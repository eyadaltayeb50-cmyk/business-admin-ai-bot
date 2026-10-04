import { config } from "./config.js";

const api = `https://api.telegram.org/bot${config.telegramBotToken}`;

export type TelegramReplyMarkup = {
  keyboard?: Array<Array<{ text: string }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
};

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${api}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Telegram API ${method} failed: ${response.status} ${await response.text()}`);
  const json = (await response.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(json.description ?? `Telegram API ${method} failed`);
  return json.result;
}

export function sendMessage(chatId: number, text: string, replyMarkup?: TelegramReplyMarkup) {
  return telegramRequest("sendMessage", { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

export function sendDocument(chatId: number, fileId: string, caption?: string) {
  return telegramRequest("sendDocument", { chat_id: chatId, document: fileId, ...(caption ? { caption } : {}) });
}

export const mainKeyboard: TelegramReplyMarkup = {
  keyboard: [
    [{ text: "📚 المحاضرات" }, { text: "🔍 البحث" }],
    [{ text: "🤖 اسأل AI" }, { text: "🆕 آخر ما نزل" }],
    [{ text: "📢 الإعلانات" }, { text: "📅 المواعيد" }]
  ],
  resize_keyboard: true
};