import { Telegraf, Markup } from 'telegraf';
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
  bot.command('menu', handleStart);
  
  bot.action('menu', handleMenuAction);
  bot.action('cities', handleCitiesAction);
  bot.action('addcity', handleAddCityAction);
  bot.action('threats', handleThreatsAction);
  bot.action('help', handleHelpAction);
  
  bot.action(/^delcity_(.+)$/, handleDeleteCityAction);
  bot.action(/^toggle_(.+)$/, handleToggleThreatAction);
  bot.action('cancel', handleCancelAction);
  
  bot.on('text', handleText);
  
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
  });
  
  bot.launch();
  console.log('✓ Bot API initialized and launched');
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
  return bot;
}

function getMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏙️ Мої міста', 'cities')],
    [Markup.button.callback('⚠️ Типи загроз', 'threats')],
    [Markup.button.callback('ℹ️ Допомога', 'help')],
  ]);
}

async function handleStart(ctx) {
  const telegramUserId = ctx.from.id;
  getOrCreateUser(telegramUserId);
  
  await ctx.reply(
    '👋 Привіт! Я допомагаю відстежувати загрози для твоїх міст.\n\n' +
    '🔔 Ти отримаєш сповіщення про загрози в налаштованих локаціях.\n\n' +
    '📍 Обери потрібний розділ:',
    getMainMenuKeyboard()
  );
}

async function showMainMenu(ctx) {
  await ctx.editMessageText(
    '📍 Головне меню:\n\n' +
    'Обери потрібний розділ:',
    getMainMenuKeyboard()
  );
}

async function handleMenuAction(ctx) {
  await ctx.answerCbQuery();
  await showMainMenu(ctx);
}

async function showCitiesScreen(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const locations = getUserLocations(user.id);
  
  if (locations.length === 0) {
    await ctx.editMessageText(
      '🏙️ Мої міста\n\n' +
      'У тебе поки немає збережених міст.\n' +
      'Додай своє перше місто, щоб отримувати сповіщення про загрози.',
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Додати місто', 'addcity')],
        [Markup.button.callback('« Назад', 'menu')],
      ])
    );
    return;
  }
  
  let message = '🏙️ Мої міста\n\n';
  
  const buttons = [];
  locations.forEach((loc) => {
    const oblast = loc.oblast_name ? ` (${loc.oblast_name})` : '';
    message += `📍 ${loc.label} – ${loc.city_name}${oblast}\n`;
    buttons.push([Markup.button.callback(`🗑️ Видалити "${loc.label}"`, `delcity_${loc.id}`)]);
  });
  
  buttons.push([Markup.button.callback('➕ Додати місто', 'addcity')]);
  buttons.push([Markup.button.callback('« Назад', 'menu')]);
  
  await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
}

async function handleCitiesAction(ctx) {
  await ctx.answerCbQuery();
  await showCitiesScreen(ctx);
}

async function handleAddCityAction(ctx) {
  await ctx.answerCbQuery();
  
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  userStates.set(telegramUserId, {
    command: 'addcity',
    step: 'label',
    userId: user.id,
  });
  
  await ctx.editMessageText(
    '➕ Додавання міста\n\n' +
    '📝 Крок 1 з 3\n\n' +
    'Введи коротку назву для цієї локації:\n' +
    '(наприклад: Дім, Батьки, Робота)',
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Скасувати', 'cancel')],
    ])
  );
}

async function handleDeleteCityAction(ctx) {
  const locationId = parseInt(ctx.match[1]);
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const locations = getUserLocations(user.id);
  
  const location = locations.find(loc => loc.id === locationId);
  
  if (location) {
    deleteUserLocation(user.id, locationId);
    await ctx.answerCbQuery('✅ Місто видалено');
  } else {
    await ctx.answerCbQuery();
  }
  
  await showCitiesScreen(ctx);
}

