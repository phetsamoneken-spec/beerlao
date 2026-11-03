import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Sprite, Text, Texture, Rectangle } from 'pixi.js';
import type { Agent, Task } from './model';
import { employeeState, seats } from './hq';
import { useI18n } from './i18n';
import { Minus, Plus, Move, RotateCcw } from 'lucide-react';

type P={x:number;y:number};
const iso=(x:number,y:number,z=0):P=>({x:450+(x-y)*35,y:105+(x+y)*17.5-z});
const hex=(s:string)=>parseInt(s.replace('#',''),16);
function polygon(g:Graphics,p:P[],color:number,alpha=1){g.poly(p.flatMap(p=>[Math.round(p.x),Math.round(p.y)])).fill({color,alpha});}
function box(g:Graphics,x:number,y:number,w:number,d:number,h:number,top:number,left:number,right:number,z=0){
 const a=iso(x,y,z),b=iso(x+w,y,z),c=iso(x+w,y+d,z),e=iso(x,y+d,z);const up=(p:P)=>({x:p.x,y:p.y-h});
 polygon(g,[e,c,up(c),up(e)],left);polygon(g,[b,c,up(c),up(b)],right);polygon(g,[up(a),up(b),up(c),up(e)],top);
}
function pixelCharacter(color:string,ceo:boolean,avatar:string){
 const c=document.createElement('canvas');c.width=24;c.height=36;const ctx=c.getContext('2d')!;ctx.imageSmoothingEnabled=false;
 const r=(x:number,y:number,w:number,h:number,fill:string)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);};
 r(6,33,5,3,'#131729');r(14,33,5,3,'#131729');r(7,25,4,8,'#2e3651');r(14,25,4,8,'#2e3651');
 r(5,16,15,12,ceo?'#574177':color);r(3,18,3,9,ceo?'#574177':color);r(20,18,3,9,ceo?'#574177':color);r(3,26,3,3,'#e9ae88');r(20,26,3,3,'#e9ae88');
 r(8,5,11,12,ceo?'#edbe9c':avatar==='robot'?'#d7e1ec':'#e9ae88');r(6,7,3,8,ceo?'#edbe9c':avatar==='robot'?'#d7e1ec':'#e9ae88');
 r(7,2,12,5,ceo?'#dedbea':avatar==='orb'?'#6e4763':'#343047');r(5,5,3,5,ceo?'#dedbea':'#343047');r(18,5,3,5,ceo?'#dedbea':'#343047');
 if(avatar==='robot'&&!ceo){r(8,8,11,6,'#28364d');r(9,10,2,2,'#80ddf7');r(15,10,2,2,'#80ddf7');r(12,0,2,3,color);}
 else {r(9,9,2,2,'#30293e');r(15,9,2,2,'#30293e');r(11,14,4,1,'#a46169');}
 if(ceo){r(7,8,6,5,'#343249');r(14,8,6,5,'#343249');r(9,9,3,2,'#9cb5cf');r(15,9,3,2,'#9cb5cf');r(12,9,2,1,'#343249');r(11,17,4,3,'#f5e7cf');r(12,20,2,6,'#e8bb76');}
 const t=Texture.from(c);t.source.scaleMode='nearest';return t;
}
function plant(g:Graphics,x:number,y:number){box(g,x,y,.48,.48,17,0xb68073,0x775466,0x5b465b);const p=iso(x+.24,y+.24,23);g.rect(p.x-2,p.y-13,4,17).fill(0x4c856e);g.rect(p.x-11,p.y-13,10,7).fill(0x7cbd8a);g.rect(p.x+1,p.y-20,11,8).fill(0x659f83);g.rect(p.x-5,p.y-26,10,9).fill(0x9bc68c);}
function screen(g:Graphics,x:number,y:number,color:number){const p=iso(x,y,41);g.rect(p.x-18,p.y-23,36,25).fill(0x171c36).rect(p.x-15,p.y-20,30,18).fill(0x29436a);g.rect(p.x-12,p.y-16,17,2).fill(color).rect(p.x-12,p.y-10,10,2).fill(color).rect(p.x-2,p.y+2,4,7).fill(0x697196);}

