/**
 * AV Flow model — joins what the AV devices say (Crestron NVX, Dante) with
 * what the network says (Cisco MAC tables, IGMP snooping, PTP) and turns it
 * into streams, a device list and plain-English findings for an ETO.
 *
 * Pure functions only: the server feeds it live data, the demo feeds it a
 * canned vessel. Nothing in here touches the network.
 */

export const STREAM_TYPES = {
  nvx: { label: "NVX video", color: "#60a5fa" },
  dante: { label: "Dante multicast", color: "#22c55e" },
  aes67: { label: "AES67", color: "#a78bfa" },
  ptp: { label: "PTP clock", color: "#f59e0b" },
  other: { label: "Other multicast", color: "#94a3b8" },
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, ok: 3 };

export function normMac(mac) {
  const hex = String(mac || "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  return hex.length === 12 ? hex.match(/../g).join(":") : null;
}

export function portKey(name) {
  const n = String(name || "").trim().toLowerCase();
  const word = n.match(/^[a-z-]+/)?.[0] || "";
  const map = { gigabitethernet: "gi", tengigabitethernet: "te", twogigabitethernet: "tw", fastethernet: "fa" };
  const prefix = map[word] || word.slice(0, 2);
  return `${prefix}${n.slice(word.length)}`;
}

export function classifyGroup(address, { nvxGroups = new Set(), sapGroups = new Set() } = {}) {
  const a = String(address || "");
  if (nvxGroups.has(a)) return "nvx";
  if (a === "224.0.1.129" || a === "224.0.1.130" || a === "224.0.1.131" || a === "224.0.1.132") return "ptp";
  if (sapGroups.has(a) || a.startsWith("239.69.")) return "aes67";
  if (a.startsWith("239.255.") && a !== "239.255.255.250" && a !== "239.255.255.255") return "dante";
  if (a.startsWith("224.0.0.") || a === "239.255.255.250" || a === "239.255.255.255") return null; // link-local, SSDP, SAP
  return "other";
}

/** Find where a MAC lives on the Cisco switches: prefer access ports over uplinks. */
function buildLocator(switches) {
  const byMac = new Map();
  for (const sw of switches || []) {
    const snap = sw.snapshot || {};
    const ports = new Map((snap.interfaces || []).map((p) => [portKey(p.name), p]));
    const macCount = new Map();
    for (const m of snap.macs || []) macCount.set(portKey(m.port), (macCount.get(portKey(m.port)) || 0) + 1);
    for (const m of snap.macs || []) {
      const mac = normMac(m.mac);
      if (!mac) continue;
      const key = portKey(m.port);
      const port = ports.get(key);
      const candidate = {
        switchHost: sw.host,
        switchName: sw.name || snap.system?.hostname || sw.host,
        port: port?.name || m.port,
        portKey: key,
        vlan: m.vlan ?? port?.vlan ?? null,
        speedMbps: port?.speedMbps ?? null,
        status: port?.status || null,
        poeWatts: port?.poeWatts ?? null,
        errors: port?.errors || null,
        uplink: !!port?.isUplink || (macCount.get(key) || 0) > 8,
        description: port?.ifAlias || "",
      };
      const prev = byMac.get(mac);
      if (!prev || (prev.uplink && !candidate.uplink)) byMac.set(mac, candidate);
    }
  }
  return (mac) => (mac ? byMac.get(normMac(mac)) || null : null);
}

function speedText(mbps) {
  if (!mbps) return "unknown speed";
  return mbps >= 1000 ? `${mbps / 1000} Gb/s` : `${mbps} Mb/s`;
}

/**
 * @param {object} input
 * @param {Array}  input.nvx        NVX endpoints from the Crestron REST API
 * @param {Array}  input.dante      Dante devices from mDNS
 * @param {object} input.ptp        avNetworkScan() result (PTP + SAP), optional
 * @param {Array}  input.switches   [{ host, name, snapshot }] Cisco snapshots incl. multicast
 * @param {Array}  input.neighbours [{ ip, mac }] ARP table of the WaveGuard server
 * @param {Array}  input.equipment  WaveGuard equipment records (names, locations)
 */
export function buildAvFlow({ nvx = [], dante = [], ptp = null, switches = [], neighbours = [], equipment = [], notes = [] } = {}) {
  const locate = buildLocator(switches);
  const macByIp = new Map();
  for (const n of neighbours) if (n.ip && n.mac) macByIp.set(n.ip, normMac(n.mac));
  const eqByIp = new Map(equipment.filter((e) => e.ip || e.ipAddress).map((e) => [e.ip || e.ipAddress, e]));

  const findings = [];
  const add = (severity, title, detail, fix, refs = {}) => findings.push({ severity, title, detail, fix, ...refs });

  // ── Devices ────────────────────────────────────────────────────────────
  const devices = [];
  for (const d of nvx) {
    const mac = normMac(d.mac) || macByIp.get(d.ip) || null;
    const eq = eqByIp.get(d.ip);
    devices.push({
      id: `nvx:${d.ip}`,
      kind: d.mode === "rx" ? "nvx-rx" : "nvx-tx",
      family: "nvx",
      ip: d.ip,
      mac,
      name: d.name || eq?.name || d.ip,
      model: d.model || eq?.model || "DM-NVX",
      location: eq?.location || null,
      firmware: d.firmware || null,
      online: d.online !== false,
      authFailed: !!d.authFailed,
      error: d.error || null,
      mode: d.mode,
      multicast: d.multicast || null,
      streamLocation: d.streamLocation || null,
      streamStatus: d.status || null,
      resolution: d.resolution || null,
      inputSync: d.inputSync ?? null,
      hdcp: d.hdcp || null,
      port: locate(mac),
    });
  }
  for (const d of dante) {
    const mac = normMac(d.mac) || macByIp.get(d.ip) || null;
    const eq = eqByIp.get(d.ip);
    devices.push({
      id: `dante:${d.ip}`,
      kind: "dante",
      family: "dante",
      ip: d.ip,
      mac,
      name: d.name || eq?.name || d.ip,
      model: [d.manufacturer, d.model].filter(Boolean).join(" ") || eq?.model || "Dante device",
      location: eq?.location || null,
      online: true,
      txChannels: d.txChannels ?? null,
      rxChannels: d.rxChannels ?? null,
      sampleRate: d.sampleRate ?? null,
      port: locate(mac),
    });
  }
  const devByIp = new Map(devices.map((d) => [d.ip, d]));
  const devByPort = new Map();
  for (const d of devices) if (d.port) devByPort.set(`${d.port.switchHost}|${d.port.portKey}`, d);
  const portLabel = (switchHost, port) => {
    const dev = devByPort.get(`${switchHost}|${portKey(port)}`);
    return dev ? dev.name : port;
  };

  // ── Network-wide multicast state ───────────────────────────────────────
  const nvxGroups = new Set(devices.filter((d) => d.kind === "nvx-tx" && d.multicast).map((d) => d.multicast));
  const sapStreams = ptp?.streams || [];
  const sapGroups = new Set(sapStreams.map((s) => s.connection).filter(Boolean));
  const groupPorts = new Map(); // group -> [{switchHost, port, vlan}]
  const avVlans = new Set(devices.map((d) => d.port?.vlan).filter(Boolean));
  for (const sw of switches) {
    const mc = sw.snapshot?.multicast;
    const swName = sw.name || sw.snapshot?.system?.hostname || sw.host;
    if (!mc) continue;
    if (mc.snoopingEnabled === false) {
      add("critical", `IGMP snooping is off on ${swName}`,
        "Every NVX video stream and Dante multicast flow is flooded to every port on the VLAN. NVX alone can saturate 1 Gb/s links, so cameras, Wi-Fi and Dante drop out.",
        `On ${swName}: configure terminal → ip igmp snooping → end → write memory. Then enable it on each AV VLAN.`, { switchHost: sw.host });
    }
    for (const v of mc.vlans || []) {
      if (v.snooping === false && avVlans.has(v.vlan)) {
        add("critical", `IGMP snooping off on AV VLAN ${v.vlan} (${swName})`,
          "AV multicast on this VLAN is flooded to every port.",
          `ip igmp snooping vlan ${v.vlan}`, { switchHost: sw.host });
      }
    }
    for (const g of mc.groups || []) {
      const list = groupPorts.get(g.group) || [];
      for (const p of g.ports || []) list.push({ switchHost: sw.host, switchName: swName, port: p, vlan: g.vlan });
      groupPorts.set(g.group, list);
    }
  }
  const haveIgmp = switches.some((s) => s.snapshot?.multicast);
  // A querier anywhere on the VLAN (usually the core switch) is enough.
  const querierChecked = switches.some((s) => s.snapshot?.multicast?.querierChecked);
  const querierVlans = new Set(switches.flatMap((s) => (s.snapshot?.multicast?.queriers || []).map((q) => q.vlan)));
  if (querierChecked) {
    const groupVlans = new Set(switches.flatMap((s) => (s.snapshot?.multicast?.groups || []).map((g) => g.vlan)));
    for (const vlan of groupVlans) {
      if (querierVlans.has(vlan)) continue;
      add("warning", `No IGMP querier on VLAN ${vlan}`,
        "Without a querier, switches stop forwarding a group after ~4 minutes. Classic symptom: NVX video or Dante audio drops every few minutes, then comes back when a device rejoins.",
        "Enable exactly one querier per AV VLAN, ideally on the core switch: ip igmp snooping querier (the VLAN needs an IP address).");
    }
  }

  // ── Streams ────────────────────────────────────────────────────────────
  const streams = [];
  const txList = devices.filter((d) => d.kind === "nvx-tx");
  const rxList = devices.filter((d) => d.kind === "nvx-rx");
  const rxSource = (rx) =>
    txList.find((tx) => (rx.multicast && tx.multicast === rx.multicast) ||
      (rx.streamLocation && (rx.streamLocation === tx.streamLocation || rx.streamLocation.includes(`//${tx.ip}/`) || rx.streamLocation.includes(`//${tx.ip}:`))));

  for (const tx of txList) {
    const receivers = rxList.filter((rx) => rxSource(rx) === tx);
    const joined = groupPorts.get(tx.multicast) || [];
    const streaming = /start|stream|active|ok/i.test(tx.streamStatus || "") && !/stop|no\s/i.test(tx.streamStatus || "");
    streams.push({
      id: `nvx:${tx.ip}`,
      type: "nvx",
      name: tx.name,
      address: tx.multicast,
      source: { id: tx.id, name: tx.name, ip: tx.ip },
      receivers: receivers.map((r) => ({ id: r.id, name: r.name, ip: r.ip, ok: !/no stream|stop|error/i.test(r.streamStatus || "") })),
      joinedPorts: joined.map((j) => ({ ...j, label: portLabel(j.switchHost, j.port) })),
      status: !tx.online ? "offline" : streaming ? (receivers.length ? "active" : "idle") : "stopped",
      detail: [tx.resolution, tx.inputSync === false ? "no HDMI input" : null].filter(Boolean).join(" · "),
      bandwidth: "up to 950 Mb/s",
    });
    if (tx.online && tx.inputSync === false && receivers.length) {
      add("warning", `${tx.name}: no video on the HDMI input`, `${receivers.length} display(s) are routed to this encoder but it has no source signal.`,
        "Check the source device is on and the HDMI cable / input selection at the encoder.", { deviceId: tx.id });
    }
    if (tx.online && !streaming && receivers.length) {
      add("critical", `${tx.name} is not streaming`, `Status reported: "${tx.streamStatus || "unknown"}". Routed displays will be blank.`,
        "Open the encoder's web page → Stream → Start, or check its multicast address isn't 0.0.0.0.", { deviceId: tx.id });
    }
    if (haveIgmp && tx.multicast && receivers.length) {
      for (const rx of receivers) {
        if (!rx.port) continue;
        const ok = joined.some((j) => j.switchHost === rx.port.switchHost && portKey(j.port) === rx.port.portKey);
        if (!ok) {
          add("warning", `${rx.name} hasn't joined ${tx.multicast}`,
            `The decoder is set to ${tx.name}, but ${rx.port.switchName} ${rx.port.port} isn't in the IGMP group, so the switch won't forward the video.`,
            "Bounce the decoder's port or check IGMP snooping/querier on its VLAN.", { deviceId: rx.id });
        }
      }
    }
  }
  for (const rx of rxList) {
    if (!rx.online) continue;
    const src = rxSource(rx);
    if (!src && (rx.multicast || rx.streamLocation)) {
      add("warning", `${rx.name} is subscribed to an unknown stream`, `It is set to ${rx.multicast || rx.streamLocation}, which isn't any encoder WaveGuard can see.`,
        "Route it to an encoder below, or add the missing encoder's IP to Equipment.", { deviceId: rx.id });
    }
  }

  for (const [group, ports] of groupPorts) {
    const type = classifyGroup(group, { nvxGroups, sapGroups });
    if (!type || type === "nvx") continue;
    const sap = sapStreams.find((s) => s.connection === group);
    const sourceDev = sap ? devByIp.get(sap.source) : null;
    streams.push({
      id: `${type}:${group}`,
      type,
      name: sap?.sessionName || (type === "dante" ? `Dante flow ${group}` : type === "ptp" ? "PTP clock" : group),
      address: group,
      source: sourceDev ? { id: sourceDev.id, name: sourceDev.name, ip: sourceDev.ip } : sap ? { name: sap.source, ip: sap.source } : null,
      receivers: ports.map((p) => {
        const dev = devByPort.get(`${p.switchHost}|${portKey(p.port)}`);
        return dev ? { id: dev.id, name: dev.name, ip: dev.ip, ok: true } : { name: `${p.switchName} ${p.port}`, ok: true };
      }),
      joinedPorts: ports.map((j) => ({ ...j, label: portLabel(j.switchHost, j.port) })),
      status: "active",
      detail: sap?.rtpmap || null,
    });
  }
  for (const s of sapStreams) {
    if (!s.connection || groupPorts.has(s.connection) || s.deletion) continue;
    streams.push({
      id: `aes67:${s.connection}`,
      type: "aes67",
      name: s.sessionName || s.connection,
      address: s.connection,
      source: devByIp.get(s.source) ? { id: devByIp.get(s.source).id, name: devByIp.get(s.source).name, ip: s.source } : { name: s.source, ip: s.source },
      receivers: [],
      joinedPorts: [],
      status: "advertised",
      detail: s.rtpmap || null,
    });
  }

  // ── Per-device link checks ─────────────────────────────────────────────
  for (const d of devices) {
    if (d.authFailed) {
      add("warning", `Can't log in to ${d.name}`, "The NVX answers, but refused WaveGuard's username/password, so its stream status is unknown.",
        "AV Flow → Settings: enter the NVX login (the same one used on its web page).", { deviceId: d.id });
      continue;
    }
    if (!d.online) {
      add("critical", `${d.name} is not responding`, d.error || `No answer from ${d.ip}.`,
        d.port ? `It's on ${d.port.switchName} ${d.port.port}. Try "Power-cycle device (PoE)" on that port.` : "Check power and the network cable.", { deviceId: d.id });
      continue;
    }
    const p = d.port;
    if (!p) continue;
    if (d.family === "nvx" && p.speedMbps && p.speedMbps < 1000) {
      add("critical", `${d.name} linked at ${speedText(p.speedMbps)}`, "NVX needs a 1 Gb/s link; at 100 Mb/s the video won't stream.",
        `Check the cable/patch on ${p.switchName} ${p.port}, then restart the port.`, { deviceId: d.id });
    }
    if (d.family === "dante" && p.speedMbps && p.speedMbps < 1000) {
      add("info", `${d.name} linked at ${speedText(p.speedMbps)}`, "Dante works at 100 Mb/s for small channel counts, but most devices expect 1 Gb/s.",
        `Check the cable on ${p.switchName} ${p.port}.`, { deviceId: d.id });
    }
    const errs = p.errors ? (p.errors.fcs || 0) + (p.errors.in || 0) : 0;
    if (errs > 100) {
      add("warning", `${d.name}: ${errs.toLocaleString()} errors on ${p.switchName} ${p.port}`, "CRC/FCS errors mean a damaged cable, bad termination or interference — audio clicks and video sparkles.",
        "Re-terminate or replace the cable, then clear counters and watch.", { deviceId: d.id });
    }
    if (p.uplink) {
      add("info", `${d.name} is only seen behind an uplink`, `WaveGuard can't see the access port for ${d.ip}. It's probably on a switch that isn't connected to WaveGuard.`,
        "Add that switch under Core Network → Cisco Switches.", { deviceId: d.id });
    }
  }

  // ── Dante clocking ─────────────────────────────────────────────────────
  if (ptp) {
    const leaders = (ptp.ptp || []).filter((x) => x.sendsSync);
    const v1 = leaders.filter((l) => l.version === 1);
    if (v1.length > 1) {
      add("critical", `${v1.length} Dante clock leaders`, `Devices ${v1.map((l) => devByIp.get(l.ip)?.name || l.ip).join(", ")} are all sending PTP sync. Audio will click or mute.`,
        "In Dante Controller → Clock Status, set one device as Preferred Leader and check the others' clock settings / VLANs.");
    }
    if (dante.length && !leaders.length) {
      add("warning", "No Dante clock (PTP) heard", "WaveGuard heard no PTP sync on its own network port. Either it isn't on the Dante VLAN, or the switch isn't forwarding 224.0.1.129 to it.",
        "Put WaveGuard's port on the Dante VLAN (or a trunk) to monitor clocking.");
    }
    for (const f of ptp.findings || []) {
      if (/PTPv1 Sync/.test(f.message) || /No PTP traffic/.test(f.message)) continue;
      add(f.severity === "warning" ? "warning" : "info", "Clock", f.message, null);
    }
  }
  const nvxDanteSameVlan = [...avVlans].some((v) =>
    devices.some((d) => d.family === "nvx" && d.port?.vlan === v) && devices.some((d) => d.family === "dante" && d.port?.vlan === v));
  if (nvxDanteSameVlan) {
    add("info", "NVX video and Dante audio share a VLAN", "It works with IGMP snooping, but heavy NVX multicast can starve Dante clock packets on busy uplinks.",
      "Best practice: separate VLANs, and QoS that trusts DSCP 56 (PTP) and 46 (audio) on all trunk ports.");
  }

  for (const n of notes) add("info", n.title, n.detail, n.fix || null);

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const summary = {
    nvxTx: txList.length,
    nvxRx: rxList.length,
    dante: devices.filter((d) => d.family === "dante").length,
    offline: devices.filter((d) => !d.online).length,
    streams: streams.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    igmp: haveIgmp ? (switches.every((s) => s.snapshot?.multicast?.snoopingEnabled !== false) ? "on" : "off") : "unknown",
    clockLeader: (() => {
      const l = (ptp?.ptp || []).find((x) => x.sendsSync);
      return l ? { ip: l.ip, name: devByIp.get(l.ip)?.name || l.vendor || l.ip, version: l.version } : null;
    })(),
  };
  return { devices, streams, findings, summary, generatedAt: new Date().toISOString() };
}
