import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Memory-based step tracker (per user)
const userState = new Map();

export default async function handler(req, res) {
  const { message } = req.body;
  const chatId = message?.chat?.id;
  const text = message?.text;

  if (!chatId || !text) return res.status(200).end();

  // /start command
  if (text === "/start") {
    await sendMessage(
      chatId,
      `Hello! I am ⁀જ➣ ezynotify 📨, a Telegram Bot...`
    );
    return res.status(200).end();
  }

  // Start new update monitor — first step
  //   if (text === "/new_update_monitor") {
  //     userState.set(chatId, { step: 1 });
  //     await sendMessage(
  //       chatId,
  //       "Step 1 of 4:\nPlease enter the website URL you want to monitor."
  //     );
  //     return res.status(200).end();
  //   }

  // Handle response to first step
  //   const state = userState.get(chatId);
  //   if (state?.step === 1) {
  //     const { data, error } = await supabase
  //       .from("ezynotify")
  //       .insert([{ url: text, telegramID: String(chatId), checkUpdates: true }])
  //       .select("id")
  //       .single();

  //     if (error) {
  //       console.error(error);
  //       await sendMessage(
  //         chatId,
  //         "❌ Failed to save your request. Please try again."
  //       );
  //     } else {
  //       await sendMessage(
  //         chatId,
  //         `✅ Website URL saved!\n\nTracking ID: ${data.id}`
  //       );
  //     }

  //     userState.delete(chatId);
  //     return res.status(200).end();
  //   }

  return res.status(200).end();
}

// Helper to send a message to Telegram
async function sendMessage(chatId, text) {
  await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
}
