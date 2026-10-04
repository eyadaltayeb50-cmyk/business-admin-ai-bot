import {supabase} from "./supabase.js";
import {sendDocument,sendMessage,mainKeyboard} from "./telegram.js";

export async function showSubjects(id:number){
 const {data,error}=await supabase.from("subjects").select("id,name").order("name");
 if(error)throw error;
 if(!data?.length)return void await sendMessage(id,"📚 لسه مفيش مواد مضافة.",mainKeyboard);
 await sendMessage(id,"📚 اختار المادة:",{inline_keyboard:data.map((s:any)=>[{text:s.name,callback_data:`subject:${s.id}`}])});
}
export async function showSubjectLectures(id:number,subjectId:string){
 const {data,error}=await supabase.from("lectures").select("id,lecture_number,title,professor_name,telegram_file_id")
 .eq("subject_id",subjectId).order("lecture_number");
 if(error)throw error;
 if(!data?.length)return void await sendMessage(id,"📚 مفيش محاضرات للمادة دي.",mainKeyboard);
 await sendMessage(id,"📚 اختار المحاضرة:",{inline_keyboard:data.map((l:any)=>[{text:`محاضرة ${l.lecture_number} — ${l.title}`,callback_data:`lecture:${l.id}`}])});
}
export async function sendLectureById(id:number,lectureId:string){
 const {data,error}=await supabase.from("lectures").select("telegram_file_id,title,lecture_number,professor_name").eq("id",lectureId).maybeSingle();
 if(error)throw error;
 if(!data)return void await sendMessage(id,"❌ المحاضرة غير موجودة.",mainKeyboard);
 await sendDocument(id,data.telegram_file_id,`📚 محاضرة ${data.lecture_number} — ${data.title}\n👨‍🏫 ${data.professor_name??""}`);
}
export async function showLatest(id:number){
 const {data,error}=await supabase.from("lectures").select("id,lecture_number,title,professor_name,telegram_file_id,created_at").order("created_at",{ascending:false}).limit(5);
 if(error)throw error;
 if(!data?.length)return void await sendMessage(id,"🆕 لسه مفيش محاضرات.",mainKeyboard);
 for(const l of data)await sendDocument(id,l.telegram_file_id,`📚 محاضرة ${l.lecture_number} — ${l.title}\n👨‍🏫 ${l.professor_name??""}`);
}
export async function showAnnouncements(id:number){
 const {data,error}=await supabase.from("announcements").select("title,content,created_at").order("created_at",{ascending:false}).limit(10);
 if(error)throw error;
 await sendMessage(id,data?.length?"📢 الإعلانات:\n\n"+data.map((a:any)=>`🔸 ${a.title}\n${a.content}`).join("\n\n"):"📢 لا توجد إعلانات.",mainKeyboard);
}
export async function showEvents(id:number){
 const {data,error}=await supabase.from("events").select("id,title,description,event_date,event_type").gte("event_date",new Date().toISOString()).order("event_date").limit(10);
 if(error)throw error;
 await sendMessage(id,data?.length?"📅 المواعيد:\n\n"+data.map((e:any)=>`📌 ${e.title}\n${e.description??""}\n🕒 ${new Date(e.event_date).toLocaleString("ar-EG")}`).join("\n\n"):"📅 لا توجد مواعيد قادمة.",mainKeyboard);
}
