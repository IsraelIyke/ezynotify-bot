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

  // Prevent storing list commands as URLs
  if (
    text === "/list_update_requests" ||
    text === "/list_keyword_check_requests"
  ) {
    return res.status(200).end();
  }

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

  // LIST UPDATE REQUESTS COMMAND
  if (text === "/list_update_requests") {
    const { data, error } = await supabase
      .from("ezynotify")
      .select("*")
      .eq("telegramID", String(chatId))
      .eq("checkUpdates", true);

    if (error || !data?.length) {
      await sendMessage(chatId, "You have no update monitoring requests.");
      return res.status(200).end();
    }

    const requests = data
      .map((req, index) => {
        return `📌 Request #${index + 1}
🔗 URL: ${req.url}
📝 Detailed Updates: ${req.shouldSendDetailedUpdates ? "Yes" : "No"}
🔄 Continue Monitoring: ${req.shouldContinueCheck ? "Yes" : "No"}

/edit_update_${req.uuid} - Edit this request
/delete_update_${req.uuid} - Delete this request
`;
      })
      .join("\n\n");

    await sendMessage(
      chatId,
      `📋 Your Update Monitoring Requests:\n\n${requests}`
    );
    return res.status(200).end();
  }

  // LIST KEYWORD REQUESTS COMMAND
  if (text === "/list_keyword_check_requests") {
    const { data, error } = await supabase
      .from("ezynotify")
      .select("*")
      .eq("telegramID", String(chatId))
      .not("keywords", "is", null);

    if (error || !data?.length) {
      await sendMessage(chatId, "You have no keyword check requests.");
      return res.status(200).end();
    }

    const requests = data
      .map((req, index) => {
        const keywords = req.keywords?.keywords?.join(", ") || "No keywords";
        return `📌 Request #${index + 1}
🔗 URL: ${req.url}
🔎 Keywords: ${keywords}

/edit_keyword_${req.uuid} - Edit this request
/delete_keyword_${req.uuid} - Delete this request
`;
      })
      .join("\n\n");

    await sendMessage(chatId, `📋 Your Keyword Check Requests:\n\n${requests}`);
    return res.status(200).end();
  }

  // DELETE UPDATE REQUEST
  if (text.startsWith("/delete_update_")) {
    const uuid = text.replace("/delete_update_", "");

    const { error } = await supabase
      .from("ezynotify")
      .delete()
      .eq("uuid", uuid)
      .eq("telegramID", String(chatId))
      .eq("checkUpdates", true);

    if (error) {
      await sendMessage(
        chatId,
        "❌ Failed to delete update request. Please try again."
      );
    } else {
      await sendMessage(chatId, "✅ Update request deleted successfully.");
    }
    return res.status(200).end();
  }

  // DELETE KEYWORD REQUEST
  if (text.startsWith("/delete_keyword_")) {
    const uuid = text.replace("/delete_keyword_", "");

    const { error } = await supabase
      .from("ezynotify")
      .delete()
      .eq("uuid", uuid)
      .eq("telegramID", String(chatId))
      .not("keywords", "is", null);

    if (error) {
      await sendMessage(
        chatId,
        "❌ Failed to delete keyword request. Please try again."
      );
    } else {
      await sendMessage(chatId, "✅ Keyword request deleted successfully.");
    }
    return res.status(200).end();
  }

  // EDIT UPDATE REQUEST
  if (text.startsWith("/edit_update_")) {
    const uuid = text.replace("/edit_update_", "");

    // Verify this is actually an update request
    const { data } = await supabase
      .from("ezynotify")
      .select("url, shouldContinueCheck, shouldSendDetailedUpdates")
      .eq("uuid", uuid)
      .eq("telegramID", String(chatId))
      .eq("checkUpdates", true)
      .single();

    if (!data) {
      await sendMessage(
        chatId,
        "❌ Update request not found or you don't have permission to edit it."
      );
      return res.status(200).end();
    }

    userState.set(chatId, {
      step: "edit-update",
      uuid,
      fieldIndex: 0,
      fields: ["url", "shouldContinueCheck", "shouldSendDetailedUpdates"],
      totalFields: 3,
      currentValues: {
        url: data.url,
        shouldContinueCheck: data.shouldContinueCheck,
        shouldSendDetailedUpdates: data.shouldSendDetailedUpdates,
      },
    });

    await sendMessage(
      chatId,
      `✏️ Editing Update Monitor (Step 1 of 3):
      
1. Website URL (current: ${data.url})
  
Reply with the new URL or /skip to keep the current value`
    );
    return res.status(200).end();
  }

  // EDIT KEYWORD REQUEST
  if (text.startsWith("/edit_keyword_")) {
    const uuid = text.replace("/edit_keyword_", "");

    // Verify this is actually a keyword request
    const { data } = await supabase
      .from("ezynotify")
      .select("url, keywords")
      .eq("uuid", uuid)
      .eq("telegramID", String(chatId))
      .not("keywords", "is", null)
      .single();

    if (!data) {
      await sendMessage(
        chatId,
        "❌ Keyword request not found or you don't have permission to edit it."
      );
      return res.status(200).end();
    }

    userState.set(chatId, {
      step: "edit-keyword",
      uuid,
      fieldIndex: 0,
      fields: ["url", "keywords"],
      totalFields: 2,
      currentValues: {
        url: data.url,
        keywords: data.keywords?.keywords?.join(", ") || "",
      },
    });

    await sendMessage(
      chatId,
      `✏️ Editing Keyword Check (Step 1 of 2):
      
1. Website URL (current: ${data.url})
  
Reply with the new URL or /skip to keep the current value`
    );
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
    // EDIT UPDATE MONITOR FLOW
    if (state.step === "edit-update") {
      const currentField = state.fields[state.fieldIndex];

      // Handle skip
      if (text.toLowerCase() === "/skip") {
        // Move to next field
        if (state.fieldIndex < state.fields.length - 1) {
          state.fieldIndex++;
          userState.set(chatId, state);
          await sendNextEditPrompt(chatId, state);
        } else {
          await sendMessage(
            chatId,
            "✅ Update monitoring request updated successfully!"
          );
          userState.delete(chatId);
        }
        return res.status(200).end();
      }

      let updateData = {};

      if (currentField === "url") {
        updateData.url = formatUrl(text);
      } else if (currentField === "shouldContinueCheck") {
        if (["yes", "no"].includes(text.toLowerCase())) {
          updateData.shouldContinueCheck = text.toLowerCase() === "yes";
        } else {
          await sendMessage(
            chatId,
            "❌ Please answer with 'Yes' or 'No' or /skip"
          );
          return res.status(200).end();
        }
      } else if (currentField === "shouldSendDetailedUpdates") {
        if (["yes", "no"].includes(text.toLowerCase())) {
          updateData.shouldSendDetailedUpdates = text.toLowerCase() === "yes";
        } else {
          await sendMessage(
            chatId,
            "❌ Please answer with 'Yes' or 'No' or /skip"
          );
          return res.status(200).end();
        }
      }

      // Update the field if not skipping
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("ezynotify")
          .update(updateData)
          .eq("uuid", state.uuid)
          .eq("telegramID", String(chatId));

        if (error) {
          await sendMessage(chatId, "❌ Failed to update. Please try again.");
          userState.delete(chatId);
          return res.status(200).end();
        }
      }

      // Move to next field or complete
      if (state.fieldIndex < state.fields.length - 1) {
        state.fieldIndex++;
        userState.set(chatId, state);
        await sendNextEditPrompt(chatId, state);
      } else {
        await sendMessage(
          chatId,
          "✅ Update monitoring request updated successfully!"
        );
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    // EDIT KEYWORD CHECK FLOW
    if (state.step === "edit-keyword") {
      const currentField = state.fields[state.fieldIndex];

      // Handle skip
      if (text.toLowerCase() === "/skip") {
        // Move to next field
        if (state.fieldIndex < state.fields.length - 1) {
          state.fieldIndex++;
          userState.set(chatId, state);
          await sendNextEditPrompt(chatId, state);
        } else {
          await sendMessage(
            chatId,
            "✅ Keyword check request updated successfully!"
          );
          userState.delete(chatId);
        }
        return res.status(200).end();
      }

      let updateData = {};

      if (currentField === "url") {
        updateData.url = formatUrl(text);
      } else if (currentField === "keywords") {
        const keywords = text
          .split(",")
          .map((word) => word.trim().toLowerCase())
          .filter((word) => word.length > 0);
        updateData.keywords = { keywords };
      }

      // Update the field if not skipping
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("ezynotify")
          .update(updateData)
          .eq("uuid", state.uuid)
          .eq("telegramID", String(chatId));

        if (error) {
          await sendMessage(chatId, "❌ Failed to update. Please try again.");
          userState.delete(chatId);
          return res.status(200).end();
        }
      }

      // Move to next field or complete
      if (state.fieldIndex < state.fields.length - 1) {
        state.fieldIndex++;
        userState.set(chatId, state);
        await sendNextEditPrompt(chatId, state);
      } else {
        await sendMessage(
          chatId,
          "✅ Keyword check request updated successfully!"
        );
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    // ... (rest of your existing state handling code for new requests)
  }

  return res.status(200).end();
}

async function sendNextEditPrompt(chatId, state) {
  const currentField = state.fields[state.fieldIndex];
  const currentStep = state.fieldIndex + 1;

  if (state.step === "edit-update") {
    let prompt = "";
    if (currentField === "shouldContinueCheck") {
      const currentValue = state.currentValues.shouldContinueCheck
        ? "Yes"
        : "No";
      prompt = `✏️ Editing Update Monitor (Step ${currentStep} of ${state.totalFields}):
      
2. Continue monitoring after first change (current: ${currentValue})
  
Reply with 'Yes' or 'No' or /skip to keep the current value`;
    } else if (currentField === "shouldSendDetailedUpdates") {
      const currentValue = state.currentValues.shouldSendDetailedUpdates
        ? "Yes"
        : "No";
      prompt = `✏️ Editing Update Monitor (Step ${currentStep} of ${state.totalFields}):
      
3. Detailed update messages (current: ${currentValue})
  
Reply with 'Yes' or 'No' or /skip to keep the current value`;
    }
    await sendMessage(chatId, prompt);
  } else if (state.step === "edit-keyword") {
    if (currentField === "keywords") {
      const currentKeywords = state.currentValues.keywords;
      await sendMessage(
        chatId,
        `✏️ Editing Keyword Check (Step ${currentStep} of ${state.totalFields}):
        
2. Keywords (current: ${currentKeywords || "None"})
  
Enter new keywords (comma separated) or /skip to keep current keywords`
      );
    }
  }
}

// Add https:// if missing
function formatUrl(input) {
  if (!input) return input;
  if (!/^https?:\/\//i.test(input)) {
    return "https://" + input;
  }
  return input;
}

async function sendMessage(chatId, text) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      }
    );

    if (!response.ok) {
      console.error("Telegram API error:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}
