import { supabase } from "./supabase.js";
import { sendDocument, sendMessage, mainKeyboard } from "./telegram.js";

export async function showSubjects(id:number) {
  const {data,error}=await supabase.from("subjects").select("id,name").order("name");
  if(error) throw error;
  if(!data?.length) return void await sendMessage(id,"📚 لسه مفيش مواد مضافة.",mainKeyboard);
  await sendMessage(id,"📚 المواد المتاحة:\n\n"+data.map((s:any)=>"• "+s.name).join("\n"));
}

export async function showLatest(id:number) {
  const {data,error}=await supabase.from("lectures").select("lecture_number,title,professor_name,telegram_file_id,created_at").order("created_at",{ascending:false}).limit(5);
  if(error) throw error;
  if(!data?.length) return void await sendMessage(id,"🆕 لسه مفيش محاضرات.",mainKeyboard);
  await sendMessage(id,"🆕 آخر المحاضرات:");
  for(const l of data) await sendDocument(id,l.telegram_file_id,`📚 محاضرة ${l.lecture_number} — ${l.title}\n${l.professor_name ?? ""}`);
}

export async function showAnnouncements(id:number) {
  const {data,error}=await supabase.from("announcements").select("title,content,created_at").order("created_at",{ascending:false}).limit(10);
  if(error) throw error;
  await sendMessage(id,data?.length ? "📢 الإعلانات:\n\n"+data.map((a:any)=>`🔸 ${a.title}\n${a.content}`).join("\n\n") : "📢 لا توجد إعلانات.",mainKeyboard);
}

export async function showEvents(id:number) {
  const {data,error}=await supabase.from("events").select("title,description,event_date,event_type").gte("event_date",new Date().toISOString()).order("event_date").limit(10);
  if(error) throw error;
  await sendMessage(id,data?.length ? "📅 المواعيد:\n\n"+data.map((e:any)=>`📌 ${e.title}\n${e.description ?? ""}\n🕒 ${new Date(e.event_date).toLocaleString("ar-EG")}`).join("\n\n") : "📅 لا توجد مواعيد قادمة.",mainKeyboard);
}