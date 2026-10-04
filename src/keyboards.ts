import type { TelegramReplyMarkup } from "./telegram.js";

export const adminKeyboard: TelegramReplyMarkup = {
  keyboard: [
    [{ text: "🎟️ توليد أكواد" }, { text: "👥 الطلاب" }],
    [{ text: "📚 المواد" }, { text: "📤 رفع محاضرة" }],
    [{ text: "🗑️ حذف محتوى" }, { text: "📢 إرسال إشعار" }],
    [{ text: "📅 إدارة المواعيد" }, { text: "📊 الإحصائيات" }],
    [{ text: "⚙️ أدوات الإدارة" }],
    [{ text: "🏠 القائمة الرئيسية" }]
  ],
  resize_keyboard: true
};

export const adminToolsKeyboard: TelegramReplyMarkup = {
  keyboard: [
    [{ text: "👥 إدارة الطلاب" }, { text: "🎟️ إدارة الأكواد" }],
    [{ text: "📚 إدارة المواد" }, { text: "📅 إدارة المواعيد" }],
    [{ text: "🔎 إعادة فهرسة" }, { text: "📊 إحصائيات متقدمة" }],
    [{ text: "🏠 لوحة الإدارة" }]
  ],
  resize_keyboard: true
};
