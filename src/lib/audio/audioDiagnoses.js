export function generateAudioDiagnoses(audioSystems, audioEvents) {
  const diagnoses = [];
  if (!audioSystems?.length) return diagnoses;

  for (const system of audioSystems) {
    if (system.status === "offline") {
      diagnoses.push({
        id: `audio-dsp-offline-${system.id}`,
        source: "Audio DSP",
        severity: "critical" ,
        title: `${system.name} offline`,
        summary: `${system.name} (${system.type}) is not reachable. Check connection and network.`,
        details: `Host: ${system.host || "N/A"}, Protocol: ${system.protocol || "N/A"}, Last polled: ${system.lastPolled || "never"}`,
        category: "audio",
        systemId: system.id,
        timestamp: new Date().toISOString(),
        dismissible: true,
      });
    }

    if (system.amplifiers?.length) {
      for (const amp of system.amplifiers) {
        if (amp.status === "protect" || amp.status === "fault") {
          diagnoses.push({
            id: `audio-amp-protect-${amp.id}`,
            source: "Audio DSP",
            severity: "critical" ,
            title: `Amplifier fault: ${amp.name}`,
            summary: `${amp.name} on ${system.name} is in ${amp.status} mode. Check load and temperature.`,
            details: `Model: ${amp.model}, Temp: ${amp.temperature}°C, Power: ${amp.powerWatts}W`,
            category: "audio",
            systemId: system.id,
            ampId: amp.id,
            timestamp: new Date().toISOString(),
            dismissible: true,
          });
        }
        if (amp.temperature > 60) {
          diagnoses.push({
            id: `audio-amp-temp-${amp.id}`,
            source: "Audio DSP",
            severity: "warning" ,
            title: `High temp: ${amp.name}`,
            summary: `${amp.name} on ${system.name} is running at ${amp.temperature}°C.`,
            category: "audio",
            systemId: system.id,
            ampId: amp.id,
            timestamp: new Date().toISOString(),
            dismissible: true,
          });
        }
      }
    }
  }

  const recentErrors = (audioEvents?.events || []).filter(
    (e) => e.severity === "warning" || e.severity === "error"
  );
  if (recentErrors.length >= 5) {
    diagnoses.push({
      id: "audio-recent-errors",
      source: "Audio DSP",
      severity: "warning" ,
      title: "Multiple recent audio errors",
      summary: `${recentErrors.length} audio events generated in the last session. Check the audio event log.`,
      category: "audio",
      timestamp: new Date().toISOString(),
      dismissible: true,
    });
  }

  return diagnoses;
}
