import { translate } from './i18n';
export type Status = 'New' | 'Waiting for information' | 'In progress' | 'Draft ready' | 'Awaiting approval' | 'Approved' | 'Rejected' | 'Completed' | 'Failed';
export const statuses: Status[] = ['New','Waiting for information','In progress','Draft ready','Awaiting approval','Approved','Rejected','Completed','Failed'];
export type Agent = {
 id: string; name: string; title: string; department: string; color: string; avatar: 'orb'|'robot'|'capsule'|'chibi-mint'|'chibi-violet'|'chibi-amber'; active: boolean; description: string;
 prompt: string; responsibilities: string; allowedTasks: string; restrictedTasks: string; workflow: string; requirements: string; language: string;
 folder: string; files: string; spreadsheet: string; tabs: string; ranges: string; templates: string; additionalSources: string;
 formats: string[]; permissions: string[]; access: string; fields: string;
};
export type Task = {id:string; agentId:string; title:string; requester:string; created:string; status:Status; input:Record<string,string>; draft:string; log:{at:string; text:string}[]};
export type Message = {id:string; agentId:string; role:'user'|'assistant'; text:string};
export type State = {agents:Agent[]; tasks:Task[]; messages:Message[]};
export const formats=['Word (.docx)','PDF','Excel (.xlsx)','Google Docs','Google Sheets','Dashboard / Charts'];
export const permissions=['Read data','Generate drafts','Export documents','Save approved documents','Request human approval'];
export const uid=()=>crypto.randomUUID();
export function emptyAgent():Agent{return {id:uid(),name:'',title:'',department:'Operations',color:'#9e8bfa',avatar:'robot',active:true,description:'',prompt:'',responsibilities:'',allowedTasks:'',restrictedTasks:'Never invent missing business data.',workflow:'Collect required inputs, generate a draft, and request human approval.',requirements:'',language:'Lao',folder:'',files:'',spreadsheet:'',tabs:'',ranges:'',templates:'',additionalSources:'',formats:['PDF'],permissions:['Generate drafts','Request human approval'],access:'',fields:'Task details'};}
const starter=(name:string,title:string,department:string,color:string,fields:string,prompt:string):Agent=>({...emptyAgent(),id:name.toLowerCase().replaceAll(' ','-'),name,title,department,color,fields,prompt,responsibilities:prompt,description:prompt,formats:title.includes('Analysis')?['Excel (.xlsx)','Dashboard / Charts']:['Word (.docx)','PDF']});
export function initialState():State {
 const agents=[starter('Mali','Budget Proposal Officer','Sales & Marketing','#aa91fa','Shop name, Contact name, Activity type, Requested budget, Supporting information','Prepare budget proposal drafts using approved company templates and supplied data.'),starter('Kham','BAF Officer','Document Operations','#edaf79','Shop name, Approved business data, BAF template','Map approved business data to the administrator-supplied BAF template. Validate all required fields.'),starter('Noy','Sales Analysis Officer','Data & Insights','#76d5bc','Month, Sales data','Aggregate sales by shop ID and month, then rank shops by total sales in descending order.')];
 const created=new Date().toISOString();
 return {agents,tasks:[{id:'sample-task',agentId:agents[0].id,title:'Summer activation budget',requester:'Demo Admin',created,status:'Awaiting approval',input:{'Shop name':'Sample shop — fictional','Requested budget':'Sample only'},draft:'SAMPLE DRAFT — fictional demonstration\n\nSummer activation budget\n\nThis is a sample document for exploring the review workflow. No company records were accessed. Replace it with authorized inputs and an approved template before production use.',log:[{at:created,text:'Fictional sample draft seeded for the prototype.'}]}],messages:[]};
}
const key='orbit-office-v1';
let persistenceBlocked=false;
export function load():State {
 let raw:string|null=null;
 try {
  raw=localStorage.getItem(key);
  if(raw){
   // One immutable, additive snapshot before the first AGENT HQ save.
   if(!localStorage.getItem('agent-hq-preserved-workspace-v1')){
    try{localStorage.setItem('agent-hq-preserved-workspace-v1',raw);}catch{/* Existing records remain usable even if backup storage is full. */}
   }
   const s=JSON.parse(raw);
   if(Array.isArray(s.agents)&&Array.isArray(s.tasks)&&Array.isArray(s.messages))return s;
   persistenceBlocked=true;
  }
 }catch{if(raw)persistenceBlocked=true;}
 return initialState();
}
export function save(s:State){
 if(persistenceBlocked)throw new Error('Existing workspace could not be read. Original data was preserved; restore a valid backup before saving.');
 localStorage.setItem(key,JSON.stringify(s));
}
export function demoDraft(a:Agent,t:Task){
 const tr=(key:string)=>translate(a.language==='Lao'?'lo':'en',key);
 return `${tr('LOCAL DEMO DRAFT — NOT AI GENERATED')}\n\n${t.title}\n${tr('Agent')}: ${a.name} · ${tr(a.title)}\n${tr('Language requested')}: ${tr(a.language)}\n\n${tr('SUPPLIED INFORMATION')}\n${Object.entries(t.input).map(([k,v])=>`${tr(k)}: ${v}`).join('\n')}\n\n${tr('CONFIGURED RESPONSIBILITIES')}\n${tr(a.responsibilities||a.prompt)}\n\n${tr('OUTPUT REQUIREMENTS')}\n${tr(a.requirements||'No additional requirements configured.')}\n\n${tr('No Google files were read and no business calculations were performed. Template mapping, AI generation and binary document export require the secure backend in later phases. Review all inputs before approval.')}`;
}
