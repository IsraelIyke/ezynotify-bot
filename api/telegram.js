export default async function handler(req, res) {
  const { message } = req.body;

  const chatId = message?.chat?.id;
  const text = message?.text;

  if (text === "/start") {
    // Send a welcome message
    await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Hello! I am alive on Vercel 🚀",
        }),
      }
    );

    // Optional: Trigger GitHub Action
    // await fetch(
    //   "https://api.github.com/repos/your-username/your-repo/dispatches",
    //   {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    //       Accept: "application/vnd.github+json",
    //     },
    //     body: JSON.stringify({ event_type: "telegram_start_trigger" }),
    //   }
    // );
  }

  res.status(200).end();
}
