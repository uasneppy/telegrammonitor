# Telegram Threat Monitor

A Node.js application that monitors Telegram channels for threat alerts, analyzes them using Google Gemini AI, and sends personalized notifications to users based on their location and threat type preferences.

## Features

- **MTProto User-Bot**: Monitors specified Telegram channels in real-time as a regular user
- **Bot API Integration**: Handles user commands and sends alerts via Telegram Bot API
- **AI Analysis**: Uses Google Gemini 2.5 Flash to analyze threats and provide structured summaries
- **Smart Filtering**: Matches threats against user-configured cities, oblasts, and threat types
- **SQLite Database**: Stores user preferences, locations, and message history

## Prerequisites

1. **Telegram API credentials** (for MTProto user-bot):
   - Get from https://my.telegram.org/apps
   - You'll need: API ID and API Hash

2. **Telegram Bot Token** (for Bot API):
   - Create a bot via @BotFather on Telegram
   - Get the bot token

3. **Google Gemini API Key**:
   - Get from https://ai.google.dev/

4. **Node.js** (v18 or higher)

## Installation

1. Clone or download this project

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Edit `.env` and fill in your credentials:
```env
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE_NUMBER=+380XXXXXXXXX
TELEGRAM_BOT_TOKEN=your_bot_token
GEMINI_API_KEY=your_gemini_key
MONITORED_CHANNELS=channel1,channel2,channel3
```

**Important**: 
- Add channel usernames to `MONITORED_CHANNELS` (comma-separated, without @)
- Make sure your Telegram account is already subscribed to these channels
- The phone number must include country code (e.g., +380...)

## First Run - Login

On the first run, the MTProto client will need to authenticate:

1. Start the application:
```bash
npm start
```

2. You'll be prompted to enter the OTP code from Telegram
3. Check your Telegram app for the login code
4. Enter the code in the terminal
5. The session will be saved to `data/session.json`
6. Future runs will use this session automatically (no OTP needed)

## Usage

### For Users (via Telegram Bot)

Start a chat with your bot and use the beautiful inline keyboard interface:

1. Send `/start` or `/menu` to open the main menu
2. Use the interactive buttons to:
   - 🏙️ **Мої міста** - View, add, or delete your cities
   - ⚠️ **Типи загроз** - Toggle threat type filters with one tap
   - ℹ️ **Допомога** - View detailed help information

The bot features a modern, aesthetic interface with:
- Interactive inline keyboard buttons
- Visual status indicators (✅/⬜️ for filters)
- Step-by-step city addition flow
- One-tap city deletion
- Instant threat filter toggling
- Easy navigation with back buttons

### How Alerts Work

1. The user-bot monitors configured channels for new messages
2. Each message is analyzed by Gemini AI with recent context
3. If a threat is detected:
   - **Strategic threats** (missiles, aviation, fleet) → sent to ALL users
   - **Local threats** → sent only to users with matching locations
4. Users receive alerts via the Bot API bot in Ukrainian

## Project Structure

```
telegram-threat-monitor/
├── src/
│   ├── index.js           # Main entry point
│   ├── config.js          # Configuration loader
│   ├── db.js              # SQLite database management
│   ├── geminiClient.js    # Gemini AI integration
│   ├── analyzer.js        # Threat analysis parsing
│   ├── dispatcher.js      # Alert distribution logic
│   ├── botApi.js          # Telegram Bot API handler
│   └── mtprotoClient.js   # MTProto user-bot client
├── data/                  # Generated at runtime
│   ├── session.json       # MTProto session (auto-generated)
│   └── settings.db        # SQLite database (auto-generated)
├── package.json
├── .env                   # Your configuration (create from .env.example)
└── README.md
```

## Database Schema

The SQLite database includes:
- `users` - Bot API users
- `user_locations` - User's cities and oblasts
- `user_threat_filters` - User's threat type preferences
- `channels` - Monitored Telegram channels
- `channel_messages` - Recent messages (last 20 per channel)

## Troubleshooting

### Session Issues
If you get authentication errors:
1. Delete `data/session.json`
2. Restart the app
3. Complete the OTP login again

### Channel Access
Make sure:
- Your Telegram account is subscribed to all channels in `MONITORED_CHANNELS`
- Channel usernames are correct (without @)
- Channels are public or you have access

### No Alerts Received
Check that:
1. You've run `/start` in the bot
2. You've added cities via `/addcity`
3. The threat location matches your configured cities/oblasts

## Configuration Tips

### Adding Channels
Edit `.env` and update `MONITORED_CHANNELS`:
```env
MONITORED_CHANNELS=air_alert_ua,ukraine_now,official_channel
```

### Modifying Threat Types
Edit `src/botApi.js` and update the `PREDEFINED_THREATS` array:
```javascript
const PREDEFINED_THREATS = ['ракети', 'шахеди', 'артобстріл', 'авіація', 'дрони'];
```

## Security Notes

- Never commit `.env` file to version control
- Keep your session file private
- Protect your API keys and bot token

## License

ISC
