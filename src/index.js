"use strict";

const {
  Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, EmbedBuilder, StringSelectMenuBuilder
} = require("discord.js");
require("dotenv").config();

const { createVps, listVps, getInfo, startVps, stopVps, restartVps } = require("./docker");

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const PUBLIC_IPV4 = process.env.PUBLIC_IPV4 || "Not configured";

if (!TOKEN || !ADMIN_ID) throw new Error("DISCORD_TOKEN and ADMIN_ID are required.");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const OS_OPTIONS = [
  { label: "Ubuntu 22.04 LTS", value: "ubuntu2204" },
  { label: "Ubuntu 24.04 LTS", value: "ubuntu2404" },
  { label: "Debian 11", value: "debian11" },
  { label: "Debian 12 (Bookworm)", value: "debian12" }
];

const isAdmin = id => id === ADMIN_ID;

function noVpsEmbed() {
  return new EmbedBuilder().setColor(0xF43F5E)
    .setTitle("🌟 KM DEV - No VPS Found")
    .setDescription("You don't have any VPS yet. Contact an admin to create one.")
    .setFooter({ text: "KM DEV VPS Manager" });
}

function manageRows(name, ownerId) {
  const actions = [
    ["start", "Start", ButtonStyle.Success],
    ["stop", "Stop", ButtonStyle.Danger],
    ["restart", "Restart", ButtonStyle.Primary],
    ["info", "VPS Info", ButtonStyle.Secondary]
  ];
  return [new ActionRowBuilder().addComponents(
    ...actions.map(([id, label, style]) => new ButtonBuilder()
      .setCustomId(`manage:${id}:${ownerId}:${name}`).setLabel(label).setStyle(style))
  )];
}

