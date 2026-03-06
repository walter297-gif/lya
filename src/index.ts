import { Bot } from "grammy";
import http from "http";
import { ENV, validateConfig, isUserAllowed } from "./config.js";
import { processUserMessage } from "./agent/loop.js";

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
    await ctx.reply("Welcome to LyaGravity! I am your personal AI assistant. How can I help you today?");
});

// Message handler
bot.on("message:text", async (ctx) => {
    // Inform user that the bot is thinking
    await ctx.replyWithChatAction("typing");
    
    try {
        const reply = await processUserMessage(ctx.message.text);
        // Send the response back, handle possible markdown formatting from the LLM
        await ctx.reply(reply, { parse_mode: 'Markdown' }).catch(async (e) => {
            console.warn("Markdown parse failed, sending as plain text");
            await ctx.reply(reply); // Fallback to plain text if markdown parsing fails
        });
    } catch (error) {
        console.error("Error processing message:", error);
        await ctx.reply("Sorry, I encountered an internal error while processing your message.");
    }
});

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    console.error(err.error);
});

// Minimal HTTP server for Render health checks
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('LyaGravity Bot is running\n');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
});

// Start the bot
console.log("Starting LyaGravity bot...");
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
