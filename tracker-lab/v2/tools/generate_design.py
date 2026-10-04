"""AT-02 V2: native schematics, component placement, netlist and 3D data.

The KiCad board is an electrically assigned placement draft. Net overlays in
the viewer are connection guides, not validated copper. No Gerbers released.
"""
import csv
import html
import json
import math
import re
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/downloads"
D=json.loads((ROOT/"public/design.json").read_text())
COMP={c["ref"]:dict(c,pins=[],pads=[]) for c in D["components"] if c["ref"]!="ANT1"}
PADS=[]

def pin(ref,num,name,net,dx,dy,w=.8,h=.8):
    c=COMP[ref]
    p=dict(ref=ref,num=str(num),name=name,net=net,x=round(c["x"]+dx,4),y=round(c["y"]+dy,4),dx=dx,dy=dy,w=w,h=h,layer=c["layer"])
    c["pads"].append(p);PADS.append(p)

def perimeter(ref,n,pitch,reach,netmap,names=None,pad_width=.3,pad_length=1.5):
    each=n//4
    for i in range(n):
        side=i//each;k=i%each;off=(k-(each-1)/2)*pitch
        if side==0: dx,dy,w,h=-reach,off,pad_length,pad_width
        elif side==1:dx,dy,w,h=off,reach,pad_width,pad_length
        elif side==2:dx,dy,w,h=reach,-off,pad_length,pad_width
        else:dx,dy,w,h=-off,-reach,pad_width,pad_length
        name=(names or {}).get(i+1,str(i+1));pin(ref,i+1,name,netmap.get(i+1,""),dx,dy,w,h)

# MCU numbers independently checked against the official KiCad STM32L072CBTx symbol.
legacy=(ROOT/"hardware/reference/MCU_ST_STM32L0.lib").read_text()
block=legacy.split("# STM32L072CBTx\n",1)[1].split("ENDDEF",1)[0]
mcu_names={int(num):name for name,num in re.findall(r'^X (\S+) (\d+) ',block,re.M)}
assert len(mcu_names)==48
MCU_NET={1:"+3V3",7:"NRST",8:"GND",9:"+3V3_A",10:"VBAT_ADC",11:"RADIO_AUX",12:"RADIO_RX",13:"RADIO_TX",14:"RADIO_M0",15:"RADIO_M1",16:"GNSS_EN",17:"GNSS_PPS",18:"RADIO_RESET",19:"MOTION_INT",23:"GND",24:"+3V3",30:"GNSS_RX",31:"GNSS_TX",32:"USB_DM",33:"USB_DP",34:"SWDIO",35:"GND",36:"+3V3",37:"SWCLK",41:"LED_DRIVE",42:"I2C_SCL",43:"I2C_SDA",44:"BOOT0",45:"CHARGE_EN1",46:"CHG_STATUS",47:"GND",48:"+3V3"}
perimeter("U1",48,.5,4.25,MCU_NET,mcu_names)

# MAX-M10S uses an 18-contact LCC body. Preliminary land dimensions and bottom
# mirroring require comparison with the recommended land pattern before fabrication.
gnss_names={1:"GND",2:"TXD",3:"RXD",4:"TIMEPULSE",5:"EXTINT",6:"V_BCKP",7:"V_IO",8:"VCC",9:"RESET_N",10:"GND",11:"RF_IN",12:"GND",13:"LNA_EN",14:"VCC_RF",15:"VIO_SEL",16:"SDA",17:"SCL",18:"SAFEBOOT_N"}
gnss_nets={1:"GND",2:"GNSS_TX",3:"GNSS_RX",4:"GNSS_PPS",6:"+3V3",7:"+3V3_GNSS",8:"+3V3_GNSS",10:"GND",11:"GNSS_RF",12:"GND"}
for i in range(18):
    num=i+1;side=i//9;k=i%9;dy=(k-4)*1.1*(1 if side==0 else -1)
    pin("U2",num,gnss_names[num],gnss_nets.get(num,""),-4.65 if side==0 else 4.65,dy,1.15,.7)

