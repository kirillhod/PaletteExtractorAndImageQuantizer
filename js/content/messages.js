// @ts-check
/**
 * UI message catalog. Keys are flat and shared by the static HTML (`data-i18n*`) and
 * the dynamic UI. Documentation files are not translated.
 *
 * `count.*` keys are pluralized with Intl.PluralRules. `unit.*` keys are noun-only
 * labels used next to a separate numeric value in the status bar.
 *
 * Locale tables live in `messages.en.js` and `messages.ru.js` so a task reads only
 * the language it changes.
 */
import { EN_MESSAGES } from './messages.en.js';
import { RU_MESSAGES } from './messages.ru.js';

/** @type {Record<'en'|'ru', Record<string, string>>} */
export const MESSAGES = { en: EN_MESSAGES, ru: RU_MESSAGES };
