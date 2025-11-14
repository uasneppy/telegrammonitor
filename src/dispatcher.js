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
      sendAlertToUser(user.telegram_user_id, analysis, botApiSendFunction)
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

async function sendAlertToUser(telegramUserId, analysis, botApiSendFunction) {
  const message = `⚠️ Нова загроза:\n\n${analysis.rawText}`;
  await botApiSendFunction(telegramUserId, message);
}
