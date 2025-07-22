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
          text: `Hello! I am ⁀જ➣EzyNotify

I help you stay informed by monitoring changes and keywords from websites or services.

Here are some commands you can use:
/new — Create a new monitoring request
/list — View all your active monitoring requests
/help — Show this help message again

More features coming soon!`,
        }),
      }
    );
  }

  res.status(200).end();
}
