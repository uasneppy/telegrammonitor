import { getAllUsers, getUserLocations, getUserThreatFilters, saveSentAlert, getUserIgnoredWords, getUserGPSLocation } from './db.js';
import { isStrategicThreat } from './analyzer.js';
import { getCoordinatesForLocation } from './geocoding.js';
import { calculateDistance, formatDistance } from './distance.js';

export async function dispatchThreatAlert(analysis, botApiSendFunction) {
  if (!analysis.threat) {
    console.log('ℹ️ No threat detected, skipping alert dispatch');
    return;
  }
  
  const users = getAllUsers();
  const isStrategic = isStrategicThreat(analysis);
  
  console.log(`📢 Dispatching threat alert (strategic: ${isStrategic})`);
  
  const proximityCache = new Map();
  
  const usersToNotify = users.filter(user => {
    if (hasIgnoredWords(user, analysis)) {
      console.log(`⊘ Skipping user ${user.telegram_user_id} due to ignored word match`);
      return false;
    }
    
    if (isStrategic) {
      return true;
    }
    
    const proximityInfo = checkProximityWarning(user, analysis);
    proximityCache.set(user.id, proximityInfo);
    
    if (proximityInfo) {
      console.log(`📍 Proximity match for user ${user.telegram_user_id}: ${proximityInfo.distance.toFixed(1)} km from ${proximityInfo.locationName}`);
      return true;
    }
    
    return shouldNotifyUser(user, analysis);
  });
  
  const alertPromises = usersToNotify.map(user => {
    const proximityInfo = proximityCache.get(user.id);
    return sendAlertToUser(user.telegram_user_id, analysis, botApiSendFunction, isStrategic, user.id, proximityInfo)
      .then(() => {
        console.log(`✓ Alert sent to user ${user.telegram_user_id}`);
        return { userId: user.telegram_user_id, success: true };
      })
      .catch(error => {
        console.error(`❌ Failed to send alert to user ${user.telegram_user_id}:`, error.message);
        return { userId: user.telegram_user_id, success: false, error: error.message };
      });
  });
  
  await Promise.allSettled(alertPromises);
}

function hasIgnoredWords(user, analysis) {
  const ignoredWords = getUserIgnoredWords(user.id);
  
  if (ignoredWords.length === 0) {
    return false;
  }
  
  const description = (analysis.description || '').toLowerCase();
  
  return ignoredWords.some(wordObj => {
    const word = wordObj.word.toLowerCase();
    return description.includes(word);
  });
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

function getProbabilityIndicator(probability) {
  if (probability >= 80) return '🔴 висока';
  if (probability >= 50) return '🟡 середня';
  if (probability >= 20) return '🟢 низька';
  return '⚪ невідомо';
}

function checkProximityWarning(user, analysis) {
  const gpsLocation = getUserGPSLocation(user.id);
  
  if (!gpsLocation || !gpsLocation.latitude || !gpsLocation.longitude) {
    return null;
  }
  
  if (!analysis.locations || analysis.locations.length === 0) {
    return null;
  }
  
  const proximityRadius = gpsLocation.proximity_radius || 20;
  let closestThreat = null;
  
  for (const locationName of analysis.locations) {
    const coords = getCoordinatesForLocation(locationName);
    
    if (coords) {
      const distance = calculateDistance(
        gpsLocation.latitude,
        gpsLocation.longitude,
        coords.lat,
        coords.lon
      );
      
      if (distance <= proximityRadius) {
        if (!closestThreat || distance < closestThreat.distance) {
          closestThreat = {
            locationName,
            distance,
            coordinates: coords
          };
        }
      }
    }
  }
  
  return closestThreat;
}

function formatThreatAlert(analysis, isStrategic, proximityInfo) {
  let message = `⚠️ *Загроза зафіксована*\n\n`;
  
  if (proximityInfo) {
    message = `🚨 *ЗАГРОЗА ПОБЛИЗУ!*\n\n`;
    message += `📍 *Відстань від вас:* ${formatDistance(proximityInfo.distance)}\n`;
    message += `📌 *Локація загрози:* ${proximityInfo.locationName}\n\n`;
  }
  
  message += `*Регіони:* `;
  if (analysis.locations && analysis.locations.length > 0) {
    message += `${analysis.locations.join(', ')}\n`;
  } else {
    message += `невідомо\n`;
  }
  
  message += `*Тип:* ${analysis.type || 'невідомо'}\n`;
  
  message += `*Опис:* ${analysis.description || 'Інформація відсутня'}\n`;
  
  message += `*Ймовірність:* ${getProbabilityIndicator(analysis.probability || 0)}\n\n`;
  
  if (proximityInfo) {
    message += `⚠️ Загроза знаходиться в радіусі ${formatDistance(proximityInfo.distance)} від вашого місцезнаходження. Будьте обережні!\n\n`;
  }
  
  message += `Слідкуйте за офіційними повідомленнями та дотримуйтесь безпеки.`;
  
  return message;
}

async function sendAlertToUser(telegramUserId, analysis, botApiSendFunction, isStrategic, userId, proximityInfo) {
  const message = formatThreatAlert(analysis, isStrategic, proximityInfo);
  await botApiSendFunction(telegramUserId, message, { parse_mode: 'Markdown' });
  
  if (userId) {
    saveSentAlert(userId, analysis, isStrategic);
  }
}
