import { config } from "./config.js";
import { supabase } from "./supabase.js";
import { adminKeyboard, adminToolsKeyboard } from "./keyboards.js";
import { sendMessage } from "./telegram.js";
export const isAdmin=(id:number)=>id===config.adminTelegramId;
export async function adminMenu(id:number){await sendMessage(id,"👑 لوحة الإدارة\n\nاختار العملية:",adminKeyboard);}
export async function adminTools(id:number){await sendMessage(id,"⚙️ أدوات الإدارة:",adminToolsKeyboard);}
export async function generateCodes(id:number,count:number){
  const safe=Math.min(Math.max(Math.floor(count),1),500);
  const rows=Array.from({length:safe},()=>({code:"BAI-"+crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase(),status:"available"}));
  const {data,error}=await supabase.from("access_codes").insert(rows).select("code");if(error)throw error;
  const codes=(data??[]).map((x:any)=>x.code);for(let i=0;i<codes.length;i+=70)await sendMessage(id,"🎟️ الأكواد:\n\n"+codes.slice(i,i+70).join("\n"),adminKeyboard);
}
export async function listStudents(id:number){
  const {data,error}=await supabase.from("students").select("id,telegram_id,status,created_at").order("created_at",{ascending:false}).limit(50);if(error)throw error;
  if(!data?.length)return void await sendMessage(id,"👥 لا يوجد طلاب.",adminKeyboard);
  await sendMessage(id,"👥 الطلاب:",{inline_keyboard:data.map((s:any)=>[{text:(s.status==="active"?"🟢 ":"🔴 ")+s.telegram_id,callback_data:"student:"+s.id}])});
}
export async function showStudent(id:number,studentId:string){
  const {data,error}=await supabase.from("students").select("id,telegram_id,status,created_at").eq("id",studentId).maybeSingle();if(error)throw error;
  if(!data)return void await sendMessage(id,"❌ الطالب غير موجود.",adminKeyboard);
  await sendMessage(id,"👤 الطالب\n\nTelegram ID: "+data.telegram_id+"\nالحالة: "+data.status+"\nالتفعيل: "+new Date(data.created_at).toLocaleString("ar-EG"),{inline_keyboard:[[{text:data.status==="active"?"⛔ حظر":"✅ تفعيل",callback_data:"student_toggle:"+data.id},{text:"♻️ إعادة الكود",callback_data:"student_reset:"+data.id}]]});
}
export async function toggleStudent(id:number,studentId:string){
  const {data,error}=await supabase.from("students").select("status").eq("id",studentId).maybeSingle();if(error)throw error;if(!data)return;
  const {error:updateError}=await supabase.from("students").update({status:data.status==="active"?"blocked":"active"}).eq("id",studentId);if(updateError)throw updateError;
  await showStudent(id,studentId);
}
export async function resetStudentCode(id:number,studentId:string){
  const {data,error}=await supabase.from("students").select("access_code_id").eq("id",studentId).maybeSingle();if(error)throw error;if(!data)return;
  if(data.access_code_id){const {error:e}=await supabase.from("access_codes").update({status:"available",bound_telegram_id:null,used_at:null}).eq("id",data.access_code_id);if(e)throw e;}
  const {error:e}=await supabase.from("students").delete().eq("id",studentId);if(e)throw e;
  await sendMessage(id,"♻️ تم فصل الطالب عن الكود. سيحتاج لكود جديد عند /start.",adminKeyboard);
}
export async function listSubjects(id:number){
  const {data,error}=await supabase.from("subjects").select("id,name").order("name");if(error)throw error;
  if(!data?.length)return void await sendMessage(id,"📚 لا توجد مواد.",adminKeyboard);
  await sendMessage(id,"📚 اضغط على المادة لحذفها:",{inline_keyboard:data.map((s:any)=>[{text:"🗑️ "+s.name,callback_data:"deletesubject:"+s.id}])});
  await sendMessage(id,"➕ لإضافة مادة: /addsubject",adminKeyboard);
}
export async function listLectures(id:number){
  const {data,error}=await supabase.from("lectures").select("id,lecture_number,title").order("created_at",{ascending:false}).limit(50);if(error)throw error;
  if(!data?.length)return void await sendMessage(id,"📚 لا توجد محاضرات.",adminKeyboard);
  await sendMessage(id,"🗑️ اختار المحاضرة للحذف:",{inline_keyboard:data.map((l:any)=>[{text:"🗑️ "+l.lecture_number+" — "+l.title,callback_data:"deletelecture:"+l.id}])});
}
export async function listEvents(id:number){
  const {data,error}=await supabase.from("events").select("id,title,event_date").order("event_date").limit(30);if(error)throw error;
  if(!data?.length)return void await sendMessage(id,"📅 لا توجد مواعيد.",adminKeyboard);
  await sendMessage(id,"📅 اختار الموعد للحذف:",{inline_keyboard:data.map((e:any)=>[{text:"🗑️ "+e.title,callback_data:"deleteevent:"+e.id}])});
}
export async function broadcast(id:number,text:string){
  const {data,error}=await supabase.from("students").select("telegram_id").eq("status","active");if(error)throw error;let sent=0,failed=0;
  for(const s of data??[]){try{await sendMessage(s.telegram_id,text);sent++;}catch{failed++;}}
  await sendMessage(id,"📢 الإرسال انتهى\nنجح: "+sent+"\nفشل: "+failed,adminKeyboard);
}
export async function createEvent(id:number,title:string,description:string,date:string){
  const {error}=await supabase.from("events").insert({title,description,event_date:date,event_type:"general"});if(error)throw error;await sendMessage(id,"✅ تم إضافة الموعد.",adminKeyboard);
}
