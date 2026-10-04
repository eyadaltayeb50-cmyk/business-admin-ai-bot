import type { TelegramReplyMarkup } from "./telegram.js";

export const adminKeyboard: TelegramReplyMarkup = {
  keyboard: [
    [{ text: "🎟️ توليد أكواد" }, { text: "👥 الطلاب" }],
    [{ text: "📚 المواد" }, { text: "📤 رفع محاضرة" }],
    [{ text: "🗑️ حذف محتوى" }, { text: "📢 إرسال إشعار" }],
    [{ text: "📅 إدارة المواعيد" }, { text: "📊 الإحصائيات" }],
    [{ text: "🏠 القائمة الرئيسية" }]
  ],
  resize_keyboard: true
};