# E32-T series manual, section 3.1. Pads 9/10 and 17/18 are absent.
radio_names={1:"RESET",2:"GND",3:"NC",4:"NC",5:"NC",6:"NC",7:"NC",8:"GND",11:"GND",12:"ANT",13:"GND",14:"GND",15:"GND",16:"GND",19:"GND",20:"M0",21:"M1",22:"RXD",23:"TXD",24:"AUX",25:"VCC",26:"GND"}
radio_nets={1:"RADIO_RESET",2:"GND",8:"GND",11:"GND",13:"GND",14:"GND",15:"GND",16:"GND",19:"GND",20:"RADIO_M0",21:"RADIO_M1",22:"RADIO_RX",23:"RADIO_TX",24:"RADIO_AUX",25:"+3V3",26:"GND"}
for num in radio_names:
    if num<=8:dx,dy=-8,-11+(num-1)*1.27
    elif num in [11,12,13]:dx,dy=-8,9.06+(num-11)*1.27
    elif num>=19:dx,dy=8,-11+(26-num)*1.27
    else:dx,dy=8,9.06+(16-num)*1.27
    # Use the module's u.FL; castellated ANT pad intentionally unconnected.
    pin("U3",num,radio_names[num],radio_nets.get(num,""),dx,dy,1.3,.75)

charger_names={1:"TS",2:"BAT",3:"BAT",4:"CE",5:"EN2",6:"EN1",7:"PGOOD",8:"VSS",9:"CHG",10:"OUT",11:"OUT",12:"ILIM",13:"IN",14:"TMR",15:"ITERM",16:"ISET"}
charger_nets={1:"BAT_NTC",2:"VBAT",3:"VBAT",4:"GND",5:"GND",6:"CHARGE_EN1",8:"GND",9:"CHG_STATUS",10:"VSYS",11:"VSYS",12:"CHG_ILIM",13:"VBUS",14:"CHG_TMR",15:"CHG_ITERM",16:"CHG_ISET"}
perimeter("U4",16,.5,1.45,charger_nets,charger_names,.25,.6);pin("U4",17,"EP","GND",0,0,1.7,1.7)

reg_names={1:"VOUT",2:"L2",3:"PGND",4:"L1",5:"VIN",6:"EN",7:"PS_SYNC",8:"VINA",9:"GND",10:"FB"}
reg_nets={1:"+3V3",2:"SW_L2",3:"GND",4:"SW_L1",5:"VSYS",6:"VSYS",7:"GND",8:"VSYS",9:"GND",10:"+3V3"}
for i in range(10):
    num=i+1;side=i//5;k=i%5
    pin("U5",num,reg_names[num],reg_nets[num],-1.15 if side==0 else 1.15,(k-2)*.5*(1 if side==0 else -1),.6,.3)
pin("U5",11,"EP","GND",0,0,1.25,1.5)

motion_names={1:"SCL",2:"CS",3:"SDO_SA0",4:"SDA",5:"NC",6:"GND",7:"RES",8:"GND",9:"VDD",10:"VDD_IO",11:"INT2",12:"INT1"}
motion_nets={1:"I2C_SCL",2:"+3V3",3:"GND",4:"I2C_SDA",6:"GND",7:"GND",8:"GND",9:"+3V3",10:"+3V3",12:"MOTION_INT"}
perimeter("U6",12,.5,1.0,motion_nets,motion_names,.25,.35)
switch_names={1:"VIN",2:"GND",3:"ON",4:"QOD",5:"NC",6:"VOUT"}
switch_nets={1:"+3V3",2:"GND",3:"GNSS_EN",4:"GNSS_QOD",6:"+3V3_GNSS"}
for i in range(6):
    num=i+1;side=i//3;k=i%3;pin("U7",num,switch_names[num],switch_nets.get(num,""),-.95 if side==0 else .95,(k-1)*.65*(1 if side==0 else -1),.6,.35)

