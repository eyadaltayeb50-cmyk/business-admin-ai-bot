const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  adminTelegramId: Number(required("ADMIN_TELEGRAM_ID")),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
};

if (!Number.isSafeInteger(config.adminTelegramId)) {
  throw new Error("ADMIN_TELEGRAM_ID must be a valid Telegram numeric ID.");
}