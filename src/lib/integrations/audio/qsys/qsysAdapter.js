let requestId = 0;

function nextId() {
  requestId += 1;
  return requestId;
}

function buildRequest(method, params) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: nextId(),
    method,
    params,
  }) + "\0";
}

export function createQsysClient(connection) {
  return {
    connect: async () => {
      throw new Error("Q-SYS QRC client requires Node.js (use scanner integration)");
    },
    send: async () => {
      throw new Error("Q-SYS QRC client requires Node.js (use scanner integration)");
    },
    disconnect: async () => {},
    setEventHandler: () => {},
  };
}

export function buildMockQsysEngine() {
  let controls = {};
  let components = [];
  let changeGroupSubscriptions = [];
  let mixerState = {};
  let snapshotState = {};
  let connected = false;
  let eventHandlers = [];

  function notify(event) {
    for (const h of eventHandlers) {
      try { h(event); } catch {}
    }
  }

  return {
    connect: async () => {
      connected = true;
      notify({ type: "Connected" });
    },

    disconnect: async () => {
      connected = false;
      notify({ type: "Disconnected" });
    },

    isConnected: () => connected,

    onEvent: (handler) => {
      eventHandlers.push(handler);
    },

    send: async (method, params) => {
      if (!connected) throw new Error("Mock Q-SYS engine not connected");
      notify({ type: "Command", method, params });

      switch (method) {
        case "NoOp":
          return { Status: 0 };
        case "Logon":
          return {};
        case "StatusGet":
          return {
            Status: 0, Name: "Q-SYS Core (Mock)", DesignName: "WaveGuard Demo",
            DesignCode: "DEMO-001", Running: true, Platform: "Core 510i",
            Version: "9.4.0", Uptime: Math.floor(Math.random() * 864000),
          };
        case "Control.Get": {
          const name = params.Name;
          if (name && controls[name] != null) {
            return { Name: name, Value: controls[name], Position: 0, String: String(controls[name]), IsPassword: false };
          }
          return { Name: name, Value: 0, String: "0" };
        }
        case "Control.Set": {
          const { Name, Value } = params;
          if (Name) controls[Name] = Value;
          return {};
        }
        case "Component.GetComponents": {
          const tag = params.TagName || "";
          const type = params.TypeName || "";
          let result = components;
          if (tag) result = result.filter((c) => c.Tags?.includes(tag));
          if (type) result = result.filter((c) => c.Type === type);
          return { Components: result, TotalCount: result.length };
        }
        case "Component.GetControls": {
          const id = params.Id || params.IdString;
          if (!id) return { Controls: [], TotalCount: 0 };
          const comp = components.find((c) => c.Id === id || c.IdString === id);
          return { Controls: comp?.Controls || [], TotalCount: comp?.Controls?.length || 0 };
        }
        case "Component.Set": {
          const { IdString, Controls: ctrlUpdates } = params;
          const comp = components.find((c) => c.IdString === IdString);
          if (comp && ctrlUpdates) {
            for (const update of ctrlUpdates) {
              const existing = comp.Controls?.find((c) => c.Name === update.Name);
              if (existing) {
                existing.Value = update.Value;
                existing.String = update.String ?? String(update.Value);
              }
            }
          }
          return {};
        }
        case "ChangeGroup.AddControl": {
          changeGroupSubscriptions.push(params.Name);
          return {};
        }
        case "ChangeGroup.AddComponentControl": {
          const { IdString, Controls: ctrls } = params;
          for (const ctrl of ctrls || []) {
            changeGroupSubscriptions.push(`${IdString}:${ctrl.Name}`);
          }
          return {};
        }
        case "ChangeGroup.Poll": {
          const changes = [];
          for (const sub of changeGroupSubscriptions) {
            if (sub.includes(":")) {
              const [idStr, ctrlName] = sub.split(":");
              const comp = components.find((c) => c.IdString === idStr);
              const ctrl = comp?.Controls?.find((c) => c.Name === ctrlName);
              if (ctrl) changes.push({ IdString: idStr, Controls: [{ Name: ctrlName, Value: ctrl.Value }] });
            } else {
              const ctrl = controls[sub];
              if (ctrl != null) changes.push({ Name: sub, Value: ctrl });
            }
          }
          return { Changes: changes };
        }
        case "Mixer.SetCrossPointGain": {
          mixerState[`xpt:${params.Input}:${params.Output}`] = params.Gain;
          return {};
        }
        case "Mixer.SetInputGain": {
          mixerState[`inputGain:${params.Input}`] = params.Gain;
          return {};
        }
        case "Mixer.SetOutputGain": {
          mixerState[`outputGain:${params.Output}`] = params.Gain;
          return {};
        }
        case "Mixer.SetInputMute": {
          mixerState[`inputMute:${params.Input}`] = params.Mute ? 1 : 0;
          return {};
        }
        case "Mixer.SetOutputMute": {
          mixerState[`outputMute:${params.Output}`] = params.Mute ? 1 : 0;
          return {};
        }
        case "Mixer.SetCrossPointMute": {
          mixerState[`xptMute:${params.Input}:${params.Output}`] = params.Mute ? 1 : 0;
          return {};
        }
        case "Snapshot.Load": {
          snapshotState.lastLoaded = { bank: params.Bank ?? 1, name: params.Name || `Snapshot ${params.Bank ?? 1}` };
          return {};
        }
        case "Snapshot.Save": {
          snapshotState.lastSaved = { bank: params.Bank ?? 1, name: params.Name || `Snapshot ${params.Bank ?? 1}` };
          return {};
        }
        case "ChangeGroup.Destroy":
          changeGroupSubscriptions = [];
          return {};
        case "LoopPlayer.Start":
        case "LoopPlayer.Stop":
          return {};
        default:
          return {};
      }
    },

    getState: () => ({
      controls: { ...controls },
      components: JSON.parse(JSON.stringify(components)),
      mixerState: { ...mixerState },
      changeGroupSubscriptions: [...changeGroupSubscriptions],
      snapshotState: { ...snapshotState },
      connected,
    }),

    setControls: (state) => { controls = { ...controls, ...state }; },
    setComponents: (compList) => { components = compList; },
    setControl: (name, value) => { controls[name] = value; },
  };
}
