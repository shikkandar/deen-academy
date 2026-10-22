import reminders from '@/assets/data/daily-reminders.json';
import type { Language } from '@/lib/settings';

// The welcome note (first open, and from Settings) and the daily reminders, in English and Tamil.

type Text = { en: string; ta: string };

export const WELCOME = {
  title: { en: 'Assalamu alaikum', ta: 'அஸ்ஸலாமு அலைக்கும்' } as Text,
  paragraphs: [
    {
      en: 'Welcome to Deen Academy, a quiet companion for your salah.',
      ta: 'Deen Academy-க்கு வரவேற்கிறோம். உங்கள் தொழுகைக்கு ஒரு அமைதியான துணை.',
    },
    {
      en: 'It will remind you before every Azan, wake you for Fajr, and keep the Quran, the duas and the words of the Prophet ﷺ close to you, wherever you are.',
      ta: 'ஒவ்வொரு பாங்குக்கும் முன் நினைவூட்டும், ஃபஜ்ருக்கு எழுப்பும், குர்ஆன், துஆக்கள், நபி ﷺ அவர்களின் வார்த்தைகளை நீங்கள் எங்கிருந்தாலும் அருகில் வைத்திருக்கும்.',
    },
    {
      en: 'Every day it will show you one reminder from the Quran and the Sunnah. Read it, reflect on it, and carry it into your day.',
      ta: 'ஒவ்வொரு நாளும் குர்ஆன், சுன்னாவிலிருந்து ஒரு நினைவூட்டல் காட்டும். படியுங்கள், சிந்தியுங்கள், அதை உங்கள் நாளில் எடுத்துச் செல்லுங்கள்.',
    },
    {
      en: 'May Allah accept your prayers and make every step a step towards Jannah.',
      ta: 'அல்லாஹ் உங்கள் தொழுகைகளை ஏற்று, ஒவ்வொரு அடியையும் சுவனத்தை நோக்கிய அடியாக ஆக்குவானாக.',
    },
  ] as Text[],
  dua: {
    arabic: 'رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةًۭ وَفِى ٱلْءَاخِرَةِ حَسَنَةًۭ وَقِنَا عَذَابَ ٱلنَّارِ', // AlQuran Cloud, Uthmani
    meaning: {
      en: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire. (Al-Baqarah 2:201)',
      ta: 'எங்கள் இறைவா, எங்களுக்கு இம்மையிலும் நன்மையைத் தா, மறுமையிலும் நன்மையைத் தா, நரக வேதனையிலிருந்து எங்களைக் காப்பாற்று. (அல்-பகரா 2:201)',
    } as Text,
  },
  signoff: { en: 'Deen Academy', ta: 'Deen Academy' } as Text,
};

export const pick = (text: Text, language: Language) => text[language] ?? text.en;

/** One reminder a day (picked by date, so a new one every morning). Edit them in assets/data/daily-reminders.json. */
export const DAILY_REMINDERS: Text[] = reminders;

export function reminderForToday(language: Language, now = new Date()) {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  return pick(DAILY_REMINDERS[day % DAILY_REMINDERS.length], language);
}
