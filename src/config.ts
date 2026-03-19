import { config } from "dotenv";

config();

export const ENV = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_ALLOWED_USER_IDS: process.env.TELEGRAM_ALLOWED_USER_IDS || "",
  DB_PATH: process.env.DB_PATH || "./memory.db",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "llama3.1",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || "",
  FIREBASE_CREDENTIALS_PATH: process.env.FIREBASE_CREDENTIALS_PATH || "./lya-firebase.json",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
  OLLAMA_TIMEOUT: process.env.OLLAMA_TIMEOUT || "120",
};

export function validateConfig() {
  if (!ENV.TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  if (!ENV.TELEGRAM_ALLOWED_USER_IDS) throw new Error("Missing TELEGRAM_ALLOWED_USER_IDS");
  // GEMINI_API_KEY is optional but recommended for audio

  // Validate allowed user ids format
  const ids = ENV.TELEGRAM_ALLOWED_USER_IDS.split(",").map(id => id.trim());
  if (ids.some(id => isNaN(Number(id)))) {
    throw new Error("TELEGRAM_ALLOWED_USER_IDS must be a comma-separated list of numbers");
  }
}

export function isUserAllowed(userId: number | undefined): boolean {
  if (!userId) return false;
  const ids = ENV.TELEGRAM_ALLOWED_USER_IDS.split(",").map(id => Number(id.trim()));
  return ids.includes(userId);
}
