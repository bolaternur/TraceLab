type Locale = 'ru' | 'en' | 'kk';
const months = {
  ru: ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
};

// Account deadlines must render identically during SSR and hydration, including
// embedded browsers whose Kazakh ICU falls back to "M10" month placeholders.
export function formatAccountDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getUTCDate(), month = months[locale][date.getUTCMonth()], year = date.getUTCFullYear();
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`;
  if (locale === 'en') return `${month} ${day}, ${year}, ${time}`;
  return `${day} ${month} ${year} ${locale === 'kk' ? 'ж.' : 'г.'}, ${time}`;
}
