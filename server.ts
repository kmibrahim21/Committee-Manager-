import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Routes
import authHandler from "./api/auth";
import executivesHandler from "./api/executives";
import smsSendHandler from "./api/sms/send";
import createCommitteeHandler from "./api/admin/create-committee";
import updateUserPasswordHandler from "./api/admin/update-user-password";
import systemSettingsHandler from "./api/admin/system-settings";
import awajHandler from "./api/awaj";

// API Routes
app.all("/api/auth", (req, res) => authHandler(req as any, res as any));
app.all("/api/executives*all", (req, res) => executivesHandler(req, res));
app.all("/api/teachers*all", (req, res) => executivesHandler(req, res));
app.all("/api/sms/send", (req, res) => smsSendHandler(req as any, res as any));
app.all("/api/admin/create-committee", (req, res) => createCommitteeHandler(req, res));
app.all("/api/admin/update-user-password", (req, res) => updateUserPasswordHandler(req, res));
app.all("/api/admin/system-settings", (req, res) => systemSettingsHandler(req, res));
app.all("/api/awaj*all", (req, res) => awajHandler(req as any, res as any));

app.post("/api/gemini/generate-minutes", async (req, res) => {
  try {
    const { title, agendas, agenda, description, notes, date, lang } = req.body || {};
    const agendaText = Array.isArray(agendas) ? agendas.join(", ") : (agenda || "");
    const notesText = description || notes || "";

    const prompt = `
      You are an expert secretary for an organization / committee.
      Generate detailed meeting minutes based on the following information:
      
      Meeting Title: ${title || ""}
      Date: ${date || ""}
      Agendas: ${agendaText}
      Notes / Description: ${notesText}
      Language: ${lang === 'en' ? 'English' : 'Bengali'}
      
      Please write a professional summary with clear sections:
      1. Intro: Purpose of the meeting.
      2. Highlights: Each agenda item discussed.
      3. Conclusions: Final decisions and action items taken.
      
      Keep it structured and formal.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
    });

    res.json({ minutes: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate minutes" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
