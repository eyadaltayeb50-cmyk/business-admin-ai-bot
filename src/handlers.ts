import {supabase} from "./supabase.js";
import {mainKeyboard,sendMessage,answerCallbackQuery} from "./telegram.js";
import {adminKeyboard} from "./keyboards.js";
import {isAdmin,adminMenu,adminTools,generateCodes,listStudents,showStudent,toggleStudent,resetStudentCode,listSubjects,listLectures,listEvents,broadcast,createEvent} from "./admin.js";
import {showSubjects,showSubjectLectures,sendLectureById,showLatest,showAnnouncements,showEvents} from "./content.js";
import {searchLectures} from "./search.js";

type Message={message_id:number;chat:{id:number};from?:{id:number};text?:string;document?:{file_id:string;file_name?:string;mime_type?:string}};
type Callback={id:string;from:{id:number};data?:string};
type Update={update_id:number;message?:Message;callback_query?:Callback};

async function markUpdate(id:number){const {error}=await supabase.from("telegram_updates").insert({update_id:id});if(!error)return true;if(error.code==="23505")return false;throw error;}
async function student(id:number){const {data,error}=await supabase.from("students").select("id,telegram_id,status").eq("telegram_id",id).maybeSingle();if(error)throw error;return data;}
async function session(id:number){const {data,error}=await supabase.from("bot_sessions").select("state,data").eq("telegram_id",id).maybeSingle();if(error)throw error;return data;}
async function save(id:number,state:string,data:Record<string,unknown>={}){const {error}=await supabase.from("bot_sessions").upsert({telegram_id:id,state,data,updated_at:new Date().toISOString()});if(error)throw error;}
async function clear(id:number){await supabase.from("bot_sessions").delete().eq("telegram_id",id);}
async function log(id:number,action:string,metadata:Record<string,unknown>={}){await supabase.from("activity_logs").insert({telegram_id:id,action,metadata});}

