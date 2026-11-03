export type FileKind='reference'|'template'|'attachment';
export type UploadRecord={id:string;name:string;size:number;type:string;extension:string;created:string;updated:string;kind:FileKind;agentId:string;hash:string};
export const MAX_FILE_BYTES=20_000_000;
export const MAX_BATCH_FILES=10;
export const ACCEPTED_EXTENSIONS=['pdf','doc','docx','xls','xlsx','csv','txt','md','json','png','jpg','jpeg','webp','gif'];
export const FILE_ACCEPT=ACCEPTED_EXTENSIONS.map(e=>'.'+e).join(',');
const DB_NAME='agent-hq-files-v1';
let opening:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{
 if(opening)return opening;
 opening=new Promise<IDBDatabase>((resolve,reject)=>{
  let request:IDBOpenDBRequest;
  try{request=indexedDB.open(DB_NAME,1);}catch(error){reject(error);return;}
  request.onupgradeneeded=()=>{const db=request.result;const metadata=db.createObjectStore('metadata',{keyPath:'id'});metadata.createIndex('hash','hash',{unique:true});db.createObjectStore('contents',{keyPath:'id'});};
  request.onerror=()=>reject(request.error);
  let blocked=false;
  request.onblocked=()=>{blocked=true;reject(new Error('File storage is busy. Close other tabs and try again.'));};
  request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};
 }).catch(error=>{opening=undefined;throw error;});
 return opening;
}
export function validationError(file:File):string|null {
 if(!file.size)return 'Empty files cannot be uploaded.';
 if(file.size>MAX_FILE_BYTES)return 'Each file must be 20 MB or smaller.';
 if(!ACCEPTED_EXTENSIONS.includes(file.name.split('.').at(-1)?.toLowerCase()||''))return 'This file type is not supported.';
 return null;
}
export async function listUploads():Promise<UploadRecord[]>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('metadata','readonly');const request=tx.objectStore('metadata').getAll();let records:UploadRecord[]=[];request.onsuccess=()=>{records=request.result;};tx.oncomplete=()=>resolve(records.sort((a,b)=>b.created.localeCompare(a.created)));tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
}
export async function addUpload(file:File,options:{kind:FileKind;agentId:string}):Promise<{record:UploadRecord;duplicate:boolean}>{
 const invalid=validationError(file);if(invalid)throw new Error(invalid);
 const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
 const now=new Date().toISOString();const record:UploadRecord={id:crypto.randomUUID(),name:file.name,size:file.size,type:file.type,extension:file.name.split('.').at(-1)!.toLowerCase(),created:now,updated:now,hash,...options};
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['metadata','contents'],'readwrite');const store=tx.objectStore('metadata');let result={record,duplicate:false};
  const request=store.index('hash').get(hash);
  request.onsuccess=()=>{if(request.result){result={record:request.result,duplicate:true};return;}store.add(record);tx.objectStore('contents').add({id:record.id,blob:file.slice(0,file.size,file.type)});};
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
 });
}
export async function uploadContent(id:string):Promise<Blob>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('contents','readonly');const request=tx.objectStore('contents').get(id);let blob:Blob|undefined;request.onsuccess=()=>{blob=request.result?.blob;};tx.oncomplete=()=>blob?resolve(blob):reject(new Error('This file is missing from browser storage.'));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
export async function updateUpload(id:string,changes:Pick<UploadRecord,'agentId'|'kind'>):Promise<void>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('metadata','readwrite');const store=tx.objectStore('metadata');let missing=false;const request=store.get(id);request.onsuccess=()=>{if(!request.result){missing=true;return;}store.put({...request.result,...changes,updated:new Date().toISOString()});};tx.oncomplete=()=>missing?reject(new Error('This file is missing from browser storage.')):resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
export async function removeUpload(id:string):Promise<void>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(['metadata','contents'],'readwrite');tx.objectStore('metadata').delete(id);tx.objectStore('contents').delete(id);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
}
export function formatBytes(bytes:number){if(bytes<1000)return bytes+' B';if(bytes<1_000_000)return (bytes/1000).toFixed(1)+' KB';return (bytes/1_000_000).toFixed(1)+' MB';}
export const IMAGE_EXTENSIONS=['png','jpg','jpeg','webp','gif'];
export const TEXT_EXTENSIONS=['txt','md','csv','json'];
export async function downloadUpload(record:UploadRecord){
 const blob=await uploadContent(record.id);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=record.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
