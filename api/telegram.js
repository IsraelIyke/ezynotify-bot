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

  if (!chatId || !text) {
    return res.status(200).end();
  }

  // /start
  if (text === "/start") {
    await sendMessage(
      chatId,
      `👋 Hello! I am ⁀જ➣ *ezynotify*, your smart Telegram bot for website monitoring.

I can:
🛰️ Monitor websites for updates  
🔍 Check for specific keywords  
🧾 List your tracking requests  

Here are some commands you can use:
/new_update_monitor — Monitor a website for changes  
/new_keyword_check — Get notified when keywords appear  
/list_update_requests — View update monitors  
/list_keyword_check_requests — View keyword checks  
/cancel — Cancel an active setup

ℹ️ *Note:* I cannot monitor websites that require login.

✨ More features coming soon!`
    );
    return res.status(200).end();
  }

  // /cancel
  if (text === "/cancel") {
    const state = userState.get(chatId);
    if (state?.uuid) {
      await supabase.from("ezynotify").delete().eq("uuid", state.uuid);
      userState.delete(chatId);
      await sendMessage(chatId, "🚫 Cancelled. Your request has been removed.");
    } else {
      await sendMessage(chatId, "❌ No active request to cancel.");
    }
    return res.status(200).end();
  }

  // /new_update_monitor
  if (text === "/new_update_monitor") {
    userState.set(chatId, { step: 1, type: "update" });
    await sendMessage(
      chatId,
      "🛠️ Step 1 of 3:\nPlease enter the website URL to monitor for updates."
    );
    return res.status(200).end();
  }

  // /new_keyword_check
  if (text === "/new_keyword_check") {
    userState.set(chatId, { step: 1, type: "keyword" });
    await sendMessage(
      chatId,
      "🛠️ Step 1 of 2:\nEnter the website URL you want to monitor for keywords."
    );
    return res.status(200).end();
  }

  // Handle user state
  const state = userState.get(chatId);
  if (state) {
    if (state.step === 1) {
      // Format URL
      let url = text;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }

      const insertPayload = {
        url,
        telegramID: String(chatId),
      };

      if (state.type === "update") {
        insertPayload.checkUpdates = true;
      }

      const { data, error } = await supabase
        .from("ezynotify")
        .insert([insertPayload])
        .select("uuid")
        .single();

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Failed to save your request. Try again.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.uuid = data.uuid;
      state.step = state.type === "update" ? 2 : 2;
      userState.set(chatId, state);

      if (state.type === "update") {
        await sendMessage(
          chatId,
          "🔁 Step 2 of 3:\nShould I continue monitoring after the first update is detected? (Yes or No)"
        );
      } else {
        await sendMessage(
          chatId,
          "📝 Step 2 of 2:\nPlease enter the keywords you want to track, separated by commas (e.g., `law, government, climate`)"
        );
      }

      return res.status(200).end();
    }

    if (state.step === 2 && state.type === "update") {
      const value = text.toLowerCase() === "yes";

      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldContinueCheck: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Failed to save your answer. Try again.");
        userState.delete(chatId);
        return res.status(200).end();
      }

      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "📋 Step 3 of 3:\nDo you want *detailed* updates when changes occur? (Yes or No)"
      );
      return res.status(200).end();
    }

    if (state.step === 3 && state.type === "update") {
      const value = text.toLowerCase() === "yes";

      const { error } = await supabase
        .from("ezynotify")
        .update({ shouldSendDetailedUpdates: value })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Failed to finalize. Please try again.");
      } else {
        await sendMessage(
          chatId,
          "✅ Your update monitoring request has been saved successfully!"
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }

    if (state.step === 2 && state.type === "keyword") {
      const keywords = text
        .toLowerCase()
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k);

      const { error } = await supabase
        .from("ezynotify")
        .update({ keywords: { keywords } })
        .eq("uuid", state.uuid);

      if (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Failed to save keywords. Try again.");
      } else {
        await sendMessage(
          chatId,
          "✅ Your keyword monitoring request has been saved successfully!"
        );
      }

      userState.delete(chatId);
      return res.status(200).end();
    }
  }

  // /list_update_requests
  if (text === "/list_update_requests") {
    const { data, error } = await supabase
      .from("ezynotify")
      .select("url, uuid, inserted_at")
      .eq("telegramID", String(chatId))
      .is("keywords", null);

    if (error || !data?.length) {
      await sendMessage(chatId, "ℹ️ No update monitoring requests found.");
    } else {
      const list = data
        .map(
          (item, i) =>
            `${i + 1}. 🔗 ${item.url}\n🆔 ${item.uuid}\n📅 ${new Date(
              item.inserted_at
            ).toLocaleString()}`
        )
        .join("\n\n");
      await sendMessage(chatId, `📄 *Your Update Requests:*\n\n${list}`);
    }
    return res.status(200).end();
  }

  // /list_keyword_check_requests
  if (text === "/list_keyword_check_requests") {
    const { data, error } = await supabase
      .from("ezynotify")
      .select("url, uuid, keywords, inserted_at")
      .eq("telegramID", String(chatId))
      .not("keywords", "is", null);

    if (error || !data?.length) {
      await sendMessage(chatId, "ℹ️ No keyword monitoring requests found.");
    } else {
      const list = data
        .map(
          (item, i) =>
            `${i + 1}. 🔗 ${
              item.url
            }\n🔍 Keywords: ${item.keywords.keywords.join(", ")}\n🆔 ${
              item.uuid
            }\n📅 ${new Date(item.inserted_at).toLocaleString()}`
        )
        .join("\n\n");
      await sendMessage(chatId, `📄 *Your Keyword Requests:*\n\n${list}`);
    }
    return res.status(200).end();
  }

  // Unknown message fallback
  return res.status(200).end();
}

async function sendMessage(chatId, text) {
  await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );
}
