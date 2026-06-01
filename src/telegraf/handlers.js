/**
 * Telegram Command Handlers
 */

const { Markup } = require('telegraf');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Handle /start command - Send welcome with image and buttons
 */
async function handleStart(ctx, config) {
    try {
        await ctx.replyWithPhoto(
            config.IMAGES.WELCOME,
            {
                caption: `*🤖 Welcome to ${config.BOT_NAME} Bot!*\n\n` +
                        `*Developer:* ${config.DEVELOPER}\n\n` +
                        `This bot connects to WhatsApp using WhatsApp Bot Connector technology.\n` +
                        `Connect your WhatsApp number and get a powerful bot!`,
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
}

/**
 * Handle Setup button - Show terms and disclaimer
 */
async function handleSetup(ctx, config) {
    try {
        await ctx.replyWithPhoto(
            config.IMAGES.SETUP,
            {
                caption: `*📋 Terms & Disclaimer*\n\n` +
                        `⚠️ *I am doing this on my own risk.*\n\n` +
                        `By proceeding, you acknowledge that:\n` +
                        `• You have authorization to use this bot\n` +
                        `• You take full responsibility for your actions\n` +
                        `• The developer is not liable for any misuse\n\n` +
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
}

/**
 * Handle Agree - Show next step with Pair button
 */
async function handlePair(ctx, config, whatsappManager) {
    try {
        await ctx.replyWithPhoto(
            config.IMAGES.NEXT_STEP,
            {
                caption: `*🔗 Connect Your WhatsApp Bot*\n\n` +
                        `Click the button below to start the pairing process.\n` +
                        `You'll be asked to enter your phone number.`,
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📲 Pair', 'pair')]
                ])
            }
        );
    } catch (error) {
        logger.error('Pair handler error:', error);
        await ctx.reply(
            `*🔗 Connect Your WhatsApp Bot*\n\n` +
            `Click the button below to start pairing.`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📲 Pair', 'pair')]
                ])
            }
        );
    }
}

/**
 * Handle .msg command - Send message to target from all connected bots
 */
async function handleMsgCommand(ctx, text, whatsappManager) {
    try {
        // Format: .msg <target_number> <message content>
        const match = text.match(/^\.msg\s+(\d{5,15})\s+(.+)$/s);
        if (!match) {
            return await ctx.reply(
                '❌ *Invalid format!*\n\nUsage: `.msg <target_number> <message>`\nExample: `.msg 1234567890 Hello from Tokyo bot!`',
                { parse_mode: 'Markdown' }
            );
        }

        const targetNumber = match[1];
        const messageContent = match[2];
        const targetJid = targetNumber + '@s.whatsapp.net';

        await ctx.reply(`📤 Sending message to *${targetNumber}* from all connected bots...`, { parse_mode: 'Markdown' });

        const bots = whatsappManager.getAllBots();
        let sentCount = 0;

        for (const [userId, sock] of Object.entries(bots)) {
            try {
                await sock.sendMessage(targetJid, {
                    text: messageContent,
                    // This sends as a silent message (not showing in the bot's chat)
                    contextInfo: { mentionedJid: [] }
                });
                sentCount++;
            } catch (e) {
                logger.error(`Bot ${userId} failed to send: ${e.message}`);
            }
        }

        await ctx.reply(`✅ Message sent from ${sentCount} bot(s) to ${targetNumber}`);
    } catch (error) {
        logger.error('Msg command error:', error);
        await ctx.reply(`❌ Error: ${error.message}`);
    }
}

/**
 * Handle plugin management commands (.plugin, .removeplugin, .listplugin)
 */
async function handlePluginCommands(ctx, action, text, config) {
    try {
        switch (action) {
            case 'add': {
                // .plugin <gisturl>
                const gistUrl = text.replace(/^\.plugin\s+/, '').trim();
                if (!gistUrl || !gistUrl.startsWith('http')) {
                    return await ctx.reply('❌ Please provide a valid Gist URL.\nUsage: `.plugin https://gist.github.com/...`');
                }

                await ctx.reply('⏳ Downloading plugin...');

                // Fetch plugin code from gist
                const response = await axios.get(gistUrl);
                const pluginCode = response.data;

                // Extract plugin name from code (look for module.exports or name)
                let pluginName = 'plugin_' + Date.now();
                const nameMatch = pluginCode.match(/name\s*[=:]\s*['"]([^'"]+)['"]/);
                if (nameMatch) pluginName = nameMatch[1].toLowerCase().replace(/\s+/g, '_');

                // Save plugin file
                const pluginsDir = config.PLUGINS_DIR;
                if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });

                const filePath = path.join(pluginsDir, `${pluginName}.js`);
                
                // Check if plugin already exists
                if (fs.existsSync(filePath)) {
                    return await ctx.reply(`❌ Plugin "${pluginName}" already exists! Use a different name or remove it first.`);
                }

                fs.writeFileSync(filePath, pluginCode);

                await ctx.reply(`✅ Plugin *"${pluginName}"* installed successfully!\n\nUse \`.listplugin\` to see all plugins.`, { parse_mode: 'Markdown' });
                break;
            }

            case 'remove': {
                // .removeplugin <name>
                const pluginName = text.replace(/^\.removeplugin\s+/, '').trim().toLowerCase();
                if (!pluginName) {
                    return await ctx.reply('❌ Please specify a plugin name.\nUsage: `.removeplugin pluginname`');
                }

                const filePath = path.join(config.PLUGINS_DIR, `${pluginName}.js`);
                if (!fs.existsSync(filePath)) {
                    return await ctx.reply(`❌ Plugin "${pluginName}" not found. Use \`.listplugin\` to see all plugins.`);
                }

                fs.unlinkSync(filePath);
                await ctx.reply(`✅ Plugin *"${pluginName}"* removed successfully.`, { parse_mode: 'Markdown' });
                break;
            }

            case 'list': {
                const pluginsDir = config.PLUGINS_DIR;
                if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });

                const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
                
                if (files.length === 0) {
                    return await ctx.reply('📋 *Installed Plugins:*\n\nNo plugins installed.');
                }

                const pluginList = files.map((f, i) => `${i + 1}. \`${f.replace('.js', '')}\``).join('\n');
                await ctx.reply(`📋 *Installed Plugins:*\n\n${pluginList}`, { parse_mode: 'Markdown' });
                break;
            }
        }
    } catch (error) {
        logger.error('Plugin command error:', error);
        await ctx.reply(`❌ Plugin command error: ${error.message}`);
    }
}

module.exports = {
    handleStart,
    handleSetup,
    handlePair,
    handleMsgCommand,
    handlePluginCommands
};