# USB footprint represents a 16-contact USB2 receptacle; selection and shell
# locating pegs need to be locked to a particular MPN in the release BOM.
usb_pins=[("A1","GND"),("A4","VBUS"),("A5","USB_CC1"),("A6","USB_DP_CONN"),("A7","USB_DM_CONN"),("A8",""),("A9","VBUS"),("A12","GND"),("B1","GND"),("B4","VBUS"),("B5","USB_CC2"),("B6","USB_DP_CONN"),("B7","USB_DM_CONN"),("B8",""),("B9","VBUS"),("B12","GND")]
for i,(num,net) in enumerate(usb_pins):pin("J1",num,num,net,(i-7.5)*.5,-2.8,.28,1.2)
for i,(dx,dy) in enumerate([(-4.6,-1.5),(4.6,-1.5),(-4.6,2),(4.6,2)]):pin("J1","S"+str(i+1),"SHIELD","GND",dx,dy,1.3,1.5)
for i,net in enumerate(["VBAT","GND","BAT_NTC"]):pin("J2",i+1,net,net,(i-1)*1.25,0,.7,1.5)
pin("J3",1,"RF","GNSS_RF",0,0,.7,.7)
pin("J3",2,"GND","GND",-1.25,0,1,2.5);pin("J3",3,"GND","GND",1.25,0,1,2.5)
pin("L1",1,"L1","SW_L1",-1,0,1.2,2.7);pin("L1",2,"L2","SW_L2",1,0,1.2,2.7)
for ref,net in [("SW1","BOOT0"),("SW2","NRST")]:
    pin(ref,1,net,net,-1.5,0,.8,1.2);pin(ref,2,"3V3" if ref=="SW1" else "GND","+3V3" if ref=="SW1" else "GND",1.5,0,.8,1.2)

def two(ref,value,x,y,net1,net2,kind="resistor",layer="F.Cu",width=1.6,depth=.8,height=.6):
    COMP[ref]=dict(ref=ref,id=ref,name=value,type=kind,x=x,y=y,width=width,depth=depth,height=height,layer=layer,zone="power" if y>30 else "control",description=value,pads=[])
    pitch=.8 if width<2 else width*.4
    pin(ref,1,"1",net1,-pitch,0,.8 if width<2 else 1.2,depth+.1);pin(ref,2,"2",net2,pitch,0,.8 if width<2 else 1.2,depth+.1)

passives=[
 ("R1","5.1k / CC1",6,35,"USB_CC1","GND"),("R2","5.1k / CC2",6,37.5,"USB_CC2","GND"),
 ("R3","22R / USB D+",18,29,"USB_DP_CONN","USB_DP"),("R4","22R / USB D-",18,31,"USB_DM_CONN","USB_DM"),
 ("R5","10k / BOOT0",40,34,"BOOT0","GND"),("R6","10k / NRST",44,31,"NRST","+3V3"),
 ("R7","1M / battery divider",25,8,"VBAT","VBAT_ADC"),("R8","330k / battery divider",25,10.5,"VBAT_ADC","GND"),
 ("R9","10k / I2C SCL",36,9,"I2C_SCL","+3V3"),("R10","10k / I2C SDA",36,11.5,"I2C_SDA","+3V3"),
 ("R11","330R / LED",42,28,"LED_DRIVE","LED_A"),("R12","100k / EN1 default",23,39,"CHARGE_EN1","GND"),
 ("R13","2.94k / ISET 300mA target",23,31,"CHG_ISET","GND"),("R14","3.24k / ILIM",19.5,37.5,"CHG_ILIM","GND"),
 ("R15","46.4k / safety timer",26,37.5,"CHG_TMR","GND"),("R16","1k / ITERM",26,31,"CHG_ITERM","GND"),
 ("R17","10k / CHG pullup",28,6,"CHG_STATUS","+3V3"),("R18","100R / GNSS QOD",19,24.5,"GNSS_QOD","+3V3_GNSS"),
 ("R19","10k / radio reset pullup",44,18,"RADIO_RESET","+3V3"),
 ("R20","100k / M0 pulldown",44,20.5,"RADIO_M0","GND"),("R21","100k / M1 pulldown",44,23,"RADIO_M1","GND")]
