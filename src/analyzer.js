export function parseThreatAnalysis(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 7) {
    console.warn('⚠️ Gemini response has fewer than 7 lines, parsing may be incomplete');
  }
  
  const analysis = {
    threat: false,
    type: 'невідомо',
    locations: [],
    description: '',
    time: 'невідомо',
    probability: 0,
    strategic: 'невідомо',
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
    } else if (line.startsWith('Стратегічна:')) {
      const value = line.substring('Стратегічна:'.length).trim().toLowerCase();
      
      if (value.includes('так') || value.includes('yes')) {
        analysis.strategic = 'так';
      } else if (value.includes('ні') || value.includes('no')) {
        analysis.strategic = 'ні';
      } else if (value.includes('невідомо') || value.includes('unknown')) {
        analysis.strategic = 'невідомо';
      } else if (value === '') {
        console.warn('⚠️ Empty strategic field from AI');
        analysis.strategic = 'невідомо';
      } else {
        console.warn(`⚠️ Unexpected strategic value from AI: "${value}"`);
        analysis.strategic = 'невідомо';
      }
    }
  }
  
  if (!lines.some(line => line.startsWith('Стратегічна:'))) {
    console.warn('⚠️ AI response missing "Стратегічна:" line - strategic field will default to невідомо');
  }
  
  return analysis;
}

const STRATEGIC_KEYWORDS = [
  'стратегічна авіація',
  'стратегічн',
  'шахед',
  'шахід',
  'крилат',
  'міг-31',
  'міг-к',
  'mig-31',
  'кинджал',
  'кінджал',
  'калібр',
  'калібрів',
  'флот',
  'ту-95',
  'ту-160',
  'tu-95',
  'tu-160',
  'х-101',
  'х-555',
  'x-101',
  'x-555',
  'балістика',
  'балістичн',
  'отрк',
  'іскандер',
  'ракетоносі',
  'ракетоносці',
  'брянськ',
  'курськ',
  'вороніж',
  'масовий пуск',
  'масових пуск',
];

export function isStrategicThreat(analysis) {
  if (analysis.strategic === 'так') {
    return true;
  }
  
  if (analysis.strategic === 'ні') {
    return false;
  }
  
  if (analysis.strategic === 'невідомо') {
    console.warn('⚠️ AI could not determine if threat is strategic, using keyword fallback');
    const combinedText = `${analysis.type} ${analysis.description}`.toLowerCase();
    return STRATEGIC_KEYWORDS.some(keyword => combinedText.includes(keyword));
  }
  
  console.warn(`⚠️ Unexpected strategic value: "${analysis.strategic}", using keyword fallback`);
  const combinedText = `${analysis.type} ${analysis.description}`.toLowerCase();
  return STRATEGIC_KEYWORDS.some(keyword => combinedText.includes(keyword));
}
