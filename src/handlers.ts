import { config } from "./config.js";
import { supabase } from "./supabase.js";
import { mainKeyboard, sendMessage } from "./telegram.js";
import { adminKeyboard } from "./keyboards.js";
import { isAdmin, adminMenu, generateCodes, listStudents, listSubjects, listLectures, sendBroadcast } from "./admin.js";
import { showSubjects, showLatest, showAnnouncements, showEvents } from "./content.js";
import { searchLectures } from "./search.js";

type TelegramDocument = { file_id: string; file_name?: string };
type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  from?: { id: number };
  text?: string;
  document?: TelegramDocument;
};
type TelegramUpdate = { update_id: number; message?: TelegramMessage };

async function markUpdate(updateId: number) {
  const { error } = await supabase.from("telegram_updates").insert({ update_id: updateId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function getStudent(telegramId: number) {
  const { data, error } = await supabase.from("students")
    .select("id,telegram_id,status")
    .eq("telegram_id", telegramId).maybeSingle();
  if (error) throw error;
  return data;
}

async function getSession(id:number) {
  const {data,error}=await supabase.from("bot_sessions")
    .select("state,data").eq("telegram_id",id).maybeSingle();
  if(error) throw error;
  return data;
}

async function saveSession(id:number,state:string,data:Record<string,unknown>={}) {
  const {error}=await supabase.from("bot_sessions").upsert({
    telegram_id:id,state,data,updated_at:new Date().toISOString()
  });
  if(error) throw error;
}

async function clearSession(id:number) {
  await supabase.from("bot_sessions").delete().eq("telegram_id",id);
}

async function logActivity(id:number,action:string,metadata:Record<string,unknown>={}) {
  await supabase.from("activity_logs").insert({telegram_id:id,action,metadata});
}

async function askForCode(id:number) {
  await saveSession(id,"awaiting_access_code");
  await sendMessage(id,"أهلًا بيك في 🤖 إدارة أعمال AI\n\nابعتلي كود الدخول الخاص بيك.");
}

async function activateStudent(id:number,code:string) {
  const normalized=code.trim().toUpperCase();
  const {data:accessCode,error}=await supabase.from("access_codes")
    .select("id,code,status").eq("code",normalized).maybeSingle();
  if(error) throw error;
  if(!accessCode || accessCode.status!=="available")
    return void await sendMessage(id,"❌ الكود غير صالح أو تم استخدامه بالفعل.");

  const {data:existing}=await supabase.from("students").select("id").eq("telegram_id",id).maybeSingle();
  if(existing) return void await sendMessage(id,"الحساب ده مسجل بالفعل.",mainKeyboard);

  const {data:student,error:studentError}=await supabase.from("students").insert({
    telegram_id:id,access_code_id:accessCode.id,status:"active",last_activity_at:new Date().toISOString()
  }).select("id").single();
  if(studentError) throw studentError;

  const {data:updated,error:codeError}=await supabase.from("access_codes").update({
    status:"used",bound_telegram_id:id,used_at:new Date().toISOString()
  }).eq("id",accessCode.id).eq("status","available").select("id");
  if(codeError || !updated?.length) {
    await supabase.from("students").delete().eq("id",student.id);
    if(codeError) throw codeError;
    return void await sendMessage(id,"❌ الكود اتستخدم في نفس اللحظة. جرّب كودًا آخر.");
  }

  await clearSession(id);
  await logActivity(id,"student_registered");
  await sendMessage(id,"✅ تم تفعيل حسابك بنجاح!\n\nأهلاً بيك في إدارة أعمال AI 🤖",mainKeyboard);
}

async function startLectureUpload(id:number,fileId:string,fileName?:string) {
  await saveSession(id,"lecture_subject",{file_id:fileId,file_name:fileName ?? ""});
  const {data,error}=await supabase.from("subjects").select("id,name").order("name");
  if(error) throw error;
  if(!data?.length) {
    await clearSession(id);
    return void await sendMessage(id,"❌ مفيش مواد. أضف مادة الأول من 📚 المواد.",adminKeyboard);
  }
  await sendMessage(id,"📤 الملف استلم. اختار رقم المادة:\n\n"+data.map((s:any,i:number)=>`${i+1}. ${s.name}`).join("\n")+
    "\n\nابعت رقم المادة.");
}

async function handleAdminFlow(id:number,text:string,session:any) {
  if(session?.state==="admin_code_count") {
    const count=Number(text);
    if(!Number.isInteger(count)||count<1||count>500) return void await sendMessage(id,"❌ اكتب رقم من 1 إلى 500.");
    await clearSession(id); await generateCodes(id,count); return;
  }
  if(session?.state==="admin_subject_add") {
    const name=text.trim();
    if(name.length<2) return void await sendMessage(id,"❌ اسم المادة قصير جدًا.");
    const {error}=await supabase.from("subjects").insert({name});
    if(error) {
      if(error.code==="23505") return void await sendMessage(id,"⚠️ المادة موجودة بالفعل.",adminKeyboard);
      throw error;
    }
    await clearSession(id); await sendMessage(id,"✅ تم إضافة المادة.",adminKeyboard); return;
  }
  if(session?.state==="admin_announce_title") {
    await saveSession(id,"admin_announce_content",{title:text}); 
    await sendMessage(id,"📝 ابعت نص الإعلان.");
    return;
  }
  if(session?.state==="admin_announce_content") {
    const title=String(session.data?.title ?? "إعلان");
    const {data,error}=await supabase.from("announcements").insert({title,content:text}).select("id").single();
    if(error) throw error;
    await clearSession(id);
    await sendBroadcast(id,`📢 ${title}\n\n${text}`);
    await logActivity(id,"announcement_created",{announcement_id:data.id});
    return;
  }
  if(session?.state==="admin_lecture_subject") {
    const n=Number(text);
    const {data}=await supabase.from("subjects").select("id,name").order("name");
    const subject=data?.[n-1];
    if(!subject) return void await sendMessage(id,"❌ رقم مادة غير صحيح.");
    await saveSession(id,"admin_lecture_number",{...(session.data??{}),subject_id:subject.id,subject_name:subject.name});
    await sendMessage(id,"🔢 اكتب رقم المحاضرة (مثال: 1).");
    return;
  }
  if(session?.state==="admin_lecture_number") {
    const n=Number(text);
    if(!Number.isInteger(n)||n<1) return void await sendMessage(id,"❌ اكتب رقم محاضرة صحيح.");
    await saveSession(id,"admin_lecture_title",{...(session.data??{}),lecture_number:n});
    await sendMessage(id,"📝 اكتب عنوان المحاضرة.");
    return;
  }
  if(session?.state==="admin_lecture_title") {
    await saveSession(id,"admin_lecture_professor",{...(session.data??{}),title:text});
    await sendMessage(id,"👨‍🏫 اكتب اسم الدكتور/المحاضر.");
    return;
  }
  if(session?.state==="admin_lecture_professor") {
    const d=session.data??{};
    const {error}=await supabase.from("lectures").insert({
      subject_id:d.subject_id,lecture_number:d.lecture_number,title:d.title,
      professor_name:text,telegram_file_id:d.file_id
    });
    if(error) {
      if(error.code==="23505") return void await sendMessage(id,"❌ رقم المحاضرة موجود بالفعل لهذه المادة.",adminKeyboard);
      throw error;
    }
    await clearSession(id);
    await logActivity(id,"lecture_published",{subject_id:d.subject_id,lecture_number:d.lecture_number});
    await sendMessage(id,"✅ تم نشر المحاضرة بنجاح.",adminKeyboard);
    return;
  }
}

export async function handleUpdate(update:TelegramUpdate) {
  if(!(await markUpdate(update.update_id))) return;
  const message=update.message;
  if(!message?.from) return;
  const id=message.from.id;
  const text=message.text?.trim() ?? "";
  const document=message.document;

  if(isAdmin(id)) {
    const session=await getSession(id);
    if(text==="/admin" || text==="🏠 القائمة الرئيسية") return void await adminMenu(id);
    if(text==="🎟️ توليد أكواد") {
      await saveSession(id,"admin_code_count");
      return void await sendMessage(id,"🎟️ كام كود عايز تولّد؟ (1 إلى 500)");
    }
    if(text==="👥 الطلاب") return void await listStudents(id);
    if(text==="📚 المواد") {
      await listSubjects(id);
      return void await sendMessage(id,"\nلإضافة مادة جديدة اكتب: /addsubject");
    }
    if(text==="/addsubject") {
      await saveSession(id,"admin_subject_add");
      return void await sendMessage(id,"📚 اكتب اسم المادة الجديدة.");
    }
    if(text==="📤 رفع محاضرة") {
      await saveSession(id,"awaiting_lecture_file");
      return void await sendMessage(id,"📤 ابعت ملف PDF كمستند Document.");
    }
    if(document && session?.state==="awaiting_lecture_file")
      return void await startLectureUpload(id,document.file_id,document.file_name);
    if(text==="📢 إرسال إشعار") {
      await saveSession(id,"admin_announce_title");
      return void await sendMessage(id,"📢 اكتب عنوان الإعلان.");
    }
    if(text==="📊 الإحصائيات") {
      const [s,c,l,a,e]=await Promise.all([
        supabase.from("students").select("id",{count:"exact",head:true}),
        supabase.from("access_codes").select("id",{count:"exact",head:true}),
        supabase.from("lectures").select("id",{count:"exact",head:true}),
        supabase.from("announcements").select("id",{count:"exact",head:true}),
        supabase.from("events").select("id",{count:"exact",head:true})
      ]);
      return void await sendMessage(id,`📊 الإحصائيات\n\n👥 الطلاب: ${s.count??0}\n🎟️ الأكواد: ${c.count??0}\n📚 المحاضرات: ${l.count??0}\n📢 الإعلانات: ${a.count??0}\n📅 المواعيد: ${e.count??0}`,adminKeyboard);
    }
    if(text==="🗑️ حذف محتوى") return void await listLectures(id);
    if(text==="📅 إدارة المواعيد") return void await sendMessage(id,"📅 إدارة المواعيد التفصيلية هنضيفها في الخطوة التالية.",adminKeyboard);
    if(text==="🏠 القائمة الرئيسية") return void await adminMenu(id);
    if(session) {
      await handleAdminFlow(id,text,session);
      return;
    }
    if(text==="/start") return void await adminMenu(id);
  }

  if(text==="/start") {
    const student=await getStudent(id);
    if(student?.status==="blocked") return void await sendMessage(id,"⛔ حسابك محظور حاليًا.");
    if(student) return void await sendMessage(id,"أهلًا بيك تاني 👋",mainKeyboard);
    return void await askForCode(id);
  }

  const session=await getSession(id);
  if(session?.state==="awaiting_access_code") return void await activateStudent(id,text);
  if(session?.state==="searching") {
    await clearSession(id);
    return void await searchLectures(id,text);
  }

  const student=await getStudent(id);
  if(!student || student.status!=="active") return void await askForCode(id);
  await supabase.from("students").update({last_activity_at:new Date().toISOString()}).eq("telegram_id",id);

  switch(text) {
    case "📚 المحاضرات": await showSubjects(id); break;
    case "🔍 البحث": await saveSession(id,"searching"); await sendMessage(id,"🔍 اكتب اسم المادة أو عنوان المحاضرة."); break;
    case "🤖 اسأل AI": await sendMessage(id,"🤖 AI/RAG هنفعّله بعد تجهيز قاعدة المعرفة.",mainKeyboard); break;
    case "🆕 آخر ما نزل": await showLatest(id); break;
    case "📢 الإعلانات": await showAnnouncements(id); break;
    case "📅 المواعيد": await showEvents(id); break;
    default: await sendMessage(id,"اختار من القائمة 👇",mainKeyboard);
  }
}