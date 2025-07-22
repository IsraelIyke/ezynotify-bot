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
          text: `Hello! I am ⁀જ➣ ezynotify

I help you stay informed by monitoring changes and keywords from websites.

Here are some commands you can use:
/new update monitor — Create a new update monitoring request
/new keyword check — Create a new keyword check request
/list update requests — View all your active update monitoring requests
/list keyword check requests — View all your active keyword check requests
/help — Show this help message again

More features coming soon!`,
        }),
      }
    );
  }

  res.status(200).end();
}
