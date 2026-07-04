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

| Protocol | Port | Probe Method | Live Client |
|---|---|---|---|
| Telnet | 23 | TCP connect + login/password prompt detection | Telnet socket with command queue |
| LEAP | 8081 | TCP probe | HTTP REST (JSON via Basic auth) |
| LEAP pairing | 8083 | TCP probe | — |
| Legacy Telnet | 2147 | TCP probe | — |
| Web admin | 443 | TCP probe | — |

**Live LEAP client** (`leapClient.js`):
- Sends `CreateRequest` commands via HTTP PUT to `/zone/{id}/commandprocessor`, `/area/{id}/commandprocessor`, `/device/{id}/button/{comp}/commandprocessor`
- Reads zone status via `GET /zone/{id}/status`
- Supports `GoToLevel`, `Raise`/`Lower`/`StopRaisingOrLowering`, `PressAndRelease`, `ActivateScene`
- Uses HTTP (port 8081) by default; HTTPS is used when port is 443 or 8083
- Authentication via HTTP Basic auth with integration username/password (no certificate pairing required on port 8081)

**Recommendations:**
- If Telnet (23) is closed but LEAP (8081) is open: suggests switching to LEAP protocol in the connection settings
- If both are closed: advises enabling integration access in Designer and re-transferring

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

### Generated Lighting Diagnoses

`src/lib/lighting/lightingDiagnoses.js` reads the lighting event log ring buffer (`lighting-event-log` in SystemSettings) and produces structured diagnoses surfaced on the Diagnoses page and counted in the sidebar badge:

| ID prefix | Severity | When it fires |
|---|---|---|
| `lighting-processor-offline` | critical | The configured Lutron processor stops responding to the periodic probe in `SystemDataContext` (60s cadence). |
| `lighting-zone-rejected-<href>` | warning | A single zone command is rejected by the processor within the last 5 minutes. |
| `lighting-zone-unreachable-<href>` | critical | Three or more consecutive failures on the same zone within the last 5 minutes. |

The generator is re-run on every `LIGHTING_EVENT_LOG_CHANGED_EVENT` and `LIGHTING_LUTRON_CONNECTION_CHANGED_EVENT` dispatch, so diagnoses appear and clear in real time without page reloads.

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

### Packet Capture (Wireshark / tshark)

The **Diagnoses** page includes a **Packet Analysis** panel powered by [Wireshark tshark](https://www.wireshark.org/docs/man-pages/tshark.html) on the on-prem scanner host.

| Feature | API function | tshark usage |
|---|---|---|
| Status & interfaces | `wiresharkStatus` | `tshark -v`, `tshark -D` |
| Live capture | `wiresharkCapture` | `tshark -i <iface> -a duration:N -f "<bpf>" -w file` |
| Analyze / filter | `wiresharkAnalyze` | `tshark -r file -Y "<display filter>" -T json` |
| Statistics | `wiresharkStats` | `tshark -r file -qz io,phs,0`, `-qz conv,tcp,0`, `-qz endpoints,ip` |

**Prerequisites (scanner host):**

1. Install [Wireshark](https://www.wireshark.org/download.html) and **Npcap** (Windows) or libpcap (Linux).
2. Optional: set `WIRESHARK_TSHARK_PATH` if tshark is not in the default location (`C:\Program Files\Wireshark\tshark.exe` on Windows).
3. Live capture may require elevated permissions or Npcap “WinPcap compatible mode”.

**UI entry points:**

- **Diagnoses → Packet Analysis** — manual capture, upload `.pcap`/`.pcapng`, display filters, download captures
- **Diagnosis cards** — `capture_traffic` suggested action triggers a 15s BPF capture for the equipment IP
- **Topology node panel** — **Capture Traffic** sends the same capture request

**Mock mode:** When tshark is not installed, the scanner returns sample packet data so the UI can be tested without Wireshark.

**Security:** Captures are stored under `mock-server/.captures/` for up to 24 hours. Packet data may contain sensitive traffic — restrict scanner API access to trusted operators.


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
