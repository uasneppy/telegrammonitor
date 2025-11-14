import { Telegraf } from 'telegraf';
import { config } from './config.js';
import {
  getOrCreateUser,
  getUserLocations,
  addUserLocation,
  deleteUserLocation,
  getUserThreatFilters,
  toggleUserThreatFilter,
} from './db.js';

let bot = null;
const userStates = new Map();

const PREDEFINED_THREATS = ['ракети', 'шахеди', 'артобстріл', 'авіація', 'дрони'];

export function initBotApi() {
  bot = new Telegraf(config.botApi.token);
  
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('cities', handleCities);
  bot.command('addcity', handleAddCity);
  bot.command('delcity', handleDelCity);
  bot.command('threats', handleThreats);
  bot.command('togglethreat', handleToggleThreat);
  
  bot.on('text', handleText);
  
  bot.launch();
  console.log('✓ Bot API initialized and launched');
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
  return bot;
}

async function handleStart(ctx) {
  const telegramUserId = ctx.from.id;
  getOrCreateUser(telegramUserId);
  
  await ctx.reply(
    'Привіт. Я допомагаю відстежувати загрози для твоїх міст за повідомленнями з вибраних каналів.\n\n' +
    'Використовуй /cities щоб налаштувати міста, /threats щоб налаштувати типи загроз, /help щоб отримати довідку.'
  );
}

async function handleHelp(ctx) {
  await ctx.reply(
    '📋 Доступні команди:\n\n' +
    '/start - почати роботу з ботом\n' +
    '/cities - показати твої міста\n' +
    '/addcity - додати місто\n' +
    '/delcity - видалити місто\n' +
    '/threats - налаштування типів загроз\n' +
    '/togglethreat - змінити фільтр типу загрози\n' +
    '/help - ця довідка'
  );
}

async function handleCities(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const locations = getUserLocations(user.id);
  
  if (locations.length === 0) {
    await ctx.reply(
      'У тебе поки немає збережених міст.\n\n' +
      'Використовуй /addcity щоб додати місто.'
    );
    return;
  }
  
  let message = 'Твої міста:\n\n';
  locations.forEach((loc, index) => {
    const oblast = loc.oblast_name ? ` (${loc.oblast_name})` : '';
    message += `${index + 1}) ${loc.label} – ${loc.city_name}${oblast}\n`;
  });
  
  message += '\nВикористовуй /addcity щоб додати місто, /delcity щоб видалити.';
  
  await ctx.reply(message);
}

async function handleAddCity(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  userStates.set(telegramUserId, {
    command: 'addcity',
    step: 'label',
    userId: user.id,
  });
  
  await ctx.reply('Введи коротку назву для цієї локації (наприклад, Дім, Батьки):');
}

async function handleDelCity(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const locations = getUserLocations(user.id);
  
  if (locations.length === 0) {
    await ctx.reply('У тебе немає збережених міст для видалення.');
    return;
  }
  
  let message = 'Вибери номер міста для видалення:\n\n';
  locations.forEach((loc, index) => {
    const oblast = loc.oblast_name ? ` (${loc.oblast_name})` : '';
    message += `${index + 1}) ${loc.label} – ${loc.city_name}${oblast}\n`;
  });
  
  userStates.set(telegramUserId, {
    command: 'delcity',
    userId: user.id,
    locations: locations,
  });
  
  await ctx.reply(message);
}

async function handleThreats(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const filters = getUserThreatFilters(user.id);
  
  const activeFilters = new Set(filters.map(f => f.threat_type));
  
  let message = 'Твої фільтри типів загроз:\n\n';
  
  PREDEFINED_THREATS.forEach(threat => {
    const status = activeFilters.has(threat) ? '✅ увімкнено' : '❌ вимкнено';
    message += `${threat}: ${status}\n`;
  });
  
  message += '\nВикористовуй /togglethreat щоб змінити фільтри.';
  
  await ctx.reply(message);
}

async function handleToggleThreat(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  userStates.set(telegramUserId, {
    command: 'togglethreat',
    userId: user.id,
  });
  
  let message = 'Введи тип загрози для переключення:\n\n';
  PREDEFINED_THREATS.forEach((threat, index) => {
    message += `${index + 1}) ${threat}\n`;
  });
  
  await ctx.reply(message);
}

async function handleText(ctx) {
  const telegramUserId = ctx.from.id;
  const text = ctx.message.text;
  const state = userStates.get(telegramUserId);
  
  if (!state) {
    return;
  }
  
  if (state.command === 'addcity') {
    await handleAddCityFlow(ctx, state, text);
  } else if (state.command === 'delcity') {
    await handleDelCityFlow(ctx, state, text);
  } else if (state.command === 'togglethreat') {
    await handleToggleThreatFlow(ctx, state, text);
  }
}

async function handleAddCityFlow(ctx, state, text) {
  const telegramUserId = ctx.from.id;
  
  if (state.step === 'label') {
    state.label = text;
    state.step = 'city';
    await ctx.reply('Введи назву міста (наприклад, Київ):');
  } else if (state.step === 'city') {
    state.city = text;
    state.step = 'oblast';
    await ctx.reply('Введи область (наприклад, Київська область) або напиши "-" якщо не хочеш вказувати:');
  } else if (state.step === 'oblast') {
    const oblast = text === '-' ? null : text;
    
    addUserLocation(state.userId, state.label, state.city, oblast);
    
    const oblastText = oblast ? ` (${oblast})` : '';
    await ctx.reply(`✅ Додано: ${state.label} – ${state.city}${oblastText}`);
    
    userStates.delete(telegramUserId);
  }
}

async function handleDelCityFlow(ctx, state, text) {
  const telegramUserId = ctx.from.id;
  const num = parseInt(text);
  
  if (isNaN(num) || num < 1 || num > state.locations.length) {
    await ctx.reply('Невірний номер. Спробуй ще раз або скасуй командою /cities');
    return;
  }
  
  const location = state.locations[num - 1];
  deleteUserLocation(state.userId, location.id);
  
  await ctx.reply(`✅ Видалено: ${location.label} – ${location.city_name}`);
  userStates.delete(telegramUserId);
}

async function handleToggleThreatFlow(ctx, state, text) {
  const telegramUserId = ctx.from.id;
  const num = parseInt(text);
  
  if (isNaN(num) || num < 1 || num > PREDEFINED_THREATS.length) {
    const threatType = text.toLowerCase().trim();
    if (PREDEFINED_THREATS.includes(threatType)) {
      toggleUserThreatFilter(state.userId, threatType);
      await ctx.reply(`✅ Фільтр "${threatType}" переключено`);
      userStates.delete(telegramUserId);
      return;
    }
    
    await ctx.reply('Невірний вибір. Спробуй ще раз або скасуй командою /threats');
    return;
  }
  
  const threatType = PREDEFINED_THREATS[num - 1];
  toggleUserThreatFilter(state.userId, threatType);
  
  await ctx.reply(`✅ Фільтр "${threatType}" переключено`);
  userStates.delete(telegramUserId);
}

export async function sendAlertMessage(telegramUserId, message) {
  if (!bot) {
    throw new Error('Bot not initialized');
  }
  
  await bot.telegram.sendMessage(telegramUserId, message);
}

export function getBot() {
  return bot;
}
