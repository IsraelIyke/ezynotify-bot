import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { message } = req.body;
  const chatId = message?.chat?.id;
  const text = message?.text;

  // Check if it's a URL response (after /new_update_monitor)
  if (text && text.startsWith("http")) {
    try {
      const { data, error } = await supabase.from("ezynotify").insert([
        {
          url: text,
          telegramID: chatId,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "URL saved successfully! I'll monitor this page for updates.",
          }),
        }
      );
    } catch (error) {
      await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Error saving URL. Please try again later.",
          }),
        }
      );
    }
    return res.status(200).end();
  }

  if (text === "/start") {
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Hello! I am ⁀જ➣ ezynotify, a Telegram Bot...

I help you stay informed by monitoring changes and keywords from websites.

Here are some commands you can use:
/new_update_monitor — Create a new update monitoring request
/new_keyword_check — Create a new keyword check request
/list_update_requests — View all your active update monitoring requests
/list_keyword_check_requests — View all your active keyword check requests
/help — Show this help message again

❗Note: I can only monitor websites that does not require logging in (Password protected pages) or any kind of protected page. Thank You.

More features coming soon!`,
        }),
      }
    );
  }

  if (text === "/new_update_monitor") {
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Enter URL:",
        }),
      }
    );
  }

  res.status(200).end();
}
