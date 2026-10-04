# إدارة أعمال AI 🤖

Telegram-first educational bot for first-year Business Administration students.

## What is complete
- Student activation with unique access codes
- Telegram ID binding and blocked accounts
- Student menu: lectures, search, AI, latest, announcements, events
- Subject -> lecture navigation
- PDF delivery directly from Telegram using Telegram file_id
- Lecture search by title, professor, subject, or lecture number
- Latest lectures
- Announcements and broadcast messaging
- Upcoming events with Egypt/Cairo time handling
- One Super Admin protected by ADMIN_TELEGRAM_ID
- Generate up to 500 access codes per batch
- Student activation/block/unblock/reset-code tools
- Subject management and lecture deletion
- Event management
- Lecture publish confirmation
- PDF text extraction
- RAG indexing with embeddings + Supabase pgvector
- Grounded AI answers from uploaded course material
- Activity logging and basic/advanced statistics
- Persistent bot sessions
- Duplicate Telegram update protection
- Vercel serverless webhook
- GitHub Actions TypeScript check

## Stack
Telegram Bot API + Node.js 22/TypeScript + Vercel + Supabase/PostgreSQL/pgvector + OpenAI + GitHub.

## Environment variables
Required:
- TELEGRAM_BOT_TOKEN
- ADMIN_TELEGRAM_ID
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

AI:
- OPENAI_API_KEY
- OPENAI_CHAT_MODEL=gpt-5.5
- OPENAI_EMBEDDING_MODEL=text-embedding-3-small

Never commit real secrets. Never send API keys or bot tokens in chat.

## Supabase
Run the migrations in:
- supabase/migrations/20261004_bot_ai_indexes.sql
- supabase/migrations/20261004_ai_rag.sql

The AI migration creates document_chunks, pgvector indexing, and match_document_chunks().

## Deployment
1. Import the repository into Vercel.
2. Use Node.js 22.
3. Add the environment variables above in Vercel.
4. Deploy.
5. Configure the Telegram webhook to:
   https://YOUR-VERCEL-DOMAIN/api/webhook

The bot itself is the interface. Students and the admin do not need a web dashboard.

## AI flow
Admin uploads a PDF -> bot asks for subject/lecture metadata -> admin confirms -> PDF is downloaded from Telegram -> text is extracted -> text is chunked -> embeddings are generated -> chunks are stored in Supabase pgvector.

Student asks a question -> question embedding -> vector similarity search -> relevant course chunks -> OpenAI Responses API -> answer grounded only in uploaded material.

If the answer is not supported by the uploaded material, the bot says that the available material is insufficient instead of inventing an answer.
