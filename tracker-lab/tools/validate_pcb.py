"""Independent connectivity and copper clearance checks. Not a KiCad DRC substitute."""
import json
import math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
pcb=json.loads((ROOT/"public/pcb.json").read_text())
clearance=pcb["clearance"]

def distance(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    if dx==dy==0:return math.dist(p,a)
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)

def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def seg_distance(a,b,c,d):
    if cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0:return 0
    return min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))

segments=[dict(net=t["net"],layer=t["layer"],width=t["width"],a=a,b=b) for t in pcb["traces"] for a,b in zip(t["points"],t["points"][1:])]
violations=[]
minimum=100
for i,a in enumerate(segments):
    for b in segments[i+1:]:
        if a["net"]==b["net"] or a["layer"]!=b["layer"]:continue
        gap=seg_distance(a["a"],a["b"],b["a"],b["b"])-(a["width"]+b["width"])/2
        minimum=min(minimum,gap)
        if gap<clearance-1e-6:violations.append(["trace/trace",a["net"],b["net"],round(gap,4)])
    for pad in pcb["pads"]:
        if a["net"]==pad["net"] or (not pad["drill"] and a["layer"]!="F.Cu"):continue
        gap=distance((pad["x"],pad["y"]),a["a"],a["b"])-pad["size"]/2-a["width"]/2
        minimum=min(minimum,gap)
        if gap<clearance-1e-6:violations.append(["trace/pad",a["net"],pad["ref"]+"."+pad["number"],round(gap,4)])
    for via in pcb["vias"]:
        if a["net"]==via["net"]:continue
        gap=distance((via["x"],via["y"]),a["a"],a["b"])-.4-a["width"]/2
        if gap<clearance-1e-6:violations.append(["trace/via",a["net"],via["net"],round(gap,4)])

# Electrical graph checks include T intersections, pads and plated vias.
unconnected=[]
for net in pcb["nets"]:
    pads=[p for p in pcb["pads"] if p["net"]==net]
    traces=[s for s in segments if s["net"]==net]
    nodes=[("pad",p) for p in pads]+[("trace",s) for s in traces]+[("via",v) for v in pcb["vias"] if v["net"]==net]
    adj=[set() for _ in nodes]
    for i,(ki,a) in enumerate(nodes):
        for j in range(i+1,len(nodes)):
            kj,b=nodes[j];join=False
            if ki==kj=="trace":join=a["layer"]==b["layer"] and seg_distance(a["a"],a["b"],b["a"],b["b"])<1e-6
            elif ki=="trace" or kj=="trace":
                s,p=(a,b) if ki=="trace" else (b,a)
                pk=kj if ki=="trace" else ki
                join=(pk=="via" or p["drill"] or s["layer"]=="F.Cu") and distance((p["x"],p["y"]),s["a"],s["b"])<(.4 if pk=="via" else p["size"]/2)
            if join:adj[i].add(j);adj[j].add(i)
    seen={0};pending=[0]
    while pending:
        for j in adj[pending.pop()]-seen:seen.add(j);pending.append(j)
    for i,p in enumerate(pads):
        if i not in seen:unconnected.append(p["ref"]+"."+p["number"])

report={"check":"Independent geometry and electrical graph; KiCad DRC/ERC still required", "nets":len(pcb["nets"]),"pads":len(pcb["pads"]),"segments":len(segments),"vias":len(pcb["vias"]),"required_clearance_mm":clearance,"minimum_trace_or_pad_gap_mm":round(minimum,4),"unconnected_pads":unconnected,"clearance_violations":violations,"passed":not violations and not unconnected}
(ROOT/"public/downloads/pcb-validation.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
if not report["passed"]:raise SystemExit(1)
