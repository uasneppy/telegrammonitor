export function parseThreatAnalysis(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 6) {
    console.warn('⚠️ Gemini response has fewer than 6 lines, parsing may be incomplete');
  }
  
  const analysis = {
    threat: false,
    type: 'невідомо',
    locations: [],
    description: '',
    time: 'невідомо',
    probability: 0,
    rawText: rawText,
  };
  
  for (const line of lines) {
    if (line.startsWith('Загроза:')) {
      const value = line.substring('Загроза:'.length).trim().toLowerCase();
      analysis.threat = value === 'так' || value === 'yes';
    } else if (line.startsWith('Тип:')) {
      analysis.type = line.substring('Тип:'.length).trim();
    } else if (line.startsWith('Локації:') || line.startsWith('Локація:')) {
      const locStr = line.substring(line.indexOf(':') + 1).trim();
      if (locStr && locStr !== 'невідомо') {
        analysis.locations = locStr.split(',').map(l => l.trim()).filter(l => l.length > 0);
      }
    } else if (line.startsWith('Опис:')) {
      analysis.description = line.substring('Опис:'.length).trim();
    } else if (line.startsWith('Час:')) {
      analysis.time = line.substring('Час:'.length).trim();
    } else if (line.startsWith('Ймовірність:')) {
      const probStr = line.substring('Ймовірність:'.length).trim();
      const match = probStr.match(/\d+/);
      if (match) {
        analysis.probability = parseInt(match[0]);
      }
    }
  }
  
  return analysis;
}

const STRATEGIC_KEYWORDS = [
  'стратегічна авіація',
  'стратегічн',
  'шахед',
  'крилат',
  'міг-31',
  'кинджал',
  'калібр',
  'флот',
  'ту-95',
  'ту-160',
  'х-101',
  'х-555',
];

export function isStrategicThreat(analysis) {
  const combinedText = `${analysis.type} ${analysis.description}`.toLowerCase();
  
  return STRATEGIC_KEYWORDS.some(keyword => combinedText.includes(keyword));
}
