import appJson from '../../app.json';

/**
 * Where the web app sends people to install the Android app. Will become a GitHub Releases "latest" link like
 * https://github.com/<owner>/<repo>/releases/latest/download/DeenAcademy.apk — while it is '' the download UI is hidden.
 */
export const ANDROID_APK_URL = 'https://github.com/shikkandar/deen-academy/releases/latest/download/DeenAcademy.apk';

/** Shown next to the download button. */
export const ANDROID_APP_VERSION: string = appJson.expo.version;

/**
 * Where the native app downloads the books (hadith, Muntakhab Ahadith, Hayatus Sahaba, Quran word timings) from:
 * the web app's own /data on Netlify. Each page or chapter is fetched the first time it is opened and kept on the
 * phone, so it opens offline after that. The web app fetches the same files from its own site.
 */
export const DATA_URL = 'https://deen-academy-360.netlify.app';
