import { useLanguage } from '@/i18n/LanguageContext';
import type { Locale } from '@/i18n/translations';

const flags: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'en': '🇺🇸',
  'pl': '🇵🇱',
  'de': '🇩🇪',
};

const labels: Record<Locale, string> = {
  'pt-BR': 'PT',
  'en': 'EN',
  'pl': 'PL',
  'de': 'DE',
};

export const LanguageSwitcher = () => {
  const { locale, setLocale } = useLanguage();
  const locales: Locale[] = ['pt-BR', 'en', 'pl', 'de'];

  return (
    <div className="flex items-center gap-1">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            locale === l
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {flags[l]} {labels[l]}
        </button>
      ))}
    </div>
  );
};
