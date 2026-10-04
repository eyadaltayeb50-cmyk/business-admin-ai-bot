import { config } from "./config.js";

const api = `https://api.telegram.org/bot${config.telegramBotToken}`;

export type TelegramReplyMarkup = {
  keyboard?: Array<Array<{text:string}>>;
  resize_keyboard?: boolean;
  inline_keyboard?: Array<Array<{text:string;callback_data:string}>>;
};

async function telegramRequest<T>(method:string, body:Record<string,unknown>):Promise<T>{
  const response = await fetch(`${api}/${method}`, {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body)
  });
  const json = await response.json() as {ok:boolean;result:T;description?:string};
  if(!response.ok || !json.ok) throw new Error(json.description ?? `Telegram API ${method} failed`);
  return json.result;
}

export function sendMessage(chatId:number,text:string,replyMarkup?:TelegramReplyMarkup){
  return telegramRequest("sendMessage",{chat_id:chatId,text,...(replyMarkup?{reply_markup:replyMarkup}:{})});
}
export function sendDocument(chatId:number,fileId:string,caption?:string){
  return telegramRequest("sendDocument",{chat_id:chatId,document:fileId,...(caption?{caption}:{})});
}
export function answerCallbackQuery(id:string,text?:string){
  return telegramRequest("answerCallbackQuery",{callback_query_id:id,...(text?{text}:{})});
}
export async function getFilePath(fileId:string){
  const file = await telegramRequest<{file_path?:string}>("getFile",{file_id:fileId});
  if(!file.file_path) throw new Error("Telegram file path not returned.");
  return file.file_path;
}
export async function getTelegramFileUrl(fileId:string){
  const path = await getFilePath(fileId);
  return `${api.replace(/\/bot[^/]+$/, "")}/file/bot${config.telegramBotToken}/${path}`;
}

export const mainKeyboard:TelegramReplyMarkup={keyboard:[
  [{text:"📚 المحاضرات"},{text:"🔍 البحث"}],
  [{text:"🤖 اسأل AI"},{text:"🆕 آخر ما نزل"}],
  [{text:"📢 الإعلانات"},{text:"📅 المواعيد"}]
],resize_keyboard:true};
