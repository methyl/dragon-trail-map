"""One-time, guarded correction of three user-reported out-and-back spurs.
Only exact reverse sequences are removed. No snapping or route inference.
Input geometry is PDF-v10 reconstruction; same spurs verified in the user's
route-10e6112a.gpx (2026-11-11). Screenshot references documented in report.
"""
import json, math, pathlib, xml.etree.ElementTree as ET
P=pathlib.Path(__file__).resolve().parents[1]/'public/data'
def read(f):return json.loads((P/f).read_text())
def write(f,v):(P/f).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def km(a,b):
 p,q=map(math.radians,[a[1],b[1]]);dl=math.radians(b[0]-a[0]);dp=q-p
 h=math.sin(dp/2)**2+math.cos(p)*math.cos(q)*math.sin(dl/2)**2
 return 6371*2*math.atan2(math.sqrt(h),math.sqrt(1-h))
def chain(c):
 out=[0.]
 for a,b in zip(c,c[1:]):out.append(out[-1]+km(a,b))
 return out
routes=read('routes.geojson');f=next(f for f in routes['features'] if f['properties']['id']=='30k');old=f['geometry']['coordinates'];assert len(old)==1168,'Already fixed or different input; refusing to guess'
# Retain first junction vertex; drop the complete excursion and duplicated junction.
spurs=[('Pod Grzywacką / potok',206,209,212),('Grzywacka / B1',290,291,292),('Myscowa / Kręcisz',536,540,544)]
removed=set();oldchain=chain(old);report=[]
for name,a,tip,b in spurs:
 assert tip-a==b-tip
 for j in range(1,tip-a+1):assert km(old[tip-j],old[tip+j])*1000<.01
 removed.update(range(a+1,b+1));report.append({'place':name,'oldIndices':[a,tip,b],'junction':old[a][:2],'tip':old[tip][:2],'removedLengthM':(oldchain[b]-oldchain[a])*1000,'evidence':'Exact reverse sequence exists in original route-10e6112a.gpx and screenshot supplied by user.'})
new=[c for i,c in enumerate(old) if i not in removed];newchain=chain(new)
f['geometry']['coordinates']=new;f['properties']['distanceKm']=newchain[-1];f['properties']['geometryCorrection']='Three exact out-and-back spurs removed per user screenshots, 2026-11-12. All other coordinates unchanged.'
write('routes.geojson',routes)
profiles=read('profiles.json');pr=next(x for x in profiles if x['id']=='30k');pr['distanceKm']=newchain;pr['elevationM']=[c[2] for c in new];write('profiles.json',profiles)
# Rebase existing point chainages without moving points or inventing new anchors.
def rebase(v):
 return v-sum(max(0,min(v,oldchain[b])-oldchain[a]) for _,a,_,b in spurs)
points=read('points.geojson')
for p in points['features']:
 prop=p['properties']
 if prop.get('route')=='30k' and isinstance(prop.get('km'),(float,int)):prop['km']=rebase(prop['km'])
write('points.geojson',points)
roads=read('roads.geojson');rd=next(x for x in roads['features'] if x['properties']['id']=='30k-D3');coords=rd['geometry']['coordinates'];assert len(coords)==24 and km(coords[15],old[536])*1000<.01;rd['geometry']['coordinates']=coords[:16];rd['properties']['correction']='Removed the same Myscowa out-and-back as route 30k; terminates at original junction.';write('roads.geojson',roads)
root=ET.Element('gpx',version='1.1',creator='Dragon Trail Map',xmlns='http://www.topografix.com/GPX/1/1');trk=ET.SubElement(root,'trk');ET.SubElement(trk,'name').text='Trasa 30k';seg=ET.SubElement(trk,'trkseg')
for c in new:
 pt=ET.SubElement(seg,'trkpt',lon=str(c[0]),lat=str(c[1]));ET.SubElement(pt,'ele').text=str(c[2])
ET.ElementTree(root).write(P/'30k.gpx',encoding='utf-8',xml_declaration=True)
metadata=read('metadata.json');metadata['geometryCorrections']={'date':'2026-11-12','sourceGpx':'route-10e6112a.gpx','screenshots':['IMG_2079.png','IMG_2080.png','IMG_2081.png'],'changes':report,'current30kDistanceKm':newchain[-1],'removedVertices':len(removed),'unchanged10k':True};write('metadata.json',metadata)
write('geometry-corrections.json',metadata['geometryCorrections'])
print(json.dumps({'oldKm':oldchain[-1],'newKm':newchain[-1],'removedM':(oldchain[-1]-newchain[-1])*1000,'vertices':len(new),'changes':report},indent=2))
