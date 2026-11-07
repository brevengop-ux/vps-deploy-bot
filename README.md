# KM DEV VPS Deploy Bot

Discord.js bot that provisions Docker containers as managed Linux environments.

## Supported container images
- Ubuntu 22.04 LTS
- Ubuntu 24.04 LTS
- Debian 11
- Debian 12 (Bookworm)

## Requirements
- Linux host with Docker Engine installed and running
- Node.js 20+
- Discord bot with Message Content Intent enabled
- A configured public IPv4 and provider/firewall port forwarding for SSH

## Setup
1. Copy `.env.example` to `.env`.
2. Fill `DISCORD_TOKEN`, `ADMIN_ID`, and `PUBLIC_IPV4`.
3. Run `npm install`.
4. Run `npm run check`.
5. Run `npm start`.

Never commit `.env` or share your bot token.

## Commands
- `!create <ramGB> <cpuCores> <diskGB> [@user]` (admin only)
- `!myvps`
- `!list`
- `!status`
- `!manage [number]`
- `!help`

After `!create`, choose the operating system from the dropdown. Credentials are sent by DM.

## Important limitations
This project provisions Docker containers, not KVM virtual machines or separate physical VPSs. The disk request is currently recorded as metadata; it is **not** enforced as a filesystem quota. Docker access is highly privileged (effectively root-level). Do not expose the Docker socket to an untrusted service account or public network. Use a properly isolated host and review the security model before deploying real users.

SSH connectivity depends on the host's firewall, provider firewall, public IP routing and port forwarding. A randomly mapped Docker port alone does not guarantee internet reachability.

Reinstall, SSHX, Tmate and Backup are intentionally not enabled in this starter.
