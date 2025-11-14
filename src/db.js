import Database from 'better-sqlite3';
import { config } from './config.js';

let db = null;

export function initDatabase() {
  db = new Database(config.database.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  createTables();
  console.log(`✓ Database initialized: ${config.database.path}`);
  
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS user_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      city_name TEXT NOT NULL,
      oblast_name TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS user_threat_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      threat_type TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_channel_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      title TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS channel_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      message_id BIGINT NOT NULL,
      message_date INTEGER,
      raw_text TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sent_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      locations TEXT,
      type TEXT,
      description TEXT,
      probability INTEGER,
      is_strategic INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS user_ignored_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_threat_filters_user_id ON user_threat_filters(user_id);
    CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_id ON channel_messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_sent_alerts_user_id ON sent_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_sent_alerts_sent_at ON sent_alerts(sent_at);
    CREATE INDEX IF NOT EXISTS idx_user_ignored_words_user_id ON user_ignored_words(user_id);
  `);
}

export function getOrCreateUser(telegramUserId) {
  const existing = db.prepare('SELECT * FROM users WHERE telegram_user_id = ?').get(telegramUserId);
  
  if (existing) {
    return existing;
  }
  
  const result = db.prepare('INSERT INTO users (telegram_user_id) VALUES (?)').run(telegramUserId);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

export function getUserLocations(userId) {
  return db.prepare('SELECT * FROM user_locations WHERE user_id = ? AND active = 1').all(userId);
}

export function addUserLocation(userId, label, cityName, oblastName) {
  return db.prepare(`
    INSERT INTO user_locations (user_id, label, city_name, oblast_name)
    VALUES (?, ?, ?, ?)
  `).run(userId, label, cityName, oblastName || null);
}

export function deleteUserLocation(userId, locationId) {
  return db.prepare('DELETE FROM user_locations WHERE id = ? AND user_id = ?').run(locationId, userId);
}

export function getUserThreatFilters(userId) {
  return db.prepare('SELECT * FROM user_threat_filters WHERE user_id = ? AND active = 1').all(userId);
}

export function toggleUserThreatFilter(userId, threatType) {
  const existing = db.prepare(
    'SELECT * FROM user_threat_filters WHERE user_id = ? AND threat_type = ?'
  ).get(userId, threatType);
  
  if (existing) {
    return db.prepare(
      'UPDATE user_threat_filters SET active = ? WHERE id = ?'
    ).run(existing.active === 1 ? 0 : 1, existing.id);
  } else {
    return db.prepare(
      'INSERT INTO user_threat_filters (user_id, threat_type, active) VALUES (?, ?, 1)'
    ).run(userId, threatType);
  }
}

export function getAllUsers() {
  return db.prepare('SELECT * FROM users').all();
}

export function getOrCreateChannel(telegramChannelId, username, title) {
  const existing = db.prepare('SELECT * FROM channels WHERE telegram_channel_id = ?').get(telegramChannelId);
  
  if (existing) {
    return existing;
  }
  
  const result = db.prepare(`
    INSERT INTO channels (telegram_channel_id, username, title)
    VALUES (?, ?, ?)
  `).run(telegramChannelId, username || null, title || null);
  
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(result.lastInsertRowid);
}

export function saveChannelMessage(channelId, messageId, messageDate, rawText) {
  db.prepare(`
    INSERT INTO channel_messages (channel_id, message_id, message_date, raw_text)
    VALUES (?, ?, ?, ?)
  `).run(channelId, messageId, messageDate, rawText);
  
  cleanupOldMessages(channelId);
}

function cleanupOldMessages(channelId) {
  const maxMessages = config.messageContext.maxMessagesPerChannel;
  
  db.prepare(`
    DELETE FROM channel_messages
    WHERE channel_id = ?
    AND id NOT IN (
      SELECT id FROM channel_messages
      WHERE channel_id = ?
      ORDER BY message_date DESC
      LIMIT ?
    )
  `).run(channelId, channelId, maxMessages);
}

export function getRecentMessages(channelId, limit = 20) {
  return db.prepare(`
    SELECT * FROM channel_messages
    WHERE channel_id = ?
    ORDER BY message_date DESC
    LIMIT ?
  `).all(channelId, limit).reverse();
}

export function saveSentAlert(userId, analysis, isStrategic) {
  const locations = Array.isArray(analysis.locations) ? analysis.locations.join(', ') : (analysis.locations || '');
  
  return db.prepare(`
    INSERT INTO sent_alerts (user_id, locations, type, description, probability, is_strategic)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, locations, analysis.type || '', analysis.description || '', analysis.probability || 0, isStrategic ? 1 : 0);
}

export function getUserAlerts(userId, minutesAgo) {
  const timestamp = new Date(Date.now() - minutesAgo * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  
  return db.prepare(`
    SELECT * FROM sent_alerts
    WHERE user_id = ? AND sent_at >= ?
    ORDER BY sent_at DESC
  `).all(userId, timestamp);
}

export function getUserIgnoredWords(userId) {
  return db.prepare('SELECT * FROM user_ignored_words WHERE user_id = ? ORDER BY word').all(userId);
}

export function addIgnoredWord(userId, word) {
  const normalized = word.toLowerCase().trim();
  
  if (!normalized) {
    return null;
  }
  
  const existing = db.prepare('SELECT id FROM user_ignored_words WHERE user_id = ? AND LOWER(word) = ?').get(userId, normalized);
  
  if (existing) {
    return null;
  }
  
  return db.prepare('INSERT INTO user_ignored_words (user_id, word) VALUES (?, ?)').run(userId, normalized);
}

export function deleteIgnoredWord(userId, wordId) {
  return db.prepare('DELETE FROM user_ignored_words WHERE id = ? AND user_id = ?').run(wordId, userId);
}

export function getDatabase() {
  return db;
}
