# Telegram Threat Monitor

A Node.js application that monitors Telegram channels for threat alerts, analyzes them using Google Gemini AI, and sends personalized notifications to users based on their location and threat type preferences.

## Features

- **MTProto User-Bot**: Monitors specified Telegram channels in real-time as a regular user
- **Bot API Integration**: Handles user commands and sends alerts via Telegram Bot API
- **AI Analysis**: Uses Google Gemini 2.5 Flash to analyze threats and provide structured summaries
- **Smart Filtering**: Matches threats against user-configured cities, oblasts, and threat types
- **GPS Proximity Warnings**: Share your location to receive alerts about threats within your chosen radius (10-50 km)
- **Geocoding Service**: Automatically converts Ukrainian location names to coordinates using GeoJSON data
- **SQLite Database**: Stores user preferences, locations, message history, and GPS coordinates with persistent data across restarts

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
   - 📍 **Моя локація** - Share your GPS location for proximity warnings
   - 📏 **Радіус попередження** - Set warning radius (10, 20, 30, 40, 50 km)
   - 🚫 **Ігноровані слова** - Add words to ignore in threat descriptions
   - 📊 **Зведення** - Get AI-generated threat summaries
   - ℹ️ **Допомога** - View detailed help information

The bot features a modern, aesthetic interface with:
- Interactive inline keyboard buttons
- Visual status indicators (✅/⬜️ for filters)
- Step-by-step city addition flow
- One-tap city deletion
- Instant threat filter toggling
- GPS location sharing with Telegram's built-in location picker
- Customizable proximity radius
- Easy navigation with back buttons

### How Alerts Work

1. The user-bot monitors configured channels for new messages
2. Each message is analyzed by Gemini AI with recent context
3. If a threat is detected:
   - **Strategic threats** (missiles, aviation, fleet) → sent to ALL users
   - **Proximity threats** → sent to users with GPS location if within their chosen radius
   - **Local threats** → sent only to users with matching cities/oblasts
4. Users receive alerts via the Bot API bot in Ukrainian
5. **Proximity warnings** show distance and enhanced alert formatting when threats are nearby

### GPS Proximity Warnings

The bot can send special proximity warnings based on your exact GPS location:

1. **Share Your Location**:
   - Tap "📍 Моя локація" in the menu
   - Use Telegram's location sharing button
   - Your coordinates are securely stored in the database

2. **Set Your Radius**:
   - Tap "📏 Радіус попередження"
   - Choose from 10, 20, 30, 40, or 50 km
   - Default is 20 km

3. **How It Works**:
   - When a threat is detected, the system converts location names to GPS coordinates
   - Your distance to the threat is calculated using the Haversine formula
   - If within your radius, you receive a special proximity alert showing:
     - 🚨 Enhanced warning header
     - 📍 Exact distance from your location
     - 📌 Threat location name
   - Works even if you haven't saved any cities (GPS-only mode)

4. **Data Persistence**:
   - Your GPS location is saved to the SQLite database
   - Survives bot restarts and server shutdowns
   - Update anytime by sharing your location again

## Project Structure

```
telegram-threat-monitor/
├── src/
│   ├── index.js           # Main entry point
│   ├── config.js          # Configuration loader
│   ├── db.js              # SQLite database management
│   ├── geminiClient.js    # Gemini AI integration
│   ├── analyzer.js        # Threat analysis parsing
│   ├── dispatcher.js      # Alert distribution logic with proximity checks
│   ├── botApi.js          # Telegram Bot API handler
│   ├── mtprotoClient.js   # MTProto user-bot client
│   ├── geocoding.js       # Ukraine GeoJSON data fetcher and location resolver
│   └── distance.js        # Haversine distance calculations
├── data/                  # Generated at runtime
│   ├── session.json       # MTProto session (auto-generated)
│   ├── settings.db        # SQLite database (auto-generated)
│   └── ukraine_geojson_cache.json  # Cached Ukraine location coordinates
├── package.json
├── .env                   # Your configuration (create from .env.example)
└── README.md
```

## Database Schema

The SQLite database includes:
- `users` - Bot API users with GPS coordinates (latitude, longitude, proximity_radius)
- `user_locations` - User's cities and oblasts
- `user_threat_filters` - User's threat type preferences
- `channels` - Monitored Telegram channels
- `channel_messages` - Recent messages (last 20 per channel)
- `sent_alerts` - History of sent alerts
- `user_ignored_words` - Words to filter from alerts

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
