import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import lao from './lo.json';
export type Language = 'lo' | 'en';
export type Translate = (key: string, values?: Record<string, string | number>) => string;
const dictionary: Record<string, string> = lao;
export function translate(language: Language, key: string, values: Record<string,string|number> = {}) {
 let text = language === 'lo' ? dictionary[key] ?? key : key;
 if(language==='lo' && !dictionary[key]){
  for(const prefix of ['Waiting for required inputs: ','Required fields missing: ','Reviewer rejected draft: ','NEEDS_INFORMATION: ']){
   if(key.startsWith(prefix)){text=dictionary[prefix]+key.slice(prefix.length).split(', ').map(part=>dictionary[part]??part).join(', ');break;}
  }
 }
 return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
const Context = createContext<{language:Language;setLanguage:(l:Language)=>void;t:Translate}>({language:'lo',setLanguage:()=>{},t:key=>translate('lo',key)});
export function LanguageProvider({children}:{children:ReactNode}) {
 const [language,setLanguage]=useState<Language>(()=>{try{return localStorage.getItem('orbit-language')==='en'?'en':'lo';}catch{return 'lo';}});
 useEffect(()=>{document.documentElement.lang=language;document.title=language==='lo'?'AGENT HQ — ຫ້ອງການ Chibi AI':'AGENT HQ — Chibi AI Studio';try{localStorage.setItem('orbit-language',language);}catch{/* language still works without storage */}},[language]);
 return <Context.Provider value={{language,setLanguage,t:(key,values)=>translate(language,key,values)}}>{children}</Context.Provider>;
}
export const useI18n=()=>useContext(Context);
