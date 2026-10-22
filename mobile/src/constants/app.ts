import appJson from '../../app.json';

/**
 * Where the web app sends people to install the Android app. Will become a GitHub Releases "latest" link like
 * https://github.com/<owner>/<repo>/releases/latest/download/DeenAcademy.apk — while it is '' the download UI is hidden.
 */
export const ANDROID_APK_URL = 'https://github.com/shikkandar/deen-academy/releases/latest/download/DeenAcademy.apk';

/** Shown next to the download button. */
export const ANDROID_APP_VERSION: string = appJson.expo.version;
