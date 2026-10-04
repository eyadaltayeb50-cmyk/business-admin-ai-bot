import { config } from "./config.js";
import { supabase } from "./supabase.js";
import { adminKeyboard } from "./keyboards.js";
import { sendDocument, sendMessage, mainKeyboard } from "./telegram.js";

export const isAdmin = (id:number) => id === config.adminTelegramId;

export async function adminMenu(id:number) {
  await sendMessage(id, "👑 لوحة الإدارة\n\nاختار العملية:", adminKeyboard);
}

export async function generateCodes(id:number, count:number) {
  if (!isAdmin(id)) return;
  const safeCount = Math.min(Math.max(Math.floor(count),1),500);
  const rows = Array.from({length:safeCount}, () => ({
    code: "BAI-" + crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase(),
    status: "available"
  }));
  const { data, error } = await supabase.from("access_codes").insert(rows).select("code");
  if (error) throw error;
  const codes = (data ?? []).map((x:{code:string}) => x.code).join("\n");
  await sendMessage(id, `✅ تم توليد ${codes.split("\n").length} كود:\n\n${codes}`, adminKeyboard);
}

export async function listStudents(id:number) {
  const {data,error}=await supabase.from("students").select("telegram_id,status,created_at,last_activity_at").order("created_at",{ascending:false}).limit(50);
  if(error) throw error;
  if(!data?.length) return void await sendMessage(id,"👥 لا يوجد طلاب مفعّلون.",adminKeyboard);
  const text=data.map((s:any,i:number)=>`${i+1}. ${s.telegram_id} — ${s.status}`).join("\n");
  await sendMessage(id,"👥 آخر الطلاب:\n\n"+text,adminKeyboard);
}

export async function listSubjects(id:number) {
  const {data,error}=await supabase.from("subjects").select("id,name").order("name");
  if(error) throw error;
  await sendMessage(id,data?.length ? "📚 المواد:\n\n"+data.map((s:any)=>"• "+s.name).join("\n") : "📚 لا توجد مواد.",adminKeyboard);
}

export async function listLectures(id:number) {
  const {data,error}=await supabase.from("lectures").select("id,subject_id,lecture_number,title,professor_name,created_at").order("created_at",{ascending:false}).limit(50);
  if(error) throw error;
  await sendMessage(id,data?.length ? "📚 آخر المحاضرات:\n\n"+data.map((l:any)=>`• محاضرة ${l.lecture_number}: ${l.title}\n  ${l.professor_name ?? ""}`).join("\n\n") : "📚 لا توجد محاضرات.",adminKeyboard);
}

export async function sendBroadcast(id:number,text:string) {
  if(!isAdmin(id)) return;
  const {data,error}=await supabase.from("students").select("telegram_id").eq("status","active");
  if(error) throw error;
  let sent=0,failed=0;
  for(const student of data ?? []) {
    try { await sendMessage(student.telegram_id,text); sent++; }
    catch { failed++; }
  }
  await sendMessage(id,`📢 انتهى الإرسال.\nنجح: ${sent}\nفشل: ${failed}`,adminKeyboard);
}

export async function sendLecture(id:number,fileId:string,caption:string) {
  await sendDocument(id,fileId,caption);
}