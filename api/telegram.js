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

  if (!chatId || !text) return res.status(200).end();

  // START COMMAND
  if (text === "/start") {
    await sendMessage(
      chatId,
      `👋 Hello! I am ⁀જ➣ *ezynotify*, your website monitoring assistant ✈️

I can help you keep track of:
🔄 Website updates
🔍 Keyword appearances

📋 *Commands you can use:*
/new_update_monitor – Monitor a page for changes
/new_keyword_check – Get notified when certain keywords appear
/list_update_requests – View your update checks
/list_keyword_check_requests – View your keyword checks
/cancel – Cancel an ongoing form

⚠️ I can only monitor public websites (no login required).

✨ More features coming soon!`
    );
    return res.status(200).end();
  }

  // CANCEL COMMAND
  if (text === "/cancel") {
    const state = userState.get(chatId);
    if (state?.uuid) {
      await supabase.from("ezynotify").delete().eq("uuid", state.uuid);
      await sendMessage(chatId, "❌ Your request has been cancelled.");
    } else {
      await sendMessage(chatId, "No active request to cancel.");
    }
    userState.delete(chatId);
    return res.status(200).end();
  }

  // NEW UPDATE MONITOR
  if (text === "/new_update_monitor") {
    userState.set(chatId, { step: "update_1" });
    await sendMessage(
      chatId,
      "🧩 Step 1 of 2:\nPlease enter the website URL you want to monitor for updates."
    );
    return res.status(200).end();
  }

  // NEW KEYWORD CHECK
  if (text === "/new_keyword_check") {
    userState.set(chatId, { step: "keyword_1" });
    await sendMessage(
      chatId,
      "🧩 Step 1 of 2:\nPlease enter the website URL you want to monitor for *keywords*."
    );
    return res.status(200).end();
  }

  const state = userState.get(chatId);
  if (state) {
    // === UPDATE MONITOR FLOW ===
    if (state.step === "update_1") {
      let url = text.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const { data, error } = await supabase
        .from("ezynotify")
        .insert([{ url, telegramID: String(chatId), checkUpdates: true }])
        .select("uuid")
        .single();

      if (error) {
        console.error(error);
        await sendMessage(
          chatId,
          "❌ Error saving your request. Please try again."
        );
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.uuid = data.uuid;
      state.step = "update_2";
      userState.set(chatId, state);

      await sendMessage(
        chatId,
        "🧩 Step 2 of 2:\nDo you want me to *continue checking* after detecting the first update? (yes/no)"
      );
      return res.status(200).end();
    }

    if (state.step === "update_2") {
      const value = text.toLowerCase() === "yes";

      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldContinueCheck: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Error saving your answer. Try again.");
      } else {
        await sendMessage(
          chatId,
          "✅ Done! Your update monitoring request is now active."
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }

    // === KEYWORD CHECK FLOW ===
    if (state.step === "keyword_1") {
      let url = text.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const { data, error } = await supabase
        .from("ezynotify")
        .insert([{ url, telegramID: String(chatId) }])
        .select("uuid")
        .single();

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Error saving the URL. Try again.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.uuid = data.uuid;
      state.step = "keyword_2";
      userState.set(chatId, state);

      await sendMessage(
        chatId,
        "🧩 Step 2 of 2:\nPlease enter the keywords to monitor (separated by commas)."
      );
      return res.status(200).end();
    }

    if (state.step === "keyword_2") {
      const keywords = text
        .split(",")
        .map((kw) => kw.trim().toLowerCase())
        .filter((kw) => kw.length > 0)
        .join(",");

      const { error } = await supabase
        .from("ezynotify")
        .update({ keywords })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Error saving your keywords. Try again.");
      } else {
        await sendMessage(
          chatId,
          "✅ All set! I'll watch that page for your keywords."
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }
  }

  return res.status(200).end();
}

async function sendMessage(chatId, text) {
  await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    }
  );
}
