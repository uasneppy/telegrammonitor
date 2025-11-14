# Telegram Threat Monitor Project

## Overview
A Node.js application that monitors Telegram channels for threat alerts using MTProto user-bot, analyzes messages with Google Gemini AI, and sends personalized alerts to users via Telegram Bot API based on their location and threat type preferences.

## Project Status
✅ **Core implementation complete** - All modules created and integrated
⚠️ **Requires user setup** - Environment variables must be configured before use

## Recent Changes (November 14, 2025)
- Initial project setup with ES modules architecture
- Implemented MTProto user-bot with terminal-based OTP authentication
- Created Telegram Bot API bot with Ukrainian language commands
- Integrated Google Gemini 2.5 Flash for threat analysis
- Built SQLite database with 5 tables for user management
- Implemented smart threat dispatcher with location/type filtering
- Added comprehensive README with setup instructions

## Architecture

### Core Modules
1. **src/config.js** - Environment variable loading and validation
2. **src/db.js** - SQLite database with users, locations, filters, channels, messages
3. **src/geminiClient.js** - Gemini AI integration for threat analysis
4. **src/analyzer.js** - Parse 6-line Ukrainian threat summaries from Gemini
5. **src/dispatcher.js** - Match threats to users based on location/type filters
6. **src/botApi.js** - Telegraf bot with Ukrainian commands (/start, /cities, /addcity, /delcity, /threats, /help)
7. **src/mtprotoClient.js** - MTProto user-bot for channel monitoring with session persistence
8. **src/index.js** - Main entry point that orchestrates all components

### Data Flow
1. MTProto user-bot monitors configured channels
2. New messages saved to SQLite (last 20 per channel)
3. Message + context sent to Gemini for analysis
4. Gemini returns structured 6-line Ukrainian summary
5. Dispatcher matches threat against user filters
6. Bot API sends alerts to matching users

## Dependencies
- **telegram** (gramjs) - MTProto client for user-bot
- **telegraf** - Telegram Bot API client
- **better-sqlite3** - SQLite database
- **@google/generative-ai** - Google Gemini SDK
- **dotenv** - Environment variables
- **input** - Terminal input handling

## User Setup Required

### Before First Run
1. Copy `.env.example` to `.env`
2. Obtain Telegram API credentials from https://my.telegram.org/apps
3. Create a bot via @BotFather and get bot token
4. Get Google Gemini API key from https://ai.google.dev/
5. Configure monitored channels (must be already subscribed)
6. Set phone number with country code

### First Run Authentication
- App will prompt for OTP via terminal (not Telegram chat)
- Session saved to `data/session.json` for future runs
- No OTP needed after successful first login

## Database Schema
- **users** - Bot API user registrations
- **user_locations** - Cities/oblasts per user (label, city, oblast)
- **user_threat_filters** - Threat type preferences per user
- **channels** - Monitored Telegram channels
- **channel_messages** - Last 20 messages per channel for context

## Key Features
- **Terminal-based OTP** - User-bot login via stdin/stdout only
- **Session persistence** - MTProto session saved as JSON
- **Context-aware analysis** - Gemini receives 10-20 recent messages
- **Smart filtering** - Strategic threats (missiles, aviation) sent to all; local threats filtered by location
- **Ukrainian interface** - All bot responses in Ukrainian, commands in English
- **Automatic cleanup** - Only last 20 messages kept per channel

## Configuration Notes
- Channels configured via MONITORED_CHANNELS environment variable
- Threat types defined in `PREDEFINED_THREATS` array in botApi.js
- Message context limit set to 20 in config.js
- All data stored in `data/` directory (auto-created)

## Project Structure
```
telegram-threat-monitor/
├── src/                  # Source code
├── data/                 # Runtime data (session, database)
├── package.json          # Node.js configuration
├── .env.example          # Environment template
├── .gitignore           # Git exclusions
└── README.md            # User documentation
```

## User Preferences
- Language: Ukrainian for all user-facing messages
- Commands: English command names
- Architecture: Modular ES6 structure
- Database: SQLite for simplicity
- Error handling: Graceful failures with console logging

## Next Steps for Users
1. Set up `.env` file with all required credentials
2. Ensure Telegram account is subscribed to target channels
3. Run `npm start` and complete OTP authentication
4. Start bot chat with `/start` command
5. Configure cities with `/addcity`
6. Optionally configure threat filters with `/togglethreat`
