import { config, validateConfig } from './config.js';
import { initDatabase } from './db.js';
import { initGemini } from './geminiClient.js';
import { initBotApi, sendAlertMessage } from './botApi.js';
import { initMTProtoClient } from './mtprotoClient.js';

console.log('🚀 Starting Telegram Threat Monitor...\n');

const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.error('❌ Configuration errors:');
  configErrors.forEach(err => console.error(`   - ${err}`));
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  console.error('See .env.example for reference.\n');
  process.exit(1);
}

console.log('✓ Configuration validated\n');

try {
  initDatabase();
  initGemini();
  
  const bot = initBotApi();
  
  await initMTProtoClient(sendAlertMessage);
  
  console.log('\n✅ All systems initialized successfully!');
  console.log('📡 Monitoring channels for threats...');
  console.log('🤖 Bot API is ready to receive commands');
  console.log('\nPress Ctrl+C to stop\n');
  
} catch (error) {
  console.error('\n❌ Fatal error during initialization:', error);
  process.exit(1);
}