export default function Office({agents,tasks,onSelect,onCeo,selectedId}:{agents:Agent[];tasks:Task[];onSelect:(a:Agent)=>void;onCeo:()=>void;selectedId:string|null}){
 const {t,language}=useI18n();const host=useRef<HTMLDivElement>(null);const controls=useRef({zoom:1,pan:{x:0,y:0},drag:false});const [zoom,setZoom]=useState(1);const [failed,setFailed]=useState(false);const [ready,setReady]=useState(false);const [lightweight,setLightweight]=useState(false);
 const callbacks=useRef({onSelect,onCeo});callbacks.current={onSelect,onCeo};
 useEffect(()=>{controls.current.zoom=zoom;},[zoom]);
 useEffect(()=>{
  const target=host.current;if(!target||lightweight)return;let disposed=false;let app:Application|undefined;let observer:ResizeObserver|undefined;let dragStart:{x:number;y:number;px:number;py:number}|null=null;const textures:Texture[]=[];
  async function start(){
   try{
    await document.fonts.ready;if(disposed)return;app=new Application();await app.init({width:target!.clientWidth,height:target!.clientHeight,background:0x101426,antialias:false,resolution:1,autoDensity:false,preference:'webgl'});if(disposed){app.destroy(true,{children:true});return;}
    target!.appendChild(app.canvas);app.canvas.setAttribute('aria-label',t('Interactive pixel office'));app.canvas.style.imageRendering='pixelated';
    const world=new Container();app.stage.addChild(world);const floor=new Graphics();world.addChild(floor);const spots=seats(agents);const n=Math.max(12,spots.at(-1)?.y?spots.at(-1)!.y+2.1:12);
    const corner=[iso(0,0),iso(12,0),iso(12,n),iso(0,n)];polygon(floor,corner.map(p=>({x:p.x+12,y:p.y+19})),0x070c1b,.8);
    box(floor,0,0,12,n,12,0x553b48,0x342b40,0x282438,-12);
    for(let x=0;x<12;x++)for(let y=0;y<Math.ceil(n);y++){
     const d=Math.min(1,n-y);polygon(floor,[iso(x,y),iso(x+1,y),iso(x+1,y+d),iso(x,y+d)], [0x98705d,0xa47a61,0x8f6659,0xa07a65][(x*3+y)%4]);
     const a=iso(x+.06,y+.08),b=iso(x+.86,y+.08);floor.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color:0xc29370,width:1,alpha:.4});
    }
    // Two full-height walls and thick violet cornices frame the cutaway room.
    polygon(floor,[iso(0,0),iso(0,n),iso(0,n,102),iso(0,0,102)],0x25253e);
    polygon(floor,[iso(0,0),iso(12,0),iso(12,0,102),iso(0,0,102)],0x30314e);
    floor.moveTo(iso(0,n,103).x,iso(0,n,103).y).lineTo(iso(0,0,103).x,iso(0,0,103).y).lineTo(iso(12,0,103).x,iso(12,0,103).y).stroke({color:0x696080,width:6});
    floor.moveTo(iso(0,n,3).x,iso(0,n,3).y).lineTo(iso(0,0,3).x,iso(0,0,3).y).lineTo(iso(12,0,3).x,iso(12,0,3).y).stroke({color:0x77719e,width:4});
    for(const x of [2,5,8]){const p=iso(x,0,78);polygon(floor,[p,{x:p.x+54,y:p.y+27},{x:p.x+54,y:p.y+64},{x:p.x,y:p.y+37}],0x171e39);polygon(floor,[{x:p.x+4,y:p.y+7},{x:p.x+49,y:p.y+29},{x:p.x+49,y:p.y+55},{x:p.x+4,y:p.y+33}],0x405d86);floor.moveTo(p.x+27,p.y+17).lineTo(p.x+27,p.y+43).stroke({color:0x8097bd,width:3});}
    // Executive rug, executive desk, shelves, plants and cabinet details.
    polygon(floor,[iso(1.8,1.5),iso(5.7,1.5),iso(5.7,5.1),iso(1.8,5.1)],0x453e65);
    const decor=new Graphics();world.addChild(decor);
    box(decor,.3,3.1,.8,2.2,65,0x50425f,0x302e49,0x39344e);
    for(let i=0;i<3;i++){box(decor,.2,3.2+i*.65,.95,.52,13,[0x968564,0x6d809b,0x937397][i],0x4b3d57,0x5b4a65,12+i*15);}
    box(decor,10,.3,1.7,.75,39,0x79718b,0x4c465f,0x3c3b54);for(let i=0;i<2;i++){const p=iso(10.15+i*.7,.98,21);decor.rect(p.x-4,p.y-2,9,2).fill(0xc0adc4);}
    box(decor,10.3,8.6,.8,1.5,36,0x71658a,0x4e4669,0x3a3659);
    box(decor,1.1,10.6,2,.8,19,0x725573,0x443c57,0x5b4667);
    plant(decor,.7,.6);plant(decor,10.8,1.4);plant(decor,.6,8.8);plant(decor,10.5,10.6);
    const sign=iso(.15,6.7,70);const plaque=new Text({text:'AGENT HQ',style:{fontFamily:'monospace',fontSize:13,fontWeight:'bold',fill:0xc6c0ed,letterSpacing:2}});plaque.position.set(sign.x-20,sign.y);world.addChild(plaque);
    const links=new Graphics();world.addChild(links);const start=iso(4,4.2);const paths: {from:P;to:P;state:string}[]=[];
    for(const seat of spots){const end=iso(seat.x+.8,seat.y+.8);paths.push({from:start,to:end,state:employeeState(seat.agent,tasks)});links.moveTo(start.x,start.y).lineTo(start.x,start.y+22).lineTo(end.x,end.y+15).lineTo(end.x,end.y).stroke({color:0x6788ff,width:7,alpha:.1});links.moveTo(start.x,start.y).lineTo(start.x,start.y+22).lineTo(end.x,end.y+15).lineTo(end.x,end.y).stroke({color:0x7cc8fa,width:1,alpha:.8});}
    const indicator=new Graphics();world.addChild(indicator);
    const animated:{sprite:Sprite;base:number;monitor:Graphics;state:string;color:number}[]=[];
    function station(x:number,y:number,agent:Agent|null,index:number){
     const ceo=!agent;const color=ceo?0xceb27d:hex(agent.color);const status=agent?employeeState(agent,tasks):'Idle';const g=new Graphics();const layer=new Container();world.addChild(layer);layer.addChild(g);
     if(selectedId===(agent?.id||'ceo')){const p=iso(x-.2,y-.2);polygon(g,[p,iso(x+2.2,y-.2),iso(x+2.2,y+2),iso(x-.2,y+2)],color,.25);}
     const chair=iso(x+.7,y+.05,15);g.rect(chair.x-15,chair.y-30,30,35).fill(0x29233d).rect(chair.x-12,chair.y-28,24,28).fill(ceo?0x665074:0x474a69);
     const texture=pixelCharacter(ceo?'#ceb27d':agent.color,ceo,agent?.avatar||'robot');textures.push(texture);const sprite=new Sprite(texture);sprite.anchor.set(.5,1);const pos=iso(x+.65,y+.4,18);sprite.position.set(pos.x,pos.y);sprite.scale.set(1.6);layer.addChild(sprite);
     const desk=new Graphics();layer.addChild(desk);box(desk,x,y+.8,ceo?2.65:2.05,1.05,30,ceo?0xba9071:0x9c8b92,0x5b4a58,0x665466);box(desk,x+.08,y+.83,ceo?2.5:1.9,.92,5,ceo?0xcfaa7c:0xb9a3a1,0x8d717b,0x8c747a,30);
     screen(desk,x+.85,y+1.25,color);const key=iso(x+1.1,y+1.6,37);desk.rect(key.x-12,key.y-2,24,5).fill(0x34384f);desk.rect(key.x-9,key.y-1,17,1).fill(0x77819d);
     const cup=iso(x+1.7,y+1.03,36);desk.rect(cup.x,cup.y-6,6,8).fill(0xd8c2ac);
     const monitor=new Graphics();layer.addChild(monitor);const m=iso(x+.85,y+1.25,41);monitor.rect(m.x+9,m.y-10,4,2).fill(color);
     animated.push({sprite,base:pos.y,monitor,state:status,color});
     const labelPos=iso(x+1,y+2.15);const tag=new Graphics();layer.addChild(tag);tag.rect(labelPos.x-58,labelPos.y+4,116,35).fill({color:0x171c32,alpha:.95}).rect(labelPos.x-58,labelPos.y+4,3,35).fill(color);
     const name=new Text({text:ceo?'CEO / AI MANAGER':`AI ${index+1} · ${agent.name}`,style:{fontFamily:'Noto Sans Lao Variable',fontSize:11,fontWeight:'600',fill:0xe2def2}});name.anchor.set(.5,0);name.position.set(labelPos.x,labelPos.y+7);layer.addChild(name);
     const statusLabel=new Text({text:ceo?t('Central command'):!agent.active?t('Offline'):t(status),style:{fontFamily:'Noto Sans Lao Variable',fontSize:9,fill:ceo?0xb4a1d0:color}});statusLabel.anchor.set(.5,0);statusLabel.position.set(labelPos.x,labelPos.y+23);layer.addChild(statusLabel);
     layer.eventMode='static';layer.cursor='pointer';layer.hitArea=new Rectangle(pos.x-35,pos.y-63,ceo?145:120,140);
     layer.on('pointertap',()=>{if(controls.current.drag)return;ceo?callbacks.current.onCeo():callbacks.current.onSelect(agent!);});
    }
    station(3,2.1,null,-1);for(const seat of spots)station(seat.x,seat.y,seat.agent,seat.index);
    // Pan and zoom affect only the camera. Task states always come from records.
    const extraHeight=Math.max(0,n-12)*17.5;
    const layout=()=>{if(!app)return;const fit=Math.min(app.screen.width/940,app.screen.height/(610+extraHeight));const z=fit*controls.current.zoom;world.scale.set(z);world.position.set(app.screen.width/2-450*z+controls.current.pan.x,(app.screen.height-(560+extraHeight)*z)/2+controls.current.pan.y);};
    let elapsed=0;app.ticker.add(ticker=>{elapsed+=ticker.deltaMS/1000;layout();indicator.clear();animated.forEach((a,i)=>{a.sprite.y=a.base+Math.round(Math.sin(elapsed*1.5+i)*.7);a.monitor.alpha=.65+Math.sin(elapsed*2+i)*.25;});paths.forEach((p,i)=>{if(p.state!=='Working'&&p.state!=='Receiving Task')return;const f=(elapsed*.35+i*.3)%1;indicator.rect(Math.round(p.from.x+(p.to.x-p.from.x)*f)-2,Math.round(p.from.y+(p.to.y-p.from.y)*f)-2,4,4).fill(0xb2ecff);});});
    app.canvas.style.touchAction='none';app.canvas.addEventListener('pointerdown',down);app.canvas.addEventListener('pointermove',move);app.canvas.addEventListener('pointerup',up);app.canvas.addEventListener('pointercancel',up);app.canvas.addEventListener('wheel',wheel,{passive:false});
    observer=new ResizeObserver(()=>{if(app){app.renderer.resize(target!.clientWidth,target!.clientHeight);layout();}});observer.observe(target!);layout();setReady(true);
   }catch(e){if(!disposed){setFailed(true);console.error('Pixel office could not start',e);}}
  }
  const down=(e:PointerEvent)=>{dragStart={x:e.clientX,y:e.clientY,px:controls.current.pan.x,py:controls.current.pan.y};controls.current.drag=false;};
  const move=(e:PointerEvent)=>{if(!dragStart)return;const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;if(Math.abs(dx)+Math.abs(dy)>6){controls.current.drag=true;controls.current.pan={x:dragStart.px+dx,y:dragStart.py+dy};}};
  const up=()=>{dragStart=null;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();setZoom(z=>Math.min(2.5,Math.max(.65,z+(e.deltaY<0?.1:-.1))));};
  setReady(false);setFailed(false);void start();return()=>{disposed=true;observer?.disconnect();if(app?.renderer){app.canvas.removeEventListener('pointerdown',down);app.canvas.removeEventListener('pointermove',move);app.canvas.removeEventListener('pointerup',up);app.canvas.removeEventListener('pointercancel',up);app.canvas.removeEventListener('wheel',wheel);app.destroy(true,{children:true});}textures.forEach(texture=>texture.destroy(true));};
 },[agents,tasks,language,selectedId,lightweight]);
 return <div className="pixel-office"><div ref={host} className="pixel-canvas" data-ready={ready} data-employee-count={agents.length} />{(failed||lightweight)&&<div className="pixel-fallback"><b>{t('Lightweight office')}</b><p>{t('Graphics unavailable. Every workspace is still available below.')}</p><button onClick={onCeo}>CEO</button>{agents.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.name}</button>)}{lightweight&&<button onClick={()=>setLightweight(false)}>{t('Return to pixel office')}</button>}</div>}{!ready&&!failed&&!lightweight&&<div className="pixel-loading">{t('Preparing your office…')}</div>}<div className="pixel-shortcuts" aria-label={t('Office characters')}><button onClick={onCeo}>CEO / AI Manager</button>{agents.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.name}</button>)}</div><div className="pixel-camera"><span><Move size={12}/>{t('Drag to explore')}</span><button className="pixel-light-button" aria-label={t('Lightweight view')} onClick={()=>setLightweight(v=>!v)}>≡</button><button aria-label={t('Zoom out')} onClick={()=>setZoom(z=>Math.max(.65,z-.2))}><Minus size={15}/></button><b>{Math.round(zoom*100)}%</b><button aria-label={t('Zoom in')} onClick={()=>setZoom(z=>Math.min(2.5,z+.2))}><Plus size={15}/></button><button aria-label={t('Reset camera')} onClick={()=>{setZoom(1);controls.current.pan={x:0,y:0};}}><RotateCcw size={14}/></button></div></div>;
}
