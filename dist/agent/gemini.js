import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "../config.js";
import fs from "fs";
const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
export async function transcribeAudio(filePath) {
    if (!ENV.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
    }
    console.log(`[Gemini] Transcribing audio file: ${filePath}`);
    // Using gemini-2.0-flash for consistency with the main agent
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const audioData = {
        inlineData: {
            data: Buffer.from(await fs.promises.readFile(filePath)).toString("base64"),
            mimeType: "audio/ogg",
        },
    };
    const prompt = "Transcribe el siguiente audio de forma exacta. Si hay ruidos de fondo, ignóralos. Devuelve solo el texto transcrito.";
    try {
        console.log("[Gemini] Sending transcription request...");
        const result = await model.generateContent([prompt, audioData]);
        const response = await result.response;
        if (!response) {
            throw new Error("Empty response from Gemini API");
        }
        const text = response.text();
        console.log(`[Gemini] Transcription successful: "${text.substring(0, 50)}..."`);
        return text;
    }
    catch (error) {
        console.error("[Gemini Error] Transcription failed.");
        if (error.status === 404) {
            console.error("[Gemini Error] 404 Not Found: Check if the model name 'gemini-2.0-flash' is correct or if your API key has access to it.");
        }
        else if (error.message) {
            console.error(`[Gemini Error] Message: ${error.message}`);
        }
        throw error;
    }
}
