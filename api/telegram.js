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

  // Helper function to extract ID from short UUID
  async function getIdFromShortUuid(
    shortUuid,
    telegramId,
    isUpdateRequest = false
  ) {
    try {
      const query = supabase
        .from("ezynotify")
        .select("id,uuid")
        .eq("telegramID", String(telegramId))
        .like("uuid", `${shortUuid}%`);

      if (isUpdateRequest) {
        query.eq("checkUpdates", true);
      } else {
        query.not("keywords", "is", null);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return null;
      }

      // Return both id and full uuid for verification
      return { id: data[0].id, uuid: data[0].uuid };
    } catch (error) {
      console.error("Error finding ID from short UUID:", error);
      return null;
    }
  }

  // /start command
  if (text === "/start") {
    await sendMessage(
      chatId,
      `👋 Hello! I am ⁀જ➣ ezynotify — your website monitoring assistant.

I help you:
🔔 Monitor website changes
🔑 Track keywords on pages

📌 Commands you can use:
/cancel – Cancel current request creation
/new_update_monitor – Track any website for content updates
/new_keyword_check – Track keywords on a website
/list_update_requests – View, edit or delete your update requests
/list_keyword_check_requests – View, edit or delete your keyword check requests
/help – Show this help message

⚠️ Note: I can only monitor public pages (no login required).`
    );
    return res.status(200).end();
  }

  // /help command
  if (text === "/help") {
    await sendMessage(
      chatId,
      `🆘 ezynotify Help Center

📌 Available Commands:

🔹 Monitoring Setup:
/new_update_monitor - Track website content changes
/new_keyword_check - Track specific keywords on a website

🔹 Request Management:
/list_update_requests - View your update monitors
/list_keyword_check_requests - View your keyword checks
/cancel - Stop current operation

🔹 Editing Requests:
/editupdate[UUID] - Modify an update monitor
/editkeyword[UUID] - Modify a keyword check

🔹 Deleting Requests:
/deleteupdate[UUID] - Remove an update monitor
/deletekeyword[UUID] - Remove a keyword check

💡 Tips:
- Use first 8 characters of UUID from list commands
- Use /skip during editing to keep current values
- All requests are sorted by creation date (newest first)`
    );
    return res.status(200).end();
  }

  // /cancel command
  if (text === "/cancel") {
    const state = userState.get(chatId);
    if (state?.id) {
      await supabase.from("ezynotify").delete().eq("id", state.id);
      await sendMessage(chatId, "❌ Request cancelled successfully.");
    } else {
      await sendMessage(chatId, "⚠️ No ongoing request to cancel.");
    }
    userState.delete(chatId);
    return res.status(200).end();
  }

  // LIST UPDATE REQUESTS COMMAND
  if (text === "/list_update_requests") {
    try {
      const { data, error } = await supabase
        .from("ezynotify")
        .select("*")
        .eq("telegramID", String(chatId))
        .eq("checkUpdates", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        await sendMessage(
          chatId,
          "You currently have no update monitoring requests."
        );
        return res.status(200).end();
      }

      const requests = data
        .map((req, index) => {
          const shortUuid = req.uuid.substring(0, 8);
          return `📌 Request #${index + 1}
🔗 URL: ${req.url || "Not specified"}
📝 Detailed Updates: ${req.shouldSendDetailedUpdates ? "Yes" : "No"}
🔄 Continue Monitoring: ${req.shouldContinueCheck ? "Yes" : "No"}
📅 Created: ${new Date(req.created_at).toLocaleDateString()}
🆔 UUID: ${shortUuid}

/editupdate${shortUuid} - Edit this request
/deleteupdate${shortUuid} - Delete this request`;
        })
        .join("\n\n");

      await sendMessage(
        chatId,
        `📋 Your Update Monitoring Requests (${data.length} total):\n\n${requests}`
      );
    } catch (error) {
      console.error("List update error:", error);
      await sendMessage(
        chatId,
        "❌ Failed to fetch your update requests. Please try again."
      );
    }
    return res.status(200).end();
  }

  // LIST KEYWORD REQUESTS COMMAND
  if (text === "/list_keyword_check_requests") {
    try {
      const { data, error } = await supabase
        .from("ezynotify")
        .select("*")
        .eq("telegramID", String(chatId))
        .not("keywords", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        await sendMessage(
          chatId,
          "You currently have no keyword check requests."
        );
        return res.status(200).end();
      }

      const requests = data
        .map((req, index) => {
          const shortUuid = req.uuid.substring(0, 8);
          const keywords =
            req.keywords?.keywords?.join(", ") || "No keywords specified";
          return `📌 Request #${index + 1}
🔗 URL: ${req.url || "Not specified"}
🔎 Keywords: ${keywords}
📅 Created: ${new Date(req.created_at).toLocaleDateString()}
🆔 UUID: ${shortUuid}

/editkeyword${shortUuid} - Edit this request
/deletekeyword${shortUuid} - Delete this request`;
        })
        .join("\n\n");

      await sendMessage(
        chatId,
        `📋 Your Keyword Check Requests (${data.length} total):\n\n${requests}`
      );
    } catch (error) {
      console.error("List keyword error:", error);
      await sendMessage(
        chatId,
        "❌ Failed to fetch your keyword requests. Please try again."
      );
    }
    return res.status(200).end();
  }

  // DELETE UPDATE REQUEST
  if (text.startsWith("/deleteupdate")) {
    const shortUuid = text.replace("/deleteupdate", "");

    try {
      const record = await getIdFromShortUuid(shortUuid, chatId, true);
      if (!record) {
        await sendMessage(chatId, "❌ Update request not found.");
        return res.status(200).end();
      }

      const { error } = await supabase
        .from("ezynotify")
        .delete()
        .eq("id", record.id)
        .eq("telegramID", String(chatId));

      if (error) throw error;

      await sendMessage(chatId, "✅ Update request deleted successfully.");
    } catch (error) {
      console.error("Delete update error:", error);
      await sendMessage(
        chatId,
        "❌ Failed to delete update request. Please try again."
      );
    }
    return res.status(200).end();
  }

  // DELETE KEYWORD REQUEST
  if (text.startsWith("/deletekeyword")) {
    const shortUuid = text.replace("/deletekeyword", "");

    try {
      const record = await getIdFromShortUuid(shortUuid, chatId, false);
      if (!record) {
        await sendMessage(chatId, "❌ Keyword request not found.");
        return res.status(200).end();
      }

      const { error } = await supabase
        .from("ezynotify")
        .delete()
        .eq("id", record.id)
        .eq("telegramID", String(chatId));

      if (error) throw error;

      await sendMessage(chatId, "✅ Keyword request deleted successfully.");
    } catch (error) {
      console.error("Delete keyword error:", error);
      await sendMessage(
        chatId,
        "❌ Failed to delete keyword request. Please try again."
      );
    }
    return res.status(200).end();
  }

  // EDIT UPDATE REQUEST
  if (text.startsWith("/editupdate")) {
    const shortUuid = text.replace("/editupdate", "");

    try {
      const record = await getIdFromShortUuid(shortUuid, chatId, true);
      if (!record) {
        await sendMessage(chatId, "❌ Update request not found.");
        return res.status(200).end();
      }

      const { data, error } = await supabase
        .from("ezynotify")
        .select("*")
        .eq("id", record.id)
        .eq("telegramID", String(chatId))
        .single();

      if (error || !data) throw error;

      userState.set(chatId, {
        step: "edit-update",
        id: record.id,
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
        
1. Website URL (current: ${data.url || "Not specified"})
  
Reply with the new URL or /skip to keep the current value`
      );
    } catch (error) {
      console.error("Edit update init error:", error);
      await sendMessage(
        chatId,
        "❌ Update request not found or you don't have permission to edit it."
      );
    }
    return res.status(200).end();
  }

  // EDIT KEYWORD REQUEST
  if (text.startsWith("/editkeyword")) {
    const shortUuid = text.replace("/editkeyword", "");

    try {
      const record = await getIdFromShortUuid(shortUuid, chatId, false);
      if (!record) {
        await sendMessage(chatId, "❌ Keyword request not found.");
        return res.status(200).end();
      }

      const { data, error } = await supabase
        .from("ezynotify")
        .select("*")
        .eq("id", record.id)
        .eq("telegramID", String(chatId))
        .single();

      if (error || !data) throw error;

      userState.set(chatId, {
        step: "edit-keyword",
        id: record.id,
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
        
1. Website URL (current: ${data.url || "Not specified"})
  
Reply with the new URL or /skip to keep the current value`
      );
    } catch (error) {
      console.error("Edit keyword init error:", error);
      await sendMessage(
        chatId,
        "❌ Keyword request not found or you don't have permission to edit it."
      );
    }
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
      try {
        const currentField = state.fields[state.fieldIndex];

        // Handle skip
        if (text.toLowerCase() === "/skip") {
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
            .eq("id", state.id)
            .eq("telegramID", String(chatId));

          if (error) throw error;
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
      } catch (error) {
        console.error("Edit update error:", error);
        await sendMessage(chatId, "❌ Failed to update. Please try again.");
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    // EDIT KEYWORD CHECK FLOW
    if (state.step === "edit-keyword") {
      try {
        const currentField = state.fields[state.fieldIndex];

        // Handle skip
        if (text.toLowerCase() === "/skip") {
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
            .eq("id", state.id)
            .eq("telegramID", String(chatId));

          if (error) throw error;
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
      } catch (error) {
        console.error("Edit keyword error:", error);
        await sendMessage(chatId, "❌ Failed to update. Please try again.");
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    // ... (rest of your existing state handling code for new requests)
  }

  return res.status(200).end();
}

async function sendNextEditPrompt(chatId, state) {
  try {
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
          `✏️ Editing Keyword Check (Step ${currentStep} of ${
            state.totalFields
          }):
          
2. Keywords (current: ${currentKeywords || "None"})
  
Enter new keywords (comma separated) or /skip to keep current keywords`
        );
      }
    }
  } catch (error) {
    console.error("Send next prompt error:", error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
    userState.delete(chatId);
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
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      console.error("Telegram API error:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}
