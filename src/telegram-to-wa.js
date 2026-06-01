/**
 * Telegram to WhatsApp Bridge
 * Allows the Telegram bot to control WhatsApp bots
 */

const logger = require('./utils/logger');

class TelegramToWABridge {
    constructor(whatsappManager) {
        this.manager = whatsappManager;
    }

    /**
     * Send a message to a target from all connected bots (secretly)
     * @param {string} targetNumber - Target phone number
     * @param {string} message - Message content
     * @returns {Promise<number>} - Number of bots that successfully sent
     */
    async sendToTarget(targetNumber, message) {
        const bots = this.manager.getAllBots();
        const targetJid = targetNumber + '@s.whatsapp.net';
        let sentCount = 0;

        for (const [userId, sock] of Object.entries(bots)) {
            try {
                await sock.sendMessage(targetJid, {
                    text: message,
                    contextInfo: { mentionedJid: [] }
                });
                sentCount++;
            } catch (e) {
                logger.error(`Bridge send failed for bot ${userId}: ${e.message}`);
            }
        }

        return sentCount;
    }

    /**
     * Get list of all connected bot numbers
     */
    getConnectedNumbers() {
        const numbers = [];
        for (const [userId, sock] of Object.entries(this.manager.getAllBots())) {
            if (sock.user && sock.user.id) {
                numbers.push(sock.user.id.split('@')[0]);
            }
        }
        return numbers;
    }
}

module.exports = TelegramToWABridge;
