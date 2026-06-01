/**
 * Tokyo Bot - Main Entry Point
 * Developer: D4RK-K1NG
 * Bot Name: Tokyo
 * 
 * This is the main orchestrator that starts both:
 * 1. Telegram Bot / watspp bot (Control Panel)
 */

const config = require('./config');
const TelegramBot = require('./src/telegraf/telegramBot');
const WhatsAppManager = require('./src/whatsapp/whatsappBot');
const logger = require('./src/utils/logger');

async function main() {
    logger.info('🚀 Starting Tokyo Bot System...');
    logger.info(`🤖 Bot Name: ${config.BOT_NAME}`);
    logger.info(`👤 Developer: ${config.DEVELOPER}`);
    
    // Initialize WhatsApp bot manager first
    const whatsappManager = new WhatsAppManager();
    
    // Initialize Telegram bot with reference to WA manager
    const telegramBot = new TelegramBot(whatsappManager);
    
    // Start Telegram bot
    await telegramBot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('🛑 Shutting down...');
        await telegramBot.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        logger.info('🛑 Shutting down...');
        await telegramBot.stop();
        process.exit(0);
    });
    
    logger.info('✅ System ready!');
}

main().catch(err => {
    logger.error('Fatal error:', err);
    process.exit(1);
});
