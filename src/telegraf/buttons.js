/**
 * Inline Keyboard Builders
 */

const { Markup } = require('telegraf');

module.exports = {
    welcomeButtons: () => Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Setup', 'setup')]
    ]),

    termsButtons: () => Markup.inlineKeyboard([
        [
            Markup.button.callback('✅ Agree', 'agree'),
            Markup.button.callback('❌ Not Agree', 'disagree')
        ]
    ]),

    pairButton: () => Markup.inlineKeyboard([
        [Markup.button.callback('📲 Pair', 'pair')]
    ])
};
