import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "uploads", "qsys-designs");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".qsys";
      cb(null, `design-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export default function createAudioRouter(db, broadcast) {
  const router = Router();

  router.post("/qsys/qrc", async (req, res) => {
    const { method, params } = req.body || {};
    if (!method) {
      return res.status(400).json({ error: "method required" });
    }

    const result = handleQsysQrcCommand(method, params);
    res.json(result);
  });

  router.get("/qsys/status", (_req, res) => {
    const settings = (db.systemSettings || []).find(
      (s) => s.key === "audio-systems"
    );
    const systems = settings?.value?.systems || [];
    const statuses = systems.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status || "offline",
      host: s.host,
      port: s.port,
      protocol: s.protocol,
    }));
    res.json({ systems: statuses });
  });

  router.post("/qsys/design", upload.single("design"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No design file uploaded" });
    }
    const filePath = req.file.path;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      broadcast("qsys-design-uploaded", {
        filename: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
      });
      res.json({
        success: true,
        filename: req.file.originalname,
        path: `/uploads/qsys-designs/${req.file.filename}`,
        size: req.file.size,
        message: "Design file uploaded successfully. Parse it client-side with qsysProjectParser.",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/dante/flows", (_req, res) => {
    const settings = (db.systemSettings || []).find(
      (s) => s.key === "audio-dante-routing"
    );
    res.json(settings?.value || { flows: [], subscriptions: [] });
  });

  router.get("/discover", (_req, res) => {
    res.json({
      systems: [
        {
          id: "discovered-qsc-1",
          name: "QSC Core 510i",
          type: "qsys",
          addresses: ["192.168.1.100"],
          ports: [1710, 443],
          protocols: ["qrc", "management"],
        },
      ],
    });
  });

  return router;
}

function handleQsysQrcCommand(method, _params) {
  switch (method) {
    case "NoOp":
      return { Status: 0 };
    case "Logon":
      return {};
    case "StatusGet":
      return {
        Status: 0,
        Name: "Q-SYS Core (Proxy)",
        DesignName: "WaveGuard Design",
        DesignCode: "WG-001",
        Running: true,
        Platform: "Core 510i",
        Version: "9.4.0",
        Uptime: 1234567,
      };
    case "Control.Get":
      return { Name: _params.Name, Value: 0, String: "0" };
    case "Control.Set":
      return {};
    case "Component.GetComponents":
      return { Components: [], TotalCount: 0 };
    case "Component.GetControls":
      return { Controls: [], TotalCount: 0 };
    case "Component.Set":
      return {};
    case "ChangeGroup.Poll":
      return { Changes: [] };
    case "Mixer.SetCrossPointGain":
    case "Mixer.SetInputGain":
    case "Mixer.SetOutputGain":
    case "Mixer.SetInputMute":
    case "Mixer.SetOutputMute":
    case "Mixer.SetCrossPointMute":
      return {};
    case "Snapshot.Load":
    case "Snapshot.Save":
      return {};
    default:
      return {};
  }
}
