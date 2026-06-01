/**
 * WhatsApp Message Handler
 * Processes incoming WhatsApp messages and runs commands/plugins
 */

const logger = require('../utils/logger');
const config = require('../../config');
const path = require('path');
const fs = require('fs');

class MessageHandler {
    constructor(whatsappManager) {
        this.manager = whatsappManager;
        this.loadedPlugins = {};
        this.loadPlugins();
    }

    /**
     * Load all plugins from plugins directory
     */
    loadPlugins() {
        const pluginsDir = config.PLUGINS_DIR;
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const pluginPath = path.join(pluginsDir, file);
                delete require.cache[require.resolve(pluginPath)];
                const plugin = require(pluginPath);
                const pluginName = file.replace('.js', '');
                this.loadedPlugins[pluginName] = plugin;
                logger.info(`Loaded plugin: ${pluginName}`);
            } catch (error) {
                logger.error(`Failed to load plugin ${file}:`, error.message);
            }
        }
    }

    /**
     * Handle an incoming message from a WhatsApp bot
     */
    async handleMessage(sock, userId, from, text, msg) {
        const command = text.toLowerCase().trim();
        
        try {
            // Built-in commands
            if (command === 'ping') {
                return await sock.sendMessage(from, { text: '🏓 Pong!' });
            }

            if (command === 'alive') {
                return await sock.sendMessage(from, { 
                    text: `✅ *${config.BOT_NAME} Bot is Alive!*\n\n*Developer:* ${config.DEVELOPER}\n*Status:* Running smoothly 🚀` 
                });
            }

            if (command === 'menu') {
                return await this.sendMenu(sock, from);
            }

            // Check user-installed plugins
            for (const [pluginName, plugin] of Object.entries(this.loadedPlugins)) {
                if (plugin.check && plugin.check(command, text, msg)) {
                    await plugin.execute(sock, from, text, msg);
                    return;
                }
                // Also check if command starts with plugin trigger
                if (plugin.trigger && text.startsWith(plugin.trigger)) {
                    await plugin.execute(sock, from, text, msg);
                    return;
                }
            }

        } catch (error) {
            logger.error(`Message handler error for ${userId}:`, error);
            await sock.sendMessage(from, { text: '❌ An error occurred processing your command.' });
        }
    }

    /**
     * Send the cool menu with image
     */
    async sendMenu(sock, from) {
        try {
            await sock.sendMessage(from, {
                image: { url: config.IMAGES.MENU },
                caption: `*🤖 ${config.BOT_NAME} Menu*\n\n` +
                        `*Developer:* ${config.DEVELOPER}\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `*📌 Basic Commands:*\n` +
                        `┣ \`ping\` - Check bot response\n` +
                        `┣ \`alive\` - Check bot status\n` +
                        `┗ \`menu\` - Show this menu\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `*⚡ Features:*\n` +
                        `┣ Multi-device support\n` +
                        `┣ Plugin system\n` +
                        `┣ 24/7 uptime\n` +
                        `┗ Telegram control panel\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `*${config.BOT_NAME}™* | *${config.DEVELOPER}*`
            });
        } catch (error) {
            // Fallback if image fails
            await sock.sendMessage(from, {
                text: `*🤖 ${config.BOT_NAME} Menu*\n\n*Developer:* ${config.DEVELOPER}\n\n` +
                      `━━━━━━━━━━━━━━━━━━\n\n` +
                      `📌 *Basic Commands:*\n` +
                      `├ ping - Check bot response\n` +
                      `├ alive - Check bot status\n` +
                      `└ menu - Show this menu\n\n` +
                      `━━━━━━━━━━━━━━━━━━\n\n` +
                      `${config.BOT_NAME}™ | ${config.DEVELOPER}`
            });
        }
    }
}

module.exports = MessageHandler;
