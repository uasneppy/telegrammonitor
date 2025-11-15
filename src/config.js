import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const dataDir = join(projectRoot, 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log(`✓ Created data directory: ${dataDir}`);
}

export const config = {
  mtproto: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    sessionFile: process.env.TELEGRAM_SESSION_FILE || join(dataDir, 'session.json'),
    phoneNumber: process.env.TELEGRAM_PHONE || process.env.TELEGRAM_PHONE_NUMBER || '',
  },
  
  botApi: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  
  database: {
    path: process.env.DB_PATH || join(dataDir, 'settings.db'),
  },
  
  channels: {
    monitored: (process.env.MONITORED_CHANNELS || '')
      .split(',')
      .map(ch => ch.trim())
      .filter(ch => ch.length > 0),
  },
  
  messageContext: {
    maxMessagesPerChannel: 20,
  },
};

export function validateConfig() {
  const errors = [];
  
  if (!config.mtproto.apiId || config.mtproto.apiId === 0) {
    errors.push('TELEGRAM_API_ID is required');
  }
  
  if (!config.mtproto.apiHash) {
    errors.push('TELEGRAM_API_HASH is required');
  }
  
  if (!config.botApi.token) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }
  
  if (!config.gemini.apiKey) {
    errors.push('GEMINI_API_KEY is required');
  }
  
  return errors;
}
