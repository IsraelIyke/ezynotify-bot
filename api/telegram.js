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
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `👋 Hello! I am ⁀જ➣ ezynotify — your website monitoring assistant.

I help you:
🔔 Monitor website changes
🔑 Track keywords on pages

Please start these bots before continuing:
🔗 @ezynotify_updates_bot
🔗 @ezynotify_keywords_bot

📌 Commands you can use:
  /cancel - Cancel current request creation
  /new_update_monitor - Track any website for content updates
  /new_keyword_check - Track keywords on a website
  /list_update_requests - View, edit or delete your update requests
  /list_keyword_check_requests - View, edit or delete your keyword check requests
  /help - Show this help message

  ⚠️ Note: I can only monitor public pages (no login required).
  `,
        }),
      }
    );
    res.status(200).end();
  }

  // /help command

  if (text === "/help") {
    // Send a welcome message
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `ezynotify Help Center

📌 Available Commands:

🔹 Monitoring Setup:
/new_update_monitor - Track website content changes
/new_keyword_check - Track specific keywords on a website

🔹 Request Management:
/list_update_requests - View your update monitors
/list_keyword_check_requests - View your keyword checks
/cancel - Stop current operation

🔹 Editing Requests:
/editupdate[ID] - Modify an update monitor
/editkeyword[ID] - Modify a keyword check

🔹 Deleting Requests:
/deleteupdate[ID] - Remove an update monitor
/deletekeyword[ID] - Remove a keyword check

💡 Tips:
- Use /skip during editing to keep current values
- You can edit URL, monitoring options, and keywords
- All requests are sorted by creation date (newest first)

Need more help? Contact support @ezynotify `,
        }),
      }
    );
    res.status(200).end();
  }

  // /cancel command
  if (text === "/cancel") {
    const state = userState.get(chatId);
    if (state?.id) {
      await supabase
        .from("ezynotify")
        .delete()
        .eq("id", state.id)
        .eq("telegramID", String(chatId));
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
          return `📌 Request #${index + 1}
🔗 URL: ${req.url || "Not specified"}
📝 Detailed Updates: ${req.shouldSendDetailedUpdates ? "Yes" : "No"}
🔄 Continue Monitoring: ${req.shouldContinueCheck ? "Yes" : "No"}
📅 Created: ${new Date(req.created_at).toLocaleDateString()}

/editupdate${req.id} - Edit this request
/deleteupdate${req.id} - Delete this request`;
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
          const keywords =
            req.keywords?.keywords?.join(", ") || "No keywords specified";
          return `📌 Request #${index + 1}
🔗 URL: ${req.url || "Not specified"}
🔎 Keywords: ${keywords}
📅 Created: ${new Date(req.created_at).toLocaleDateString()}

/editkeyword${req.id} - Edit this request
/deletekeyword${req.id} - Delete this request`;
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
    const id = text.replace("/deleteupdate", "");

    try {
      // First verify the request belongs to the user
      const { data: verifyData, error: verifyError } = await supabase
        .from("ezynotify")
        .select("id")
        .eq("id", id)
        .eq("telegramID", String(chatId))
        .eq("checkUpdates", true)
        .single();

      if (verifyError || !verifyData) {
        throw new Error("Request not found or not owned by user");
      }

      const { error } = await supabase
        .from("ezynotify")
        .delete()
        .eq("id", id)
        .eq("telegramID", String(chatId));

      if (error) throw error;

      await sendMessage(chatId, "✅ Update request deleted successfully.");
    } catch (error) {
      console.error("Delete update error:", error);
      await sendMessage(
        chatId,
        "❌ Failed to delete update request. It may not exist or you don't have permission."
      );
    }
    return res.status(200).end();
  }

  // DELETE KEYWORD REQUEST
  if (text.startsWith("/deletekeyword")) {
    const id = text.replace("/deletekeyword", "");

    try {
      // First verify the request belongs to the user
      const { data: verifyData, error: verifyError } = await supabase
        .from("ezynotify")
        .select("id")
        .eq("id", id)
        .eq("telegramID", String(chatId))
        .not("keywords", "is", null)
        .single();

      if (verifyError || !verifyData) {
        throw new Error("Request not found or not owned by user");
      }

      const { error } = await supabase
        .from("ezynotify")
        .delete()
        .eq("id", id)
        .eq("telegramID", String(chatId));

      if (error) throw error;

      await sendMessage(chatId, "✅ Keyword request deleted successfully.");
    } catch (error) {
      console.error("Delete keyword error:", error);
      await sendMessage(
        chatId,
        "❌ Failed to delete keyword request. It may not exist or you don't have permission."
      );
    }
    return res.status(200).end();
  }

  // EDIT UPDATE REQUEST
  if (text.startsWith("/editupdate")) {
    const id = text.replace("/editupdate", "");

    try {
      // First verify the request belongs to the user
      const { data, error } = await supabase
        .from("ezynotify")
        .select("*")
        .eq("id", id)
        .eq("telegramID", String(chatId))
        .eq("checkUpdates", true)
        .single();

      if (error || !data) {
        throw new Error("Request not found or not owned by user");
      }

      userState.set(chatId, {
        step: "edit-update",
        id,
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
    const id = text.replace("/editkeyword", "");

    try {
      // First verify the request belongs to the user
      const { data, error } = await supabase
        .from("ezynotify")
        .select("*")
        .eq("id", id)
        .eq("telegramID", String(chatId))
        .not("keywords", "is", null)
        .single();

      if (error || !data) {
        throw new Error("Request not found or not owned by user");
      }

      userState.set(chatId, {
        step: "edit-keyword",
        id,
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

    // NEW UPDATE MONITOR FLOW
    if (state.step === "update-1") {
      try {
        const url = formatUrl(text);

        const { data, error } = await supabase
          .from("ezynotify")
          .insert([
            {
              url,
              telegramID: String(chatId),
              checkUpdates: true,
            },
          ])
          .select("id")
          .single();

        if (error) throw error;

        userState.set(chatId, {
          step: "update-2",
          id: data.id,
        });

        await sendMessage(
          chatId,
          "🔁 Step 2 of 3:\nShould I keep monitoring the site after detecting the first change? (Yes/No)"
        );
      } catch (error) {
        console.error("Update monitor step 1 error:", error);
        await sendMessage(chatId, "🚫 Failed to save your request. Try again.");
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    if (state.step === "update-2") {
      try {
        const value = text.toLowerCase() === "yes";
        const { error } = await supabase
          .from("ezynotify")
          .update({ shouldContinueCheck: value })
          .eq("id", state.id)
          .eq("telegramID", String(chatId));

        if (error) throw error;

        userState.set(chatId, {
          ...state,
          step: "update-3",
        });

        await sendMessage(
          chatId,
          "📋 Step 3 of 3:\nDo you want *detailed* update messages? (Yes/No)"
        );
      } catch (error) {
        console.error("Update monitor step 2 error:", error);
        await sendMessage(chatId, "❗Failed to save your response.");
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    if (state.step === "update-3") {
      try {
        const value = text.toLowerCase() === "yes";
        const { error } = await supabase
          .from("ezynotify")
          .update({ shouldSendDetailedUpdates: value })
          .eq("id", state.id)
          .eq("telegramID", String(chatId));

        if (error) throw error;

        await sendMessage(
          chatId,
          "✅ Your update monitoring request has been saved successfully!"
        );
      } catch (error) {
        console.error("Update monitor step 3 error:", error);
        await sendMessage(chatId, "❌ Something went wrong. Try again.");
      }
      userState.delete(chatId);
      return res.status(200).end();
    }

    // NEW KEYWORD CHECK FLOW
    if (state.step === "keyword-1") {
      try {
        const url = formatUrl(text);

        const { data, error } = await supabase
          .from("ezynotify")
          .insert([
            {
              url,
              telegramID: String(chatId),
            },
          ])
          .select("id")
          .single();

        if (error) throw error;

        userState.set(chatId, {
          step: "keyword-2",
          id: data.id,
        });

        await sendMessage(
          chatId,
          "✍️ Step 2 of 2:\nEnter the keywords to check, separated by commas.\nExample: `law, good boy, city`"
        );
      } catch (error) {
        console.error("Keyword check step 1 error:", error);
        await sendMessage(chatId, "🚫 Failed to save your request. Try again.");
        userState.delete(chatId);
      }
      return res.status(200).end();
    }

    if (state.step === "keyword-2") {
      try {
        const keywords = text
          .split(",")
          .map((word) => word.trim().toLowerCase())
          .filter((word) => word.length > 0);

        const keywordObject = { keywords };

        const { error } = await supabase
          .from("ezynotify")
          .update({ keywords: keywordObject })
          .eq("id", state.id)
          .eq("telegramID", String(chatId));

        if (error) throw error;

        await sendMessage(
          chatId,
          "✅ Your keyword check request has been saved!"
        );
      } catch (error) {
        console.error("Keyword check step 2 error:", error);
        await sendMessage(chatId, "❗Error saving keywords. Try again.");
      }
      userState.delete(chatId);
      return res.status(200).end();
    }
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
