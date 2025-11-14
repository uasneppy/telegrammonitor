import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { config } from './config.js';
import { getOrCreateChannel, saveChannelMessage, getRecentMessages } from './db.js';
import { analyzeThreat } from './geminiClient.js';
import { parseThreatAnalysis } from './analyzer.js';
import { dispatchThreatAlert } from './dispatcher.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import readline from 'readline';
import crypto from 'crypto';

let client = null;

const recentMessageHashes = new Map();
const DEDUP_WINDOW_MS = 60000;
const MAX_CACHE_SIZE = 100;

export async function initMTProtoClient(botApiSendFunction) {
  console.log('🔐 Initializing MTProto client...');
  
  if (!config.mtproto.phoneNumber) {
    console.error('❌ TELEGRAM_PHONE_NUMBER is not set in .env');
    console.error('Please set TELEGRAM_PHONE_NUMBER in .env file and restart');
    process.exit(1);
  }
  
  let sessionString = '';
  if (existsSync(config.mtproto.sessionFile)) {
    try {
      sessionString = readFileSync(config.mtproto.sessionFile, 'utf-8');
      console.log('✓ Loaded existing session from file');
    } catch (error) {
      console.warn('⚠️ Could not read session file, will create new session');
    }
  }
  
  const session = new StringSession(sessionString);
  
  client = new TelegramClient(
    session,
    config.mtproto.apiId,
    config.mtproto.apiHash,
    {
      connectionRetries: 5,
    }
  );
  
  await client.start({
    phoneNumber: config.mtproto.phoneNumber,
    phoneCode: async () => {
      return await promptForOTP();
    },
    password: async () => {
      console.log('Enter your 2FA password (if enabled):');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      return new Promise(resolve => {
        rl.question('', answer => {
          rl.close();
          resolve(answer);
        });
      });
    },
    onError: (err) => console.error('MTProto error:', err),
  });
  
  const newSession = client.session.save();
  writeFileSync(config.mtproto.sessionFile, newSession);
  console.log(`✓ Session saved to ${config.mtproto.sessionFile}`);
  
  console.log('✓ MTProto client connected');
  
  await subscribeToChannels(botApiSendFunction);
  
  return client;
}

async function promptForOTP() {
  console.log('\n📱 Enter the OTP code from Telegram:');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question('OTP: ', answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function subscribeToChannels(botApiSendFunction) {
  console.log('📡 Subscribing to channels...');
  
  if (config.channels.monitored.length === 0) {
    console.warn('⚠️ No channels configured in MONITORED_CHANNELS');
    console.warn('Add channel usernames to .env (comma-separated, without @)');
    return;
  }
  
  for (const username of config.channels.monitored) {
    try {
      const entity = await client.getEntity(username);
      const channelId = entity.id.toString();
      
      getOrCreateChannel(channelId, username, entity.title || username);
      
      console.log(`✓ Subscribed to channel: @${username} (${entity.title})`);
    } catch (error) {
      console.error(`❌ Failed to subscribe to @${username}:`, error.message);
    }
  }
  
  client.addEventHandler(
    (event) => handleNewMessage(event, botApiSendFunction),
    new NewMessage({})
  );
  
  console.log('✓ Event handler registered for new messages');
}

async function handleNewMessage(event, botApiSendFunction) {
  try {
    const message = event.message;
    
    if (!message.peerId || !message.peerId.channelId) {
      return;
    }
    
    const channelId = message.peerId.channelId.toString();
    const messageText = message.message || '';
    
    if (!messageText.trim()) {
      return;
    }
    
    const channel = getOrCreateChannel(channelId, null, null);
    
    if (!channel) {
      return;
    }
    
    const messageDate = message.date;
    const messageId = message.id;
    
    saveChannelMessage(channel.id, messageId, messageDate, messageText);
    
    console.log(`\n📨 New message from channel ${channel.username || channelId}`);
    
    const dedupKey = `${channelId}:${crypto.createHash('sha256').update(messageText.toLowerCase().trim()).digest('hex').substring(0, 16)}`;
    
    const now = Date.now();
    if (recentMessageHashes.has(dedupKey)) {
      const lastSeen = recentMessageHashes.get(dedupKey);
      if (now - lastSeen < DEDUP_WINDOW_MS) {
        console.log(`⏭️ Skipping duplicate message from ${channel.username || channelId} (seen in last 60s)`);
        return;
      }
    }
    
    recentMessageHashes.set(dedupKey, now);
    
    if (recentMessageHashes.size > MAX_CACHE_SIZE) {
      const oldestKey = recentMessageHashes.keys().next().value;
      recentMessageHashes.delete(oldestKey);
    }
    
    const recentMessages = getRecentMessages(channel.id, 5);
    
    try {
      const rawAnalysis = await analyzeThreat({
        channelName: channel.username || channel.title || channelId,
        recentMessages: recentMessages.slice(0, -1),
        newMessageText: messageText,
      });
      
      console.log('🤖 Gemini analysis received');
      
      const analysis = parseThreatAnalysis(rawAnalysis);
      
      console.log(`   Threat: ${analysis.threat ? 'ТАК' : 'НІ'}`);
      console.log(`   Type: ${analysis.type}`);
      console.log(`   Locations: ${analysis.locations.join(', ') || 'невідомо'}`);
      console.log(`   Strategic: ${analysis.strategic}`);
      
      if (analysis.threat) {
        await dispatchThreatAlert(analysis, botApiSendFunction);
      }
    } catch (error) {
      console.error('❌ Error analyzing message:', error.message);
    }
  } catch (error) {
    console.error('❌ Error handling new message:', error);
  }
}

export function getClient() {
  return client;
}
