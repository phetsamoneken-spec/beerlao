import type { Agent } from './model';
import teamImage from './assets/chibi-team.png';
export { teamImage };
export function portraitIndex(agent?:Agent):number {
 if(!agent)return 0;
 const explicit:Record<string,number>={'chibi-mint':1,'chibi-violet':2,'chibi-amber':3};
 if(explicit[agent.avatar])return explicit[agent.avatar];
 if(agent.avatar==='orb')return 2;if(agent.avatar==='capsule')return 3;
 const known:Record<string,number>={mali:1,kham:2,noy:3};
 return known[agent.id]||1+Array.from(agent.id).reduce((n,c)=>n+c.charCodeAt(0),0)%3;
}
export function ChibiFace({agent,large=false}:{agent?:Agent;large?:boolean}){
 const index=portraitIndex(agent);const x=(index%2)*768+175,y=Math.floor(index/2)*512;
 return <div className={'face chibi-face '+(large?'large':'')} style={{'--agent':agent?.color||'#73baff'} as React.CSSProperties}><svg preserveAspectRatio="xMidYMid slice" viewBox={`${x} ${y} 440 350`} aria-hidden="true"><image href={teamImage} width="1536" height="1024"/></svg></div>;
}
export type ChibiSeat={x:number;y:number;labelX:number;labelY:number;index:number;agent:Agent|null};
export function chibiSeats(agents:Agent[]):ChibiSeat[]{
 const first=[{x:1120,y:376,labelX:1120,labelY:188},{x:405,y:706,labelX:278,labelY:548},{x:1134,y:708,labelX:1285,labelY:550}];
 return [{x:400,y:376,labelX:390,labelY:187,index:-1,agent:null},...agents.map((agent,index)=>({...first[index]||{x:320+(index-3)%3*420,y:1120+Math.floor((index-3)/3)*310,labelX:320+(index-3)%3*420,labelY:960+Math.floor((index-3)/3)*310},index,agent}))];
}
