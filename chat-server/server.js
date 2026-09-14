import express from "express";
import cors from "cors";
import { handleChatRequest, getChatHealth } from "./handler.js";

const app = express();
const HOST = process.env.WAVEGUARD_HOST || "0.0.0.0";
const PORT = Number(process.env.CHAT_PORT) || 3003;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.post("/chat", async (req, res) => {
  try {
    const result = await handleChatRequest(req.body);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[chat]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/chat/health", async (_req, res) => {
  try {
    res.json(await getChatHealth());
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/health", async (_req, res) => {
  try {
    res.json(await getChatHealth());
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[waveguard-chat] Listening on ${HOST}:${PORT}`);
  console.log(`[waveguard-chat] Local mode uses Ollama when available, else offline agent`);
});
