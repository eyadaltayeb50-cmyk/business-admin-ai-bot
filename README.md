# إدارة أعمال AI 🤖

Telegram-first educational bot for first-year Business Administration students.

## Current features
- Student activation with unique access codes
- Telegram ID binding and blocked accounts
- Main student menu
- Subject -> lecture navigation with inline buttons
- Search by lecture title or professor
- Latest lectures
- Announcements
- Upcoming events
- Admin-only Telegram menu
- Generate up to 500 access codes
- List students and subjects
- Add subjects
- Upload PDF lectures directly through Telegram
- Delete lectures with confirmation
- Create upcoming events
- Broadcast announcements
- Basic statistics
- Session/state persistence
- Duplicate update protection
- Activity logging

## Stack
Telegram Bot API + Node.js/TypeScript + Vercel + Supabase/PostgreSQL + GitHub.

## Environment variables
TELEGRAM_BOT_TOKEN
ADMIN_TELEGRAM_ID
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

Never commit real secrets.

## Deployment
1. Import the repository into Vercel.
2. Add the four environment variables.
3. Deploy.
4. Set Telegram webhook to:
https://YOUR-VERCEL-DOMAIN/api/webhook

## Next phase
AI/RAG: extract text from educational PDFs, chunk it, embed it, store vectors in Supabase/pgvector, retrieve relevant chunks, and answer only from the uploaded course material.
