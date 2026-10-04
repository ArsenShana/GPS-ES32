"""AT-02 V2 trial enclosure; CadQuery 2.7, millimetres."""
import json
from pathlib import Path
import cadquery as cq

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/downloads"
d=json.loads((ROOT/"public/design.json").read_text());b,c=d["board"],d["case"]
W,H=b["width"],b["depth"];OW,OH=W+2*(c["gap"]+c["wall"]),H+2*(c["gap"]+c["wall"])
def rectangle(w,h,z,z0=0,r=0):
    obj=cq.Workplane("XY").center(W/2,H/2).rect(w,h).extrude(z).translate((0,0,z0))
    return obj.edges("|Z").fillet(r) if r else obj
def cylinder(x,y,r,h,z=0):return cq.Workplane("XY").center(x,y).circle(r).extrude(h).translate((0,0,z))
base=rectangle(OW,OH,c["height"],r=5).cut(rectangle(W+2*c["gap"],H+2*c["gap"],c["height"]+2,c["floor"],2.6))
for x,y in b["holes"]:
    base=base.union(cylinder(x,y,2.4,c["pcbZ"]-c["floor"],c["floor"]))
    base=base.cut(cylinder(x,y,.85,c["pcbZ"],1.2))
lid_holes=[[-1,-1],[W+1,-1],[-1,H+1],[W+1,H+1]]
for x,y in lid_holes:
    base=base.union(cylinder(x,y,2.2,c["height"]-c["floor"],c["floor"]))
    base=base.cut(cylinder(x,y,.85,9,c["height"]-7))
# USB-C and cable slot. Port heights are tied to the placement manifest.
base=base.cut(cq.Workplane("XY").box(14,15,7).translate((12,H+c["gap"],c["pcbZ"]+b["thickness"]+1.6)))
base=base.cut(cq.Workplane("XY").box(15,6,3).translate((W+c["gap"],29,c["pcbZ"]+b["thickness"]+1.2)))
# Low battery locating stops leave a 50 x 30 mm interior cell envelope.
for x in [7.8,60.2]:
    base=base.union(cq.Workplane("XY").box(1.2,16,1.2).translate((x,22,c["floor"]+.6)))
lid=rectangle(OW,OH,c["lidThickness"],r=5)
for x,y in lid_holes:lid=lid.cut(cylinder(x,y,1.2,c["lidThickness"]+2,-1))
try:lid=lid.cut(cq.Workplane("XY").center(W/2,H/2).text("ALANATECH",4,.4,font="Arial").translate((0,0,c["lidThickness"]-.3)))
except Exception:pass
for name,obj in [("enclosure-base",base),("enclosure-lid",lid)]:
    assert obj.val().isValid() and len(obj.solids().vals())==1
    cq.exporters.export(obj,str(OUT/(name+".stl")),tolerance=.08,angularTolerance=.12)
    cq.exporters.export(obj,str(OUT/(name+".step")))
assembly=cq.Assembly(name="AlanaTech_AT02_V2")
assembly.add(base,name="base",color=cq.Color(.55,.65,.6));assembly.add(lid,name="lid",loc=cq.Location(cq.Vector(0,0,c["height"])),color=cq.Color(.65,.74,.69));assembly.export(str(OUT/"enclosure.step"))
report=dict(version="V2 A0",units="mm",outer_dimensions=[OW,OH,c["height"]+c["lidThickness"]],base_valid=base.val().isValid(),lid_valid=lid.val().isValid(),base_solids=len(base.solids().vals()),lid_solids=len(lid.solids().vals()),battery_to_GNSS_clearance_mm=round(c["pcbZ"]-2.5-(c["floor"]+d["battery"]["height"]),2),status="Trial print; connector, antenna and battery envelope verification pending")
(OUT/"cad-status.json").write_text(json.dumps(report,indent=2)+"\n");print(json.dumps(report,indent=2))
