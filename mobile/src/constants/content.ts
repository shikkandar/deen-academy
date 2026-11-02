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
      en: 'It was made by Shikkandar, from the Gandhigramam Masjid mahalla in Karur, as a small bridge between this dunya and the Jannah we all hope for.',
      ta: 'கரூர் காந்திகிராமம் மஸ்ஜித் மஹல்லாவைச் சேர்ந்த ஷிக்கந்தர் இதை உருவாக்கினார். இந்த துன்யாவுக்கும், நாம் அனைவரும் ஆசைப்படும் சுவனத்துக்கும் இடையே ஒரு சிறிய பாலமாக.',
    },
    {
      en: 'It will remind you before every Azan, wake you for Fajr, and keep the Quran, the duas and the words of the Prophet ﷺ close to you, wherever you are.',
      ta: 'ஒவ்வொரு பாங்குக்கும் முன் நினைவூட்டும், ஃபஜ்ருக்கு எழுப்பும், குர்ஆன், துஆக்கள், நபி ﷺ அவர்களின் வார்த்தைகளை நீங்கள் எங்கிருந்தாலும் அருகில் வைத்திருக்கும்.',
    },
    {
      en: 'It is free for everyone. If it helps you even a little, please remember me in your duas.',
      ta: 'இது அனைவருக்கும் இலவசம். இது உங்களுக்குச் சிறிதளவாவது பயன்பட்டால், உங்கள் துஆக்களில் என்னையும் நினைவுகூருங்கள்.',
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
  signoff: { en: 'Shikkandar · Gandhigramam Masjid, Karur', ta: 'ஷிக்கந்தர் · காந்திகிராமம் மஸ்ஜித், கரூர்' } as Text,
};

export const pick = (text: Text, language: Language) => text[language] ?? text.en;

/** One reminder a day (picked by date, so a new one every morning). Edit them in assets/data/daily-reminders.json. */
export const DAILY_REMINDERS: Text[] = reminders;

export function reminderForToday(language: Language, now = new Date()) {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  return pick(DAILY_REMINDERS[day % DAILY_REMINDERS.length], language);
}
