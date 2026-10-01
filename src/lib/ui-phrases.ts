import type { Locale } from "./i18n";
import { uiRussian } from "./ui-russian";
const workspaceLabels: Record<string, [string, string]> = {
  "Find a record": ["Найти запись", "Жазбаны табу"],
  "No matching records": ["Ничего не найдено", "Ештеңе табылмады"],
  "Hide tools": ["Скрыть инструменты", "Құралдарды жасыру"],
  "Show tools": ["Показать инструменты", "Құралдарды көрсету"],
  "Filters": ["Фильтры", "Сүзгілер"],
  "Connect records": ["Соединить", "Байланыстыру"],
  "From record": ["От записи", "Бастапқы жазба"],
  "To record": ["К записи", "Мақсатты жазба"],
  "Save connection": ["Сохранить связь", "Байланысты сақтау"],
  "Connection could not be saved. Please retry.": ["Не удалось сохранить связь. Попробуйте ещё раз.", "Байланыс сақталмады. Қайталап көріңіз."],
  "Related to": ["Связано с", "Байланысты"],
  "Supports": ["Подтверждает", "Растайды"],
  "Leads to": ["Приводит к", "Әкеледі"],
  "Contradicts": ["Противоречит", "Қайшы келеді"],
  "Supersedes": ["Заменяет", "Алмастырады"],
  "Evidence Trace": ["Граф связей", "Байланыстар графы"],
  "Engineering Timeline": ["Хронология", "Хронология"],
  "Timeline": ["Хронология", "Хронология"],
  "Trace graph": ["Граф связей", "Байланыстар графы"],
  "List view": ["Список записей", "Жазбалар тізімі"],
  "Relation type": ["Тип связи", "Байланыс түрі"],
  "Saving…": ["Сохранение…", "Сақталуда…"],
  "Cancel": ["Отмена", "Бас тарту"],
};
export function uiPhrase(text: string, locale: Locale): string {
  const workspace = workspaceLabels[text.trim()];
  if (workspace && locale !== "en") return workspace[locale === "kk" ? 1 : 0];
  if (locale !== "ru") return text;
  const key = text.replace(/\s+/g, " ").trim();
  const translated = uiRussian[key];
  if (translated) return `${text.match(/^\s*/)?.[0] ?? ""}${translated}${text.match(/\s*$/)?.[0] ?? ""}`;
  const counts: Array<[RegExp, string]> = [
    [/^(\d+) CAD revisions$/, "Версий моделей: $1"],
    [/^(\d+) subsystems$/, "Узлов: $1"],
    [/^(\d+) tests$/, "Испытаний: $1"],
    [/^(\d+) quantitative$/, "С измерениями: $1"],
    [/^(\d+) commits$/, "Коммитов: $1"],
    [/^(\d+) decisions$/, "Решений: $1"],
    [/^(\d+) evidence-linked$/, "Связано с материалами: $1"],
    [/^Supported by (\d+) linked CAD revisions across (\d+) subsystems?\.$/, "Версий моделей: $1; узлов: $2."],
    [/^Supported by (\d+) structured tests, (\d+) quantitative\.$/, "Испытаний: $1, с измерениями: $2."],
    [/^Supported by (\d+) commits linked to team evidence\.$/, "Коммитов, связанных с материалами: $1."],
    [/^Supported by (\d+) decisions, (\d+) linked to evidence; (\d+) iterations opened\.$/, "Решений: $1; с материалами: $2; этапов: $3."],
    [/^Supported by (\d+) student-authored notes and (\d+) photos\.$/, "Авторских заметок: $1; фотографий: $2."],
    [/^ftc portfolio v(\d+) is ready$/, "Портфолио FTC, версия $1, готово"],
    [/^Interactive 3D model: (.+)$/, "Интерактивная 3D-модель: $1"],
    [/^(\d+) records$/, "Записей: $1"],
    [/^(\d+) recent$/, "Новых: $1"],
    [/^(\d+) missing$/, "Не заполнено: $1"],
    [/^(\d+) need attention$/, "Требуют проверки: $1"],
    [/^(\d+) waiting to sync$/, "Ожидают отправки: $1"],
    [/^(\d+) decisions were recorded this week\.$/, "Решений за неделю: $1."],
    [/^(\d+) tests were recorded this week\. Open Tests to review them\.$/, "Испытаний за неделю: $1. Открой раздел, чтобы посмотреть результаты."],
    [/^Select (.+)$/, "Выбрать: $1"],
    [/^Decisions linked to evidence: (.+)$/, "Решения с материалами: $1"],
    [/^Tests with a downstream decision: (\d+) missing$/, "Испытания без решения: $1"],
    [/^(\d+) decisions without evidence$/, "Решения без материалов: $1"],
    [/^(\d+) source events still unclassified$/, "Материалы без узла: $1"],
    [/^(\d+) open decisions$/, "Открытые решения: $1"],
    [/^Policy version active: (.+)$/, "Действующая версия правил: $1"],
  ];
  for (const [pattern, replacement] of counts) if (pattern.test(key)) return key.replace(pattern, replacement);
  return text;
}
