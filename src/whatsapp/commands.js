/**
 * Built-in WhatsApp Commands
 */

const config = require('../../config');

module.exports = {
    /**
     * Ping command - Check bot response
     */
    ping: async (sock, from) => {
        await sock.sendMessage(from, { text: '🏓 Pong!' });
    },

    /**
     * Alive command - Check bot status
     */
    alive: async (sock, from) => {
        await sock.sendMessage(from, { 
            text: `✅ *${config.BOT_NAME} Bot is Alive!*\n\n` +
                  `*Developer:* ${config.DEVELOPER}\n` +
                  `*Status:* Running smoothly 🚀\n` +
                  `*Uptime:* Active` 
        });
    },

    /**
     * Menu command - Show all commands
     */
    menu: async (sock, from) => {
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
            await sock.sendMessage(from, {
                text: `*🤖 ${config.BOT_NAME} Menu*\n\n` +
                      `*Developer:* ${config.DEVELOPER}\n\n` +
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
};
