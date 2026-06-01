# 🤖 Tokyo Bot

**Developer:** D4RK-K1NG

Tokyo Bot is a powerful WhatsApp bot with a Telegram control panel. Connect your WhatsApp number and get a fully-featured bot with plugin support.

## ✨ Features

- **WhatsApp Bot** with `ping`, `alive`, `menu` commands
- **Telegram Control Panel** to manage your bots
- **Plugin System** - Add commands via `.plugin <gisturl>`
- **Multi-Device Support** using Baileys
- **Pairing Code** connection (no QR needed)
- **Secret Message Sender** - Send messages from all connected bots
- **Auto-Reconnect** on disconnection

## 📋 Commands

### WhatsApp Commands
| Command | Description |
|---------|-------------|
| `ping` | Check bot response |
| `alive` | Check bot status |
| `menu` | Show command menu |

### Telegram Owner Commands
| Command | Description |
|---------|-------------|
| `.plugin <gisturl>` | Install a plugin from GitHub Gist |
| `.removeplugin <name>` | Remove an installed plugin |
| `.listplugin` | List all installed plugins |
| `.msg <number> <text>` | Send message to target from all bots |
| `.crash_v1 <number>` | Send crash payload to target from all bots |

## 🚀 Deployment

### Deploy on Render

1. Fork this repository
2. Create a new **Web Service** on Render
3. Connect your GitHub repo
4. Set the **Start Command** to `npm start`
5. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
   - `OWNER_ID` - Your Telegram user ID

### Deploy on Railway

1. Fork this repository
2. Create a new project on Railway
3. Connect your GitHub repo
4. Add environment variables in the dashboard
5. Deploy!

## 🔧 Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/tokyo-bot.git
cd tokyo-bot

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your token and owner ID

# Start the bot
npm start
