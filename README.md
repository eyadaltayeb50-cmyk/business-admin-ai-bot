# إدارة أعمال 📚

Telegram-first educational bot for first-year Business Administration students.

## Features
- 🎟️ Student activation with unique access codes
- 👥 Student management: list, block/unblock, reset access
- 📚 Subjects and lecture management
- 📄 PDF delivery directly through Telegram using Telegram file_id
- 🔍 Lecture search by title, professor, subject, or lecture number
- 🆕 Latest lectures
- 📢 Announcements and broadcast messaging
- 📅 Upcoming events
- 📊 Basic statistics
- 🔐 One Super Admin protected by ADMIN_TELEGRAM_ID
- 💾 Persistent bot sessions
- 🛡️ Duplicate Telegram update protection
- ☁️ Vercel serverless webhook
- 🐙 GitHub Actions TypeScript check

## Stack
Telegram Bot API + Node.js 22/TypeScript + Vercel + Supabase/PostgreSQL + GitHub.

No OpenAI, no paid AI API, no embeddings, and no vector database are required.

## Environment variables
- TELEGRAM_BOT_TOKEN
- ADMIN_TELEGRAM_ID
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Never commit real secrets.

## Supabase
Run the core migrations in supabase/migrations/.

The PDF itself stays on Telegram. Supabase stores the Telegram file_id and lecture metadata.

## Deployment
1. Import the repository into Vercel.
2. Use Node.js 22.
3. Add the four environment variables above.
4. Deploy.
5. Configure the Telegram webhook to: https://YOUR-VERCEL-DOMAIN/api/webhook

The bot itself is the interface. Students and the admin do not need a web dashboard.
