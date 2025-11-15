import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';
import {
  getOrCreateUser,
  getUserLocations,
  addUserLocation,
  deleteUserLocation,
  getUserThreatFilters,
  toggleUserThreatFilter,
  getUserAlerts,
  getUserIgnoredWords,
  addIgnoredWord,
  deleteIgnoredWord,
  updateUserGPSLocation,
  getUserGPSLocation,
  updateUserProximityRadius,
} from './db.js';

let bot = null;
const userStates = new Map();

const PREDEFINED_THREATS = ['ракети', 'шахеди', 'артобстріл', 'авіація', 'дрони'];

export function initBotApi() {
  bot = new Telegraf(config.botApi.token);
  
  bot.command('start', handleStart);
  bot.command('menu', handleStart);
  bot.command('summary', (ctx) => {
    userStates.delete(ctx.from.id);
    return showSummaryScreen(ctx);
  });
  
  bot.on('location', handleLocation);
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
  return Markup.keyboard([
    ['🏙️ Мої міста', '⚠️ Типи загроз'],
    ['📍 Моя локація', '📏 Радіус попередження'],
    ['🚫 Ігноровані слова', '📊 Зведення'],
    ['ℹ️ Допомога']
  ]).resize();
}

async function handleStart(ctx) {
  const telegramUserId = ctx.from.id;
  getOrCreateUser(telegramUserId);
  
  await ctx.reply(
    '👋 Привіт! Я допомагаю відстежувати загрози для твоїх міст.\n\n' +
    '🔔 Ти отримаєш сповіщення про загрози в налаштованих локаціях.\n' +
    '📍 Поділись своєю локацією для отримання попереджень про близькі загрози.\n\n' +
    '📍 Обери потрібний розділ:',
    getMainMenuKeyboard()
  );
}

async function showMainMenu(ctx) {
  await ctx.reply(
    '📍 Головне меню:\n\n' +
    'Обери потрібний розділ:',
    getMainMenuKeyboard()
  );
}

async function showCitiesScreen(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const locations = getUserLocations(user.id);
  
  if (locations.length === 0) {
    await ctx.reply(
      '🏙️ Мої міста\n\n' +
      'У тебе поки немає збережених міст.\n' +
      'Додай своє перше місто, щоб отримувати сповіщення про загрози.',
      Markup.keyboard([
        ['➕ Додати місто'],
        ['« Назад']
      ]).resize()
    );
    return;
  }
  
  let message = '🏙️ Мої міста\n\n';
  
  const buttons = [['➕ Додати місто']];
  locations.forEach((loc, index) => {
    const oblast = loc.oblast_name ? ` (${loc.oblast_name})` : '';
    message += `${index + 1}. ${loc.label} – ${loc.city_name}${oblast}\n`;
  });
  
  message += '\n💡 Щоб видалити місто, напиши його номер';
  
  buttons.push(['« Назад']);
  
  await ctx.reply(message, Markup.keyboard(buttons).resize());
  
  userStates.set(telegramUserId, {
    command: 'deletecity',
    locations: locations
  });
}

async function handleAddCityAction(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  userStates.set(telegramUserId, {
    command: 'addcity',
    step: 'label',
    userId: user.id,
  });
  
  await ctx.reply(
    '➕ Додавання міста\n\n' +
    '📝 Крок 1 з 3\n\n' +
    'Введи коротку назву для цієї локації:\n' +
    '(наприклад: Дім, Батьки, Робота)',
    Markup.keyboard([
      ['❌ Скасувати']
    ]).resize()
  );
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
    buttons.push([`${emoji} ${threat}`]);
  });
  
  message += '\n💡 Натисни на тип загрози, щоб увімкнути/вимкнути';
  
  buttons.push(['« Назад']);
  
  await ctx.reply(message, Markup.keyboard(buttons).resize());
}