for row in passives:two(*row)
caps=[
 ("C1","100nF / VDD1",24.5,16.5,"+3V3","GND"),("C2","100nF / VDD24",30,25,"+3V3","GND"),
 ("C3","100nF / VDD48",32,11,"+3V3","GND"),("C4","100nF / USB VDD",38,18,"+3V3","GND"),
 ("C5","100nF / VDDA",25,18.5,"+3V3_A","GND"),("C6","4.7uF / MCU",28,27,"+3V3","GND"),
 ("C7","100nF / reset",46,28,"NRST","GND"),("C8","100nF / ADC",25,13,"VBAT_ADC","GND"),
 ("C9","1uF / GNSS VIO",9,19,"+3V3_GNSS","GND","B.Cu"),
 ("C10","10uF / GNSS VCC",19,19,"+3V3_GNSS","GND","B.Cu"),
 ("C11","1uF / GNSS backup",19,7,"+3V3","GND","B.Cu"),
 ("C12","100nF / motion",40,7,"+3V3","GND"),("C13","10uF / motion",42.5,13,"+3V3","GND"),
 ("C14","10uF / USB IN",17,35,"VBUS","GND"),("C15","10uF / battery",33,7,"VBAT","GND"),
 ("C16","22uF / VSYS",28,34,"VSYS","GND"),("C17","10uF / buck-boost IN",31,38.5,"VSYS","GND"),
 ("C18","22uF / buck-boost OUT",36,39,"+3V3","GND"),("C19","22uF / buck-boost OUT",36,41.5,"+3V3","GND"),
 ("C20","100uF / radio buffer",60,37,"+3V3","GND"),("C21","100nF / radio",62.5,8,"+3V3","GND")]
for row in caps:
    ref,value,x,y,a,b,*layer=row
    size=3.2 if ref=="C20" else 1.6
    two(ref,value,x,y,a,b,"capacitor",layer[0] if layer else "F.Cu",size,1.6 if size>2 else .8,1.4 if size>2 else .6)
two("FB1","Ferrite / analog supply",25,21,"+3V3","+3V3_A","resistor")
two("D1","Green LED / status",42,25,"LED_A","GND","led")

# USBLC6-2SC6, SOT23-6: 1/6 I/O1, 3/4 I/O2, 2 GND, 5 VBUS.
COMP["U8"]=dict(ref="U8",id="usb-esd",name="USBLC6-2SC6 / ESD",type="sot",x=15,y=32.5,width=2.9,depth=1.3,height=1,layer="F.Cu",zone="power",description="USB ESD protection",pads=[])
for num,net in {1:"USB_DP_CONN",2:"GND",3:"USB_DM_CONN",4:"USB_DM_CONN",5:"VBUS",6:"USB_DP_CONN"}.items():
    side=(num-1)//3;k=(num-1)%3;pin("U8",num,str(num),net,-1.15 if side==0 else 1.15,(k-1)*.95*(1 if side==0 else -1),.7,.5)

# SWD and production-test pads sit on the underside; no tall development headers.
COMP["J4"]=dict(ref="J4",id="swd",name="SWD / pogo",type="test",x=34,y=8,width=11,depth=2,height=.05,layer="B.Cu",zone="control",description="VTref, SWDIO, SWCLK, NRST, GND",pads=[])
for i,net in enumerate(["+3V3","SWDIO","SWCLK","NRST","GND"]):pin("J4",i+1,net,net,(i-2)*2.54,0,1.3,1.3)

NETS=sorted({p["net"] for p in PADS if p["net"]})
GUIDES=[]
for net in NETS:
    if net in ["GND","+3V3","+3V3_A","+3V3_GNSS","VSYS","VBAT","VBUS"]:continue
    pads=[p for p in PADS if p["net"]==net]
    for a,b in zip(pads,pads[1:]):
        GUIDES.append(dict(net=net,fromRef=a["ref"],toRef=b["ref"],points=[[a["x"],a["y"]],[b["x"],b["y"]]],fromLayer=a["layer"],toLayer=b["layer"],kind="connection-guide"))

def uid(name):return str(uuid.uuid5(uuid.NAMESPACE_URL,"alanatech-v2/"+name))