async function showThreatsScreen(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const filters = getUserThreatFilters(user.id);
  
  const activeFilters = new Set(filters.map(f => f.threat_type));
  
  let message = '⚠️ Типи загроз\n\n';
  message += 'Обери які типи загроз показувати:\n\n';
  
  const buttons = [];
  
  PREDEFINED_THREATS.forEach(threat => {
    const isActive = activeFilters.has(threat);
    const emoji = isActive ? '✅' : '⬜️';
    message += `${emoji} ${threat}\n`;
    buttons.push([Markup.button.callback(`${emoji} ${threat}`, `toggle_${threat}`)]);
  });
  
  message += '\n💡 Натисни на тип загрози, щоб увімкнути/вимкнути';
  
  buttons.push([Markup.button.callback('« Назад', 'menu')]);
  
  await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
}

async function handleThreatsAction(ctx) {
  await ctx.answerCbQuery();
  await showThreatsScreen(ctx);
}

async function handleToggleThreatAction(ctx) {
  const threatType = ctx.match[1];
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  toggleUserThreatFilter(user.id, threatType);
  
  await ctx.answerCbQuery('✅ Налаштування оновлено');
  
  await showThreatsScreen(ctx);
}

async function handleHelpAction(ctx) {
  await ctx.answerCbQuery();
  
  await ctx.editMessageText(
    'ℹ️ Довідка\n\n' +
    '🤖 Як працює бот:\n' +
    '• Моніторю канали з попередженнями про загрози\n' +
    '• Аналізую повідомлення за допомогою AI\n' +
    '• Надсилаю сповіщення про загрози для твоїх міст\n\n' +
    '📍 Налаштування міст:\n' +
    '• Додай свої міста в розділі "Мої міста"\n' +
    '• Можеш додати декілька локацій (дім, батьки, робота)\n' +
    '• Отримуватимеш сповіщення тільки для своїх міст\n\n' +
    '⚠️ Типи загроз:\n' +
    '• Обери які типи загроз тебе цікавлять\n' +
    '• Стратегічні загрози (ракети, авіація) надсилаються всім\n' +
    '• Локальні загрози фільтруються за твоїми містами\n\n' +
    '🔔 Формат сповіщень:\n' +
    '• Загроза: так/ні\n' +
    '• Тип загрози\n' +
    '• Локації\n' +
    '• Опис ситуації\n' +
    '• Час і ймовірність\n\n' +
    '💬 Команди:\n' +
    '/start або /menu - головне меню',
    Markup.inlineKeyboard([
      [Markup.button.callback('« Назад', 'menu')],
    ])
  );
}

async function handleCancelAction(ctx) {
  await ctx.answerCbQuery('❌ Скасовано');
  
  const telegramUserId = ctx.from.id;
  userStates.delete(telegramUserId);
  
  await showMainMenu(ctx);
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
  }
}

async function handleAddCityFlow(ctx, state, text) {
  const telegramUserId = ctx.from.id;
  
  if (state.step === 'label') {
    state.label = text;
    state.step = 'city';
    await ctx.reply(
      '➕ Додавання міста\n\n' +
      '📝 Крок 2 з 3\n\n' +
      'Введи назву міста:\n' +
      '(наприклад: Київ, Львів, Одеса)',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel')],
      ])
    );
  } else if (state.step === 'city') {
    state.city = text;
    state.step = 'oblast';
    await ctx.reply(
      '➕ Додавання міста\n\n' +
      '📝 Крок 3 з 3\n\n' +
      'Введи область:\n' +
      '(наприклад: Київська область)\n\n' +
      'або напиши "-" якщо не хочеш вказувати',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Скасувати', 'cancel')],
      ])
    );
  } else if (state.step === 'oblast') {
    const oblast = text === '-' ? null : text;
    
    addUserLocation(state.userId, state.label, state.city, oblast);
    
    const oblastText = oblast ? ` (${oblast})` : '';
    
    await ctx.reply(
      `✅ Місто додано!\n\n` +
      `📍 ${state.label} – ${state.city}${oblastText}\n\n` +
      `Тепер ти отримуватимеш сповіщення про загрози для цієї локації.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🏙️ Мої міста', 'cities')],
        [Markup.button.callback('« Головне меню', 'menu')],
      ])
    );
    
    userStates.delete(telegramUserId);
  }
}

export async function sendAlertMessage(telegramUserId, message, options = {}) {
  if (!bot) {
    throw new Error('Bot not initialized');
  }
  
  await bot.telegram.sendMessage(telegramUserId, message, options);
}

export function getBot() {
  return bot;
}
