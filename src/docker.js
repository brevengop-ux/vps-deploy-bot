
'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');

const exec = promisify(execFile);

const IMAGES = {
  ubuntu: 'ubuntu:24.04',
  debian: 'debian:bookworm-slim'
};

const PREFIX = 'kmvps-';

function validateSpecs({ ram, cpu, disk }) {
  const memory = Number(ram);
  const cores = Number(cpu);
  const storage = Number(disk);

  if (!Number.isFinite(memory) || memory < 1 || memory > 32) {
    throw new Error('RAM must be between 1 and 32 GB.');
  }

  if (!Number.isFinite(cores) || cores < 0.5 || cores > 16) {
    throw new Error('CPU must be between 0.5 and 16 cores.');
  }

  if (!Number.isInteger(storage) || storage < 5 || storage > 500) {
    throw new Error('Disk must be between 5 and 500 GB.');
  }

  return { memory, cores, storage };
}

function safeId(value) {
  const id = String(value || '');

  if (!/^\d{17,20}$/.test(id)) {
    throw new Error('Invalid Discord user ID.');
  }

  return id;
}

async function docker(args) {
  try {
    const { stdout } = await exec('docker', args, {
      timeout: 120000,
      maxBuffer: 5 * 1024 * 1024
    });

    return stdout.trim();
  } catch (error) {
    throw new Error(
      error.stderr?.trim() ||
      error.message ||
      'Docker command failed.'
    );
  }
}

async function checkDocker() {
  await docker(['version', '--format', '{{.Server.Version}}']);
}

function makeName(userId) {
  return `${PREFIX}${userId}-${Date.now()}`;
}

async function createVps({ userId, os, ram, cpu, disk }) {
  userId = safeId(userId);

  const imageKey = String(os || '').toLowerCase();

  if (!IMAGES[imageKey]) {
    throw new Error('Supported operating systems: Ubuntu and Debian.');
  }

  const specs = validateSpecs({ ram, cpu, disk });

  await checkDocker();

  const name = makeName(userId);
  const password = crypto.randomBytes(24).toString('base64url');

  const setupScript = [
    'set -e',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update',
    'apt-get install -y openssh-server ca-certificates curl',
    'mkdir -p /run/sshd',
    'ssh-keygen -A',
    'printf "%s\\n" "root:${ROOT_PASSWORD}" | chpasswd',
    'mkdir -p /etc/ssh/sshd_config.d',
    'printf "%s\\n" "PermitRootLogin yes" "PasswordAuthentication yes" > /etc/ssh/sshd_config.d/99-kmdev.conf',
    'exec /usr/sbin/sshd -D -e'
  ].join(' && ');

  const args = [
    'run',
    '-d',
    '--init',
    '--name', name,
    '--restart', 'unless-stopped',
    '--memory', `${specs.memory}g`,
    '--cpus', String(specs.cores),
    '--pids-limit', '512',
    '--security-opt', 'no-new-privileges',
    '--cap-drop', 'ALL',
    '--cap-add', 'CHOWN',
    '--cap-add', 'SETUID',
    '--cap-add', 'SETGID',
    '--cap-add', 'NET_BIND_SERVICE',
    '--cap-add', 'SYS_CHROOT',
    '--cap-add', 'DAC_OVERRIDE',
    '--publish', '22',
    '--label', `kmdev.owner=${userId}`,
    '--label', `kmdev.os=${imageKey}`,
    '--label', `kmdev.disk_gb=${specs.storage}`,
    '--env', `ROOT_PASSWORD=${password}`,
    IMAGES[imageKey],
    'bash',
    '-lc',
    setupScript
  ];

  const containerId = await docker(args);

  return {
    id: containerId,
    name,
    userId,
    os: imageKey,
    ram: specs.memory,
    cpu: specs.cores,
    disk: specs.storage,
    password
  };
}

async function getContainer(name) {
  if (!String(name).startsWith(PREFIX)) {
    throw new Error('Invalid container name.');
  }

  const output = await docker([
    'inspect',
    '--format',
    '{{json .}}',
    name
  ]);

  return JSON.parse(output);
}

async function getInfo(name) {
  const info = await getContainer(name);

  const port = info.NetworkSettings?.Ports?.['22/tcp']?.[0]?.HostPort || null;

  return {
    name: info.Name.replace(/^\//, ''),
    id: info.Id,
    status: info.State.Status,
    running: info.State.Running,
    ip: info.NetworkSettings?.IPAddress || null,
    sshPort: port,
    os: info.Config.Labels['kmdev.os'],
    owner: info.Config.Labels['kmdev.owner'],
    disk: info.Config.Labels['kmdev.disk_gb']
  };
}

async function startVps(name) {
  await getContainer(name);
  return docker(['start', name]);
}

async function stopVps(name) {
  await getContainer(name);
  return docker(['stop', '--time', '15', name]);
}

async function restartVps(name) {
  await getContainer(name);
  return docker(['restart', '--time', '15', name]);
}

async function deleteVps(name) {
  await getContainer(name);
  await docker(['rm', '-f', name]);
  return true;
}

async function listVps(userId) {
  userId = safeId(userId);

  const output = await docker([
    'ps',
    '-a',
    '--filter', `label=kmdev.owner=${userId}`,
    '--format', '{{.Names}}'
  ]);

  return output
    ? output.split('\n').filter(Boolean)
    : [];
}

async function backupVps(name, destination) {
  await getContainer(name);

  if (!/^\/[a-zA-Z0-9/_-]+\.tar$/.test(destination)) {
    throw new Error('Backup destination must be an absolute .tar path.');
  }

  await docker([
    'export',
    '--output',
    destination,
    name
  ]);

  return destination;
}

module.exports = {
  checkDocker,
  createVps,
  getInfo,
  startVps,
  stopVps,
  restartVps,
  deleteVps,
  listVps,
  backupVps
};
    
