import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, Rectangle } from 'pixi.js';
import { Minus, Plus, Move, RotateCcw, Users, Coffee, X, ArrowUpRight } from 'lucide-react';
import type { Agent, Task } from './model';
import { employeeState } from './hq';
import { ChibiFace, chibiSeats, portraitIndex, teamImage } from './chibi';
import roomImage from './assets/chibi-room.png';
import { useI18n } from './i18n';

export default function Office({agents,tasks,onSelect,onCeo,selectedId}:{agents:Agent[];tasks:Task[];onSelect:(a:Agent)=>void;onCeo:()=>void;selectedId:string|null}){
 const {t,language}=useI18n();const host=useRef<HTMLDivElement>(null);const controls=useRef({zoom:1,pan:{x:0,y:0},drag:false});const [zoom,setZoom]=useState(1);const [failed,setFailed]=useState(false);const [ready,setReady]=useState(false);const [lightweight,setLightweight]=useState(false);const [meeting,setMeeting]=useState(false);const [corner,setCorner]=useState(false);
 const meetingRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(!meeting)return;const previous=document.activeElement as HTMLElement|null;meetingRef.current?.querySelector<HTMLButtonElement>('button')?.focus();const handle=(e:KeyboardEvent)=>{if(e.key==='Escape')setMeeting(false);if(e.key==='Tab'){const list=Array.from(meetingRef.current?.querySelectorAll<HTMLButtonElement>('button')||[]);const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};window.addEventListener('keydown',handle);return()=>{window.removeEventListener('keydown',handle);previous?.focus();};},[meeting]);
 const callbacks=useRef({onSelect,onCeo});callbacks.current={onSelect,onCeo};
 const reset=()=>{setZoom(1);controls.current.pan={x:0,y:0};setCorner(false);};
 useEffect(()=>{controls.current.zoom=zoom;},[zoom]);
 useEffect(()=>{
  const target=host.current;if(!target||lightweight)return;let disposed=false;let app:Application|undefined;let observer:ResizeObserver|undefined;let dragStart:{x:number;y:number;px:number;py:number}|null=null;const frames:Texture[]=[];
  async function start(){
   try{
    await document.fonts.ready;
    // Pixi caches the shared room and sprite atlas. Each character remains its own actor.
    const [room,atlas]=await Promise.all([Assets.load<Texture>(roomImage),Assets.load<Texture>(teamImage)]);
    if(disposed)return;
    app=new Application();await app.init({width:target!.clientWidth,height:target!.clientHeight,background:0x101426,antialias:true,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true,preference:'webgl'});
    if(disposed){app.destroy(true,{children:true});return;}
    target!.appendChild(app.canvas);app.canvas.setAttribute('aria-label',t('Interactive chibi office'));app.canvas.style.imageRendering='auto';
    const world=new Container();app.stage.addChild(world);const background=new Sprite(room);background.width=1536;background.height=1024;world.addChild(background);
    const spots=chibiSeats(agents);const extraRows=Math.ceil(Math.max(0,agents.length-3)/3);const worldHeight=1024+extraRows*310;
    if(extraRows){const extension=new Graphics();extension.rect(95,1010,1346,extraRows*310).fill(0x252b43).roundRect(115,1035,1306,extraRows*310-35,20).stroke({color:0x7d77b5,width:3,alpha:.5});world.addChild(extension);}
    const rings=new Graphics();world.addChild(rings);
    const actors:{body:Container;monitor:Graphics;base:number;status:string;index:number}[]=[];
    const roomMasks=[[[300,347],[475,332],[623,346],[624,475],[300,475]],[[910,345],[1108,335],[1220,357],[1220,480],[910,480]],[[287,674],[443,655],[605,680],[605,813],[287,813]],[[935,679],[1103,660],[1240,685],[1240,816],[935,816]]];
    for(const [seatIndex,seat] of spots.entries()){
     const {agent,x,y}=seat;const ceo=!agent;const color=ceo?0x70baff:parseInt(agent.color.slice(1),16);const status=agent?employeeState(agent,tasks):'Idle';
     const actor=new Container();const body=new Container();actor.addChild(body);world.addChild(actor);
     const index=portraitIndex(agent||undefined);const frame=new Texture({source:atlas.source,frame:new Rectangle(index%2*768,Math.floor(index/2)*512,768,512)});frames.push(frame);
     const sprite=new Sprite(frame);sprite.anchor.set(.5,1);sprite.position.set(x,y);sprite.scale.set(.34);body.addChild(sprite);
     if(seatIndex<4){
      // Repaint only the desk foreground over the animated character, as a game occlusion layer.
      const foreground=new Sprite(room);foreground.width=1536;foreground.height=1024;const mask=new Graphics();mask.poly(roomMasks[seatIndex].flat()).fill(0xffffff);foreground.mask=mask;actor.addChild(foreground,mask);
     }else{
      const desk=new Graphics();desk.roundRect(x-130,y-28,260,56,12).fill(0xd7c2c7).roundRect(x-120,y+20,240,58,5).fill(0x4a405e).roundRect(x-65,y-65,105,60,5).fill(0x182136).roundRect(x-58,y-59,91,46,3).fill(0x345878);actor.addChild(desk);
     }
     const monitor=new Graphics();const monitorX=ceo?514:seat.index===0?1018:seat.index===1?487:seat.index===2?1044:x-12;
     const monitorY=ceo?324:seat.index===0?325:seat.index===1?657:seat.index===2?654:y-48;
     monitor.roundRect(monitorX-17,monitorY-13,32,4,2).fill({color,alpha:.55}).roundRect(monitorX-17,monitorY-4,20,3,1).fill({color,alpha:.35});actor.addChild(monitor);
     const label=new Container();label.position.set(seat.labelX,seat.labelY);actor.addChild(label);const plate=new Graphics();label.addChild(plate);plate.roundRect(-115,-20,230,60,10).fill({color:0x111a30,alpha:.95}).roundRect(-115,-20,230,60,10).stroke({color,width:2,alpha:.85});
     const name=new Text({text:ceo?'CEO · AI MANAGER':agent.name,style:{fontFamily:'Noto Sans Lao Variable',fontSize:19,fontWeight:'600',fill:0xf0efff}});name.anchor.set(.5,0);name.position.set(0,-15);name.scale.set(Math.min(1,205/name.width));label.addChild(name);
     const role=new Text({text:ceo?t('Central command'):t(agent.title),style:{fontFamily:'Noto Sans Lao Variable',fontSize:12,fill:0xc6c5dc}});role.anchor.set(.5,0);role.position.set(0,12);role.scale.set(Math.min(1,208/role.width));label.addChild(role);
     const dot=new Graphics();dot.circle(-101,31,3).fill(!agent||agent.active?0x83d9bb:0x9494a5);label.addChild(dot);
     const stateLabel=new Text({text:ceo?t('Local routing preview'):!agent.active?t('Offline'):t(status),style:{fontFamily:'Noto Sans Lao Variable',fontSize:11,fill:!agent||agent.active?0x9de5cb:0xb0a8bc}});stateLabel.position.set(-92,23);label.addChild(stateLabel);
     actor.eventMode='static';actor.cursor='pointer';
     // Only actor/label regions receive clicks; desk background masks cannot steal another actor's hit target.
     const hit=new Graphics();hit.rect(x-76,y-177,152,155).fill({color:0xffffff,alpha:.001}).roundRect(seat.labelX-115,seat.labelY-20,230,60,10).fill({color:0xffffff,alpha:.001});actor.hitArea={contains:(px:number,py:number)=>(px>x-76&&px<x+76&&py>y-177&&py<y-22)||(px>seat.labelX-115&&px<seat.labelX+115&&py>seat.labelY-20&&py<seat.labelY+40)};actor.addChild(hit);
     const select=()=>{if(controls.current.drag)return;ceo?callbacks.current.onCeo():callbacks.current.onSelect(agent!);};actor.on('pointertap',select);
     const halo=new Graphics();const drawHalo=()=>{halo.clear().ellipse(x,y+45,95,23).stroke({color,width:3,alpha:.9});};world.addChild(halo);halo.eventMode='none';
     actor.on('pointerover',drawHalo);actor.on('pointerout',()=>{if(selectedId!==(agent?.id||'ceo'))halo.clear();});if(selectedId===(agent?.id||'ceo'))drawHalo();
     actors.push({body,monitor,base:0,status,index:seatIndex});
    }
    // These are decorative room controls, not simulated meetings or backend progress.
    const meetingSpot=new Graphics();meetingSpot.ellipse(767,557,190,112).fill({color:0xffffff,alpha:.001});meetingSpot.eventMode='static';meetingSpot.cursor='pointer';meetingSpot.on('pointertap',()=>{if(!controls.current.drag)setMeeting(true);});world.addChild(meetingSpot);
    const coffeeSpot=new Graphics();coffeeSpot.rect(1220,120,275,300).fill({color:0xffffff,alpha:.001});coffeeSpot.eventMode='static';coffeeSpot.cursor='pointer';coffeeSpot.on('pointertap',()=>{if(!controls.current.drag){setCorner(true);setZoom(1.6);controls.current.pan={x:-180,y:100};}});world.addChild(coffeeSpot);
    const layout=()=>{if(!app)return;const fit=Math.min(app.screen.width/1570,app.screen.height/(worldHeight+30));const z=fit*controls.current.zoom;world.scale.set(z);world.position.set((app.screen.width-1536*z)/2+controls.current.pan.x,(app.screen.height-worldHeight*z)/2+controls.current.pan.y);};
    let elapsed=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    app.ticker.add(tick=>{elapsed+=tick.deltaMS/1000;layout();actors.forEach(a=>{a.body.y=reduced?0:Math.sin(elapsed*1.5+a.index)*1.5;a.monitor.alpha=reduced?.7:.65+Math.sin(elapsed*2+a.index)*.2;});rings.clear();actors.forEach((a,i)=>{if(a.status!=='Working'&&a.status!=='Receiving Task')return;const seat=spots[i];rings.circle(seat.x,seat.y-170,5).fill({color:0x80e5fc,alpha:.6+Math.sin(elapsed*3)*.3});});});
    app.canvas.style.touchAction='none';app.canvas.addEventListener('pointerdown',down);app.canvas.addEventListener('pointermove',move);app.canvas.addEventListener('pointerup',up);app.canvas.addEventListener('pointercancel',up);app.canvas.addEventListener('wheel',wheel,{passive:false});
    observer=new ResizeObserver(()=>{if(app){app.renderer.resize(target!.clientWidth,target!.clientHeight);layout();}});observer.observe(target!);layout();setReady(true);
   }catch(error){if(!disposed){setFailed(true);console.error('Chibi office could not start',error);}}
  }
  const down=(e:PointerEvent)=>{dragStart={x:e.clientX,y:e.clientY,px:controls.current.pan.x,py:controls.current.pan.y};controls.current.drag=false;};
  const move=(e:PointerEvent)=>{if(!dragStart)return;const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;if(Math.abs(dx)+Math.abs(dy)>6){controls.current.drag=true;controls.current.pan={x:dragStart.px+dx,y:dragStart.py+dy};}};
  const up=()=>{dragStart=null;};const wheel=(e:WheelEvent)=>{e.preventDefault();setZoom(z=>Math.min(2.5,Math.max(.65,z+(e.deltaY<0?.1:-.1))));};
  setReady(false);setFailed(false);void start();return()=>{disposed=true;observer?.disconnect();if(app?.renderer){app.canvas.removeEventListener('pointerdown',down);app.canvas.removeEventListener('pointermove',move);app.canvas.removeEventListener('pointerup',up);app.canvas.removeEventListener('pointercancel',up);app.canvas.removeEventListener('wheel',wheel);app.destroy(true,{children:true});}frames.forEach(frame=>frame.destroy(false));};
 },[agents,tasks,language,selectedId,lightweight]);
 return <div className="pixel-office chibi-office"><div className="chibi-room-tools"><button onClick={()=>setMeeting(true)}><Users size={13}/>{t('Team Meeting')}</button><button className={corner?'active':''} onClick={()=>{setCorner(true);setZoom(1.6);controls.current.pan={x:-180,y:100};}}><Coffee size={13}/>{t('Coffee Corner')}</button></div><div ref={host} className="pixel-canvas" data-ready={ready} data-employee-count={agents.length}/>{(failed||lightweight)&&<div className="pixel-fallback"><b>{t('Lightweight office')}</b><p>{t('All employee workspaces remain available without graphics.')}</p><button onClick={onCeo}>CEO</button>{agents.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.name}</button>)}{lightweight&&<button onClick={()=>setLightweight(false)}>{t('Return to chibi office')}</button>}</div>}{!ready&&!failed&&!lightweight&&<div className="pixel-loading">{t('Preparing your office…')}</div>}
 <div className="pixel-shortcuts" aria-label={t('Office characters')}><button onClick={onCeo}>CEO / AI Manager</button>{agents.map(a=><button key={a.id} onClick={()=>onSelect(a)}>{a.name}</button>)}</div>
 <div className="pixel-camera"><span><Move size={12}/>{t('Drag to explore')}</span><button aria-label={t('Lightweight view')} onClick={()=>setLightweight(v=>!v)}>≡</button><button aria-label={t('Zoom out')} onClick={()=>setZoom(z=>Math.max(.65,z-.2))}><Minus size={15}/></button><b>{Math.round(zoom*100)}%</b><button aria-label={t('Zoom in')} onClick={()=>setZoom(z=>Math.min(2.5,z+.2))}><Plus size={15}/></button><button aria-label={t('Reset camera')} onClick={reset}><RotateCcw size={14}/></button></div>
 {corner&&<div className="coffee-note"><Coffee size={13}/>{t('A quiet corner for a little break.')}<button aria-label={t('Close dialog')} onClick={reset}><X size={14}/></button></div>}
 {meeting&&<div className="room-meeting-overlay" onClick={()=>setMeeting(false)}><section ref={meetingRef} role="dialog" aria-modal="true" aria-label={t('Team Meeting')} onClick={e=>e.stopPropagation()}><header><div><h2>{t('Team Meeting')}</h2><p>{t('Meet your existing team. No AI meeting is running.')}</p></div><button className="icon-btn" aria-label={t('Close dialog')} onClick={()=>setMeeting(false)}><X size={19}/></button></header><button className="meeting-person" onClick={()=>{setMeeting(false);onCeo();}}><ChibiFace/><span><b>CEO / AI Manager</b><small>{t('Central command')}</small></span><ArrowUpRight size={17}/></button>{agents.map(a=><button className="meeting-person" key={a.id} onClick={()=>{setMeeting(false);onSelect(a);}}><ChibiFace agent={a}/><span><b>{a.name}</b><small>{t(a.title)} · {t(employeeState(a,tasks))}</small></span><ArrowUpRight size={17}/></button>)}</section></div>}
 </div>;
}