def write_board():
    ids={net:i+1 for i,net in enumerate(NETS)}
    text=['(kicad_pcb (version 20240108) (generator "alanatech-code")',
      '(general (thickness 1.2)) (paper "A4")',
      '(layers (0 "F.Cu" signal) (1 "In1.Cu" power) (2 "In2.Cu" power) (31 "B.Cu" signal) (34 "B.Paste" user) (35 "F.Paste" user) (36 "B.SilkS" user) (37 "F.SilkS" user) (38 "B.Mask" user) (39 "F.Mask" user) (44 "Edge.Cuts" user) (48 "B.Fab" user) (49 "F.Fab" user))',
      '(setup (pad_to_mask_clearance 0.05)) (net 0 "")']
    text += [f'(net {i} "{net}")' for net,i in ids.items()]
    for c in COMP.values():
        layer=c["layer"];silk="F.SilkS" if layer=="F.Cu" else "B.SilkS";fab="F.Fab" if layer=="F.Cu" else "B.Fab";mask="F.Mask" if layer=="F.Cu" else "B.Mask";paste="F.Paste" if layer=="F.Cu" else "B.Paste"
        name=c["name"].replace('"','')
        text.append(f'(footprint "AT02:{c["ref"]}" (layer "{layer}") (at {c["x"]} {c["y"]}) (attr smd)')
        text.append(f'(fp_text reference "{c["ref"]}" (at 0 {-c["depth"]/2-1}) (layer "{silk}") (effects (font (size 0.6 0.6) (thickness 0.1))))')
        text.append(f'(fp_text value "{name}" (at 0 {c["depth"]/2+1}) (layer "{fab}") (effects (font (size 0.5 0.5) (thickness 0.08))))')
        text.append(f'(fp_rect (start {-c["width"]/2} {-c["depth"]/2}) (end {c["width"]/2} {c["depth"]/2}) (stroke (width 0.1) (type solid)) (fill none) (layer "{fab}"))')
        for p in c["pads"]:
            text.append(f'(pad "{p["num"]}" smd roundrect (at {p["dx"]} {p["dy"]}) (size {p["w"]} {p["h"]}) (layers "{layer}" "{mask}" "{paste}") (roundrect_rratio 0.2) (net {ids.get(p["net"],0)} "{p["net"]}"))')
        text.append(')')
    for i,(x,y) in enumerate(D["board"]["holes"]):
        text.append(f'(footprint "AT02:M2" (layer "F.Cu") (at {x} {y}) (pad "" np_thru_hole circle (at 0 0) (size 2.4 2.4) (drill 2.4) (layers "*.Cu" "*.Mask")))')
    # Rounded outline: four lines, four three-point arcs, radius 3 mm.
    w,h,r=D["board"]["width"],D["board"]["depth"],D["board"]["corner"]
    for a,b in [((r,0),(w-r,0)),((w,r),(w,h-r)),((w-r,h),(r,h)),((0,h-r),(0,r))]:
        text.append(f'(gr_line (start {a[0]} {a[1]}) (end {b[0]} {b[1]}) (stroke (width 0.05) (type solid)) (layer "Edge.Cuts"))')
    k=r/math.sqrt(2)
    for a,m,b in [((w-r,0),(w-r+k,r-k),(w,r)),((w,h-r),(w-r+k,h-r+k),(w-r,h)),((r,h),(r-k,h-r+k),(0,h-r)),((0,r),(r-k,r-k),(r,0))]:
        text.append(f'(gr_arc (start {a[0]} {a[1]}) (mid {m[0]} {m[1]}) (end {b[0]} {b[1]}) (stroke (width 0.05) (type solid)) (layer "Edge.Cuts"))')
    text.append('(gr_text "ALANATECH AT-02 / V2 A0" (at 39 3) (layer "F.SilkS") (effects (font (size 0.8 0.8) (thickness 0.13))))')
    text.append('(gr_text "PLACEMENT DRAFT - ROUTING PENDING" (at 34 42) (layer "B.SilkS") (effects (font (size 0.7 0.7) (thickness 0.1)) (justify mirror)))')
    text.append(')');(OUT/"AT-02-V2.kicad_pcb").write_text("\n".join(text)+"\n")
    netlist=['(export (version "D") (design (source "AT-02-V2.kicad_sch")) (components']
    netlist += [f'(comp (ref {c["ref"]}) (value "{c["name"]}"))' for c in COMP.values()]
    netlist.append(') (nets')
    for net,i in ids.items():
        nodes=' '.join(f'(node (ref {p["ref"]}) (pin "{p["num"]}"))' for p in PADS if p["net"]==net)
        netlist.append(f'(net (code {i}) (name "{net}") {nodes})')
    netlist.append('))');(OUT/"AT-02-V2.net").write_text("\n".join(netlist)+"\n")