async function code(id:number,value:string){
  const {data:c,error}=await supabase.from("access_codes").select("id,status").eq("code",value.trim().toUpperCase()).maybeSingle();if(error)throw error;
  if(!c||c.status!=="available")return void await sendMessage(id,"❌ الكود غير صالح أو مستخدم.");
  const {data:s,error:se}=await supabase.from("students").insert({telegram_id:id,access_code_id:c.id,status:"active",last_activity_at:new Date().toISOString()}).select("id").single();if(se)throw se;
  const {data:u,error:ue}=await supabase.from("access_codes").update({status:"used",bound_telegram_id:id,used_at:new Date().toISOString()}).eq("id",c.id).eq("status","available").select("id");
  if(ue||!u?.length){await supabase.from("students").delete().eq("id",s.id);if(ue)throw ue;return void await sendMessage(id,"❌ الكود اتستخدم. جرّب كودًا آخر.");}
  await clear(id);await log(id,"student_registered");await sendMessage(id,"✅ تم تفعيل حسابك بنجاح!",mainKeyboard);
}
function egyptDateToIso(raw:string){
  const m=raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);if(!m)return null;
  const [,y,mo,d,h,mi]=m;return new Date(Date.UTC(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi))-2*60*60*1000).toISOString();
}
async function adminFlow(id:number,text:string,s:any){
  if(s?.state==="admin_code_count"){const n=Number(text);if(!Number.isInteger(n)||n<1||n>500)return void await sendMessage(id,"❌ اكتب رقم من 1 إلى 500.");await clear(id);return void await generateCodes(id,n);}
  if(s?.state==="admin_subject_add"){const name=text.trim();if(name.length<2)return void await sendMessage(id,"❌ اسم المادة قصير.");const {error}=await supabase.from("subjects").insert({name});if(error?.code==="23505")return void await sendMessage(id,"⚠️ المادة موجودة.");if(error)throw error;await clear(id);return void await sendMessage(id,"✅ تمت إضافة المادة.",adminKeyboard);}
  if(s?.state==="announce_title"){await save(id,"announce_content",{title:text});return void await sendMessage(id,"📝 ابعت نص الإعلان.");}
  if(s?.state==="announce_content"){const title=String(s.data?.title??"إعلان");const {error}=await supabase.from("announcements").insert({title,content:text});if(error)throw error;await clear(id);return void await broadcast(id,"📢 "+title+"\n\n"+text);}
  if(s?.state==="event_title"){await save(id,"event_desc",{title:text});return void await sendMessage(id,"📝 اكتب وصف الموعد.");}
  if(s?.state==="event_desc"){await save(id,"event_date",{...(s.data??{}),description:text});return void await sendMessage(id,"🕒 اكتب: 2026-10-10 18:00 (بتوقيت مصر)");}
  if(s?.state==="event_date"){const iso=egyptDateToIso(text);if(!iso)return void await sendMessage(id,"❌ صيغة التاريخ غير صحيحة.");const d=s.data??{};await createEvent(id,String(d.title),String(d.description??""),iso);return void await clear(id);}
  if(s?.state==="lecture_subject"){const n=Number(text);const {data}=await supabase.from("subjects").select("id,name").order("name");const sub=data?.[n-1];if(!sub)return void await sendMessage(id,"❌ رقم المادة غير صحيح.");await save(id,"lecture_number",{...(s.data??{}),subject_id:sub.id,subject_name:sub.name});return void await sendMessage(id,"🔢 اكتب رقم المحاضرة.");}
  if(s?.state==="lecture_number"){const n=Number(text);if(!Number.isInteger(n)||n<1)return void await sendMessage(id,"❌ رقم غير صحيح.");await save(id,"lecture_title",{...(s.data??{}),lecture_number:n});return void await sendMessage(id,"📝 اكتب عنوان المحاضرة.");}
  if(s?.state==="lecture_title"){await save(id,"lecture_professor",{...(s.data??{}),title:text});return void await sendMessage(id,"👨‍🏫 اكتب اسم الدكتور.");}
  if(s?.state==="lecture_professor"){
    const d=s.data??{};
    const {error}=await supabase.from("lectures").insert({subject_id:d.subject_id,lecture_number:d.lecture_number,title:d.title,professor_name:text,telegram_file_id:d.file_id});
    if(error?.code==="23505")return void await sendMessage(id,"❌ المحاضرة موجودة بالفعل.",adminKeyboard);
    if(error)throw error;
    await clear(id);
    await log(id,"lecture_published",{subject_id:d.subject_id,lecture_number:d.lecture_number});
    return void await sendMessage(id,"✅ تم نشر المحاضرة بنجاح.",adminKeyboard);
  }
}

