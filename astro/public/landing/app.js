const $=s=>document.querySelector(s),base=$('#base'),next=$('#next'),seek=$('#seek'),play=$('#play'),blend=$('#blend');
const small=matchMedia('(max-width:800px)').matches,suffix=small?'-small':'';
if(small)$('#fixedTerrain').setAttribute('href','/landing/frames/12-small.webp');
const url=h=>`/landing/frames/${String(h).padStart(2,'0')}${suffix}.webp`;
const ready=new Set(),jobs=new Map();let loaded=0;
function load(h){if(jobs.has(h))return jobs.get(h);let job=new Promise(resolve=>{const im=new Image();im.onload=()=>{ready.add(h);loaded++;$('#loading').textContent=`Gotowe ${loaded}/24 klatek · ${small?'wersja mobilna':'pełna rozdzielczość'} · 60 s na dobę`;resolve(true)};im.onerror=()=>{jobs.delete(h);$('#loading').textContent='Nie udało się wczytać klatki. Odśwież stronę, aby spróbować ponownie.';resolve(false)};im.src=url(h)});jobs.set(h,job);return job}
let elapsed=0,last=null,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,current=-1;
const buttons=[];for(let h=0;h<24;h++){const b=document.createElement('button');b.textContent=String(h).padStart(2,'0');b.setAttribute('aria-label',`Godzina ${h}`);b.onclick=()=>{elapsed=h*2.5;render()};$('#hours').append(b);buttons.push(b)}
function setPlay(){play.textContent=playing?'Ⅱ Pauza':'▶ Odtwórz';play.setAttribute('aria-pressed',String(playing))}setPlay();
function body(id,t,start,duration,x0,x1,y0,y1){const u=Math.max(0,Math.min(1,(t-start)/duration));$(id).setAttribute('transform',`translate(${x0+(x1-x0)*u} ${y0+(y1-y0)*u})`)}
const lightKeys=[[0,[.22,.31,.47]],[4,[.28,.4,.55]],[6,[.83,.84,.77]],[8,[.98,1,1]],[12,[1,1,1]],[16,[1.03,.94,.79]],[18,[1.06,.79,.57]],[20,[.4,.45,.59]],[22,[.22,.31,.47]],[24,[.22,.31,.47]]];
const fogKeys=[[0,.32],[2,.52],[4,.78],[5.5,.9],[6.5,.72],[8.5,0],[19,0],[21,.08],[23,.2],[24,.32]];
function sample(keys,h){let k=0;while(k<keys.length-2&&h>keys[k+1][0])k++;let u=(h-keys[k][0])/(keys[k+1][0]-keys[k][0]);u=Math.max(0,Math.min(1,u));u=u*u*(3-2*u);const a=keys[k][1],b=keys[k+1][1];return Array.isArray(a)?a.map((v,j)=>v+(b[j]-v)*u):a+(b-a)*u}
function sceneLight(hour){$('#sunsetAtmosphere').setAttribute('opacity',sample([[0,0],[15,0],[17,.75],[18.3,1],[19,.85],[20,0],[24,0]],hour));const night=sample([[0,1],[4,1],[5,.4],[6,0],[18,0],[20,.45],[21,1],[24,1]],hour);$('#nightStars').setAttribute('opacity',night);document.documentElement.style.setProperty('--navAlpha',String(.75*(1-night)));document.documentElement.style.setProperty('--navColor',night>.45?'var(--white,#f5eed9)':'var(--green,#244c38)');const rgb=sample(lightKeys,hour);['R','G','B'].forEach((c,k)=>$('#lit'+c).setAttribute('slope',rgb[k]));const fog=sample(fogKeys,hour);$('#valleyFog').setAttribute('opacity',fog);$('#fogLowA').setAttribute('opacity',.9+.1*Math.sin(hour/24*Math.PI*2));$('#fogLowB').setAttribute('opacity',.9+.1*Math.cos(hour/24*Math.PI*2));
 const day=Math.max(0,Math.sin((hour-5)/15*Math.PI));$('#cloudLayer').setAttribute('opacity',.05+.18*day);$('#cloudLayer').setAttribute('transform',`translate(${Math.sin(hour/24*Math.PI*2)*22} 0)`);
 const red=Math.max(0,Math.min(1,(hour-16)/2.8));$('#sunDisc').setAttribute('fill',`rgb(255,${Math.round(204-red*125)},${Math.round(128-red*90)})`);
}
function render(){const hour=elapsed/2.5,i=Math.floor(hour)%24,j=(i+1)%24,f=hour-i;
load(i);load(j);load((j+1)%24);
if(ready.has(i)&&ready.has(j)){if(current!==i){base.src=url(i);next.src=url(j);current=i}next.style.opacity=blend.checked?f*f*(3-2*f):0}
sceneLight(hour);body('#sun',elapsed,39,10,600,850,-150,270);body('#moon',elapsed,0,8,520,740,-90,230);
const hh=String(i).padStart(2,'0'),mm=String(Math.floor((hour-i)*60)).padStart(2,'0');$('#clock').textContent=hh+':'+mm;$('#phase').textContent=i<4||i>=21?'Księżycowa noc':i<8?'Mglisty poranek':i<16?'Światło dnia':i<20?'Zachód za Tatrami':'Zmierzch';seek.value=elapsed;buttons.forEach((b,k)=>{b.classList.toggle('active',k===i);b.setAttribute('aria-pressed',String(k===i))})}
function tick(t){if(last!==null&&playing&&ready.has(Math.floor(elapsed/2.5))&&ready.has((Math.floor(elapsed/2.5)+1)%24))elapsed=(elapsed+Math.min((t-last)/1000,.2))%60;last=t;render();requestAnimationFrame(tick)}
play.onclick=()=>{playing=!playing;setPlay()};$('#restart').onclick=()=>{elapsed=0;render()};seek.oninput=()=>{elapsed=Number(seek.value);render()};blend.onchange=render;document.addEventListener('visibilitychange',()=>{last=null});
(async()=>{await Promise.all([load(0),load(1),load(2)]);render();for(let h=3;h<24;h+=3)await Promise.all([h,h+1,h+2].filter(x=>x<24).map(load))})();render();requestAnimationFrame(tick);
