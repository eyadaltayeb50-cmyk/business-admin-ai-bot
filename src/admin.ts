import {config} from "./config.js";
import {supabase} from "./supabase.js";
import {adminKeyboard} from "./keyboards.js";
import {sendMessage} from "./telegram.js";

export const isAdmin=(id:number)=>id===config.adminTelegramId;
export async function adminMenu(id:number){await sendMessage(id,"👑 لوحة الإدارة\n\nاختار العملية:",adminKeyboard);}
export async function generateCodes(id:number,count:number){
 const safe=Math.min(Math.max(Math.floor(count),1),500);
 const rows=Array.from({length:safe},()=>({code:"BAI-"+crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase(),status:"available"}));
 const {data,error}=await supabase.from("access_codes").insert(rows).select("code");
 if(error)throw error;
 await sendMessage(id,"✅ الأكواد:\n\n"+(data??[]).map((x:any)=>x.code).join("\n"),adminKeyboard);
}
export async function listStudents(id:number){
 const {data,error}=await supabase.from("students").select("telegram_id,status,created_at").order("created_at",{ascending:false}).limit(50);
 if(error)throw error;
 await sendMessage(id,data?.length?"👥 الطلاب:\n\n"+data.map((s:any,i:number)=>`${i+1}. ${s.telegram_id} — ${s.status}`).join("\n"):"👥 لا يوجد طلاب.",adminKeyboard);
}
export async function listSubjects(id:number){
 const {data,error}=await supabase.from("subjects").select("id,name").order("name");
 if(error)throw error;
 await sendMessage(id,data?.length?"📚 المواد:\n\n"+data.map((s:any)=>`• ${s.name}`).join("\n"):"📚 لا توجد مواد.",adminKeyboard);
}
export async function listLectures(id:number){
 const {data,error}=await supabase.from("lectures").select("id,lecture_number,title,professor_name").order("created_at",{ascending:false}).limit(50);
 if(error)throw error;
 if(!data?.length)return void await sendMessage(id,"📚 لا توجد محاضرات.",adminKeyboard);
 await sendMessage(id,"🗑️ اختار المحاضرة للحذف:",{inline_keyboard:data.map((l:any)=>[{text:`🗑️ ${l.lecture_number} — ${l.title}`,callback_data:`deletelecture:${l.id}`}])});
}
export async function broadcast(id:number,text:string){
 const {data,error}=await supabase.from("students").select("telegram_id").eq("status","active");
 if(error)throw error;
 let sent=0,failed=0;
 for(const s of data??[])try{await (await import("./telegram.js")).sendMessage(s.telegram_id,text);sent++;}catch{failed++;}
 await sendMessage(id,`📢 الإرسال انتهى\nنجح: ${sent}\nفشل: ${failed}`,adminKeyboard);
}
export async function createEvent(id:number,title:string,description:string,date:string){
 const {error}=await supabase.from("events").insert({title,description,event_date:date,event_type:"general"});
 if(error)throw error;
 await sendMessage(id,"✅ تم إضافة الموعد.",adminKeyboard);
}
