"use strict";

const { execFile } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");

const exec = promisify(execFile);
const PREFIX = "kmvps-";

const OS_IMAGES = {
  ubuntu2204: { name: "Ubuntu 22.04 LTS", image: "ubuntu:22.04" },
  ubuntu2404: { name: "Ubuntu 24.04 LTS", image: "ubuntu:24.04" },
  debian11: { name: "Debian 11", image: "debian:11" },
  debian12: { name: "Debian 12 (Bookworm)", image: "debian:12" }
};

async function docker(args, timeout = 120000) {
  try {
    const { stdout } = await exec("docker", args, {
      timeout,
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout.trim();
  } catch (err) {
    throw new Error((err.stderr || err.message || "Docker command failed").trim());
  }
}

function validateUserId(id) {
  if (!/^\d{17,20}$/.test(String(id))) throw new Error("Invalid Discord user ID.");
  return String(id);
}

function validateSpecs(ram, cpu, disk) {
  ram = Number(ram);
  cpu = Number(cpu);
  disk = Number(disk);
  if (!Number.isFinite(ram) || ram < 1 || ram > 32) throw new Error("RAM must be 1–32 GB.");
  if (!Number.isFinite(cpu) || cpu < 0.5 || cpu > 16) throw new Error("CPU must be 0.5–16 cores.");
  if (!Number.isInteger(disk) || disk < 5 || disk > 500) throw new Error("Disk must be 5–500 GB.");
  return { ram, cpu, disk };
}

function validateName(name) {
  if (typeof name !== "string" || !/^kmvps-\d{17,20}-\d+$/.test(name)) {
    throw new Error("Invalid container name.");
  }
  return name;
}

async function createVps({ userId, os, ram, cpu, disk }) {
  userId = validateUserId(userId);
  const specs = validateSpecs(ram, cpu, disk);
  const selected = OS_IMAGES[os];
  if (!selected) throw new Error("Unsupported operating system.");

  const name = `${PREFIX}${userId}-${Date.now()}`;
  const password = crypto.randomBytes(18).toString("base64url");

  await docker(["pull", selected.image], 600000);

  const setup = [
    "set -e",
    "export DEBIAN_FRONTEND=noninteractive",
    "apt-get update",
    "apt-get install -y openssh-server",
    "mkdir -p /run/sshd",
    "printf '\\nPermitRootLogin yes\\nPasswordAuthentication yes\\n' >> /etc/ssh/sshd_config",
    "exec /usr/sbin/sshd -D -e"
  ].join(" && ");

  await docker([
    "run", "-d",
    "--name", name,
    "--hostname", name,
    "--restart", "unless-stopped",
    "--memory", `${specs.ram}g`,
    "--memory-swap", `${specs.ram}g`,
    "--cpus", String(specs.cpu),
    "--pids-limit", "256",
    "--publish", "0.0.0.0::22",
    "--label", `kmdev.owner=${userId}`,
    "--label", `kmdev.os=${selected.name}`,
    "--label", `kmdev.disk_gb=${specs.disk}`,
    "--label", `kmdev.ram_gb=${specs.ram}`,
    "--label", `kmdev.cpu=${specs.cpu}`,
    selected.image,
    "bash", "-lc", setup
  ]);

  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      try {
        const state = await docker(["inspect", "-f", "{{.State.Running}}", name]);
        if (state === "true") {
          const proc = await docker(["exec", name, "pgrep", "-x", "sshd"]).catch(() => "");
          if (proc) { ready = true; break; }
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!ready) throw new Error("SSH setup did not become ready.");

    await docker(["exec", name, "bash", "-lc", "id root"]);
    await docker(["exec", name, "bash", "-lc", "echo 'root:" + password + "' | chpasswd"]);

    const portText = await docker(["port", name, "22/tcp"]);
    const match = portText.match(/:(\d+)\s*$/);
    if (!match) throw new Error("Could not determine mapped SSH port.");

    return {
      id: name, name, os: selected.name,
      ram: specs.ram, cpu: specs.cpu, disk: specs.disk,
      sshPort: Number(match[1]), password
    };
  } catch (err) {
    await docker(["rm", "-f", name]).catch(() => {});
    throw err;
  }
}

async function listVps(userId) {
  userId = validateUserId(userId);
  const out = await docker([
    "ps", "-a", "--filter", `label=kmdev.owner=${userId}`, "--format", "{{.Names}}"
  ]);
  return out ? out.split("\n").filter(Boolean) : [];
}

async function getInfo(name) {
  name = validateName(name);
  const raw = await docker(["inspect", "-f", "{{json .}}", name]);
  const c = JSON.parse(raw);
  const labels = c.Config.Labels || {};
  const portText = await docker(["port", name, "22/tcp"]).catch(() => "");
  const match = portText.match(/:(\d+)\s*$/);
  return {
    name, status: c.State.Status, os: labels["kmdev.os"] || "Unknown",
    ram: labels["kmdev.ram_gb"] || "Unknown",
    cpu: labels["kmdev.cpu"] || "Unknown",
    disk: labels["kmdev.disk_gb"] || "Unknown",
    sshPort: match ? Number(match[1]) : null,
    owner: labels["kmdev.owner"] || ""
  };
}

async function startVps(name) { return docker(["start", validateName(name)]); }
async function stopVps(name) { return docker(["stop", validateName(name)]); }
async function restartVps(name) { return docker(["restart", validateName(name)]); }

module.exports = { OS_IMAGES, createVps, listVps, getInfo, startVps, stopVps, restartVps };
