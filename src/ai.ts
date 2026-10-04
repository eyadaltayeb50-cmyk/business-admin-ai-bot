import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { supabase } from "./supabase.js";

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey, timeout: 45_000, maxRetries: 2 }) : null;
const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.5";
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

function requireAI() {
  if (!client) throw new Error("OPENAI_API_KEY is not configured.");
  return client;
}

function normalize(text: string) {
  return text.replace(/\u0000/g, "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function chunkText(text: string, size = 4200, overlap = 500) {
  const clean = normalize(text);
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    const part = clean.slice(start, end).trim();
    if (part.length >= 80) chunks.push(part);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export async function indexLecture(lectureId: string, telegramFileUrl: string) {
  const ai = requireAI();
  const pdfResponse = await fetch(telegramFileUrl);
  if (!pdfResponse.ok) throw new Error(`Telegram file download failed: ${pdfResponse.status}`);
  const buffer = Buffer.from(await pdfResponse.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  let text = "";
  try {
    const result = await parser.getText();
    text = result.text ?? "";
  } finally {
    await parser.destroy();
  }

  const chunks = chunkText(text);
  if (!chunks.length) throw new Error("No extractable text was found in this PDF.");

  await supabase.from("document_chunks").delete().eq("lecture_id", lectureId);

  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 64) {
    const batch = chunks.slice(i, i + 64);
    const response = await ai.embeddings.create({ model: embeddingModel, input: batch });
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    embeddings.push(...ordered.map(x => x.embedding));
  }

  const rows = chunks.map((content, index) => ({
    lecture_id: lectureId,
    chunk_index: index,
    content,
    embedding: embeddings[index]
  }));

  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + 50));
    if (error) throw error;
  }

  const { error } = await supabase.from("lectures")
    .update({ index_status: "indexed", index_error: null })
    .eq("id", lectureId);
  if (error) throw error;

  return chunks.length;
}

export async function askCourseAI(question: string) {
  const ai = requireAI();
  const embedding = await ai.embeddings.create({ model: embeddingModel, input: question });
  const vector = embedding.data[0]?.embedding;
  if (!vector) throw new Error("Embedding generation failed.");

  const { data: matches, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: vector,
    match_threshold: 0.22,
    match_count: 8
  });
  if (error) throw error;

  const rows = (matches ?? []) as Array<{lecture_id:string; content:string; similarity:number}>;
  if (!rows.length) {
    return "مش لاقي إجابة موثوقة في المحاضرات المرفوعة حاليًا. ابعتلي اسم المحاضرة أو ارفع المحتوى الأول.";
  }

  const lectureIds = [...new Set(rows.map(x => x.lecture_id))];
  const { data: lectures } = await supabase.from("lectures")
    .select("id,lecture_number,title,professor_name")
    .in("id", lectureIds);

  const lectureMap = new Map((lectures ?? []).map((l:any) => [l.id, l]));
  const context = rows.map((r, i) => {
    const l = lectureMap.get(r.lecture_id);
    const source = l ? `محاضرة ${l.lecture_number}: ${l.title}` : "محاضرة";
    return `[مصدر ${i + 1} | ${source}]\n${r.content}`;
  }).join("\n\n---\n\n");

  const response = await ai.responses.create({
    model: chatModel,
    instructions:
      "أنت مساعد تعليمي لطلاب الفرقة الأولى إدارة أعمال. أجب بالعربية المصرية الواضحة. " +
      "اعتمد فقط على المصادر الموجودة في السياق. لا تخترع معلومة خارجها. " +
      "لو السؤال غير موجود في المصادر قل بوضوح إن المعلومات المتاحة لا تكفي. " +
      "لو طلب الطالب تلخيصًا أو أسئلة، نفذ ذلك من المصادر فقط. " +
      "اذكر في نهاية الإجابة أسماء المحاضرات التي اعتمدت عليها.",
    input: `السؤال:\n${question}\n\nالسياق:\n${context}`
  });

  return response.output_text || "مقدرتش أطلع إجابة دلوقتي.";
}
