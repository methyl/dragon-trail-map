#!/usr/bin/env python3
"""Replace one route with a supplied GPX, preserving other routes. No routing/snap."""
import argparse,json,xml.etree.ElementTree as ET
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('route',choices=['30k','10k']);p.add_argument('gpx',type=Path);p.add_argument('--output',type=Path,default=Path('public/data/routes.geojson'));a=p.parse_args()
root=ET.parse(a.gpx).getroot();segments=root.findall('.//{*}trkseg')
if len(segments)!=1:raise SystemExit('Expected exactly one continuous track segment; join/disambiguate deliberately first.')
coords=[]
for pt in segments[0].findall('{*}trkpt'):
 c=[float(pt.attrib['lon']),float(pt.attrib['lat'])];ele=pt.find('{*}ele')
 if ele is not None and ele.text:c.append(float(ele.text))
 coords.append(c)
if len(coords)<2:raise SystemExit('GPX requires at least two track points.')
data=json.loads(a.output.read_text()) if a.output.exists() else {'type':'FeatureCollection','features':[]}
data['features']=[f for f in data['features'] if f['properties']['id']!=a.route]
data['features'].append({'type':'Feature','properties':{'id':a.route,'source':a.gpx.name},'geometry':{'type':'LineString','coordinates':coords}})
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(f'Imported {len(coords)} points. Update corresponding GPX download and point kilometre markers together.')
