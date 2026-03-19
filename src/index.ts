import { Bot, InputFile } from "grammy";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ENV, validateConfig, isUserAllowed } from "./config.js";
import { processUserMessage } from "./agent/loop.js";
import { getSetting, setSetting, clearHistory, getProjects, createProject, getArtefacts } from "./db/index.js";
import { transcribeAudio } from "./agent/gemini.js";
import { textToSpeech } from "./agent/tts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Validate configuration on startup
try {
    validateConfig();
} catch (error) {
    console.error("Configuration Error:", error instanceof Error ? error.message : error);
    process.exit(1);
}

// Initialize bot
const bot = new Bot(ENV.TELEGRAM_BOT_TOKEN);

// Middleware for access control
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (isUserAllowed(userId)) {
        await next();
    } else {
        console.log(`[Security] Unauthorized access attempt by user ID: ${userId}`);
        // Can silently ignore or optionally reply
        // await ctx.reply("Unauthorized.");
    }
});

// Command handlers
bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to Lya! I am your personal AI assistant. How can I help you today?");
});

// Clear history commands
const handleClear = async (ctx: any) => {
    try {
        const chatId = ctx.chat?.id.toString() || "default";
        await clearHistory(chatId);
        // También limpiar memoria persistente de Lya
        // Importar setSetting si hace falta
        await setSetting(chatId, "chat_summary", "");
        await setSetting(chatId, "active_product", "");
        await ctx.reply("🗑️ ¡Podemos empezar de cero! Memoria limpia.");
    } catch (error) {
        console.error("Error clearing history:", error);
        await ctx.reply("Error al intentar borrar la memoria.");
    }
};

bot.command("borrar", handleClear);
bot.command("reset", handleClear);

