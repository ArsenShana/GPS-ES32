"""Package the routed R0 carrier with a matching native KiCad schematic."""
import json, math, shutil, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'hardware/GPS-ESP32-E32'
SOURCE=ROOT/'tracker-lab/public/downloads'
NAME='GPS-ESP32-E32'
data=json.loads((ROOT/'tracker-lab/public/pcb.json').read_text())
uid=lambda s:str(uuid.uuid5(uuid.NAMESPACE_URL,NAME+'/'+s))
values={'J2':'ESP32 DevKitC left 1x19','J3':'ESP32 DevKitC right 1x19','JGPS':'NEO-6M VCC RX TX GND','JE32':'E32-433T30D M0 M1 RXD TXD AUX VCC GND','JPOWER':'5V regulated input 2A','JP1':'Remove shunt before USB','C1':'1000uF 10V','C2':'100nF 0805','R1':'330R 0805','D1':'LED 0805'}
OUT.mkdir(parents=True,exist_ok=True)
board=(SOURCE/'carrier.kicad_pcb').read_text()
r=uid('root')
text=[f'(kicad_sch (version 20231120) (generator "alanatech") (uuid {r}) (paper "A3") (lib_symbols']
placements=[]
for i,(ref,value) in enumerate(values.items()):
 pads=[p for p in data['pads'] if p['ref']==ref]
 h=(len(pads)+1)*1.27
 lib='Carrier:'+ref
 text.append(f'(symbol "{lib}" (pin_names (offset 0.5)) (in_bom yes) (on_board yes) (property "Reference" "J" (at 0 {h+3} 0) (effects (font (size 1.27 1.27)))) (property "Value" "{value}" (at 0 {-h-3} 0) (effects (font (size 1 1)))) (symbol "{ref}_0_1" (rectangle (start -8.89 {h}) (end 8.89 {-h}) (stroke (width 0.254) (type default)) (fill (type background)))) (symbol "{ref}_1_1"')
 local=[]
 for k,p in enumerate(pads):
  y=h-2.54-k*2.54
  text.append(f'(pin passive line (at -13.97 {y} 0) (length 5.08) (name "{p["name"]}" (effects (font (size 0.8 0.8)))) (number "{p["number"]}" (effects (font (size 0.8 0.8)))))')
  local.append((p,y))
 text.append('))')
 x,y=[(60,65),(145,65),(245,43),(345,47),(60,155),(145,155),(245,155),(345,155),(60,220),(145,220)][i]
 x=round(x/1.27)*1.27;y=round(y/1.27)*1.27
 placements.append((ref,value,lib,h,x,y,local))
 # Link schematic symbols to the existing routed footprints.
 marker=f'(fp_text reference "{ref}"'
 pos=board.index(marker)
 board=board[:pos]+f'(path "/{r}/{uid(ref)}")\n'+board[pos:]
text.append(')')
for ref,value,lib,h,x,y,local in placements:
 text.append(f'(symbol (lib_id "{lib}") (at {x} {y} 0) (unit 1) (in_bom yes) (on_board yes) (dnp no) (uuid {uid(ref)}) (property "Reference" "{ref}" (at {x} {y-h-3} 0) (effects (font (size 1.27 1.27)))) (property "Value" "{value}" (at {x} {y+h+3} 0) (effects (font (size 1 1))))')
 for p,_ in local:text.append(f'(pin "{p["number"]}" (uuid {uid(ref+"pin"+p["number"])}))')
 text.append(f'(instances (project "{NAME}" (path "/{r}" (reference "{ref}") (unit 1)))))')
 for p,dy in local:
  xx,yy=x-13.97,y-dy
  if p['net']:text.append(f'(label "{p["net"]}" (at {xx} {yy} 0) (effects (font (size 0.8 0.8)) (justify right bottom)) (uuid {uid(ref+"net"+p["number"])}))')
  else:text.append(f'(no_connect (at {xx} {yy}) (uuid {uid(ref+"nc"+p["number"])}))')
