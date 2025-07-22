export default async function handler(req, res) {
  const { message } = req.body;

  const chatId = message?.chat?.id;
  const text = message?.text;

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

❗❗❗ Note: I can only monitor websites that does not require logging in (Password protected pages) or any kind of protected page. Thank You.

More features coming soon!`,
        }),
      }
    );
  }

  res.status(200).end();
}
