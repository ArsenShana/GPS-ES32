"""Parametric CAD from public/design.json. Units: mm. CadQuery 2.7.

STL base is at print origin Z=0; lid top plate starts at Z=0 as a separate
printable part. STEP assembly positions the lid at its assembled height.
"""
import json
from pathlib import Path
import cadquery as cq

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/downloads"
design = json.loads((ROOT/"public/design.json").read_text())
b, c = design["board"], design["case"]
W,D = b["width"],b["depth"]
gap,wall = c["gap"],c["wall"]
OW,OD = W+2*(gap+wall),D+2*(gap+wall)
CX,CY = W/2,D/2

def rect_solid(width,depth,height,z=0,r=0):
    obj=cq.Workplane("XY").center(CX,CY).rect(width,depth).extrude(height).translate((0,0,z))
    if r: obj=obj.edges("|Z").fillet(r)
    return obj

def post(x,y,r,height,z=0):
    return cq.Workplane("XY").center(x,y).circle(r).extrude(height).translate((0,0,z))

base=rect_solid(OW,OD,c["height"],r=c["corner"])
inside=rect_solid(W+2*gap,D+2*gap,c["height"]+2,c["floor"],r=c["corner"]-wall)
base=base.cut(inside)

# PCB mounting posts and blind self-tapping pilots, independent of lid posts.
for x,y in b["holes"]:
    base=base.union(post(x,y,3.2,c["pcbZ"]-c["floor"],c["floor"]))
    base=base.cut(post(x,y,1.3,c["pcbZ"],c["floor"]*.5))

lid_holes=[[-3,-3],[W+3,-3],[-3,D+3],[W+3,D+3]]
for x,y in lid_holes:
    base=base.union(post(x,y,3,c["height"]-c["floor"],c["floor"]))
    base=base.cut(post(x,y,1.3,10,c["height"]-8))

# Micro-USB plug access. A generous 16 x 9 mm cut lets the plug shell enter
# the recessed DevKit port. Actual port height still needs a trial fit.
usb=cq.Workplane("XY").box(16,20,9).translate((20.7,D+gap,c["pcbZ"]+b["thickness"]+6))
base=base.cut(usb)
# Power terminal/cable entry on same end; keyed module-specific cover optional.
power=cq.Workplane("XY").box(14,20,10).translate((72.54,D+gap,12))
base=base.cut(power)
# E32 antenna access along -Y; matches module rotated 180 degrees on carrier.
sma=cq.Workplane("XZ").center(87.8,c["pcbZ"]+b["thickness"]+6.5).circle(4.2).extrude(20,both=True)
base=base.cut(sma)

lid=rect_solid(OW,OD,c["lidThickness"],r=c["corner"])
for x,y in lid_holes:lid=lid.cut(post(x,y,1.7,c["lidThickness"]+2,-1))

# Shallow identity engraving in the top face, clear of the GPS patch antenna.
try:
    text=cq.Workplane("XY").center(50,30).text("ALANATECH",5,.45,font="Arial",combine=True).translate((0,0,c["lidThickness"]-.35))
    lid=lid.cut(text)
except Exception:
    pass  # Font availability does not change the enclosure's mechanical fit.

OUT.mkdir(parents=True,exist_ok=True)
for name,obj in [("enclosure-base",base),("enclosure-lid",lid)]:
    assert obj.val().isValid(),f"Invalid CAD solid: {name}"
    assert len(obj.solids().vals())==1,f"Disconnected solids: {name}"
    cq.exporters.export(obj,str(OUT/(name+".stl")),tolerance=.08,angularTolerance=.12)
    cq.exporters.export(obj,str(OUT/(name+".step")))

assembly=cq.Assembly(name="AlanaTech_GPS_R0")
assembly.add(base,name="base",color=cq.Color(.65,.73,.63))
assembly.add(lid,name="lid",loc=cq.Location(cq.Vector(0,0,c["height"])),color=cq.Color(.8,.84,.76))
assembly.export(str(OUT/"enclosure.step"))
report={"unit":"mm","outer_dimensions":[OW,OD,c["height"]+c["lidThickness"]],
        "pcb_dimensions":[W,D,b["thickness"]],"pcb_underside_z":c["pcbZ"],
        "lid_holes":lid_holes,"pcb_holes":b["holes"],
        "base_valid":base.val().isValid(),"lid_valid":lid.val().isValid(),
        "base_solids":len(base.solids().vals()),"lid_solids":len(lid.solids().vals()),
        "base_volume_mm3":round(base.val().Volume(),2),"lid_volume_mm3":round(lid.val().Volume(),2),
        "status":"Trial print; USB, antenna and module heights require physical fit check"}
(OUT/"cad-validation.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