async function showMyLocationScreen(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const gpsLocation = getUserGPSLocation(user.id);
  
  if (!gpsLocation || !gpsLocation.latitude || !gpsLocation.longitude) {
    await ctx.reply(
      '📍 Моя локація\n\n' +
      'У тебе ще не збережена GPS локація.\n\n' +
      '💡 Поділись своєю локацією, щоб отримувати попередження про загрози в радіусі від твого місцезнаходження.',
      Markup.keyboard([
        [Markup.button.locationRequest('📍 Поділитися локацією')],
        ['« Назад']
      ]).resize()
    );
    return;
  }
  
  const lastUpdate = gpsLocation.location_updated_at 
    ? new Date(gpsLocation.location_updated_at).toLocaleString('uk-UA')
    : 'Невідомо';
  
  await ctx.reply(
    '📍 Моя локація\n\n' +
    `📌 Координати: ${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)}\n` +
    `🕐 Оновлено: ${lastUpdate}\n` +
    `📏 Радіус попередження: ${gpsLocation.proximity_radius} км\n\n` +
    '💡 Поділись локацією знову, щоб оновити.',
    Markup.keyboard([
      [Markup.button.locationRequest('📍 Оновити локацію')],
      ['« Назад']
    ]).resize()
  );
}

async function showProximityRadiusScreen(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const gpsLocation = getUserGPSLocation(user.id);
  
  const currentRadius = gpsLocation?.proximity_radius || 20;
  
  await ctx.reply(
    '📏 Радіус попередження\n\n' +
    `Поточний радіус: ${currentRadius} км\n\n` +
    '💡 Обери радіус, в межах якого ти хочеш отримувати попередження про загрози від твоєї GPS локації:',
    Markup.keyboard([
      ['10 км', '20 км', '30 км'],
      ['40 км', '50 км'],
      ['« Назад']
    ]).resize()
  );
  
  userStates.set(telegramUserId, {
    command: 'setproximityradius'
  });
}

async function handleLocation(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const location = ctx.message.location;
  
  updateUserGPSLocation(user.id, location.latitude, location.longitude);
  
  await ctx.reply(
    '✅ Локація збережена!\n\n' +
    `📍 Координати: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}\n\n` +
    'Тепер ти отримуватимеш попередження про загрози в радіусі від твого місцезнаходження.',
    getMainMenuKeyboard()
  );
}

async function showHelpScreen(ctx) {
  await ctx.reply(
    'ℹ️ Довідка\n\n' +
    '🤖 Як працює бот:\n' +
    '• Моніторю канали з попередженнями про загрози\n' +
    '• Аналізую повідомлення за допомогою AI\n' +
    '• Надсилаю сповіщення про загрози для твоїх міст\n\n' +
    '📍 Налаштування міст:\n' +
    '• Додай свої міста в розділі "Мої міста"\n' +
    '• Можеш додати декілька локацій (дім, батьки, робота)\n' +
    '• Отримуватимеш сповіщення тільки для своїх міст\n\n' +
    '📍 Моя локація:\n' +
    '• Поділись своєю GPS локацією для точних попереджень\n' +
    '• Отримуватимеш сповіщення про загрози в радіусі від твого місця\n' +
    '• Встанови радіус попередження від 10 до 50 км\n\n' +
    '⚠️ Типи загроз:\n' +
    '• Обери які типи загроз тебе цікавлять\n' +
    '• Стратегічні загрози (ракети, авіація) надсилаються всім\n' +
    '• Локальні загрози фільтруються за твоїми містами\n\n' +
    '🚫 Ігноровані слова:\n' +
    '• Додай слова, які хочеш ігнорувати\n' +
    '• Сповіщення з цими словами в описі не надсилатимуться\n' +
    '• Працює для всіх типів загроз\n\n' +
    '📊 Зведення:\n' +
    '• Отримай короткий звіт про загрози за період\n' +
    '• Доступні періоди від 10 хвилин до 10 годин\n\n' +
    '💬 Команди:\n' +
    '/start або /menu - головне меню',
    Markup.keyboard([
      ['« Назад']
    ]).resize()
  );
}

async function handleCancelAction(ctx) {
  const telegramUserId = ctx.from.id;
  userStates.delete(telegramUserId);
  
  await showMainMenu(ctx);
}

