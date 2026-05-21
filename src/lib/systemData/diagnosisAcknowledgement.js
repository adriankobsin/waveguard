const ACK_KEY = "waveguard-acknowledged-diagnoses";

export function getAcknowledgedDiagnoses() {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function acknowledgeDiagnosisId(id) {
  const map = getAcknowledgedDiagnoses();
  map[id] = {
    acknowledgedAt: new Date().toISOString(),
  };
  localStorage.setItem(ACK_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("waveguard-diagnoses-ack-changed", { detail: { id } }));
}

export function clearAcknowledgement(id) {
  const map = getAcknowledgedDiagnoses();
  delete map[id];
  localStorage.setItem(ACK_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("waveguard-diagnoses-ack-changed"));
}

export function applyAcknowledgements(diagnoses) {
  const map = getAcknowledgedDiagnoses();
  return diagnoses.map((d) => {
    const ack = map[d.id];
    if (!ack) return d;
    // Re-open SNMP faults if a newer poll detected the issue again
    if (d.snmpPolledAt && ack.acknowledgedAt && d.snmpPolledAt > ack.acknowledgedAt) {
      return d;
    }
    return {
      ...d,
      acknowledgedAt: ack.acknowledgedAt,
      acknowledged: true,
    };
  });
}
