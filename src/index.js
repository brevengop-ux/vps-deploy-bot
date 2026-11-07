"use strict";

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  REST,
  Routes
} = require("discord.js");

require("dotenv").config();

const {
  createVps,
  listVps,
  getInfo,
  startVps,
  stopVps,
  restartVps
} = require("./docker");

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PUBLIC_IPV4 = process.env.PUBLIC_IPV4;

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

const OS_OPTIONS = [
  { label: "Ubuntu 22.04 LTS", value: "ubuntu2204" },
  { label: "Ubuntu 24.04 LTS", value: "ubuntu2404" },
  { label: "Debian 11", value: "debian11" },
  { label: "Debian 12 (Bookworm)", value: "debian12" }
];

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

function manageRows(vpsName, ownerId) {
  const buttons = manageActions.map(([id, label, style]) =>
    new ButtonBuilder()
      .setCustomId(`manage:${id}:${ownerId}:${vpsName}`)
      .setLabel(label)
      .setStyle(style)
  );

  return [
    new ActionRowBuilder().addComponents(...buttons.slice(0, 4)),
    new ActionRowBuilder().addComponents(...buttons.slice(4, 8))
  ];
}

function noVpsEmbed() {
  return new EmbedBuilder()
    .setColor(0xF43F5E)
    .setTitle("🌟 KM DEV - No VPS Found")
    .setDescription(
      "You don't have any KM DEV VPS.\n" +
      "Contact an admin to create one.\n\n" +
      "**▸ Quick Actions**\n" +
      "• `!myvps` - List your VPS\n" +
      "• Contact admin for VPS creation"
    )
    .setFooter({ text: "KM DEV VPS Manager" });
}

function helpEmbed(category = "main") {
  const content = {
    main: {
      title: "KM DEV — HELP MENU",
      description:
        "**VPS Management**\n" +
        "`!create` — Create VPS (Admin)\n" +
        "`!manage` — Management menu\n" +
        "`!myvps` — Your VPS list\n" +
        "`!list` — List your VPS\n" +
        "`!status` — VPS status\n\n" +
        "**Administration**\n" +
        "`!admin` — Admin menu\n" +
        "`!userinfo` — User information\n\n" +
        "**Other**\n`!help` — Help menu"
    },
    vps: {
      title: "VPS MANAGEMENT",
      description:
        "`!create <ram> <cpu> <disk> [@user]` — Create VPS (Admin)\n" +
        "`!manage` — Open management buttons\n" +
        "`!myvps` — List your VPS\n" +
        "`!list` — List your VPS\n" +
        "`!status` — Check VPS status"
    },
    admin: {
      title: "ADMIN MANAGEMENT",
      description:
        "`!admin` — Admin menu\n" +
        "`!userinfo` — User information\n" +
        "More admin commands are planned."
    },
    ssh: {
      title: "SSH MANAGEMENT",
      description:
        "SSH access details are sent privately after deployment.\n" +
        "SSHX and Tmate buttons are not connected yet."
    },
    settings: {
      title: "BOT SETTINGS",
      description:
        "Bot configuration is stored in `.env`.\n" +
        "Only the configured admin ID can deploy VPS."
    }
  };

  const selected = content[category] || content.main;

  return new EmbedBuilder()
    .setColor(0x8B5CF6)
    .setTitle(selected.title)
    .setDescription(selected.description)
    .setFooter({ text: "KM DEV VPS Deployment Bot" });
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
  const names = await listVps(interaction.user.id);

  if (!names.length) {
    return interaction.reply({
      embeds: [noVpsEmbed()],
      ephemeral: true
    });
  }

  if (names.length > 1) {
    return interaction.reply({
      content:
        names.map((name, i) => `${i + 1}. \`${name}\``).join("\n") +
        "\n\nUse `!manage <number>` to select a VPS.",
      ephemeral: true
    });
  }

  return interaction.reply({
    content: `**KM DEV — VPS MANAGEMENT**\nSelected: \`${names[0]}\``,
    components: manageRows(names[0], interaction.user.id),
    ephemeral: true
  });
}

