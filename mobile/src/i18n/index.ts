// Tamil for every English text on screen, keyed by the English (see lib/i18n). One file per part of the app;
// ta-app.ts is the app's own wording and wins over the others.
import { TA_APP } from './ta-app';
import { TA_COMMON } from './ta-common';
import { TA_LIBRARY } from './ta-library';
import { TA_PRAYER } from './ta-prayer';

export const TA: Record<string, string> = { ...TA_COMMON, ...TA_PRAYER, ...TA_LIBRARY, ...TA_APP };
