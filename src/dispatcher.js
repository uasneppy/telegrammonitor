import { getAllUsers, getUserLocations, getUserThreatFilters } from './db.js';
import { isStrategicThreat } from './analyzer.js';

export async function dispatchThreatAlert(analysis, botApiSendFunction) {
  if (!analysis.threat) {
    console.log('ℹ️ No threat detected, skipping alert dispatch');
    return;
  }
  
  const users = getAllUsers();
  const isStrategic = isStrategicThreat(analysis);
  
  console.log(`📢 Dispatching threat alert (strategic: ${isStrategic})`);
  
  const alertPromises = users
    .filter(user => isStrategic || shouldNotifyUser(user, analysis))
    .map(user => 
      sendAlertToUser(user.telegram_user_id, analysis, botApiSendFunction, isStrategic)
        .then(() => {
          console.log(`✓ Alert sent to user ${user.telegram_user_id}`);
          return { userId: user.telegram_user_id, success: true };
        })
        .catch(error => {
          console.error(`❌ Failed to send alert to user ${user.telegram_user_id}:`, error.message);
          return { userId: user.telegram_user_id, success: false, error: error.message };
        })
    );
  
  await Promise.allSettled(alertPromises);
}

function shouldNotifyUser(user, analysis) {
  const userLocations = getUserLocations(user.id);
  
  if (userLocations.length === 0) {
    return false;
  }
  
  const locationMatch = userLocations.some(location => {
    return analysis.locations.some(threatLocation => {
      const threatLoc = threatLocation.toLowerCase();
      const cityMatch = location.city_name && threatLoc.includes(location.city_name.toLowerCase());
      const oblastMatch = location.oblast_name && threatLoc.includes(location.oblast_name.toLowerCase());
      return cityMatch || oblastMatch;
    });
  });
  
  if (!locationMatch && analysis.locations.length > 0 && !analysis.locations.includes('невідомо')) {
    return false;
  }
  
  const userFilters = getUserThreatFilters(user.id);
  if (userFilters.length > 0) {
    const filterMatch = userFilters.some(filter => {
      const filterType = filter.threat_type.toLowerCase();
      const analysisType = analysis.type.toLowerCase();
      return analysisType.includes(filterType) || filterType.includes(analysisType);
    });
    
    if (!filterMatch && analysis.type !== 'невідомо') {
      return false;
    }
  }
  
  return true;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getThreatEmoji(type, isStrategic) {
  if (isStrategic) {
    return '🚨';
  }
  
  const typeStr = type.toLowerCase();
  if (typeStr.includes('ракет') || typeStr.includes('крилат')) return '🚀';
  if (typeStr.includes('шахед') || typeStr.includes('дрон')) return '🛩️';
  if (typeStr.includes('авіація') || typeStr.includes('літак')) return '✈️';
  if (typeStr.includes('артобстріл') || typeStr.includes('артилер')) return '💥';
  if (typeStr.includes('флот') || typeStr.includes('морськ')) return '⚓';
  return '⚠️';
}

function getProbabilityIndicator(probability) {
  if (probability >= 80) return '🔴 Висока';
  if (probability >= 50) return '🟡 Середня';
  if (probability >= 20) return '🟢 Низька';
  return '⚪ Невідомо';
}

function formatThreatAlert(analysis, isStrategic) {
  const emoji = getThreatEmoji(analysis.type || 'невідомо', isStrategic);
  const divider = '━━━━━━━━━━━━━━━━━━';
  
  let message = `${emoji} <b>ЗАГРОЗА ВИЯВЛЕНА</b> ${emoji}\n`;
  message += `${divider}\n\n`;
  
  if (isStrategic) {
    message += `⭐ <b>СТРАТЕГІЧНА ЗАГРОЗА</b>\n`;
    message += `<i>Увага всім регіонам України!</i>\n\n`;
  }
  
  message += `📍 <b>Регіони:</b>\n`;
  if (analysis.locations && analysis.locations.length > 0) {
    const escapedLocations = analysis.locations.map(loc => escapeHtml(loc));
    message += `   ${escapedLocations.join(', ')}\n\n`;
  } else {
    message += `   <i>Локації невідомі</i>\n\n`;
  }
  
  message += `🎯 <b>Тип загрози:</b>\n`;
  message += `   ${escapeHtml(analysis.type || 'невідомо')}\n\n`;
  
  message += `📝 <b>Опис:</b>\n`;
  message += `   ${escapeHtml(analysis.description || 'Інформація відсутня')}\n\n`;
  
  if (analysis.time && analysis.time !== 'невідомо') {
    message += `⏰ <b>Час:</b> ${escapeHtml(analysis.time)}\n\n`;
  }
  
  message += `📊 <b>Ймовірність:</b> ${getProbabilityIndicator(analysis.probability || 0)}\n`;
  
  message += `\n${divider}\n`;
  message += `🛡️ <i>Слідкуйте за офіційними каналами та дотримуйтесь правил безпеки</i>`;
  
  return message;
}

async function sendAlertToUser(telegramUserId, analysis, botApiSendFunction, isStrategic) {
  const message = formatThreatAlert(analysis, isStrategic);
  await botApiSendFunction(telegramUserId, message, { parse_mode: 'HTML' });
}