async function handleThreatToggleText(ctx, text) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  const threat = PREDEFINED_THREATS.find(t => text.includes(t));
  if (threat) {
    toggleUserThreatFilter(user.id, threat);
    await showThreatsScreen(ctx);
  }
}

async function showIgnoredWordsScreen(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  const ignoredWords = getUserIgnoredWords(user.id);
  
  if (ignoredWords.length === 0) {
    await ctx.reply(
      '🚫 Ігноровані слова\n\n' +
      'У тебе поки немає ігнорованих слів.\n\n' +
      '💡 Якщо додаси слово, сповіщення з цим словом в описі не надсилатимуться.',
      Markup.keyboard([
        ['➕ Додати слово'],
        ['« Назад']
      ]).resize()
    );
    return;
  }
  
  let message = '🚫 Ігноровані слова\n\n';
  
  const buttons = [['➕ Додати слово']];
  ignoredWords.forEach((word, index) => {
    message += `${index + 1}. ${word.word}\n`;
  });
  
  message += '\n💡 Щоб видалити слово, напиши його номер';
  
  buttons.push(['« Назад']);
  
  await ctx.reply(message, Markup.keyboard(buttons).resize());
  
  userStates.set(telegramUserId, {
    command: 'deleteignoredword',
    ignoredWords: ignoredWords
  });
}

async function showSummaryScreen(ctx) {
  const telegramUserId = ctx.from.id;
  
  userStates.set(telegramUserId, {
    command: 'summary'
  });
  
  await ctx.reply(
    '📊 Зведення загроз\n\n' +
    'Обери період для зведення:',
    Markup.keyboard([
      ['10 хв', '30 хв', '1 год'],
      ['3 год', '7 год', '10 год'],
      ['« Назад']
    ]).resize()
  );
}

const TIME_PERIODS = {
  '10 хв': 10,
  '30 хв': 30,
  '1 год': 60,
  '3 год': 180,
  '7 год': 420,
  '10 год': 600
};

