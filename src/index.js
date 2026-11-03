require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ADMIN_ID = process.env.ADMIN_ID;

client.once(Events.ClientReady, (bot) => {
  console.log(`KM DEV online: ${bot.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (message.content === "!help") {
    await message.reply({
      content: "**KM DEV — HELP MENU**\n\n**VPS Management**\n`!create` — Create VPS\n`!manage` — Manage VPS\n`!list` — Your VPS list\n`!status` — VPS status\n\n**Admin Management**\n`!admin` — Admin menu\n`!userinfo` — User information"
    });
  }

  if (message.content === "!manage") {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("start").setLabel("Start").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("stop").setLabel("Stop").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("restart").setLabel("Restart").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("reinstall").setLabel("Reinstall").setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("sshx").setLabel("SSHX").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("tmate").setLabel("SSH Tmate").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("info").setLabel("VPS Info").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("backup").setLabel("Backup").setStyle(ButtonStyle.Success)
    );

    await message.reply({
      content: "**KM DEV — VPS MANAGEMENT**\nSelect an action:",
      components: [row1, row2]
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (["start", "stop", "restart", "reinstall", "sshx", "tmate", "info", "backup"].includes(interaction.customId)) {
    await interaction.reply({
      content: `**${interaction.customId.toUpperCase()}** selected.\nVPS backend is not connected yet.`,
      ephemeral: true
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
  
