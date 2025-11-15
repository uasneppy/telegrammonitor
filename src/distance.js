export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} м`;
  }
  return `${km.toFixed(1)} км`;
}

export function isWithinRadius(userLat, userLon, threatLat, threatLon, radiusKm) {
  const distance = calculateDistance(userLat, userLon, threatLat, threatLon);
  return { isWithin: distance <= radiusKm, distance };
}