async function handleSummaryPeriodSelection(ctx, text) {
  const minutes = TIME_PERIODS[text];
  
  if (!minutes) {
    return false;
  }
  
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  userStates.delete(telegramUserId);
  
  await ctx.reply('⏳ Генерую зведення, зачекай...', getMainMenuKeyboard());
  
  const alerts = getUserAlerts(user.id, minutes);
  
  if (alerts.length === 0) {
    await ctx.reply(
      `📊 Зведення за останні ${text}\n\n` +
      '✅ За цей період загроз не зафіксовано.',
      getMainMenuKeyboard()
    );
    return true;
  }
  
  try {
    const summary = await generateSummary(alerts, text);
    await ctx.reply(
      `📊 Зведення за останні ${text}\n\n${summary}`,
      { ...getMainMenuKeyboard(), parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error generating summary:', error);
    await ctx.reply(
      '❌ Помилка при генерації зведення. Спробуй пізніше.',
      getMainMenuKeyboard()
    );
  }
  
  return true;
}

async function generateSummary(alerts, period) {
  if (!config.gemini || !config.gemini.apiKey) {
    return createManualSummary(alerts);
  }
  
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const alertsText = alerts.map((alert, i) => {
      return `${i + 1}. Регіони: ${alert.locations || 'невідомо'}, Тип: ${alert.type || 'невідомо'}, Опис: ${alert.description || 'немає'}, Час: ${alert.sent_at}`;
    }).join('\n');
    
    const prompt = `Ти аналітик загроз. Створи короткий звіт про загрози за останні ${period}.

Отримані сповіщення:
${alertsText}

Створи короткий звіт українською мовою, який включає:
1. Загальну кількість загроз
2. Основні типи загроз
3. Найбільш уражені регіони
4. Короткий висновок

Звіт має бути коротким (максимум 10 рядків), інформативним та зрозумілим. Використовуй емодзі для наочності.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return createManualSummary(alerts);
  }
}

function createManualSummary(alerts) {
  const types = {};
  const regions = {};
  
  alerts.forEach(alert => {
    const type = alert.type || 'невідомо';
    const locs = alert.locations ? alert.locations.split(', ') : ['невідомо'];
    
    types[type] = (types[type] || 0) + 1;
    locs.forEach(loc => {
      regions[loc] = (regions[loc] || 0) + 1;
    });
  });
  
  let summary = `📊 *Всього загроз:* ${alerts.length}\n\n`;
  
  summary += `⚠️ *Типи загроз:*\n`;
  Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([type, count]) => {
      summary += `  • ${type}: ${count}\n`;
    });
  
  summary += `\n📍 *Найбільш уражені регіони:*\n`;
  Object.entries(regions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([region, count]) => {
      summary += `  • ${region}: ${count}\n`;
    });
  
  summary += `\n💡 Будь обережним та слідкуй за оновленнями.`;
  
  return summary;
}

async function handleText(ctx) {
  const telegramUserId = ctx.from.id;
  const text = ctx.message.text;
  const state = userStates.get(telegramUserId);
  
  const mainMenuButtons = [
    '🏙️ Мої міста', '⚠️ Типи загроз', '📍 Моя локація', '📏 Радіус попередження',
    '🚫 Ігноровані слова', '📊 Зведення', 'ℹ️ Допомога', '« Назад', '« Головне меню'
  ];
  
  if (state && mainMenuButtons.includes(text)) {
    userStates.delete(telegramUserId);
  }
  
  if (state && state.command === 'addcity') {
    if (text === '❌ Скасувати') {
      await handleCancelAction(ctx);
      return;
    }
    if (!mainMenuButtons.includes(text)) {
      await handleAddCityFlow(ctx, state, text);
      return;
    }
  }
  
  if (state && state.command === 'addignoredword') {
    if (text === '❌ Скасувати') {
      await handleCancelAction(ctx);
      return;
    }
    if (!mainMenuButtons.includes(text)) {
      await handleAddIgnoredWordFlow(ctx, state, text);
      return;
    }
  }
  
  if (state && state.command === 'summary') {
    if (text === '« Назад') {
      userStates.delete(telegramUserId);
      await showMainMenu(ctx);
      return;
    }
    const handled = await handleSummaryPeriodSelection(ctx, text);
    if (handled) return;
  }
  
  if (state && state.command === 'setproximityradius') {
    if (text === '« Назад') {
      userStates.delete(telegramUserId);
      await showMainMenu(ctx);
      return;
    }
    
    const radiusMatch = text.match(/(\d+)\s*км/);
    if (radiusMatch) {
      const radius = parseInt(radiusMatch[1]);
      if ([10, 20, 30, 40, 50].includes(radius)) {
        const user = getOrCreateUser(telegramUserId);
        updateUserProximityRadius(user.id, radius);
        await ctx.reply(
          `✅ Радіус попередження встановлено: ${radius} км\n\n` +
          'Тепер ти отримуватимеш попередження про загрози в цьому радіусі від твоєї GPS локації.',
          getMainMenuKeyboard()
        );
        userStates.delete(telegramUserId);
        return;
      }
    }
  }
  
  if (state && state.command === 'deletecity') {
    if (text === '« Назад') {
      userStates.delete(telegramUserId);
      await showMainMenu(ctx);
      return;
    }
    
    const num = parseInt(text);
    if (!isNaN(num) && num > 0 && num <= state.locations.length) {
      const location = state.locations[num - 1];
      const user = getOrCreateUser(telegramUserId);
      deleteUserLocation(user.id, location.id);
      await ctx.reply('✅ Місто видалено');
      userStates.delete(telegramUserId);
      await showCitiesScreen(ctx);
      return;
    } else if (text !== '➕ Додати місто') {
      await ctx.reply('❌ Будь ласка, введи номер міста або обери дію з меню');
      return;
    }
  }
  
  if (state && state.command === 'deleteignoredword') {
    if (text === '« Назад') {
      userStates.delete(telegramUserId);
      await showMainMenu(ctx);
      return;
    }
    
    const num = parseInt(text);
    if (!isNaN(num) && num > 0 && num <= state.ignoredWords.length) {
      const word = state.ignoredWords[num - 1];
      const user = getOrCreateUser(telegramUserId);
      deleteIgnoredWord(user.id, word.id);
      await ctx.reply('✅ Слово видалено');
      userStates.delete(telegramUserId);
      await showIgnoredWordsScreen(ctx);
      return;
    } else if (text !== '➕ Додати слово') {
      await ctx.reply('❌ Будь ласка, введи номер слова або обери дію з меню');
      return;
    }
  }
  
  switch (text) {
    case '🏙️ Мої міста':
      userStates.delete(telegramUserId);
      await showCitiesScreen(ctx);
      break;
    case '⚠️ Типи загроз':
      userStates.delete(telegramUserId);
      await showThreatsScreen(ctx);
      break;
    case '📍 Моя локація':
      userStates.delete(telegramUserId);
      await showMyLocationScreen(ctx);
      break;
    case '📏 Радіус попередження':
      userStates.delete(telegramUserId);
      await showProximityRadiusScreen(ctx);
      break;
    case '🚫 Ігноровані слова':
      userStates.delete(telegramUserId);
      await showIgnoredWordsScreen(ctx);
      break;
    case '📊 Зведення':
      userStates.delete(telegramUserId);
      await showSummaryScreen(ctx);
      break;
    case 'ℹ️ Допомога':
      userStates.delete(telegramUserId);
      await showHelpScreen(ctx);
      break;
    case '« Назад':
    case '« Головне меню':
      userStates.delete(telegramUserId);
      await showMainMenu(ctx);
      break;
    case '➕ Додати місто':
      await handleAddCityAction(ctx);
      break;
    case '➕ Додати слово':
      await handleAddIgnoredWordAction(ctx);
      break;
    case '❌ Скасувати':
      await handleCancelAction(ctx);
      break;
    default:
      if (text.startsWith('🗑️ Видалити')) {
        return;
      }
      if (PREDEFINED_THREATS.some(threat => text.includes(threat))) {
        await handleThreatToggleText(ctx, text);
      }
      break;
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
      Markup.keyboard([
        ['❌ Скасувати']
      ]).resize()
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
      Markup.keyboard([
        ['❌ Скасувати']
      ]).resize()
    );
  } else if (state.step === 'oblast') {
    const oblast = text === '-' ? null : text;
    
    addUserLocation(state.userId, state.label, state.city, oblast);
    
    const oblastText = oblast ? ` (${oblast})` : '';
    
    await ctx.reply(
      `✅ Місто додано!\n\n` +
      `📍 ${state.label} – ${state.city}${oblastText}\n\n` +
      `Тепер ти отримуватимеш сповіщення про загрози для цієї локації.`,
      getMainMenuKeyboard()
    );
    
    userStates.delete(telegramUserId);
  }
}

async function handleAddIgnoredWordAction(ctx) {
  const telegramUserId = ctx.from.id;
  const user = getOrCreateUser(telegramUserId);
  
  userStates.set(telegramUserId, {
    command: 'addignoredword',
    userId: user.id,
  });
  
  await ctx.reply(
    '➕ Додавання ігнорованого слова\n\n' +
    'Введи слово, яке хочеш ігнорувати:\n' +
    '(наприклад: тривога, увага)\n\n' +
    '💡 Сповіщення з цим словом в описі не надсилатимуться.',
    Markup.keyboard([
      ['❌ Скасувати']
    ]).resize()
  );
}

async function handleAddIgnoredWordFlow(ctx, state, text) {
  const telegramUserId = ctx.from.id;
  
  const result = addIgnoredWord(state.userId, text);
  
  if (!result) {
    await ctx.reply(
      '❌ Це слово вже в списку або некоректне.\n\n' +
      'Спробуй інше слово або скасуй дію.',
      Markup.keyboard([
        ['❌ Скасувати']
      ]).resize()
    );
    return;
  }
  
  await ctx.reply(
    `✅ Слово додано!\n\n` +
    `🚫 "${text.toLowerCase().trim()}"\n\n` +
    `Сповіщення з цим словом в описі більше не надсилатимуться.`,
    getMainMenuKeyboard()
  );
  
  userStates.delete(telegramUserId);
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
