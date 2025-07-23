import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const userState = new Map();

export default async function handler(req, res) {
  const { message } = req.body;
  const chatId = message?.chat?.id;
  const text = message?.text;

  if (!chatId || !text) {
    return res.status(200).end();
  }

  // START COMMAND
  if (text === "/start") {
    await sendMessage(
      chatId,
      `Hello! I am ⁀જ➣ ezynotify, a Telegram Bot...

I help you stay informed by monitoring changes and keywords from websites.

Here are some commands you can use:
/new_update_monitor — Create a new update monitoring request
/new_keyword_check — Create a new keyword check request
/list_update_requests — View all your active update monitoring requests
/list_keyword_check_requests — View all your active keyword check requests
/help — Show this help message again

❗Note: I can only monitor websites that do not require logging in or are protected. Thank you.

More features coming soon!`
    );
    return res.status(200).end();
  }

  // NEW MONITOR START
  if (text === "/new_update_monitor") {
    userState.set(chatId, { step: 1 });
    await sendMessage(
      chatId,
      "Step 1 of 3:\nPlease enter the website URL you want to monitor for updates."
    );
    return res.status(200).end();
  }

  // HANDLE MULTI-STEP INPUT
  const state = userState.get(chatId);
  if (state) {
    if (state.step === 1) {
      const { data, error } = await supabase
        .from("ezynotify")
        .insert([{ url: text, telegramID: String(chatId), checkUpdates: true }])
        .select("uuid")
        .single();

      if (error) {
        console.error(error);
        await sendMessage(
          chatId,
          "An error occurred while saving your request. Please try again."
        );
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.uuid = data.uuid;
      state.step = 2;
      userState.set(chatId, state);

      await sendMessage(
        chatId,
        "Step 2 of 3:\nDo you wish to continue monitoring the website after the first update detection? (Yes or No)"
      );
      return res.status(200).end();
    }

    if (state.step === 2) {
      const value = text.toLowerCase() === "yes";

      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldContinueCheck: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "Error saving your answer. Try again.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "Step 3 of 3:\nDo you wish to get detailed updates? (Yes or No)"
      );
      return res.status(200).end();
    }

    if (state.step === 3) {
      const value = text.toLowerCase() === "yes";

      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldSendDetailedUpdates: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(
          chatId,
          "Error saving your final answer. Please try again."
        );
      } else {
        await sendMessage(
          chatId,
          "✅ All set! Your website monitoring request has been saved."
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }
  }

  // If no active session or unknown message
  return res.status(200).end();
}

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
