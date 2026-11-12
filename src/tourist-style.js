// Independent tourist treatment of the open Liberty style, not Mapy.com assets.
export function touristStyle(base) {
 const style=structuredClone(base);
 style.name='Dragon Trail · turystyczna';
 const layer=id=>style.layers.find(l=>l.id===id);
 const paint=(id,p)=>{const l=layer(id);if(l)Object.assign(l.paint??={},p);};
 paint('background',{'background-color':'#f4f0e5'});
 paint('landcover_wood',{'fill-color':'#b6d3a0','fill-opacity':0.82});
 paint('landcover_grass',{'fill-color':'#dce5bd','fill-opacity':0.72});
 paint('landuse_residential',{'fill-color':'#eee7dc'});
 paint('park',{'fill-color':'#c7dcad','fill-opacity':0.55,'fill-outline-color':'#b2c99d'});
 paint('park_outline',{'line-color':'#b0c59e','line-opacity':0.4});
 paint('water',{'fill-color':'#a5d2df'});
 paint('landcover_sand',{'fill-color':'#eadcb4'});
 paint('building',{'fill-color':'#d6cbbb','fill-outline-color':'#bcb1a3'});
 const widths=(a,b,c)=>['interpolate',['linear'],['zoom'],11,a,14,b,18,c];
 for(const l of style.layers){
  if(l.id.startsWith('waterway_')&&l.type==='line')Object.assign(l.paint,{'line-color':'#82b9cf'});
  if(l.type==='line'&&/path_pedestrian/.test(l.id)&&!l.id.endsWith('casing')){
   l.minzoom=11;Object.assign(l.paint,{'line-color':'#927c64','line-width':widths(0.7,1.25,2),'line-dasharray':[2,1.6]});
  }
  if(l.type==='line'&&/service_track/.test(l.id)){
   l.minzoom=11;
   Object.assign(l.paint,{'line-color':l.id.endsWith('casing')?'#b5a993':'#faf7ee','line-width':l.id.endsWith('casing')?widths(1.2,2.8,6):widths(0.65,1.6,4.5)});
  }
  if(l.type==='line'&&/_minor/.test(l.id)){
   l.minzoom=11;Object.assign(l.paint,{'line-width':l.id.endsWith('casing')?widths(1.4,3.3,9):widths(0.8,2.1,7)});
  }
  if(l.type==='symbol'&&l.layout?.['text-field']&&!(l.id.includes('shield')||l.id.includes('one_way'))){
   l.layout['text-field']=['coalesce',['get','name:pl'],['get','name:latin'],['get','name'],''];
   if(l.paint){l.paint['text-halo-color']='#fffdf6';l.paint['text-halo-width']=1.2;}
  }
 }
 if(layer('highway-name-minor'))layer('highway-name-minor').minzoom=14;
 if(layer('highway-name-path'))layer('highway-name-path').minzoom=14;
 style.sources['tourist-dem']={type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain Tiles © Mapzen / AWS Open Data'};
 const firstRoad=style.layers.findIndex(l=>l.id.startsWith('tunnel_')||l.id.startsWith('road_'));
 style.layers.splice(firstRoad<0?1:firstRoad,0,{id:'tourist-hillshade',type:'hillshade',source:'tourist-dem',minzoom:9,layout:{visibility:'none'},paint:{'hillshade-exaggeration':0.25,'hillshade-shadow-color':'#625f4d','hillshade-highlight-color':'#fffdf6','hillshade-accent-color':'#8f8a72'}});
 return style;
}
