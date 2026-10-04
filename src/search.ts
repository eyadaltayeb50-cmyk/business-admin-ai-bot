import {supabase} from "./supabase.js";
import {sendDocument,sendMessage,mainKeyboard} from "./telegram.js";
export async function searchLectures(id:number,query:string){
  const q=query.trim().replace(/[%_,]/g," ");if(!q)return void await sendMessage(id,"اكتب كلمة للبحث.",mainKeyboard);
  const {data:subjects}=await supabase.from("subjects").select("id,name");
  const ids=(subjects??[]).filter((s:any)=>s.name.toLowerCase().includes(q.toLowerCase())).map((s:any)=>s.id);
  const filters=["title.ilike.%"+q+"%","professor_name.ilike.%"+q+"%"];if(ids.length)filters.push("subject_id.in.("+ids.join(",")+")");
  const number=Number(q);if(Number.isInteger(number)&&number>0)filters.push("lecture_number.eq."+number);
  const {data,error}=await supabase.from("lectures").select("lecture_number,title,professor_name,telegram_file_id").or(filters.join(",")).order("created_at",{ascending:false}).limit(10);
  if(error)throw error;if(!data?.length)return void await sendMessage(id,"🔎 مفيش نتائج.",mainKeyboard);
  await sendMessage(id,"🔎 النتائج:");for(const l of data)await sendDocument(id,l.telegram_file_id,"📚 محاضرة "+l.lecture_number+" — "+l.title+"\n👨‍🏫 "+(l.professor_name??""));
  await sendMessage(id,"رجوع للقائمة الرئيسية 👇",mainKeyboard);
}
