import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

let genAI = null;
let model = null;

export function initGemini() {
  genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('✓ Gemini client initialized');
}

export async function analyzeThreat({ channelName, recentMessages, newMessageText }) {
  if (!model) {
    throw new Error('Gemini client not initialized');
  }
  
  const prompt = buildPrompt(channelName, recentMessages, newMessageText);
  
  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    return text.trim();
  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    throw error;
  }
}

function buildPrompt(channelName, recentMessages, newMessageText) {
  const systemPrompt = `Ти – український аналітик реальних загроз.
Відповідай лише у форматі шести рядків (ніякого JSON):
Загроза: так/ні
Тип: <тип загрози або "невідомо">
Локації: <перелік регіонів/міст через кому або "невідомо">
Опис: <1–2 нейтральні речення з підсумком>
Час: <час/дата з повідомлення або "невідомо">
Ймовірність: <число 0–100 із знаком %>

Правила:

Якщо немає реальної або потенційної загрози, напиши "Загроза: ні".

Якщо є повідомлення по типу «чисто», «дорозвідка» – повідомляй.

Не додавай даних, яких немає в повідомленні, та не вигадуй від себе.

Якщо локація незрозуміла, вкажи "невідомо".

Якщо тип загрози незрозумілий, вкажи "невідомо".

Не копіюй оригінальний текст, лише роби аналітичний підсумок.

Якщо повідомляється про активність на бойових частотах стратегічної авіації, зліт стратегічної авіації, пуски «шахедів», пуски крилатих ракет будь-якого типу, зліт МІГ-31К, пуск «Кинджала», вихід флоту в море – попередження надається незалежно від локації. Будь-що, що може дістати будь-де – вважай загрозою.

Всі канали можуть говорити про одну й ту саму загрозу. Аналізуй кожне повідомлення, але не перебільшуй важливість, якщо загроза вже описана раніше.

Ігноруй повідомлення-звіти, де вказуються постраждалі, жертви, влучання, кількість застосованого ворогом озброєння за день чи ніч тощо.

Опис має бути спокійним, без паніки та оціночних суджень.`;

  let contextMessages = '';
  if (recentMessages && recentMessages.length > 0) {
    contextMessages = 'Попередні повідомлення каналу (від старих до нових):\n\n';
    for (const msg of recentMessages) {
      const date = msg.message_date ? new Date(msg.message_date * 1000).toISOString().slice(0, 16).replace('T', ' ') : 'невідома дата';
      contextMessages += `[${date}] ${msg.raw_text}\n\n`;
    }
  }
  
  const fullPrompt = `${systemPrompt}

${contextMessages}

Нове повідомлення з каналу "${channelName}", яке треба проаналізувати:

${newMessageText}

Відповідай строго в форматі 6 рядків як вказано вище.`;

  return fullPrompt;
}
