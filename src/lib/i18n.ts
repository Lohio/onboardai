export type Lang = 'es' | 'en' | 'fr' | 'pt'

export const LANG_LABELS: Record<Lang, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
}

export const LANG_FLAGS: Record<Lang, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  fr: '🇫🇷',
  pt: '🇧🇷',
}

export const LANGS: Lang[] = ['es', 'en', 'fr', 'pt']

export type TranslationMap = Record<string, string>

// Los diccionarios viven en ./i18n/{es,en,fr,pt}.ts (un archivo por idioma).
// LanguageProvider importa `es` estáticamente y el resto con import() dinámico,
// así al cliente solo viaja el idioma activo.
