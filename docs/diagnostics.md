# Diagnostics

WaveGuard provides diagnostics for network infrastructure, lighting systems, and system health.

## Lighting Diagnostics

### Connection Testing

Each lighting system type supports connection testing via the **Settings → Lighting** panel or the **key icon** in the Lighting page header.

When testing, the server:

1. **Resolves the connection** — uses the stored credentials or any per-request overrides
2. **Probes ports** — sends protocol-specific probes to the target host
3. **Attempts authentication** — connects and authenticates (if applicable)
4. **Reports results** — returns success/failure, product info, open ports, and recommendations

#### Lutron (Telnet / LEAP)

| Protocol | Port | Probe Method |
|---|---|---|
| Telnet | 23 | TCP connect + login/password prompt detection |
| LEAP | 8081 | TCP connect (TLS not yet wired — shows setup guide) |
| LEAP pairing | 8083 | TCP probe |
| Legacy Telnet | 2147 | TCP probe |
| Web admin | 443 | TCP probe |

**Recommendations:**
- If Telnet (23) is closed but LEAP (8081) is open: suggests enabling Telnet in Lutron Designer
- If both are closed: advises enabling integration access in Designer and re-transferring
- If LEAP is selected: informs that LEAP is not yet wired and suggests switching to Telnet

#### KNX (KNXnet/IP)

| Protocol | Port | Probe Method |
|---|---|---|
| KNX IP | 3671 | UDP KNXnet/IP search request |

**Recommendations:**
- If port 3671 is not responding: verify the KNX IP gateway is powered and reachable, and UDP multicast (224.0.23.12) is allowed on the subnet

#### DALI (DALI-IP Bridge)

| Protocol | Port | Probe Method |
|---|---|---|
| DALI IP | 5582 | TCP connect |

**Recommendations:**
- If port 5582 is not responding: verify the DALI IP bridge is powered and its IP address is reachable

#### DMX (Art-Net / sACN)

| Protocol | Port | Probe Method |
|---|---|---|
| Art-Net | 6454 | UDP probe |
| sACN | 5568 | UDP probe |

**Recommendations:**
- If Art-Net port 6454 is not responding: check the DMX Art-Net node is powered and UDP traffic is not blocked
- If sACN port 5568 is not responding: verify sACN source and multicast configuration

### Zone Diagnostics

Individual zone diagnostics are available through the Lighting system:

- **Poll all zones** — sends a bulk status request to refresh all zone levels from the live processor
- **Per-zone commands** — set level, toggle, raise/lower/stop (for shades)
- **Scene activation** — activates an area scene with per-zone level targets
- **Snapshot** — captures the full current state of all zones

### Mock Engine Mode

When no live processor is configured, the mock engine provides simulated responses for all lighting operations. This allows the full UI to be tested and demonstrated without any physical hardware.

Mock engines for each system type:
- **Lutron** — 24 zones, 4 scenes, 3 keypads
- **KNX** — 12 group addresses
- **DALI** — 16 ballasts
- **DMX** — 24 channels (Art-Net universe 0)

## Network Diagnostics

### Switch Port Diagnostics

- **SNMP Port Map** — live status of switch ports (up/down), speed, VLAN, PoE power
- **Per-port test** — query a specific interface index for detailed status
- **Cable path tracing** — traceroute + ping between any two devices
- **Fault detection** — identifies disconnected ports and potential cable faults

### Device Diagnostics

- **Ping** — ICMP echo to any discovered device with latency stats (min/max/avg/packet loss)
- **Traceroute** — hop-by-hop path to target
- **Port scan** — open TCP ports on discovered devices
- **SNMP walk** — full SNMP MIB walk (when enabled)

## System Health

The scanner health endpoint (`GET /api/scanner/health`) reports:

- **Scan interface** — the network interface used for discovery
- **Subnet detection** — auto-detected local subnets
- **SNMP availability** — whether the SNMP community string is configured
- **Concurrent scan limit** — maximum concurrent probe count
- **Timeout** — per-probe timeout in milliseconds

## Diagnosis Acknowledgements

The `diagnosisAcknowledgement.js` module provides a structured format for recording and acknowledging diagnostic findings, supporting:

- Issue identification with severity levels
- Operator acknowledgement with timestamp
- Persistent storage of acknowledged findings
- Integration with the automation rule engine for alert tracking