for i,note in enumerate(['GPS + ESP32 DevKitC V4 (38 pins) + E32-433T30D / R0 carrier','100 x 78 mm / 2 copper layers / prototype - verify module dimensions','5V regulated 2A input. Remove JP1 before USB. Fit radio antenna before power.','Pin mapping differs from tracker defaults: use firmware flags in README.txt.','Generic passive connector symbols: ERC does not validate module power or IO types.']):
 text.append(f'(text "{note}" (at 25 {12 if i==0 else 245+i*6} 0) (effects (font (size {1.5 if i==0 else 1.1} {1.5 if i==0 else 1.1})) (justify left)) (uuid {uid("note"+str(i))}))')
text.append(')')
(OUT/(NAME+'.kicad_sch')).write_text('\n'.join(text)+'\n')
(OUT/(NAME+'.kicad_pcb')).write_text(board)
(OUT/(NAME+'.kicad_pro')).write_text(json.dumps({'meta':{'filename':NAME+'.kicad_pro','version':1},'net_settings':{'classes':[{'name':'Default','clearance':0.25,'track_width':0.35,'via_diameter':0.8,'via_drill':0.4}],'version':3}},indent=2)+'\n')
for source,target in [('BOM.csv','BOM.csv'),('schematic.svg','connections.svg'),('carrier.net',NAME+'.net')]:shutil.copyfile(SOURCE/source,OUT/target)
print(OUT)
# KiCad reference designators must end in a number.
renames={'JGPS':'J4','JE32':'J5','JPOWER':'J1'}
for filename in [NAME+'.kicad_sch',NAME+'.kicad_pcb',NAME+'.net','BOM.csv','connections.svg']:
 p=OUT/filename
 s=p.read_text(encoding='utf-8-sig')
 for old,new in renames.items():s=s.replace(old,new)
 p.write_text(s)
# The top-left NPTH mounting hole may occupy the no-copper antenna area.
p=OUT/(NAME+'.kicad_pcb')
s=p.read_text().replace('(xy 4 0) (xy 36 0) (xy 36 24) (xy 4 24)', '(xy 7 0) (xy 36 0) (xy 36 24) (xy 4 24) (xy 4 7) (xy 7 7)')
# Supply the exact embedded footprints as a local library.
import re
library=OUT/'AlanaTech.pretty'
library.mkdir(exist_ok=True)
start=0
while True:
 start=s.find('(footprint ',start)
 if start<0:break
 depth=0;quoted=False;escape=False
 for end in range(start,len(s)):
  ch=s[end]
  if ch=='"' and not escape:quoted=not quoted
  if not quoted:
   if ch=='(':depth+=1
   elif ch==')':
    depth-=1
    if depth==0:break
  escape=ch=='\\' and not escape
 block=s[start:end+1]
 name=re.search(r'\(footprint "[^"]+:([^"]+)"',block)[1]
 block=re.sub(r'\(footprint "[^"]+"',f'(footprint "{name}" (version 20240108) (generator "alanatech")',block,count=1)
 block=re.sub(r'\(at [\d.]+ [\d.]+\)', '',block,count=1)
 block=re.sub(r'\(path "[^"]+"\)','',block)
 block=re.sub(r'\(net \d+ "[^"]*"\)','',block)
 (library/(name+'.kicad_mod')).write_text(block+'\n')
 start=end+1
s=s.replace('"MountingHole:M3"','"AlanaTech:M3"')
p.write_text(s)
(OUT/'fp-lib-table').write_text('(fp_lib_table (version 7) (lib (name "AlanaTech") (type "KiCad") (uri "${KIPRJMOD}/AlanaTech.pretty") (options "") (descr "R0 carrier footprints")))\n')

# Save the embedded symbol definitions as a project-local library.
s=(OUT/(NAME+'.kicad_sch')).read_text()
start=s.index('(lib_symbols')+len('(lib_symbols')
depth=1;quoted=False
for end in range(start,len(s)):
 ch=s[end]
 if ch=='"':quoted=not quoted
 if not quoted:
  if ch=='(':depth+=1
  elif ch==')':
   depth-=1
   if depth==0:break
blocks=s[start:end]
blocks=re.sub(r'\(symbol "Carrier:', '(symbol "',blocks)
(OUT/'Carrier.kicad_sym').write_text('(kicad_symbol_lib (version 20231120) (generator "alanatech")'+blocks+')\n')
(OUT/'sym-lib-table').write_text('(sym_lib_table (version 7) (lib (name "Carrier") (type "KiCad") (uri "${KIPRJMOD}/Carrier.kicad_sym") (options "") (descr "R0 connector symbols")))\n')
