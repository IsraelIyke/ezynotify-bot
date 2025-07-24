import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const userState = new Map();

export default async function handler(req, res) {
  const { message } = req.body;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  if (!chatId || !text) return res.status(200).end();

  // /start command
  if (text === "/start") {
    await sendMessage(
      chatId,
      `👋 Hello! I am ⁀જ➣ ezynotify 📨 — your website monitoring assistant.

I help you:
🔔 Monitor website changes
🔑 Track keywords on pages

📌 Commands you can use:
/new_update_monitor – Track any website for content updates
/new_keyword_check – Track keywords on a website
/list_update_requests – View your update requests
/list_keyword_check_requests – View your keyword check requests
/cancel – Cancel current request creation
/help – Show this help message

⚠️ Note: I can only monitor public pages (no login required).`
    );
    return res.status(200).end();
  }

  // /cancel command
  if (text === "/cancel") {
    const state = userState.get(chatId);
    if (state?.uuid) {
      await supabase.from("ezynotify").delete().eq("uuid", state.uuid);
      await sendMessage(chatId, "❌ Request cancelled successfully.");
    } else {
      await sendMessage(chatId, "⚠️ No ongoing request to cancel.");
    }
    userState.delete(chatId);
    return res.status(200).end();
  }

  // NEW UPDATE MONITOR COMMAND
  if (text === "/new_update_monitor") {
    userState.set(chatId, { step: "update-1" });
    await sendMessage(
      chatId,
      "🛰️ Step 1 of 3:\nPlease enter the website URL you want to monitor."
    );
    return res.status(200).end();
  }

  // NEW KEYWORD CHECK COMMAND
  if (text === "/new_keyword_check") {
    userState.set(chatId, { step: "keyword-1" });
    await sendMessage(
      chatId,
      "🔍 Step 1 of 2:\nPlease enter the website URL where you want to check for keywords."
    );
    return res.status(200).end();
  }

  // STATE HANDLING
  const state = userState.get(chatId);
  if (state) {
    // UPDATE MONITOR STEP 1
    if (state.step === "update-1") {
      const url = formatUrl(text);

      const { data, error } = await supabase
        .from("ezynotify")
        .insert([{ url, telegramID: String(chatId), checkUpdates: true }])
        .select("uuid")
        .single();

      if (error) {
        console.error(error);
        await sendMessage(chatId, "🚫 Failed to save your request. Try again.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.uuid = data.uuid;
      state.step = "update-2";
      userState.set(chatId, state);

      await sendMessage(
        chatId,
        "🔁 Step 2 of 3:\nShould I keep monitoring the site after detecting the first change? (Yes/No)"
      );
      return res.status(200).end();
    }

    // UPDATE MONITOR STEP 2
    if (state.step === "update-2") {
      const value = text.toLowerCase() === "yes";
      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldContinueCheck: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❗Failed to save your response.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.step = "update-3";
      userState.set(chatId, state);

      await sendMessage(
        chatId,
        "📋 Step 3 of 3:\nDo you want *detailed* update messages? (Yes/No)"
      );
      return res.status(200).end();
    }

    // UPDATE MONITOR STEP 3
    if (state.step === "update-3") {
      const value = text.toLowerCase() === "yes";
      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldSendDetailedUpdates: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Something went wrong. Try again.");
      } else {
        await sendMessage(
          chatId,
          "✅ Your update monitoring request has been saved successfully!"
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }

    // KEYWORD CHECK STEP 1
    if (state.step === "keyword-1") {
      const url = formatUrl(text);

      const { data, error } = await supabase
        .from("ezynotify")
        .insert([{ url, telegramID: String(chatId) }])
        .select("uuid")
        .single();

      if (error) {
        console.error(error);
        await sendMessage(chatId, "🚫 Failed to save your request. Try again.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.uuid = data.uuid;
      state.step = "keyword-2";
      userState.set(chatId, state);

      await sendMessage(
        chatId,
        "✍️ Step 2 of 2:\nEnter the keywords to check, separated by commas.\nExample: `law, good boy, city`"
      );
      return res.status(200).end();
    }

    // KEYWORD CHECK STEP 2
    if (state.step === "keyword-2") {
      const keywords = text
        .split(",")
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0);

      const keywordObject = { keywords };

      const { error } = await supabase
        .from("ezynotify")
        .update({ keywords: keywordObject })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❗Error saving keywords. Try again.");
      } else {
        await sendMessage(
          chatId,
          "✅ Your keyword check request has been saved!"
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }
  }

  return res.status(200).end();
}

// Add https:// if missing
function formatUrl(input) {
  if (!/^https?:\/\//i.test(input)) {
    return "https://" + input;
  }
  return input;
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