export async function handleUpdate(update:Update){
  if(!(await markUpdate(update.update_id)))return;
  const cb=update.callback_query;
  if(cb?.data){
    const id=cb.from.id,data=cb.data;
    if(data.startsWith("subject:")){await answerCallbackQuery(cb.id);return void await showSubjectLectures(id,data.slice(8));}
    if(data.startsWith("lecture:")){await answerCallbackQuery(cb.id);return void await sendLectureById(id,data.slice(8));}
    if(data.startsWith("deletelecture:")&&isAdmin(id)){await answerCallbackQuery(cb.id);await save(id,"delete_confirm",{lecture_id:data.slice(14)});return void await sendMessage(id,"⚠️ متأكد إنك عايز تحذف المحاضرة؟ اكتب: نعم / لا",adminKeyboard);}
    if(data.startsWith("publishlecture:")&&isAdmin(id)){
      await answerCallbackQuery(cb.id,"جاري فهرسة AI...");
      const lectureId=data.slice(15),s=await session(id);if(s?.state!=="publish_confirm"||String(s.data?.lecture_id)!==lectureId)return;
      try{const url=await getTelegramFileUrl(String(s.data?.file_id));const chunks=await indexLecture(lectureId,url);await clear(id);await log(id,"lecture_published",{lecture_id:lectureId,chunks});return void await sendMessage(id,"✅ تم النشر والفهرسة.\n🧩 المقاطع: "+chunks,adminKeyboard);}
      catch(e){await supabase.from("lectures").update({index_status:"failed",index_error:e instanceof Error?e.message:"unknown"}).eq("id",lectureId);return void await sendMessage(id,"⚠️ المحاضرة محفوظة لكن فهرسة AI فشلت. راجع OPENAI_API_KEY ثم أعد رفع الملف.");}
    }
    if(data.startsWith("cancelpublish:")&&isAdmin(id)){await answerCallbackQuery(cb.id,"تم الإلغاء");await supabase.from("lectures").delete().eq("id",data.slice(14));await clear(id);return void await sendMessage(id,"❌ تم إلغاء النشر.",adminKeyboard);}
    if(data.startsWith("student:")&&isAdmin(id)){await answerCallbackQuery(cb.id);return void await showStudent(id,data.slice(8));}
    if(data.startsWith("student_toggle:")&&isAdmin(id)){await answerCallbackQuery(cb.id);return void await toggleStudent(id,data.slice(15));}
    if(data.startsWith("student_reset:")&&isAdmin(id)){await answerCallbackQuery(cb.id);return void await resetStudentCode(id,data.slice(14));}
    if(data.startsWith("deletesubject:")&&isAdmin(id)){await answerCallbackQuery(cb.id);const {error}=await supabase.from("subjects").delete().eq("id",data.slice(14));if(error)throw error;return void await sendMessage(id,"🗑️ تم حذف المادة وكل محاضراتها.",adminKeyboard);}
    if(data.startsWith("deleteevent:")&&isAdmin(id)){await answerCallbackQuery(cb.id);const {error}=await supabase.from("events").delete().eq("id",data.slice(12));if(error)throw error;return void await sendMessage(id,"🗑️ تم حذف الموعد.",adminKeyboard);}
    return;
  }
  const m=update.message;if(!m?.from)return;const id=m.from.id,text=m.text?.trim()??"",doc=m.document;
  if(isAdmin(id)){
    const s=await session(id);
    if(s?.state==="delete_confirm"&&(text==="نعم"||text==="لا")){if(text==="لا"){await clear(id);return void await adminMenu(id);}const lid=String(s.data?.lecture_id??"");const {error}=await supabase.from("lectures").delete().eq("id",lid);if(error)throw error;await clear(id);return void await sendMessage(id,"🗑️ تم حذف المحاضرة.",adminKeyboard);}
    if(doc&&s?.state==="awaiting_lecture_file"){if(doc.mime_type&&doc.mime_type!=="application/pdf"&&!doc.file_name?.toLowerCase().endsWith(".pdf"))return void await sendMessage(id,"❌ لازم تبعت ملف PDF كمستند.");await save(id,"lecture_subject",{file_id:doc.file_id,file_name:doc.file_name??""});const {data}=await supabase.from("subjects").select("name").order("name");return void await sendMessage(id,"📤 الملف استلم. ابعت رقم المادة:\n\n"+(data??[]).map((x:any,i:number)=>(i+1)+". "+x.name).join("\n"));}
    if(text==="/admin"||text==="🏠 لوحة الإدارة"||text==="🏠 القائمة الرئيسية")return void await adminMenu(id);
    if(text==="🎟️ توليد أكواد"){await save(id,"admin_code_count");return void await sendMessage(id,"🎟️ كام كود؟ (1-500)");}
    if(text==="👥 الطلاب"||text==="👥 إدارة الطلاب")return void await listStudents(id);
    if(text==="📚 المواد"||text==="📚 إدارة المواد")return void await listSubjects(id);
    if(text==="/addsubject"){await save(id,"admin_subject_add");return void await sendMessage(id,"📚 اسم المادة؟");}
    if(text==="📤 رفع محاضرة"){await save(id,"awaiting_lecture_file");return void await sendMessage(id,"📤 ابعت PDF كمستند.");}
    if(text==="🗑️ حذف محتوى")return void await listLectures(id);
    if(text==="📢 إرسال إشعار"){await save(id,"announce_title");return void await sendMessage(id,"📢 عنوان الإعلان؟");}
    if(text==="📅 إدارة المواعيد")return void await listEvents(id);
    if(text==="⚙️ أدوات الإدارة")return void await adminTools(id);
    if(text==="🎟️ إدارة الأكواد"){const {data}=await supabase.from("access_codes").select("code,status,bound_telegram_id").order("created_at",{ascending:false}).limit(30);return void await sendMessage(id,data?.length?data.map((c:any)=>(c.status==="available"?"🟢 ":"🔴 ")+c.code+" — "+(c.bound_telegram_id??"-")).join("\n"):"لا توجد أكواد.",adminKeyboard);}
    if(text==="🔎 إعادة فهرسة")return void await sendMessage(id,"ℹ️ الفهرسة تتم عند نشر المحاضرة. لو فشلت، ارفع الملف مرة أخرى بعد ضبط OPENAI_API_KEY.",adminKeyboard);
    if(text==="📊 إحصائيات متقدمة")return void await advancedStats(id);
    if(text==="📊 الإحصائيات")return void await basicStats(id);
    if(s){await adminFlow(id,text,s);return;}return;
  }
  if(text==="/start"){const st=await student(id);if(st?.status==="blocked")return void await sendMessage(id,"⛔ حسابك محظور.");if(st)return void await sendMessage(id,"أهلًا بيك تاني 👋",mainKeyboard);await save(id,"awaiting_access_code");return void await sendMessage(id,"أهلًا بيك في 🤖 إدارة أعمال AI\n\nابعت كود الدخول.");}
  const s=await session(id);
  if(s?.state==="awaiting_access_code")return void await code(id,text);
  if(s?.state==="searching"){await clear(id);return void await searchLectures(id,text);}
  if(s?.state==="asking_ai"){await clear(id);try{const answer=await askCourseAI(text);await log(id,"ai_question",{question:text});return void await sendMessage(id,"🤖 "+answer,mainKeyboard);}catch(e){console.error(e);return void await sendMessage(id,"⚠️ الـ AI غير متاح حاليًا. تأكد من OPENAI_API_KEY وفهرسة المحاضرات.");}}
  const st=await student(id);if(!st||st.status!=="active")return void await sendMessage(id,"اكتب /start الأول.");
  await supabase.from("students").update({last_activity_at:new Date().toISOString()}).eq("telegram_id",id);
  if(text==="📚 المحاضرات")return void await showSubjects(id);
  if(text==="🔍 البحث"){await save(id,"searching");return void await sendMessage(id,"🔍 اكتب اسم المادة أو عنوان المحاضرة أو رقم المحاضرة.");}
  if(text==="🆕 آخر ما نزل")return void await showLatest(id);
  if(text==="📢 الإعلانات")return void await showAnnouncements(id);
  if(text==="📅 المواعيد")return void await showEvents(id);
  if(text==="🤖 اسأل AI"){await save(id,"asking_ai");return void await sendMessage(id,"🤖 اسألني عن أي نقطة في المحاضرات.\nمثال: لخصلي محاضرة 2 / اشرح التخطيط / اعمل 10 MCQ");}
  await sendMessage(id,"اختار من القائمة 👇",mainKeyboard);
}
async function basicStats(id:number){
  const [a,b,c,d,e]=await Promise.all([supabase.from("students").select("id",{count:"exact",head:true}),supabase.from("access_codes").select("id",{count:"exact",head:true}),supabase.from("lectures").select("id",{count:"exact",head:true}),supabase.from("announcements").select("id",{count:"exact",head:true}),supabase.from("events").select("id",{count:"exact",head:true})]);
  await sendMessage(id,"📊 الإحصائيات\n\n👥 الطلاب: "+(a.count??0)+"\n🎟️ الأكواد: "+(b.count??0)+"\n📚 المحاضرات: "+(c.count??0)+"\n📢 الإعلانات: "+(d.count??0)+"\n📅 المواعيد: "+(e.count??0),adminKeyboard);
}
async function advancedStats(id:number){
  const [students,active,codes,chunks,logs]=await Promise.all([supabase.from("students").select("id",{count:"exact",head:true}),supabase.from("students").select("id",{count:"exact",head:true}).eq("status","active"),supabase.from("access_codes").select("id",{count:"exact",head:true}).eq("status","available"),supabase.from("document_chunks").select("id",{count:"exact",head:true}),supabase.from("activity_logs").select("id",{count:"exact",head:true})]);
  await sendMessage(id,"📊 متقدم\n\n👥 إجمالي: "+(students.count??0)+"\n🟢 نشطون: "+(active.count??0)+"\n🎟️ أكواد متاحة: "+(codes.count??0)+"\n🧩 مقاطع AI: "+(chunks.count??0)+"\n📝 نشاطات: "+(logs.count??0),adminKeyboard);
}
