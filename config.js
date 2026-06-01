/**
 * Tokyo Bot Configuration
 */

module.exports = {
    // Bot Identity
    BOT_NAME: 'Tokyo',
    DEVELOPER: 'D4RK-K1NG',
    
    // Telegram Bot Token (set via environment variable)
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    
    // Bot owner Telegram ID (set via environment variable)
    OWNER_ID: process.env.OWNER_ID || '',
    
    
    IMAGES: {
        WELCOME: 'https://files.catbox.moe/x9iw8g.jpeg',
        SETUP: 'https://files.catbox.moe/9rzoqz.jpeg',
        NEXT_STEP: 'https://files.catbox.moe/xmmbk7.jpeg',
        MENU: 'https://files.catbox.moe/ru69yz.jpeg'
    },
    
    
    SESSIONS_DIR: './sessions',
    
    
    PLUGINS_DIR: './plugins',
    
    
    DATA_DIR: './data'
};