// Message handler: Text
bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();
    console.log(`[Bot] Incoming message from ${chatId}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    if (text.startsWith("/sql")) {
        await setSetting(chatId, "active_skill", "sql");
        return ctx.reply("🎯 Modo **Experto SQL** activado. Envíame tus consultas para optimizarlas.");
    } else if (text.startsWith("/code") || text.startsWith("/codigo")) {
        await setSetting(chatId, "active_skill", "codigo");
        return ctx.reply("💻 Modo **Desarrollador** activado.");
    } else if (text.startsWith("/personal") || text.startsWith("/chat")) {
        await setSetting(chatId, "active_skill", "personal");
        return ctx.reply("🏠 Modo **Personal** activado.");
    } else if (text.startsWith("/superpowers")) {
        const parts = text.split(" ");
        const subCommand = parts[1];

        if (subCommand === "brainstorm") {
            await setSetting(chatId, "active_skill", "brainstorming");
            return ctx.reply("🧠 Modo **Brainstorming** activado. Cuéntame tu idea y la puliremos.");
        } else if (subCommand === "plan") {
            await setSetting(chatId, "active_skill", "planning");
            return ctx.reply("📋 Modo **Planning** activado. Vamos a desglosar el diseño aprobado.");
        } else if (subCommand === "execute") {
            await setSetting(chatId, "active_skill", "tdd");
            return ctx.reply("🚀 Modo **Ejecución (TDD)** activado. Empezaré con los tests.");
        } else {
            return ctx.reply("✨ **Lya Superpowers**\n\nUso:\n`/superpowers brainstorm` - Refinar diseño\n`/superpowers plan` - Crear plan de tareas\n`/superpowers execute` - Ejecutar plan con TDD");
        }
    } else if (text.startsWith("/sistema")) {
        await setSetting(chatId, "active_skill", "sistema");
        return ctx.reply("⚙️**Sistema** Conexuz activado.");
    }

    await handleBotMessage(ctx, text);
});

// Message handler: Voice/Audio
bot.on(["message:voice", "message:audio"], async (ctx) => {
    console.log("[Audio] Received audio/voice message");
    let filePath: string | undefined;
    try {
        const file = await ctx.getFile();
        console.log(`[Audio] Telegram file_path: ${file.file_path}`);

        filePath = path.join(__dirname, `../tmp_${file.file_unique_id}.ogg`);
        await ctx.replyWithChatAction("typing"); // More accurate action while transcribing

        // Download the file via Telegram API
        const downloadUrl = `https://api.telegram.org/file/bot${ENV.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        console.log(`[Audio] Saved to temporary file: ${filePath}`);

        const transcribedText = await transcribeAudio(filePath);

        await ctx.reply(`🎤 _Transcripción:_ "${transcribedText}"`, { parse_mode: 'Markdown' });
        await handleBotMessage(ctx, transcribedText);
    } catch (error) {
        console.error("[Audio Error] processing error:", error);
        await ctx.reply("Lo siento, hubo un error al procesar tu audio.");
    } finally {
        // Guaranteed cleanup
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Audio] Cleanup successful for: ${filePath}`);
        }
    }
});

async function handleBotMessage(ctx: any, text: string) {
    // Inform user that the bot is thinking
    await ctx.replyWithChatAction("typing");

    try {
        const chatId = ctx.chat.id.toString();
        const activeSkill = await getSetting(chatId, "active_skill") || 'personal';
        console.log(`[Bot] Handling message for ${chatId} with skill: ${activeSkill}`);
        let reply = await processUserMessage(text, chatId, undefined, activeSkill);
        console.log(`[Bot] Response generated for ${chatId} (${reply.length} chars)`);

        // Heuristic fix for models that flatten markdown lists into a single line
        if (reply.startsWith('**Códigos encontrados:**') || reply.startsWith('🤔 **Códigos encontrados:**')) {
            // Replace " * item" with "\n* item" to restore the list format for Telegram
            reply = reply.replace(/\s\*\s/g, '\n* ');
        }

        // 1. Send the text response
        await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async (e: any) => {
            console.warn("Markdown parse failed, sending as plain text");
            await ctx.reply(reply);
        });

        // 2. Generate and send audio response if requested and API key is present
        const audioKeywords = ["audio", "voz", "escuchar", "reproduce", "habla", "sonido"];
        const wantsAudio = audioKeywords.some(keyword => text.toLowerCase().includes(keyword));

        if (wantsAudio && ENV.ELEVENLABS_API_KEY && reply.length < 1000) {
            let audioPath: string | undefined;
            try {
                await ctx.replyWithChatAction("record_voice");
                audioPath = await textToSpeech(reply);

                await ctx.replyWithVoice(new InputFile(audioPath));

                console.log("[Audio] Voice reply sent and cleaned up.");
            } catch (ttsError) {
                console.error("[TTS Error] Failed to generate/send voice reply:", ttsError);
            } finally {
                // Guaranteed cleanup for the audio file
                if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            }
        }
    } catch (error) {
        console.error("Error processing message:", error);
        await ctx.reply("Sorry, I encountered an internal error while processing your message.");
    }
}

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    console.error(err.error);
});

// Web Server with Express for a cleaner API structure
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// Serve static Web UI
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/projects', async (req, res) => {
    const projects = await getProjects();
    res.json(projects);
});

app.post('/api/projects', async (req, res) => {
    const { id, name, description } = req.body;
    await createProject(id, name, description);
    res.json({ success: true });
});

app.get('/api/artefacts', async (req, res) => {
    const artefacts = await getArtefacts();
    res.json(artefacts);
});

app.get('/api/config', (req, res) => {
    res.json({ model: ENV.OLLAMA_MODEL });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, project_id, skill, chat_id } = req.body;
        // Para la interfaz web, usamos el chat_id enviado por el cliente o uno por defecto
        const cid = chat_id || 'web-default';
        const activeSkill = skill || await getSetting(cid, "active_skill") || 'personal';
        const reply = await processUserMessage(message, cid, project_id, activeSkill);
        res.json({ reply });
    } catch (err) {
        console.error("Chat API Error:", err);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Lya Bot is running');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});

// Start the bot
console.log("Starting Lya bot...");
try {
    await bot.start({
        onStart: (botInfo) => {
            console.log(`Bot initialized successfully as @${botInfo.username}`);
        }
    });
} catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
}
