import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const sessions = new Map();

export default async function handler(req, res) {
  const { message, callback_query } = req.body;

  const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
  const text = message?.text || callback_query?.data;
  const isCallback = !!callback_query;

  if (!chatId || !text) {
    return res.status(200).end();
  }

  if (text === "/start") {
    await sendMessage(
      chatId,
      `Hello! I am ⁀જ➣ ezynotify \u{1F4E8}, your web monitoring assistant \u{1F916}\n\nI can help you monitor websites for updates or specific keywords.\n\nCommands you can use:\n/new_update_monitor \u2014 Start a new update monitor\n/new_keyword_check \u2014 Start a new keyword monitoring\n/list_update_requests \u2014 View your update monitor requests\n/list_keyword_check_requests \u2014 View your keyword check requests\n/help \u2014 Show this help message again\n\n\u26A0\uFE0F I cannot monitor password-protected websites.\n\nMore features coming soon!`
    );
    return res.status(200).end();
  }

  if (text === "/new_update_monitor") {
    sessions.set(chatId, { type: "update", step: 1 });
    await sendMessage(
      chatId,
      "Step 1 of 3: Please enter the website URL you want to monitor for updates."
    );
    return res.status(200).end();
  }

  if (text === "/new_keyword_check") {
    sessions.set(chatId, { type: "keyword", step: 1 });
    await sendMessage(
      chatId,
      "Step 1 of 2: Please enter the website URL you want to monitor for keywords."
    );
    return res.status(200).end();
  }

  if (text === "/list_update_requests") {
    const { data } = await supabase
      .from("ezynotify")
      .select("uuid, url, shouldSendDetailedUpdates, shouldContinueCheck")
      .eq("telegramID", chatId);
    if (!data || data.length === 0) {
      await sendMessage(chatId, "You have no update monitor requests.");
    } else {
      for (const row of data) {
        await sendMessage(
          chatId,
          `\u2709️ *URL:* ${row.url}\n*Detailed Updates:* ${
            row.shouldSendDetailedUpdates ? "Yes" : "No"
          }\n*Continue Monitoring:* ${row.shouldContinueCheck ? "Yes" : "No"}`,
          [
            [
              { text: "✏️ Edit", callback_data: `edit_update_${row.uuid}` },
              { text: "🗑 Delete", callback_data: `delete_${row.uuid}` },
            ],
          ]
        );
      }
    }
    return res.status(200).end();
  }

  if (text === "/list_keyword_check_requests") {
    const { data } = await supabase
      .from("ezynotify")
      .select("uuid, url, keywords")
      .eq("telegramID", chatId);
    const keywordRequests = data?.filter(
      (row) => row.keywords && row.keywords.length > 0
    );
    if (!keywordRequests || keywordRequests.length === 0) {
      await sendMessage(chatId, "You have no keyword check requests.");
    } else {
      for (const row of keywordRequests) {
        await sendMessage(
          chatId,
          `\u2709️ *URL:* ${row.url}\n*Keywords:* ${row.keywords.join(", ")}`,
          [
            [
              { text: "✏️ Edit", callback_data: `edit_keyword_${row.uuid}` },
              { text: "🗑 Delete", callback_data: `delete_${row.uuid}` },
            ],
          ]
        );
      }
    }
    return res.status(200).end();
  }

  const session = sessions.get(chatId);
  if (session) {
    if (session.type === "update") {
      if (session.step === 1) {
        const url = text.startsWith("http") ? text : `https://${text}`;
        const { data, error } = await supabase
          .from("ezynotify")
          .insert({
            url,
            telegramID: chatId,
            checkUpdates: true,
          })
          .select("uuid")
          .single();
        if (!error) {
          session.uuid = data.uuid;
          session.step = 2;
          await sendMessage(
            chatId,
            "Step 2 of 3: Do you wish to continue monitoring after the first update is detected? (Yes/No)"
          );
        }
      } else if (session.step === 2) {
        await supabase
          .from("ezynotify")
          .update({
            shouldContinueCheck: /yes/i.test(text),
          })
          .eq("uuid", session.uuid);
        session.step = 3;
        await sendMessage(
          chatId,
          "Step 3 of 3: Do you want to receive detailed updates? (Yes/No)"
        );
      } else if (session.step === 3) {
        await supabase
          .from("ezynotify")
          .update({
            shouldSendDetailedUpdates: /yes/i.test(text),
          })
          .eq("uuid", session.uuid);
        sessions.delete(chatId);
        await sendMessage(chatId, "✅ Update monitoring setup complete!");
      }
    } else if (session.type === "keyword") {
      if (session.step === 1) {
        const url = text.startsWith("http") ? text : `https://${text}`;
        const { data, error } = await supabase
          .from("ezynotify")
          .insert({
            url,
            telegramID: chatId,
          })
          .select("uuid")
          .single();
        if (!error) {
          session.uuid = data.uuid;
          session.step = 2;
          await sendMessage(
            chatId,
            "Step 2 of 2: Please enter the keywords (comma separated)."
          );
        }
      } else if (session.step === 2) {
        const keywords = text.split(",").map((k) => k.trim().toLowerCase());
        await supabase
          .from("ezynotify")
          .update({
            keywords,
          })
          .eq("uuid", session.uuid);
        sessions.delete(chatId);
        await sendMessage(chatId, "✅ Keyword monitoring setup complete!");
      }
    }
    return res.status(200).end();
  }

  if (/^delete_/.test(text)) {
    const uuid = text.replace("delete_", "");
    await supabase.from("ezynotify").delete().eq("uuid", uuid);
    await sendMessage(chatId, "🗑 Request deleted successfully.");
    return res.status(200).end();
  }

  await sendMessage(chatId, "Unknown command. Please type /help for options.");
  res.status(200).end();
}

async function sendMessage(chatId, text, inlineKeyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  };
  if (inlineKeyboard) {
    body.reply_markup = { inline_keyboard: inlineKeyboard };
  }
  await fetch(
    `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}
