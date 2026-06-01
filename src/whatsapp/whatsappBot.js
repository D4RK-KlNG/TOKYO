/**
 * WhatsApp Bot Manager
 * Manages multiple WhatsApp bot instances using Baileys
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const config = require('../../config');
const logger = require('../utils/logger');
const MessageHandler = require('./messageHandler');
const path = require('path');
const fs = require('fs');

class WhatsAppManager {
    constructor() {
        this.bots = {};       // { userId: socket }
        this.userStates = {}; // { userId: 'awaiting_phone' | null }
        this.messageHandler = new MessageHandler(this);
    }

    /**
     * Set user state for flow tracking
     */
    setUserState(userId, state) {
        this.userStates[userId] = state;
    }

    /**
     * Get user current state
     */
    getUserState(userId) {
        return this.userStates[userId] || null;
    }

    /**
     * Clear user state
     */
    clearUserState(userId) {
        delete this.userStates[userId];
    }

    /**
     * Get all connected bot sockets
     */
    getAllBots() {
        return this.bots;
    }

    /**
     * Connect a new WhatsApp bot instance
     * @param {string} userId - Telegram user ID
     * @param {string} phoneNumber - Phone number (without +)
     * @param {object} ctx - Telegram context for sending messages
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async connectBot(userId, phoneNumber, ctx) {
        try {
            const sessionDir = path.join(config.SESSIONS_DIR, `session_${userId}`);
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            logger.info(`Connecting bot for user ${userId} with phone ${phoneNumber}...`);

            const sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: require('pino')({ level: 'silent' }),
                browser: ['Tokyo Bot', 'Chrome', '3.0'],
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false
            });

            // Handle connection updates
            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (connection === 'connecting' || qr) {
                    // Request pairing code
                    try {
                        const code = await sock.requestPairingCode(phoneNumber);
                        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                        
                        await ctx.reply(
                            `📱 *Pairing Code Generated!*\n\n` +
                            `Your code: \`${formattedCode}\`\n\n` +
                            `*How to pair:*\n` +
                            `1. Open WhatsApp on your phone\n` +
                            `2. Go to *Settings → Linked Devices*\n` +
                            `3. Tap *Link a Device*\n` +
                            `4. Enter this code: \`${formattedCode}\`\n\n` +
                            `⏳ Waiting for connection...`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (pairError) {
                        logger.error(`Pairing code error for ${userId}:`, pairError);
                    }
                }

                if (connection === 'open') {
                    logger.success(`WhatsApp bot connected for user ${userId}!`);
                    this.bots[userId] = sock;
                    
                    // Set up message handler for this bot
                    this.setupMessageHandler(sock, userId);
                    
                    await ctx.reply('✅ *WhatsApp Connected!*\n\nYour bot is now alive! Send \`menu\` in WhatsApp.', { parse_mode: 'Markdown' });
                    
                    // Send welcome/confirmation
                    await sock.sendMessage(sock.user.id, {
                        image: { url: config.IMAGES.MENU },
                        caption: `*🤖 ${config.BOT_NAME} Bot Activated!*\n\n*Developer:* ${config.DEVELOPER}\n\nType \`menu\` to see available commands.\n\n*Available Commands:*\n• \`ping\` - Check bot response\n• \`alive\` - Check if bot is running\n• \`menu\` - Show this menu`
                    });
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    logger.warn(`WhatsApp disconnected for user ${userId}. Reconnect: ${shouldReconnect}`);
                    
                    delete this.bots[userId];
                    
                    if (shouldReconnect) {
                        // Auto-reconnect after 5 seconds
                        setTimeout(() => {
                            logger.info(`Attempting reconnect for user ${userId}...`);
                            this.connectBot(userId, phoneNumber, ctx);
                        }, 5000);
                    } else {
                        await ctx.reply('❌ WhatsApp logged out. Use /start to reconnect.');
                    }
                }
            });

            return { success: true };
        } catch (error) {
            logger.error(`Connect bot error for ${userId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Set up message handler for a WhatsApp bot instance
     */
    setupMessageHandler(sock, userId) {
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key || msg.key.fromMe) continue;
                
                const from = msg.key.remoteJid;
                const text = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            '';

                if (!text) continue;

                await this.messageHandler.handleMessage(sock, userId, from, text, msg);
            }
        });
    }

    /**
     * Disconnect a specific bot
     */
    async disconnectBot(userId) {
        if (this.bots[userId]) {
            try {
                this.bots[userId].logout();
                delete this.bots[userId];
                logger.info(`Bot disconnected for user ${userId}`);
            } catch (error) {
                logger.error(`Disconnect error for ${userId}:`, error);
            }
        }
    }
}

module.exports = WhatsAppManager;
