import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '..', 'data');
const geoJsonCachePath = join(dataDir, 'ukraine_geojson_cache.json');

let geoJsonCache = null;

const UKRAINE_REGIONS = [
  { name: 'Вінницька', code: '05' },
  { name: 'Волинська', code: '07' },
  { name: 'Дніпропетровська', code: '12' },
  { name: 'Донецька', code: '14' },
  { name: 'Житомирська', code: '18' },
  { name: 'Закарпатська', code: '21' },
  { name: 'Запорізька', code: '23' },
  { name: 'Івано-Франківська', code: '26' },
  { name: 'Київська', code: '32' },
  { name: 'Кіровоградська', code: '35' },
  { name: 'Луганська', code: '09' },
  { name: 'Львівська', code: '46' },
  { name: 'Миколаївська', code: '48' },
  { name: 'Одеська', code: '51' },
  { name: 'Полтавська', code: '53' },
  { name: 'Рівненська', code: '56' },
  { name: 'Сумська', code: '59' },
  { name: 'Тернопільська', code: '61' },
  { name: 'Харківська', code: '63' },
  { name: 'Херсонська', code: '65' },
  { name: 'Хмельницька', code: '68' },
  { name: 'Черкаська', code: '71' },
  { name: 'Чернівецька', code: '77' },
  { name: 'Чернігівська', code: '74' },
  { name: 'Крим', code: '43' }
];

const MAJOR_CITIES = {
  'київ': { lat: 50.4501, lon: 30.5234 },
  'харків': { lat: 49.9935, lon: 36.2304 },
  'одеса': { lat: 46.4825, lon: 30.7233 },
  'дніпро': { lat: 48.4647, lon: 35.0462 },
  'дніпропетровськ': { lat: 48.4647, lon: 35.0462 },
  'донецьк': { lat: 48.0159, lon: 37.8028 },
  'запоріжжя': { lat: 47.8388, lon: 35.1396 },
  'львів': { lat: 49.8397, lon: 24.0297 },
  'кривий ріг': { lat: 47.9077, lon: 33.3917 },
  'миколаїв': { lat: 46.9750, lon: 31.9946 },
  'маріуполь': { lat: 47.0971, lon: 37.5432 },
  'луганськ': { lat: 48.5740, lon: 39.3078 },
  'вінниця': { lat: 49.2331, lon: 28.4682 },
  'сімферополь': { lat: 44.9521, lon: 34.1024 },
  'херсон': { lat: 46.6354, lon: 32.6169 },
  'полтава': { lat: 49.5883, lon: 34.5514 },
  'чернігів': { lat: 51.4982, lon: 31.2893 },
  'черкаси': { lat: 49.4285, lon: 32.0616 },
  'суми': { lat: 50.9077, lon: 34.7981 },
  'житомир': { lat: 50.2649, lon: 28.6767 },
  'хмельницький': { lat: 49.4229, lon: 26.9871 },
  'чернівці': { lat: 48.2921, lon: 25.9358 },
  'рівне': { lat: 50.6199, lon: 26.2516 },
  'івано-франківськ': { lat: 48.9226, lon: 24.7111 },
  'тернопіль': { lat: 49.5535, lon: 25.5948 },
  'луцьк': { lat: 50.7472, lon: 25.3254 },
  'ужгород': { lat: 48.6208, lon: 22.2879 },
  'кропивницький': { lat: 48.5079, lon: 32.2623 }
};

async function fetchUkraineGeoJson() {
  const baseUrl = 'https://raw.githubusercontent.com/EugeneBorshch/ukraine_geojson/master/';
  const regionData = {};

  console.log('📥 Downloading Ukraine GeoJSON data...');

  for (const region of UKRAINE_REGIONS) {
    const fileName = `UA_${region.code}_${region.name}.geojson`;
    const url = `${baseUrl}${fileName}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`⚠️ Could not fetch ${fileName}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const coordinates = extractCenterCoordinates(data.features[0]);
        if (coordinates) {
          regionData[region.name.toLowerCase()] = coordinates;
          console.log(`✓ Loaded ${region.name}: ${coordinates.lat.toFixed(4)}, ${coordinates.lon.toFixed(4)}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error fetching ${fileName}:`, error.message);
    }
  }

  return regionData;
}

function extractCenterCoordinates(feature) {
  if (!feature.geometry) return null;

  if (feature.geometry.type === 'Point') {
    return { lat: feature.geometry.coordinates[1], lon: feature.geometry.coordinates[0] };
  }

  if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
    const coordinates = feature.geometry.type === 'Polygon' 
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0];

    let latSum = 0, lonSum = 0, count = 0;
    for (const coord of coordinates) {
      lonSum += coord[0];
      latSum += coord[1];
      count++;
    }

    return { lat: latSum / count, lon: lonSum / count };
  }

  return null;
}

export async function initGeocoding() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (existsSync(geoJsonCachePath)) {
    try {
      const cacheData = JSON.parse(readFileSync(geoJsonCachePath, 'utf-8'));
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000;

      if (cacheAge < maxAge) {
        geoJsonCache = cacheData.data;
        console.log('✓ Loaded cached GeoJSON data');
        return;
      }
    } catch (error) {
      console.warn('⚠️ Could not load GeoJSON cache:', error.message);
    }
  }

  try {
    const regionData = await fetchUkraineGeoJson();
    geoJsonCache = { ...MAJOR_CITIES, ...regionData };

    writeFileSync(
      geoJsonCachePath,
      JSON.stringify({ timestamp: new Date().toISOString(), data: geoJsonCache }, null, 2)
    );

    console.log(`✓ GeoJSON cache created with ${Object.keys(geoJsonCache).length} locations`);
  } catch (error) {
    console.error('❌ Failed to initialize geocoding:', error);
    geoJsonCache = { ...MAJOR_CITIES };
    console.log('⚠️ Using major cities only (offline mode)');
  }
}

export function getCoordinatesForLocation(locationName) {
  if (!geoJsonCache) {
    console.warn('⚠️ GeoJSON cache not initialized, using major cities only');
    return MAJOR_CITIES[locationName.toLowerCase()] || null;
  }

  const normalized = normalizeLocationName(locationName);
  return geoJsonCache[normalized] || null;
}

function normalizeLocationName(name) {
  const lower = name.toLowerCase().trim();
  
  const replacements = {
    'область': '',
    'обл.': '',
    'обл': '',
    'м.': '',
    'місто': ''
  };

  let normalized = lower;
  for (const [key, value] of Object.entries(replacements)) {
    normalized = normalized.replace(key, value);
  }

  normalized = normalized.trim();

  const variations = {
    'дніпро': 'дніпро',
    'дніпропетровськ': 'дніпро',
    'кривий ріг': 'кривий ріг',
    'кіровоград': 'кропивницький',
    'рівне': 'рівне'
  };

  return variations[normalized] || normalized;
}

export function parseLocationFromText(text) {
  const locations = [];
  const normalized = text.toLowerCase();

  for (const [name, coords] of Object.entries(geoJsonCache || MAJOR_CITIES)) {
    if (normalized.includes(name)) {
      locations.push({ name, ...coords });
    }
  }

  return locations;
}
