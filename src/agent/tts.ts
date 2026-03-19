import { ENV } from "../config.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Converts text to speech using ElevenLabs API
 * @param text The text to convert to speech
 * @returns Path to the generated audio file
 */
export async function textToSpeech(text: string): Promise<string> {
    if (!ENV.ELEVENLABS_API_KEY) {
        throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const voiceId = "EXAVITQu4vr4xnSDxMaL"; // "Bella" voice - high quality female voice
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    console.log(`[ElevenLabs] Generating speech for: "${text.substring(0, 50)}..."`);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "xi-api-key": ENV.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
            },
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `reply_${Date.now()}.mp3`;
    const filePath = path.join(__dirname, `../../${fileName}`);

    await fs.promises.writeFile(filePath, buffer);
    console.log(`[ElevenLabs] Audio saved to: ${filePath}`);

    return filePath;
}
