# Telegram Threat Monitor Project

## Overview
A Node.js application that monitors Telegram channels for threat alerts using MTProto user-bot, analyzes messages with Google Gemini AI, and sends personalized alerts to users via Telegram Bot API based on their location and threat type preferences.

## Project Status
✅ **Core implementation complete** - All modules created and integrated
⚠️ **Requires user setup** - Environment variables must be configured before use

## Recent Changes (November 14, 2025)
- Initial project setup with ES modules architecture
- Implemented MTProto user-bot with terminal-based OTP authentication
- **Redesigned Bot API with modern reply keyboard interface**
  - Reply keyboards (persistent buttons at bottom of chat)
  - Visual status indicators (✅/⬜️) for threat filters
  - Number-based city deletion
  - Emoji-decorated navigation with back buttons
  - Robust state management with cancel/back handling
- Integrated Google Gemini 2.5 Flash for threat analysis
- Built SQLite database with 7 tables for user management and alert history
- Implemented smart threat dispatcher with location/type filtering
- Added comprehensive README with setup instructions
- **Enhanced AI-based strategic threat detection**
  - Gemini AI now determines strategic threats instead of keyword matching
  - 7-line AI response format includes "Стратегічна: так/ні/невідомо"
  - Robust parser with fallback handling for AI response variations
  - Comprehensive keyword fallback for resilience (30+ variations)
  - Defensive warnings when AI returns unexpected or missing data
- **Performance optimizations**
  - Parallelized alert dispatching (sends to all users simultaneously)
  - Message deduplication cache (skips re-analyzing duplicates within 60s)
  - Optimized dispatcher to pass userId directly (avoid O(n²) lookups)
  - Reduced context from 10 to 5 messages (faster AI responses)
  - Channel-specific dedup keys prevent cross-channel false positives
- **Clean alert formatting with Markdown**
  - Markdown-formatted messages (*bold* labels)
  - Simple, readable structure: Регіони, Тип, Опис, Ймовірність
  - Color-coded probability indicators (🔴 висока, 🟡 середня, 🟢 низька)
  - No excessive emojis or dividers
- **Summary feature (/summary command)**
  - 6 time period options: 10 min, 30 min, 1 hour, 3 hours, 7 hours, 10 hours
  - AI-powered summary generation using Gemini 2.0 Flash
  - Fallback to manual summary when AI unavailable
  - Stores all sent alerts in database for historical analysis
  - Provides threat count, types, and affected regions
- **Per-user ignored words filtering**
  - Users can add words to ignore in alert descriptions
  - Case-insensitive matching in threat descriptions
  - Alerts containing ignored words are not sent to that user
  - Works for all threat types (strategic and local)
  - Simple UI for managing ignored words list

## Architecture

### Core Modules
1. **src/config.js** - Environment variable loading and validation
2. **src/db.js** - SQLite database with users, locations, filters, channels, messages, sent_alerts, user_ignored_words
3. **src/geminiClient.js** - Gemini AI integration for threat analysis with strategic detection
4. **src/analyzer.js** - Parse 7-line Ukrainian threat summaries from Gemini with AI-based strategic classification
5. **src/dispatcher.js** - Match threats to users based on location/type/ignored words filters, save alert history
6. **src/botApi.js** - Telegraf bot with reply keyboards and commands (/start, /menu, /summary)
7. **src/mtprotoClient.js** - MTProto user-bot for channel monitoring with session persistence
8. **src/index.js** - Main entry point that orchestrates all components

### Data Flow
1. MTProto user-bot monitors configured channels
2. New messages saved to SQLite (last 20 per channel)
3. Message + context sent to Gemini for analysis
4. Gemini returns structured 7-line Ukrainian summary with strategic classification
5. AI determines if threat is strategic (TU-95, shaheds, cruise missiles, etc.)
6. Dispatcher matches threat against user filters (strategic threats sent to all users)
7. Bot API sends alerts to matching users

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
- **user_ignored_words** - Words to filter out of alerts per user (case-insensitive)
- **channels** - Monitored Telegram channels
- **channel_messages** - Last 20 messages per channel for context
- **sent_alerts** - Historical record of all alerts sent to users (for summaries)

## Key Features
- **Terminal-based OTP** - User-bot login via stdin/stdout only
- **Session persistence** - MTProto session saved as JSON
- **Context-aware analysis** - Gemini receives 4-5 recent messages for context
- **AI-based strategic detection** - Gemini determines if threats are strategic (not keyword-based)
  - Primary: AI classification via "Стратегічна: так/ні/невідомо" field
  - Fallback: 30+ keyword patterns (TU-95, shaheds, cruise missiles, Kalibr, etc.)
  - Handles Cyrillic/Latin variants, plurals, and spelling variations
- **Smart filtering** - Strategic threats sent to all users; local threats filtered by location
- **Per-user ignored words** - Users can filter alerts containing specific words
  - Case-insensitive matching in threat descriptions
  - Applies to all threat types (strategic and local)
  - Simple add/delete interface via reply keyboards
- **Performance optimized** - Parallel alert dispatch, deduplication cache, reduced AI latency, optimized database queries
- **Reply keyboard interface** - Persistent buttons for easy navigation, robust state management
- **Summary reports** - AI-generated threat summaries for customizable time periods (10 min to 10 hours)
- **Alert history** - All sent alerts stored in database for historical analysis
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
5. Use the reply keyboard buttons to navigate:
   - 🏙️ Мої міста - Add/manage your cities
   - ⚠️ Типи загроз - Toggle threat type filters
   - 🚫 Ігноровані слова - Add words to filter from alerts
   - 📊 Зведення - Get threat summaries
   - ℹ️ Допомога - View help information
6. Use `/summary` command or button to view threat reports for different time periods
