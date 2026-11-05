
"use strict";

const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");

const exec = promisify(execFile);

const PREFIX = "kmvps-";

const OS_IMAGES = {
  ubuntu2204: {
    name: "Ubuntu 22.04 LTS",
    image: "ubuntu:22.04"
  },
  ubuntu2404: {
    name: "Ubuntu 24.04 LTS",
    image: "ubuntu:24.04"
  },
  debian11: {
    name: "Debian 11",
    image: "debian:11"
  },
  debian12: {
    name: "Debian 12 (Bookworm)",
    image: "debian:12"
  }
};

function randomPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

function safeId(id) {
  if (!/^\d{17,20}$/.test(String(id))) {
    throw new Error("Invalid Discord user ID.");
  }
  return String(id);
}

function validateSpecs(ram, cpu, disk) {
  ram = Number(ram);
  cpu = Number(cpu);
  disk = Number(disk);

  if (!Number.isFinite(ram) || ram < 1 || ram > 32) {
    throw new Error("RAM must be between 1 and 32 GB.");
  }

  if (!Number.isFinite(cpu) || cpu < 0.5 || cpu > 16) {
    throw new Error("CPU must be between 0.5 and 16 cores.");
  }

  if (!Number.isInteger(disk) || disk < 5 || disk > 500) {
    throw new Error("Disk must be between 5 and 500 GB.");
  }

  return { ram, cpu, disk };
}

async function docker(args, options = {}) {
  try {
    const result = await exec("docker", args, {
      timeout: options.timeout || 120000,
      maxBuffer: 10 * 1024 * 1024
    });

    return result.stdout.trim();
  } catch (error) {
    throw new Error(
      error.stderr?.trim() ||
      error.message ||
      "Docker command failed."
    );
  }
}

function dockerWithInput(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", data => stdout += data);
    child.stderr.on("data", data => stderr += data);

    child.on("error", reject);

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Docker command failed."));
      } else {
        resolve(stdout.trim());
      }
    });

    child.stdin.end(input);
  });
}

function containerName(name) {
  if (
    typeof name !== "string" ||
    !/^kmvps-\d{17,20}-\d+$/.test(name)
  ) {
    throw new Error("Invalid VPS name.");
  }

  return name;
}

async function getContainer(name) {
  name = containerName(name);

  const output = await docker([
    "inspect",
    "--format",
    "{{json .Config.Labels}}",
    name
  ]);

  return JSON.parse(output || "{}");
}

async function createVps({
  userId,
  os,
  ram,
  cpu,
  disk
}) {
  userId = safeId(userId);

  const specs = validateSpecs(ram, cpu, disk);

  const selectedOS = OS_IMAGES[os];

  if (!selectedOS) {
    throw new Error("Unsupported operating system.");
  }

  const name = `${PREFIX}${userId}-${Date.now()}`;
  const password = randomPassword();

  await docker([
    "pull",
    selectedOS.image
  ], { timeout: 600000 });

  const startupScript = [
    "set -e",
    "if [ ! -f /var/lib/kmdev-ssh-ready ]; then",
    "  export DEBIAN_FRONTEND=noninteractive",
    "  apt-get update",
    "  apt-get install -y openssh-server",
    "  mkdir -p /run/sshd",
    "  touch /var/lib/kmdev-ssh-ready",
    "fi",
    "mkdir -p /run/sshd",
    "exec /usr/sbin/sshd -D -e"
  ].join("\n");

  await docker([
    "run",
    "-d",
    "--name", name,
    "--hostname", name,
    "--restart", "unless-stopped",
    "--memory", `${specs.ram}g`,
    "--memory-swap", `${specs.ram}g`,
    "--cpus", String(specs.cpu),
    "--pids-limit", "256",
    "--publish", "0.0.0.0::22",
    "--label", `kmdev.owner=${userId}`,
    "--label", `kmdev.os=${selectedOS.name}`,
    "--label", `kmdev.disk_gb=${specs.disk}`,
    "--label", `kmdev.ram_gb=${specs.ram}`,
    "--label", `kmdev.cpu=${specs.cpu}`,
    selectedOS.image,
    "bash",
    "-lc",
    startupScript
  ]);

  try {
    let ready = false;

    for (let i = 0; i < 120; i++) {
      try {
        await docker([
          "exec",
          name,
          "test",
          "-f",
          "/var/lib/kmdev-ssh-ready"
        ]);

        ready = true;
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!ready) {
      throw new Error("SSH setup timed out.");
    }

    await dockerWithInput(
      ["exec", "-i", name, "chpasswd"],
      `root:${password}\n`
    );

    const portOutput = await docker([
      "port",
      name,
      "22/tcp"
    ]);

    const match = portOutput.match(/:(\d+)\s*$/);

    if (!match) {
      throw new Error("Could not determine SSH port.");
    }

    return {
      id: name,
      name,
      os: selectedOS.name,
      ram: specs.ram,
      cpu: specs.cpu,
      disk: specs.disk,
      sshPort: Number(match[1]),
      password
    };
  } catch (error) {
    try {
      await docker(["rm", "-f", name]);
    } catch {}
    throw error;
  }
}

async function listVps(userId) {
  userId = safeId(userId);

  const output = await docker([
    "ps",
    "-a",
    "--filter",
    `label=kmdev.owner=${userId}`,
    "--format",
    "{{.Names}}"
  ]);

  return output
    ? output.split("\n").filter(Boolean)
    : [];
}

async function getInfo(name) {
  name = containerName(name);

  const output = await docker([
    "inspect",
    "--format",
    "{{json .}}",
    name
  ]);

  const info = JSON.parse(output);
  const labels = info.Config.Labels || {};

  const portOutput = await docker([
    "port",
    name,
    "22/tcp"
  ]).catch(() => "");

  const match = portOutput.match(/:(\d+)\s*$/);

  return {
    name,
    status: info.State.Status,
    running: info.State.Running,
    os: labels["kmdev.os"] || "Unknown",
    ram: labels["kmdev.ram_gb"] || "Unknown",
    cpu: labels["kmdev.cpu"] || "Unknown",
    disk: labels["kmdev.disk_gb"] || "Unknown",
    ip: info.NetworkSettings.IPAddress || "Unavailable",
    sshPort: match ? Number(match[1]) : null,
    owner: labels["kmdev.owner"] || "Unknown"
  };
}

async function startVps(name) {
  name = containerName(name);
  await docker(["start", name]);
  return true;
}

async function stopVps(name) {
  name = containerName(name);
  await docker(["stop", name]);
  return true;
}

async function restartVps(name) {
  name = containerName(name);
  await docker(["restart", name]);
  return true;
}

async function deleteVps(name) {
  name = containerName(name);
  await docker(["rm", "-f", name]);
  return true;
}

async function backupVps(name) {
  name = containerName(name);

  const output = await docker([
    "export",
    name
  ], { timeout: 600000 });

  return output;
}

module.exports = {
  OS_IMAGES,
  createVps,
  listVps,
  getInfo,
  startVps,
  stopVps,
  restartVps,
  deleteVps,
  backupVps
};
