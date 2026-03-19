import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No GEMINI_API_KEY found in .env");
    process.exit(1);
}

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        console.log("Fetching models via REST API...");
        const response = await fetch(url);
        const data = await response.json();
        
        fs.writeFileSync('models_list.json', JSON.stringify(data, null, 2));
        console.log("Models list saved to models_list.json");
    } catch (error) {
        console.error("Diagnostic failed:", error);
    }
}

listModels();
