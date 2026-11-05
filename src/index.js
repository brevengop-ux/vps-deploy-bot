const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

require("dotenv").config();

const {
  listVps,
  getInfo,
  startVps,
  stopVps,
  restartVps
} = require("./docker");

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!TOKEN || !ADMIN_ID) {
  throw new Error("DISCORD_TOKEN or ADMIN_ID is missing in .env");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const manageActions = [
  ["start", "Start", ButtonStyle.Success],
  ["stop", "Stop", ButtonStyle.Danger],
  ["restart", "Restart", ButtonStyle.Primary],
  ["reinstall", "Reinstall", ButtonStyle.Secondary],
  ["sshx", "SSHX", ButtonStyle.Primary],
  ["tmate", "SSH Tmate", ButtonStyle.Primary],
  ["info", "VPS Info", ButtonStyle.Secondary],
  ["backup", "Backup", ButtonStyle.Success]
];

function isAdmin(userId) {
  return userId === ADMIN_ID;
}

function manageRows() {
  const buttons = manageActions.map(([id, label, style]) =>
    new ButtonBuilder()
      .setCustomId(`manage:${id}`)
      .setLabel(label)
      .setStyle(style)
  );

  return [
    new ActionRowBuilder().addComponents(...buttons.slice(0, 4)),
    new ActionRowBuilder().addComponents(...buttons.slice(4, 8))
  ];
}

function helpEmbed(category = "main") {
  const embed = new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setFooter({ text: "KM DEV VPS Deployment Bot" });

  const content = {
    main: {
      title: "KM DEV — HELP MENU",
      description:
        "**VPS Management**\n`!create` — Create VPS\n`!manage` — Management menu\n`!list` — Your VPS list\n`!status` — VPS status\n\n**Administration**\n`!admin` — Admin menu\n`!userinfo` — User information\n\n**Other**\n`!help` — Help menu"
    },
    vps: {
      title: "VPS MANAGEMENT",
      description:
        "`!create` — Create VPS\n`!manage` — Open management buttons\n`!list` — List your VPS\n`!status` — Check VPS status\n\nManagement buttons include Start, Stop, Restart, Reinstall, SSHX, SSH Tmate, VPS Info and Backup."
    },
    admin: {
      title: "ADMIN MANAGEMENT",
      description:
        "`!admin` — Admin menu\n`!addadmin` — Add admin\n`!removeadmin` — Remove admin\n`!give` — Give VPS\n`!remove` — Remove VPS\n`!allvps` — All VPS list\n`!maintenance` — Maintenance mode\n`!announce` — Announcement\n`!userinfo` — User information"
    },
    ssh: {
      title: "SSH MANAGEMENT",
      description:
        "SSHX and SSH Tmate are available as buttons inside `!manage`.\n\nSSH access will require a connected VPS backend."
    },
    settings: {
      title: "BOT SETTINGS",
      description:
        "Bot configuration is stored in the server's `.env` file.\n\nOnly the configured admin ID is authorized for admin features."
    }
  };

  const selected = content[category] || content.main;

  return embed
    .setTitle(selected.title)
    .setDescription(selected.description);
}

function helpRows() {
  const buttons = [
    ["help:main", "Home"],
    ["help:vps", "VPS Management"],
    ["help:admin", "Admin Management"],
    ["help:ssh", "SSH Management"],
    ["help:settings", "Bot Settings"]
  ].map(([id, label]) =>
    new ButtonBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder().addComponents(...buttons.slice(0, 3)),
    new ActionRowBuilder().addComponents(...buttons.slice(3))
  ];
}

async function showManage(interaction) {
  await interaction.reply({
    content: "**KM DEV — VPS MANAGEMENT**\nSelect an action:",
    components: manageRows(),
    ephemeral: true
  });
}

client.once(Events.ClientReady, async (bot) => {
  console.log(`KM DEV online: ${bot.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Open the help menu"),

    new SlashCommandBuilder()
      .setName("manage")
      .setDescription("Open VPS management menu"),

    new SlashCommandBuilder()
      .setName("create")
      .setDescription("Create a VPS"),

    new SlashCommandBuilder()
      .setName("list")
      .setDescription("List your VPS"),

    new SlashCommandBuilder()
      .setName("status")
      .setDescription("Check VPS status"),

    new SlashCommandBuilder()
      .setName("admin")
      .setDescription("Open admin menu")
  ].map(command => command.toJSON());

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(bot.user.id),
      { body: commands }
    );

    console.log("Slash commands registered successfully.");
  } catch (error) {
    console.error("Slash command registration failed:", error);
  }
});

// PREFIX COMMANDS

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith("!")) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().slice(1).toLowerCase();

  try {
    switch (command) {
      case "help":
        return message.reply({
          embeds: [helpEmbed()],
          components: helpRows()
        });

      case "manage":
        return message.reply({
          content: "**KM DEV — VPS MANAGEMENT**\nSelect an action:",
          components: manageRows()
        });

      case "create":
        return message.reply(
          "VPS creation backend is not connected yet."
        );

      case "list":
        return message.reply(
          "VPS listing backend is not connected yet."
        );

      case "status":
        return message.reply(
          "VPS status backend is not connected yet."
        );

      case "admin":
        if (!isAdmin(message.author.id)) {
          return message.reply("You are not authorized to use this command.");
        }

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x8B5CF6)
              .setTitle("KM DEV — ADMIN MENU")
              .setDescription(
                "`!addadmin` — Add admin\n" +
                "`!removeadmin` — Remove admin\n" +
                "`!give` — Give VPS\n" +
                "`!remove` — Remove VPS\n" +
                "`!allvps` — All VPS\n" +
                "`!maintenance` — Maintenance\n" +
                "`!announce` — Announcement\n" +
                "`!userinfo` — User information"
              )
          ]
        });

      case "userinfo": {
        const user = message.mentions.users.first() || message.author;

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x8B5CF6)
              .setTitle("USER INFORMATION")
              .setDescription(
                `**Username:** ${user.tag}\n` +
                `**User ID:** ${user.id}\n` +
                `**Bot:** ${user.bot ? "Yes" : "No"}`
              )
          ]
        });
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Prefix command error:", error);
    message.reply("An error occurred while processing the command.");
  }
});

// SLASH COMMANDS AND BUTTONS

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case "help":
          return interaction.reply({
            embeds: [helpEmbed()],
            components: helpRows(),
            ephemeral: true
          });

        case "manage":
          return showManage(interaction);

        case "create":
          return interaction.reply({
            content: "VPS creation backend is not connected yet.",
            ephemeral: true
          });

        case "list":
        case "status":
          return interaction.reply({
            content: "VPS backend is not connected yet.",
            ephemeral: true
          });

        case "admin":
          if (!isAdmin(interaction.user.id)) {
            return interaction.reply({
              content: "You are not authorized.",
              ephemeral: true
            });
          }

          return interaction.reply({
            content: "**KM DEV ADMIN MENU**\nUse `!admin` for the admin command list.",
            ephemeral: true
          });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("help:")) {
        const category = interaction.customId.split(":")[1];

        return interaction.update({
          embeds: [helpEmbed(category)],
          components: helpRows()
        });
      }

      if (interaction.customId.startsWith("manage:")) {
        const action = interaction.customId.split(":")[1];

        return interaction.reply({
          content:
            `**${action.toUpperCase()} selected.**\n` +
            "VPS backend is not connected yet.",
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An unexpected error occurred.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
    