async function createMenu(message, args) {
  if (!isAdmin(message.author.id)) return message.reply("Only admins can create VPS.");

  const ram = Number(args[0]), cpu = Number(args[1]), disk = Number(args[2]);
  const target = message.mentions.users.first() || message.author;
  if (!Number.isFinite(ram) || !Number.isFinite(cpu) || !Number.isInteger(disk) ||
      ram < 1 || ram > 32 || cpu < 0.5 || cpu > 16 || disk < 5 || disk > 500) {
    return message.reply("Usage: `!create <ram> <cpu> <disk> [@user]` — Example: `!create 2 1 20`");
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`create_os:${message.author.id}:${target.id}:${ram}:${cpu}:${disk}`)
    .setPlaceholder("Select Operating System")
    .addOptions(OS_OPTIONS);

  return message.reply({
    content: `🌟 **KM DEV — VPS DEPLOYMENT**\nRAM: ${ram} GB | CPU: ${cpu} Core | Disk: ${disk} GB\nUser: ${target.tag}\n\nSelect an operating system:`,
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

async function deployOS(interaction) {
  const [, adminId, targetId, r, c, d] = interaction.customId.split(":");
  if (interaction.user.id !== adminId || !isAdmin(interaction.user.id)) {
    return interaction.reply({ content: "You are not authorized.", ephemeral: true });
  }

  const ram = Number(r), cpu = Number(c), disk = Number(d), os = interaction.values[0];
  if (!OS_OPTIONS.some(x => x.value === os)) {
    return interaction.reply({ content: "Invalid OS selection.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const vps = await createVps({ userId: targetId, os, ram, cpu, disk });
    const user = await client.users.fetch(targetId);
    const created = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const dm =
      "🌟 **KM DEV - VPS Created!**\nYour VPS has successfully been deployed!\n\n" +
      "• **VPS Details**\n" +
      `**Container Name:** \`${vps.name}\`\n` +
      `**Configuration:** ${vps.ram} GB RAM / ${vps.cpu} CPU / ${vps.disk} GB Disk\n` +
      "**Status:** Running\n" +
      `**OS:** ${vps.os}\n**Created:** ${created}\n\n` +
      "• **Termius Login**\n" +
      `**Host:** \`${PUBLIC_IPV4}\`\n**Port:** \`${vps.sshPort}\`\n` +
      "**User:** `root`\n" +
      `**Password:** ||${vps.password}||\n` +
      `\n\`ssh root@${PUBLIC_IPV4} -p ${vps.sshPort}\`\n\n` +
      "Use `!manage` to manage your VPS. Keep your password private.";

    try {
      await user.send(dm);
      await interaction.editReply(`VPS **${vps.name}** created. Login details sent by DM.`);
    } catch {
      await interaction.editReply(`VPS **${vps.name}** created, but DM delivery failed. Ask the owner to enable DMs before sharing credentials.`);
    }
  } catch (err) {
    console.error("Create VPS failed:", err);
    await interaction.editReply(`VPS creation failed: ${err.message}`);
  }
}

client.once(Events.ClientReady, c => console.log(`KM DEV online: ${c.user.tag}`));

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.content.startsWith("!")) return;
  const parts = message.content.trim().split(/\s+/);
  const command = parts.shift().slice(1).toLowerCase();
  const args = parts;

  try {
    if (command === "help") {
      return message.reply("**KM DEV Commands**\n`!create <ram> <cpu> <disk> [@user]`\n`!myvps`\n`!manage [number]`\n`!help`");
    }
    if (command === "create") return createMenu(message, args);

    if (command === "myvps" || command === "list" || command === "status") {
      const names = await listVps(message.author.id);
      if (!names.length) return message.reply({ embeds: [noVpsEmbed()] });
      const info = await Promise.all(names.map(getInfo));
      return message.reply({
        embeds: [new EmbedBuilder().setColor(0x8B5CF6).setTitle("KM DEV — YOUR VPS")
          .setDescription(info.map((v, i) => `**${i + 1}. ${v.name}**\nStatus: ${v.status}\nOS: ${v.os}`).join("\n\n"))]
      });
    }

    if (command === "manage") {
      const names = await listVps(message.author.id);
      if (!names.length) return message.reply({ embeds: [noVpsEmbed()] });
      const n = args[0] ? Number(args[0]) : 1;
      if (!Number.isInteger(n) || n < 1 || n > names.length) return message.reply("Invalid VPS number. Use `!myvps`.");
      const name = names[n - 1];
      return message.reply({ content: `**KM DEV — VPS MANAGEMENT**\nSelected: \`${name}\``, components: manageRows(name, message.author.id) });
    }

    if (command === "admin") {
      if (!isAdmin(message.author.id)) return message.reply("Not authorized.");
      return message.reply("**KM DEV ADMIN**\n`!create <ram> <cpu> <disk> [@user]`");
    }
  } catch (err) {
    console.error(err);
    return message.reply(`Error: ${err.message}`);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("create_os:")) {
      return deployOS(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith("manage:")) {
      const [, action, ownerId, name] = interaction.customId.split(":");
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "This menu belongs to another user.", ephemeral: true });
      }
      const names = await listVps(interaction.user.id);
      if (!names.includes(name)) {
        return interaction.reply({ embeds: [noVpsEmbed()], ephemeral: true });
      }

      if (action === "start") await startVps(name);
      else if (action === "stop") await stopVps(name);
      else if (action === "restart") await restartVps(name);
      else if (action === "info") {
        const v = await getInfo(name);
        return interaction.reply({
          content: `**VPS Info**\nName: ${v.name}\nStatus: ${v.status}\nOS: ${v.os}\nSSH Port: ${v.sshPort || "Unavailable"}`,
          ephemeral: true
        });
      } else {
        return interaction.reply({ content: "This action is not implemented yet.", ephemeral: true });
      }

      return interaction.reply({ content: `VPS ${action.toUpperCase()} command completed.`, ephemeral: true });
    }
  } catch (err) {
    console.error("Interaction error:", err);
    const msg = `Error: ${err.message}`;
    if (interaction.deferred) await interaction.editReply(msg).catch(() => {});
    else if (!interaction.replied) await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
  }
});

client.login(TOKEN);
