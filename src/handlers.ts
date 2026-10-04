import { config } from "./config.js";
import { supabase } from "./supabase.js";
import { mainKeyboard, sendMessage } from "./telegram.js";

type TelegramMessage = { message_id: number; chat: { id: number }; from?: { id: number }; text?: string };
type TelegramUpdate = { update_id: number; message?: TelegramMessage };

const isAdmin = (id: number) => id === config.adminTelegramId;

async function markUpdate(updateId: number) {
  const { error } = await supabase.from("telegram_updates").insert({ update_id: updateId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function getStudent(telegramId: number) {
  const { data, error } = await supabase.from("students").select("id,telegram_id,status").eq("telegram_id", telegramId).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveSession(telegramId: number, state: string, data: Record<string, unknown> = {}) {
  const { error } = await supabase.from("bot_sessions").upsert({
    telegram_id: telegramId, state, data, updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

async function logActivity(telegramId: number, action: string, metadata: Record<string, unknown> = {}) {
  await supabase.from("activity_logs").insert({ telegram_id: telegramId, action, metadata });
}

async function askForCode(id: number) {
  await saveSession(id, "awaiting_access_code");
  await sendMessage(id, "أهلًا بيك في 🤖 إدارة أعمال AI\n\nابعتلي كود الدخول الخاص بيك علشان نفعّل حسابك.");
}

async function activateStudent(id: number, code: string) {
  const normalized = code.trim().toUpperCase();
  const { data: accessCode, error } = await supabase.from("access_codes")
    .select("id,code,status").eq("code", normalized).maybeSingle();
  if (error) throw error;

  if (!accessCode || accessCode.status !== "available") {
    await sendMessage(id, "❌ الكود غير صالح أو تم استخدامه بالفعل. جرّب كودًا آخر.");
    return;
  }

  const { data: existing } = await supabase.from("students").select("id").eq("telegram_id", id).maybeSingle();
  if (existing) {
    await sendMessage(id, "الحساب ده مسجل بالفعل.", mainKeyboard);
    return;
  }

  const { data: student, error: studentError } = await supabase.from("students")
    .insert({ telegram_id: id, access_code_id: accessCode.id, status: "active", last_activity_at: new Date().toISOString() })
    .select("id").single();
  if (studentError) throw studentError;

  const { error: codeError } = await supabase.from("access_codes")
    .update({ status: "used", bound_telegram_id: id, used_at: new Date().toISOString() })
    .eq("id", accessCode.id).eq("status", "available");

  if (codeError) {
    await supabase.from("students").delete().eq("id", student.id);
    throw codeError;
  }

  await supabase.from("bot_sessions").delete().eq("telegram_id", id);
  await logActivity(id, "student_registered");
  await sendMessage(id, "✅ تم تفعيل حسابك بنجاح!\n\nأهلاً بيك في إدارة أعمال AI 🤖", mainKeyboard);
}

export async function handleUpdate(update: TelegramUpdate) {
  if (!(await markUpdate(update.update_id))) return;
  const message = update.message;
  if (!message?.from || !message.text) return;

  const id = message.from.id;
  const text = message.text.trim();

  if (text === "/start") {
    const student = await getStudent(id);
    if (student?.status === "blocked") return void await sendMessage(id, "⛔ حسابك محظور حاليًا. تواصل مع الإدارة.");
    if (student) return void await sendMessage(id, "أهلًا بيك تاني 👋", mainKeyboard);
    return void await askForCode(id);
  }

  if (text === "/admin") {
    if (!isAdmin(id)) return void await sendMessage(id, "⛔ الأمر ده متاح للإدارة فقط.");
    await sendMessage(id, "👑 لوحة إدارة أعمال AI\n\nالنسخة الأولى قيد البناء. هنضيف أدوات الإدارة خطوة بخطوة.");
    await logActivity(id, "admin_login");
    return;
  }

  const { data: session } = await supabase.from("bot_sessions").select("state").eq("telegram_id", id).maybeSingle();
  if (session?.state === "awaiting_access_code") return void await activateStudent(id, text);

  const student = await getStudent(id);
  if (!student || student.status !== "active") return void await askForCode(id);

  await supabase.from("students").update({ last_activity_at: new Date().toISOString() }).eq("telegram_id", id);

  switch (text) {
    case "📚 المحاضرات":
      await sendMessage(id, "📚 قسم المحاضرات جاهز، وسيتم ربط المواد والمحاضرات في الخطوة التالية.", mainKeyboard); break;
    case "🔍 البحث":
      await saveSession(id, "searching");
      await sendMessage(id, "🔍 اكتب اسم المادة أو عنوان المحاضرة اللي بتدور عليها."); break;
    case "🤖 اسأل AI":
      await sendMessage(id, "🤖 ميزة AI/RAG هتتضاف بعد اكتمال نظام المحاضرات.", mainKeyboard); break;
    case "🆕 آخر ما نزل":
      await sendMessage(id, "🆕 لسه مفيش محتوى منشور في النسخة الحالية.", mainKeyboard); break;
    case "📢 الإعلانات":
      await sendMessage(id, "📢 مفيش إعلانات حاليًا.", mainKeyboard); break;
    case "📅 المواعيد":
      await sendMessage(id, "📅 مفيش مواعيد مضافة حاليًا.", mainKeyboard); break;
    default:
      await sendMessage(id, "اختار من القائمة 👇", mainKeyboard);
  }
}