def write_schematic():
    """Native, self-contained schematic: generic package blocks with named net labels.
    Symbols use the exact numbered pins from our pin manifest, not loose text.
    """
    root_uuid=uid("schematic")
    text=[f'(kicad_sch (version 20231120) (generator "alanatech-code") (uuid {root_uuid}) (paper "A0") (lib_symbols']
    placements=[]
    for index,c in enumerate(COMP.values()):
        ref=c["ref"];name=c["name"].replace('"','');pads=c["pads"];n=len(pads);rows=math.ceil(n/2)
        hh=max(5,(rows+1)*1.27);libid="AT02:"+ref
        text.append(f'(symbol "{libid}" (pin_names (offset 0.5)) (in_bom yes) (on_board yes) (property "Reference" "U" (at 0 {hh+2} 0) (effects (font (size 1.27 1.27)))) (property "Value" "{name}" (at 0 {-hh-2} 0) (effects (font (size 1.27 1.27))))')
        text.append(f'(symbol "{ref}_0_1" (rectangle (start -10 {hh}) (end 10 {-hh}) (stroke (width 0.254) (type default)) (fill (type background))))')
        text.append(f'(symbol "{ref}_1_1"')
        local=[]
        for i,p in enumerate(pads):
            side=i//rows;k=i%rows;y=hh-2.54-k*2.54;x=-15.08 if side==0 else 15.08;angle=0 if side==0 else 180
            # Generic passive pin types deliberately avoid pretending a checked
            # manufacturer's symbol library; ERC pin-type review remains pending.
            text.append(f'(pin passive line (at {x} {y} {angle}) (length 5.08) (name "{p["name"]}" (effects (font (size 0.8 0.8)))) (number "{p["num"]}" (effects (font (size 0.8 0.8)))))')
            local.append((p,x,y))
        text.append('))');placements.append((c,local,hh,libid,index))
    text.append(')')
    for c,local,hh,libid,index in placements:
        # A0 page, 7 columns. Wide spacing accommodates net labels and LQFP pins.
        x=55+(index%8)*145;y=55+(index//8)*110
        ref=c["ref"];name=c["name"].replace('"','');sid=uid(ref)
        text.append(f'(symbol (lib_id "{libid}") (at {x} {y} 0) (unit 1) (in_bom yes) (on_board yes) (dnp no) (uuid {sid}) (property "Reference" "{ref}" (at {x} {y-hh-3} 0) (effects (font (size 1.27 1.27)))) (property "Value" "{name}" (at {x} {y+hh+3} 0) (effects (font (size 1.0 1.0))))')
        for p,_,_ in local:text.append(f'(pin "{p["num"]}" (uuid {uid(ref+"-pin-"+p["num"])}))')
        text.append(f'(instances (project "AT-02-V2" (path "/{root_uuid}" (reference "{ref}") (unit 1)))))')
        for p,dx,dy in local:
            xx,yy=x+dx,y-dy
            if p["net"]:
                angle=0 if dx<0 else 180
                text.append(f'(label "{p["net"]}" (at {xx} {yy} {angle}) (effects (font (size 0.8 0.8)) (justify {"right" if dx<0 else "left"} bottom)) (uuid {uid(ref+"-label-"+p["num"])}))')
            else:text.append(f'(no_connect (at {xx} {yy}) (uuid {uid(ref+"-nc-"+p["num"])}))')
    text.append('(text "AT-02 V2 A0 - CONNECTIVITY DRAFT / Verify package lands, RF, ERC pin types and complete routing before release" (at 150 18 0) (effects (font (size 2 2)) (justify left)) (uuid '+uid("title")+'))')
    text.append(')');(OUT/"AT-02-V2.kicad_sch").write_text("\n".join(text)+"\n")

def write_architecture():
    colors={"control":"#82aaff","gnss":"#63d8b5","radio":"#d9bb72","power":"#f3a77e"}
    blocks=[(55,75,260,90,"MAX-M10S / GNSS","UART1 + PPS / отключаемое питание","gnss"),
      (405,75,275,160,"STM32L072CBT6","Cortex-M0+ / C + CMSIS / SWD","control"),
      (770,75,260,90,"E32-433T20S","UART2 / AUX / RESET / 433 MHz","radio"),
      (440,275,205,75,"LIS2DW12","I²C + INT1 / пробуждение","control"),
      (55,445,220,85,"USB-C / LiPo 1S","5 В / 3.7 В / NTC","power"),
      (360,445,260,85,"BQ24074 / PowerPath","зарядка + питание устройства","power"),
      (705,445,325,85,"TPS63031 / 3.3 В","buck-boost / шина питания","power")]
    parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="620" viewBox="0 0 1100 620"><rect width="1100" height="620" rx="12" fill="#10191b"/><g font-family="Arial, sans-serif"><text x="55" y="38" fill="#eaf2ea" font-size="21">ALANATECH AT-02 / СОБСТВЕННАЯ АРХИТЕКТУРА V2</text>']
    for x,y,w,h,title,subtitle,zone in blocks:
        color=colors[zone];parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="#172429" stroke="{color}" stroke-opacity=".55"/><text x="{x+18}" y="{y+31}" fill="{color}" font-size="16">{html.escape(title)}</text><text x="{x+18}" y="{y+55}" fill="#a6b8b4" font-size="10">{html.escape(subtitle)}</text>')
    for path,color in [('M315 120H405','#63d8b5'),('M680 120H770','#d9bb72'),('M542 235V275','#82aaff'),('M275 488H360','#f3a77e'),('M620 488H705','#f3a77e'),('M862 445V380H542V350','#82aaff'),('M542 380H190V165','#63d8b5'),('M862 380H900V165','#d9bb72')]:parts.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="2"/>')
    parts.append('<text x="55" y="582" fill="#8aa09a" font-size="12">Без DevKit, без USB–UART, без Arduino. SMD-компоненты припаяны на единую четырёхслойную PCB.</text></g></svg>')
    (OUT/"architecture.svg").write_text(''.join(parts))

def generate():
    OUT.mkdir(parents=True,exist_ok=True)
    components=list(COMP.values())
    (ROOT/"public/board.json").write_text(json.dumps(dict(components=components,pads=PADS,nets=NETS,guides=GUIDES,status="PLACEMENT DRAFT / copper routing not released"),indent=2)+"\n")
    write_board();write_schematic();write_architecture()
    with (OUT/"BOM-V2.csv").open("w",newline="",encoding="utf-8-sig") as f:
        writer=csv.writer(f);writer.writerow(["Ref","Value","Layer","X mm","Y mm","Status"])
        for c in components:writer.writerow([c["ref"],c["name"],c["layer"],c["x"],c["y"],"Selection/land pattern verification required"])
        writer.writerow(["ANT1","GNSS patch 18x18 - MPN and matching pending","F.Cu",14,13,"RF validation required"])
        writer.writerow(["BAT1","Protected LiPo 1S + NTC / 50x30x6 max","Off-board",9,7,"Capacity chosen after current measurement"])
    report=dict(version="V2 A0",components=len(components),pads=len(PADS),nets=len(NETS),board_dimensions_mm=[68,44,1.2],area_reduction_vs_R0_percent=round((1-68*44/(100*78))*100,1),
                state="Architecture + numbered-pin schematic + placement. No validated copper routing.",
                release_blockers=["Finalize PCB routing and stackup","Verify non-MCU land patterns against recommended manufacturer footprints","Choose exact USB-C connector and GNSS antenna","Review charge settings, NTC and input-current negotiation","Compute RF impedance and inspect RF/power layout","Run KiCad ERC/DRC and physical prototype tests"])
    (OUT/"design-status.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))

if __name__=="__main__":generate()
