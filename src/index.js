
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, (bot) => {
  console.log(`VPS Deploy Bot online: ${bot.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (message.content === "!help") {
    await message.reply({
      content: [
        "**VPS DEPLOY BOT — HELP**",
        "",
        "`!help` — Help menu",
        "`!create` — Create VPS",
        "`!manage` — Manage VPS",
        "",
        "More features coming soon!"
      ].join("\n")
    });
  }

  if (message.content === "!manage") {
    await message.reply({
      content: "**VPS MANAGEMENT**\nSelect your VPS to manage it."
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