async function showMyVps(userId) {
  const names = await listVps(userId);

  if (!names.length) {
    return { embeds: [noVpsEmbed()] };
  }

  const details = await Promise.all(names.map(name => getInfo(name)));

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle("KM DEV — YOUR VPS")
        .setDescription(
          details.map((v, i) =>
            `**${i + 1}. ${v.name}**\n` +
            `Status: ${v.status}\n` +
            `OS: ${v.os}`
          ).join("\n\n")
        )
    ]
  };
}

async function createVpsMenu(message, args) {
  if (!isAdmin(message.author.id)) {
    return message.reply("Only admins can create VPS.");
  }

  const ram = Number(args[0]);
  const cpu = Number(args[1]);
  const disk = Number(args[2]);
  const target = message.mentions.users.first() || message.author;

  if (
    !Number.isFinite(ram) ||
    !Number.isFinite(cpu) ||
    !Number.isInteger(disk) ||
    ram < 1 || ram > 32 ||
    cpu < 0.5 || cpu > 16 ||
    disk < 5 || disk > 500
  ) {
    return message.reply(
      "Usage: `!create <ram> <cpu> <disk> [@user]`\n" +
      "Example: `!create 2 1 20`"
    );
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(
      `create_os:${message.author.id}:${target.id}:${ram}:${cpu}:${disk}`
    )
    .setPlaceholder("Select Operating System")
    .addOptions(OS_OPTIONS);

  return message.reply({
    content:
      "**🌟 KM DEV — VPS DEPLOYMENT**\n" +
      `RAM: ${ram} GB | CPU: ${cpu} Core | Disk: ${disk} GB\n` +
      `User: ${target.tag}\n\n` +
      "Select an operating system:",
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  });
}

async function deploySelectedVps(interaction) {
  const parts = interaction.customId.split(":");

  const [, adminId, targetId, ramText, cpuText, diskText] = parts;

  if (
    interaction.user.id !== adminId ||
    !isAdmin(interaction.user.id)
  ) {
    return interaction.reply({
      content: "You are not authorized to deploy this VPS.",
      ephemeral: true
    });
  }

  const ram = Number(ramText);
  const cpu = Number(cpuText);
  const disk = Number(diskText);
  const os = interaction.values[0];

  if (
    !Number.isFinite(ram) ||
    !Number.isFinite(cpu) ||
    !Number.isInteger(disk) ||
    ram < 1 || ram > 32 ||
    cpu < 0.5 || cpu > 16 ||
    disk < 5 || disk > 500 ||
    !OS_OPTIONS.some(option => option.value === os)
  ) {
    return interaction.reply({
      content: "Invalid VPS configuration.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  let vps;

  try {
    vps = await createVps({
      userId: targetId,
      os,
      ram,
      cpu,
      disk
    });

    const createdAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });

    const host = PUBLIC_IPV4 || "Not configured";

    const dmMessage =
      "🌟 **KM DEV - VPS Created!**\n" +
      "Your VPS has successfully been deployed!\n\n" +
      "• **VPS Details**\n" +
      `**Container Name:** \`${vps.name}\`\n` +
      `**Configuration:** ${vps.ram} GB / ${vps.cpu} CPU / ${vps.disk} GB\n` +
      "**Status:** Running\n" +
      `**OS:** ${vps.os}\n` +
      `**Created:** ${createdAt}\n\n` +
      "• **Termius Login**\n" +
      `**Host:** \`${host}\`\n` +
      `**Port:** \`${vps.sshPort}\`\n` +
      "**User:** `root`\n" +
      `**Password:** ||${vps.password}||\n\n` +
      (PUBLIC_IPV4
        ? `\`ssh root@${PUBLIC_IPV4} -p ${vps.sshPort}\`\n\n`
        : "Public IP is not configured. SSH connection is not ready.\n\n") +
      "• **Management**\n" +
      "Use `!manage` to manage your VPS.\n\n" +
      "• **Important**\n" +
      "Keep your password private.";

    const target = await client.users.fetch(targetId);

    try {
      await target.send(dmMessage);

      return interaction.editReply(
        `VPS **${vps.name}** created successfully. Login details sent privately to ${target.tag}.`
      );
    } catch {
      return interaction.editReply(
        `VPS **${vps.name}** was created, but DM could not be delivered. Ask the owner to enable DMs before sharing login details.`
      );
    }
  } catch (error) {
    console.error("VPS creation error:", error);

    return interaction.editReply(
      "VPS creation failed: " + error.message
    );
  }
}

client.once(Events.ClientReady, async bot => {
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
      .setDescription("Use the !create command to deploy a VPS"),

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

client.on(Events.MessageCreate, async message => {
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

      case "create":
        return createVpsMenu(message, args);

      case "myvps":
      case "list":
        return message.reply(await showMyVps(message.author.id));

      case "status": {
        const names = await listVps(message.author.id);

        if (!names.length) {
          return message.reply({ embeds: [noVpsEmbed()] });
        }

        const details = await Promise.all(names.map(name => getInfo(name)));

        return message.reply(
          details.map(v => `**${v.name}** — ${v.status}`).join("\n")
        );
      }

      case "manage": {
        const names = await listVps(message.author.id);

        if (!names.length) {
          return message.reply({ embeds: [noVpsEmbed()] });
        }

        const number = Number(args[0]);
        let selected;

        if (args[0]) {
          if (!Number.isInteger(number) || number < 1 || number > names.length) {
            return message.reply("Invalid VPS number. Use `!myvps`.");
          }

          selected = names[number - 1];
        } else if (names.length === 1) {
          selected = names[0];
        } else {
          return message.reply(
            names.map((name, i) => `${i + 1}. \`${name}\``).join("\n") +
            "\n\nUse `!manage <number>`."
          );
        }

        return message.reply({
          content: `**KM DEV — VPS MANAGEMENT**\nSelected: \`${selected}\``,
          components: manageRows(selected, message.author.id)
        });
      }

      case "admin":
        if (!isAdmin(message.author.id)) {
          return message.reply("You are not authorized.");
        }

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x8B5CF6)
              .setTitle("KM DEV — ADMIN MENU")
              .setDescription(
                "`!create <ram> <cpu> <disk> [@user]` — Create VPS\n" +
                "`!userinfo [@user]` — User information"
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
    return message.reply("An error occurred: " + error.message);
  }
});

// INTERACTIONS

client.on(Events.InteractionCreate, async interaction => {
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
            content: "Use `!create <ram> <cpu> <disk> [@user]` to start deployment.",
            ephemeral: true
          });

        case "list":
        case "status":
          return interaction.reply({
            content: "Use `!myvps` to view your VPS.",
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
            content: "**KM DEV ADMIN MENU**\nUse `!admin` for admin commands.",
            ephemeral: true
          });
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("create_os:")
    ) {
      return deploySelectedVps(interaction);
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
        const [, action, ownerId, vpsName] =
          interaction.customId.split(":");

        if (interaction.user.id !== ownerId) {
          return interaction.reply({
            content: "This management menu belongs to another user.",
            ephemeral: true
          });
        }

        const names = await listVps(interaction.user.id);

        if (!names.includes(vpsName)) {
          return interaction.reply({
            embeds: [noVpsEmbed()],
            ephemeral: true
          });
        }

        if (action === "start") {
          await startVps(vpsName);
        } else if (action === "stop") {
          await stopVps(vpsName);
        } else if (action === "restart") {
          await restartVps(vpsName);
        } else if (action === "info") {
          const info = await getInfo(vpsName);

          return interaction.reply({
            content:
              `**VPS Information**\n` +
              `Name: ${info.name}\n` +
              `Status: ${info.status}\n` +
              `OS: ${info.os}\n` +
              `SSH Port: ${info.sshPort || "Unavailable"}`,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: `${action.toUpperCase()} is not connected yet.`,
            ephemeral: true
          });
        }

        return interaction.reply({
          content: `VPS ${action.toUpperCase()} request completed.`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error("Interaction error:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "An error occurred: " + error.message,
        ephemeral: true
      }).catch(() => {});
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(
        "An error occurred: " + error.message
      ).catch(() => {});
    }
  }
});

client.login(TOKEN);
    
