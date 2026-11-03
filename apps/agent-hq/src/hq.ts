import type { Agent, Task } from './model';
export type EmployeeState='Idle'|'Receiving Task'|'Working'|'Waiting for Data'|'Awaiting Approval'|'Completed'|'Failed';
export function employeeState(agent:Agent,tasks:Task[]):EmployeeState {
 const t=tasks.filter(t=>t.agentId===agent.id).sort((a,b)=>Date.parse(b.log.at(-1)?.at||b.created)-Date.parse(a.log.at(-1)?.at||a.created))[0];
 if(!agent.active||!t)return 'Idle';
 switch(t.status){case 'New':return 'Receiving Task';case 'Waiting for information':return 'Waiting for Data';case 'In progress':return 'Working';case 'Draft ready':case 'Awaiting approval':return 'Awaiting Approval';case 'Approved':case 'Completed':return 'Completed';case 'Rejected':case 'Failed':return 'Failed';}
}
export type RouteKind='budget'|'baf'|'sales';
export type Routes=Record<RouteKind,string>;
const routeKey='agent-hq-routes-v1';
export function loadRoutes(agents:Agent[]):Routes {
 const defaults={budget:agents.find(a=>a.id==='mali')?.id||'',baf:agents.find(a=>a.id==='kham')?.id||'',sales:agents.find(a=>a.id==='noy')?.id||''};
 try {const saved=JSON.parse(localStorage.getItem(routeKey)||'null');return saved?{...defaults,...saved}:defaults;}catch{return defaults;}
}
export function storeRoutes(routes:Routes){localStorage.setItem(routeKey,JSON.stringify(routes));}
// Conservative keyword matching, never a pretend AI inference call.
export function classifyCommand(text:string):RouteKind|null {
 const hits:RouteKind[]=[];
 if(/budget|proposal|ງົບປະມານ|ສະເໜີງົບ/i.test(text))hits.push('budget');
 if(/\bbaf\b/i.test(text))hits.push('baf');
 if(/sales|ranking|ຍອດຂາຍ|ວິເຄາະການຂາຍ/i.test(text))hits.push('sales');
 return hits.length===1?hits[0]:null;
}
export type Seat={x:number;y:number;agent:Agent;index:number};
export function seats(agents:Agent[]):Seat[]{
 const first=[{x:2.2,y:7.9},{x:6.1,y:7.4},{x:8.1,y:3.9}];
 return agents.map((agent,index)=>({...first[index]||{x:2.1+(index-3)%3*3.3,y:11+Math.floor((index-3)/3)*3},agent,index}));
}
