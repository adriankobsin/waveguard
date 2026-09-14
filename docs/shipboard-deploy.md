# Shipboard AV trunk — WaveGuard access

## Goal

Any device on the main ships trunk AV network opens the WaveGuard web platform in a browser.

## Checklist

1. **Physical / L2** — Plug the WaveGuard server into the AV trunk switch (or a VLAN that routes/bridges to it). Until this is done, other AV devices cannot reach the host.
2. **IP** — Assign a fixed address on the AV subnet (example: `192.168.10.20/24`). Note gateway/DNS only if the vessel uses them; WaveGuard itself does not need internet.
3. **Firewall** — Allow inbound TCP to the WaveGuard HTTP port from the AV subnet (`8080` recommended, or `80`).
4. **Software** — On the host:

```bash
cd /opt/waveguard   # or your install path
git pull
npm install
WAVEGUARD_PORT=8080 npm run ship
```

5. **Verify from another device** — On a laptop/phone joined to the same AV network, open `http://192.168.10.20:8080` (use the host’s real IP). You should see the WaveGuard login page.
6. **Live scanning** — Leave `WAVEGUARD_USE_MOCK_SCAN` unset so discovery/SNMP talk to real gear on the trunk.

## One URL for everything

`npm run ship` serves the React UI, REST API, uploads, and `/chat` from the **same origin**. Clients never need to know about port 3002/5173.

## If the page loads but APIs fail

- Confirm you are using the **ship** URL (single port), not a stale bookmark to `:5173` without Vite running.
- Confirm the host IP you typed is the NIC on the AV trunk (not a Wi‑Fi/guest NIC).
- From the client device: `ping <waveguard-ip>` then open the URL again.
