import type { Language } from '@/lib/settings';

// Notification wording, in English and Tamil. `prayer` arrives already translated.
const EN = {
  azanTitle: (prayer: string) => `${prayer} Azan`,
  azanBody: (prayer: string, time: string) => `It's ${prayer} time (${time}).`,
  fajrBody: (time: string) => `Fajr is better than sleep. Time to wake up (${time}).`,
  dueTitle: (prayer: string) => `Time for ${prayer} Namaz`,
  jamaatBody: (prayer: string, time: string) => `${prayer} Jamaat is starting now (${time}).`,
  quranTitle: 'Time to read the Quran',
  quranBody: 'A few ayahs tonight? Every letter carries a reward.',
  wakeTitle: (minutes: number) => `Fajr in ${minutes} minutes`,
  wakeBody: 'Wake up and make wudu. Tap here when you are up.',
  noteTitle: "Today's reminder 🤍",
};

const TA: typeof EN = {
  azanTitle: (prayer) => `${prayer} பாங்கு`,
  azanBody: (prayer, time) => `${prayer} நேரம் வந்துவிட்டது (${time}).`,
  fajrBody: (time) => `தூக்கத்தை விடத் தொழுகை மேலானது. எழுந்திருங்கள் (${time}).`,
  dueTitle: (prayer) => `${prayer} தொழுகை நேரம்`,
  jamaatBody: (prayer, time) => `${prayer} ஜமாஅத் இப்போது தொடங்குகிறது (${time}).`,
  quranTitle: 'குர்ஆன் ஓதும் நேரம்',
  quranBody: 'இன்றிரவு சில ஆயத்துகள் ஓதலாமா? ஒவ்வொரு எழுத்துக்கும் நன்மை உண்டு.',
  wakeTitle: (minutes) => `ஃபஜ்ர் இன்னும் ${minutes} நிமிடங்களில்`,
  wakeBody: 'எழுந்து உளூ செய்யுங்கள். எழுந்ததும் இங்கே தட்டுங்கள்.',
  noteTitle: 'இன்றைய நினைவூட்டல் 🤍',
};

export function notifyFor(language: Language) {
  return language === 'ta' ? TA : EN;
}
