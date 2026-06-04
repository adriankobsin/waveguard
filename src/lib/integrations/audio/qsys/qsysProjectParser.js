export function parseQsysDesignXml(xmlText) {
  const doc = parseXml(xmlText);
  if (!doc) return null;

  const design = {
    name: "",
    components: [],
    namedControls: [],
    mixers: [],
    amplifiers: [],
    inputChannels: [],
    outputChannels: [],
    crosspoints: [],
  };

  const root = doc.QSCDesign || doc.QSysDesign || doc;

  if (root.attr) {
    design.name = root.attr.Name || root.attr.name || "";
  }

  const namedControls = findNodes(root, "NamedControl");
  for (const nc of namedControls) {
    design.namedControls.push({
      id: nc.attr?.ID || nc.attr?.id || "",
      name: nc.attr?.Name || nc.attr?.name || "",
      controlType: nc.attr?.ControlType || nc.attr?.type || "",
      value: parseFloat(nc.attr?.Value ?? nc.attr?.value ?? 0),
      minValue: parseFloat(nc.attr?.MinValue ?? nc.attr?.min ?? 0),
      maxValue: parseFloat(nc.attr?.MaxValue ?? nc.attr?.max ?? 100),
    });
  }

  findNodes(root, "Component").forEach((comp) => {
    const c = {
      id: comp.attr?.ID || comp.attr?.id || "",
      idString: comp.attr?.IdString || comp.attr?.idString || "",
      name: comp.attr?.Name || comp.attr?.name || "",
      type: comp.attr?.Type || comp.attr?.type || "",
      parentId: comp.attr?.ParentID || comp.attr?.parentId || "",
      parentIdString: comp.attr?.ParentIdString || comp.attr?.parentIdString || "",
      tags: (comp.attr?.Tags || comp.attr?.tags || "").split(",").filter(Boolean),
      controls: [],
    };

    findNodes(comp, "Control").forEach((ctrl) => {
      if (ctrl.attr) {
        c.controls.push({
          name: ctrl.attr.Name || ctrl.attr.name || "",
          value: parseFloat(ctrl.attr.Value ?? ctrl.attr?.value ?? 0),
          string: ctrl.attr.String || ctrl.attr.string || "",
          minValue: parseFloat(ctrl.attr.MinValue ?? ctrl.attr?.min ?? 0),
          maxValue: parseFloat(ctrl.attr.MaxValue ?? ctrl.attr?.max ?? 100),
          group: ctrl.attr.Group || ctrl.attr?.group || "",
          controlType: ctrl.attr.ControlType || "",
        });
      }
    });

    if (c.type?.includes("Mixer") || c.type?.includes("mixer")) {
      findNodes(comp, "CrossPointChannel").forEach((xpt) => {
        if (xpt.attr) {
          design.crosspoints.push({
            mixerId: c.idString || c.id,
            mixerName: c.name,
            inputId: xpt.attr.InputID || xpt.attr?.inputId || "",
            outputId: xpt.attr.OutputID || xpt.attr?.outputId || "",
            gain: parseFloat(xpt.attr.Gain ?? xpt.attr?.gain ?? 0),
            mute: xpt.attr.Mute === "true" || xpt.attr?.mute === "true",
          });
        }
      });
      design.mixers.push(c);
    } else if (c.type?.includes("Amplifier") || c.type?.includes("Amp")) {
      const amp = {
        ...c,
        channels: [],
      };
      findNodes(comp, "OutputChannel").forEach((ch) => {
        if (ch.attr) {
          amp.channels.push({
            id: ch.attr.ID || ch.attr?.id || "",
            name: ch.attr.Name || ch.attr?.name || "",
            load: ch.attr.Load || "",
          });
        }
      });
      design.amplifiers.push(amp);
    } else if (c.type?.includes("InputChannel")) {
      design.inputChannels.push(c);
    } else if (c.type?.includes("OutputChannel")) {
      design.outputChannels.push(c);
    }

    design.components.push(c);
  });

  return design;
}

function parseXml(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    return xmlNodeToObj(doc.documentElement);
  } catch (err) {
    console.warn("[qsysProjectParser] parse error:", err);
    return null;
  }
}

function xmlNodeToObj(node) {
  if (!node) return null;

  const obj = { name: node.nodeName, attr: {}, children: [], text: node.textContent?.trim() || "" };

  if (node.attributes) {
    for (let i = 0; i < node.attributes.length; i++) {
      obj.attr[node.attributes[i].name] = node.attributes[i].value;
    }
  }

  for (let i = 0; i < node.children.length; i++) {
    obj.children.push(xmlNodeToObj(node.children[i]));
  }

  return obj;
}

function findNodes(obj, tagName) {
  const results = [];
  if (obj.name === tagName) {
    results.push(obj);
  }
  for (const child of obj.children || []) {
    results.push(...findNodes(child, tagName));
  }
  return results;
}
