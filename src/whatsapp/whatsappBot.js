/**
 * WhatsApp Bot Manager
 * Manages multiple WhatsApp bot instances using Baileys
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const config = require('../../config');
const logger = require('../utils/logger');
const MessageHandler = require('./messageHandler');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache');

// Use a cache for group metadata to reduce API calls
const groupCache = new NodeCache({ stdTTL: 300 });

class WhatsAppManager {
    constructor() {
        this.bots = {};       // { userId: socket }
        this.userStates = {}; // { userId: 'awaiting_phone' | null }
        this.telegramCtx = {}; // { userId: ctx } - store tg context for messaging
        this.messageHandler = new MessageHandler(this);
    }

    setUserState(userId, state) {
        this.userStates[userId] = state;
    }

    getUserState(userId) {
        return this.userStates[userId] || null;
    }

    clearUserState(userId) {
        delete this.userStates[userId];
    }

    getAllBots() {
        return this.bots;
    }

    /**
     * Connect a new WhatsApp bot instance
     * @param {string} userId - Telegram user ID
     * @param {string} phoneNumber - Phone number (WITHOUT + sign, e.g. "1234567890")
     * @param {object} ctx - Telegram context for sending messages
     */
    async connectBot(userId, phoneNumber, ctx) {
        try {
            // Store telegram context for this user so we can send updates
            this.telegramCtx[userId] = ctx;

            const sessionDir = path.join(config.SESSIONS_DIR, `session_${userId}`);
            
            // IMPORTANT: Clean old session if exists to avoid conflicts
            if (fs.existsSync(sessionDir)) {
                logger.info(`Cleaning old session for user ${userId}`);
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            fs.mkdirSync(sessionDir, { recursive: true });

            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            const { version } = await fetchLatestBaileysVersion();

            logger.info(`Connecting bot for user ${userId} with phone ${phoneNumber}...`);

            await ctx.reply('⏳ *Initializing connection to WhatsApp servers...*', { parse_mode: 'Markdown' });

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                printQRInTerminal: false,
                logger: require('pino')({ level: 'silent' }),
                browser: ['Tokyo Bot', 'Chrome', '3.0'],
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                msgRetryCounterCache: new NodeCache({ stdTTL: 300 }),
                getMessage: async () => undefined
            });

            // Handle connection updates
            sock.ev.on('creds.update', saveCreds);

            let pairingRequested = false;

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // === PAIRING CODE REQUEST ===
                // Official Baileys pattern: request pairing code when QR event fires
                // and the device is not yet registered
                if (qr && !pairingRequested && !sock.authState.creds.registered) {
                    pairingRequested = true;
                    
                    try {
                        logger.info(`Requesting pairing code for ${phoneNumber}...`);
                        
                        // The number must be WITHOUT + sign
                        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                        
                        const code = await sock.requestPairingCode(cleanNumber);
                        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                        
                        logger.success(`Pairing code generated for ${phoneNumber}: ${formattedCode}`);
                        
                        // Send pairing code to user via Telegram
                        await ctx.reply(
                            `📱 *Pairing Code Generated!*\n\n` +
                            `┌─────────────────────┐\n` +
                            `│   \`${formattedCode}\`   │\n` +
                            `└─────────────────────┘\n\n` +
                            `*How to pair:*\n` +
                            `1. Open *WhatsApp* on your phone\n` +
                            `2. Go to *Settings → Linked Devices*\n` +
                            `3. Tap *Link a Device*\n` +
                            `4. *Enter this code:* \`${formattedCode}\`\n\n` +
                            `⏳ *Waiting for connection...*`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (pairError) {
                        logger.error(`Pairing code request failed for ${userId}:`, pairError);
                        pairingRequested = false;
                        
                        await ctx.reply(
                            `❌ *Failed to generate pairing code.*\n\nError: ${pairError.message}\n\n` +
                            `Please try again by sending /start`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                }

                // === CONNECTION OPENED ===
                if (connection === 'open') {
                    logger.success(`✅ WhatsApp bot connected for user ${userId}!`);
                    this.bots[userId] = sock;
                    
                    // Set up message handler
                    this.setupMessageHandler(sock, userId);
                    
                    await ctx.reply('✅ *WhatsApp Connected!* 🎉\n\nYour bot is now *alive* and running!\n\nSend \`menu\` in WhatsApp to see commands.', { parse_mode: 'Markdown' });
                    
                    // Send welcome menu to the bot's own chat
                    try {
                        await sock.sendMessage(sock.user.id, {
                            image: { url: config.IMAGES.MENU },
                            caption: `*🤖 ${config.BOT_NAME} Bot Activated!*\n\n` +
                                    `*Developer:* ${config.DEVELOPER}\n\n` +
                                    `━━━━━━━━━━━━━━━━━━\n\n` +
                                    `*📌 Available Commands:*\n` +
                                    `┣ \`ping\` - Check bot response\n` +
                                    `┣ \`alive\` - Check bot status\n` +
                                    `┗ \`menu\` - Show command menu\n\n` +
                                    `━━━━━━━━━━━━━━━━━━\n\n` +
                                    `*${config.BOT_NAME}™* | *${config.DEVELOPER}*`
                        });
                    } catch (menuErr) {
                        logger.warn(`Could not send welcome menu: ${menuErr.message}`);
                    }
                }

                // === CONNECTION CLOSED ===
                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error instanceof Boom) 
                        ? lastDisconnect.error.output.statusCode 
                        : 500;
                    
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    logger.warn(`WhatsApp disconnected for user ${userId}. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);
                    
                    delete this.bots[userId];
                    
                    if (shouldReconnect) {
                        logger.info(`Auto-reconnecting for user ${userId} in 5s...`);
                        await ctx.reply('⚠️ *Connection lost. Reconnecting in 5 seconds...*', { parse_mode: 'Markdown' });
                        
                        setTimeout(() => {
                            logger.info(`Reconnecting bot for user ${userId}...`);
                            this.connectBot(userId, phoneNumber, ctx);
                        }, 5000);
                    } else {
                        await ctx.reply('❌ *Logged out of WhatsApp.*\n\nSend /start to reconnect and pair again.', { parse_mode: 'Markdown' });
                    }
                }
            });

            return { success: true };
        } catch (error) {
            logger.error(`Connect bot error for ${userId}:`, error);
            return { success: false, error: error.message };
        }
    }

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
