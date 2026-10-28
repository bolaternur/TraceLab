/** Interface copy only: record titles, bodies, author labels and units stay as authored. */
const entries = {
  'record.source': ['Материал', 'Source', 'Материал'],
  'record.iteration': ['Итерация', 'Iteration', 'Итерация'],
  'record.test': ['Испытание', 'Test', 'Сынақ'],
  'record.decision': ['Решение', 'Decision', 'Шешім'],
  'record.generic': ['Запись', 'Record', 'Жазба'],
  'common.untitled': ['Без названия', 'Untitled', 'Атаусыз'],
  'common.unavailable': ['Не указано', 'Not provided', 'Көрсетілмеген'],
  'common.dateMissing': ['Дата не указана', 'Date not provided', 'Күні көрсетілмеген'],
  'common.authorMissing': ['Автор не указан', 'Author not provided', 'Автор көрсетілмеген'],
  'common.unitMissing': ['Единица не указана', 'Unit not provided', 'Өлшем бірлігі көрсетілмеген'],
  'common.table': ['Показать данные таблицей', 'Show data as a table', 'Деректерді кестемен көрсету'],
  'common.fit': ['Вписать', 'Fit view', 'Сыйдыру'],
  'common.zoomIn': ['Увеличить масштаб', 'Zoom in', 'Үлкейту'],
  'common.zoomOut': ['Уменьшить масштаб', 'Zoom out', 'Кішірейту'],
  'common.zoomReset': ['Масштаб 100 процентов', 'Reset zoom to 100 percent', 'Масштабты 100 пайызға қайтару'],
  'relation.generic': ['Связь', 'Connection', 'Байланыс'],
  'relation.accepted': ['Подтверждённая связь', 'Confirmed connection', 'Расталған байланыс'],
  'relation.suggested': ['Предложено, не подтверждено', 'Suggested, not confirmed', 'Ұсынылған, расталмаған'],
  'relation.noneOutgoing': ['Нет исходящих связей', 'No outgoing connections', 'Шығыс байланыстары жоқ'],
  'relation.to': ['К {title} · {label}', 'To {title} · {label}', '{title} жазбасына · {label}'],
  'relation.remove': ['Удалить связь', 'Remove connection', 'Байланысты жою'],
  'relation.close': ['Закрыть сведения о связи', 'Close connection details', 'Байланыс мәліметтерін жабу'],
  'graph.emptyTitle': ['Граф начинается с первого материала', 'The graph starts with your first record', 'Граф алғашқы материалдан басталады'],
  'graph.emptyText': ['Добавьте материал, итерацию, испытание или решение, затем свяжите их.', 'Add a source, iteration, test, or decision, then connect the records.', 'Материал, итерация, сынақ немесе шешім қосып, оларды байланыстырыңыз.'],
  'graph.noMatches': ['Нет подходящих записей', 'No matching records', 'Сәйкес жазбалар жоқ'],
  'graph.changeFilters': ['Измените запрос или выберите все типы записей.', 'Change your search or select all record types.', 'Іздеу сұрауын өзгертіңіз немесе барлық жазба түрлерін таңдаңыз.'],
  'graph.region': ['Граф связей. Прокручивайте область для перемещения. Выберите запись для подробностей.', 'Connection graph. Scroll to move around. Select a record for details.', 'Байланыстар графы. Жылжу үшін аймақты айналдырыңыз. Мәліметтерді көру үшін жазбаны таңдаңыз.'],
  'graph.counts': ['Записи: {records} · Связи: {links}', 'Records: {records} · Connections: {links}', 'Жазбалар: {records} · Байланыстар: {links}'],
  'graph.title': ['Связи проекта «{name}»', 'Connections in “{name}”', '«{name}» жобасының байланыстары'],
  'graph.help': ['Выберите запись, чтобы выделить её связи. Масштаб меняется кнопками; область графа можно прокручивать.', 'Select a record to highlight its connections. Use the buttons to zoom and scroll to move around the graph.', 'Байланыстарын ерекшелеу үшін жазбаны таңдаңыз. Батырмалармен масштабты өзгертіп, граф аймағын айналдырыңыз.'],
  'graph.listCount': ['Записи и связи списком · {count}', 'Records and connections as a list · {count}', 'Жазбалар мен байланыстар тізімі · {count}'],
  'tests.emptyTitle': ['Пока нет испытаний', 'No tests yet', 'Әзірге сынақтар жоқ'],
  'tests.emptyText': ['Добавьте испытание: запишите условия, критерий и числовой результат или наблюдение.', 'Add a test with its conditions, criterion, and a measured result or observation.', 'Сынақ қосыңыз: жағдайларын, критерийін және сандық нәтижесін немесе бақылауды жазыңыз.'],
  'tests.educational': ['Учебные измерения: показывают сравнение версий и не являются результатами пилотного исследования.', 'Educational measurements show a version comparison. They are not pilot study findings.', 'Оқу өлшемдері нұсқаларды салыстыруды көрсетеді. Олар пилоттық зерттеу нәтижелері емес.'],
  'tests.context': ['Результаты взяты из записей испытаний. Доли показаны только для записей с количеством попыток. Сравнивайте одинаковые условия, единицы и критерии.', 'Results come from test records. Ratios are shown only where attempt counts are recorded. Compare matching conditions, units, and criteria.', 'Нәтижелер сынақ жазбаларынан алынған. Үлес әрекет саны көрсетілген жазбалар үшін ғана беріледі. Бірдей жағдайларды, өлшем бірліктерін және критерийлерді салыстырыңыз.'],
  'tests.open': ['{title}. Успешных попыток: {successes} из {trials}. Открыть испытание.', '{title}. Successful attempts: {successes} out of {trials}. Open test.', '{title}. Сәтті әрекеттер: {trials} әрекеттің {successes}-і. Сынақты ашу.'],
  'tests.ratio': ['{successes} / {trials}', '{successes} / {trials}', '{successes} / {trials}'],
  'tests.successRatio': ['Успешные попытки · {percent}', 'Successful attempts · {percent}', 'Сәтті әрекеттер · {percent}'],
  'tests.attempt': ['попытка', 'attempt', 'әрекет'],
  'tests.attempts': ['попыток', 'attempts', 'әрекет'],
  'tests.unit': ['Единица: {unit}', 'Unit: {unit}', 'Өлшем бірлігі: {unit}'],
  'tests.conditions': ['Условия: {conditions}', 'Conditions: {conditions}', 'Жағдайлар: {conditions}'],
  'tests.criterion': ['Критерий: {criterion}', 'Criterion: {criterion}', 'Критерий: {criterion}'],
  'tests.successHeader': ['Успех / попытки', 'Successes / attempts', 'Сәтті / барлық әрекеттер'],
  'tests.ratioHeader': ['Доля', 'Ratio', 'Үлес'],
  'tests.unitHeader': ['Единица', 'Unit', 'Өлшем бірлігі'],
  'tests.contextHeader': ['Условия и критерий', 'Conditions and criterion', 'Жағдайлар мен критерий'],
  'tests.conditionsHeader': ['Условия', 'Conditions', 'Жағдайлар'],
  'tests.criterionHeader': ['Критерий', 'Criterion', 'Критерий'],
  'tests.valueHeader': ['Значение', 'Value', 'Мәні'],
  'tests.tableCaption': ['Исходные измерения испытаний. Доля рассчитана как успешные попытки / все попытки.', 'Original test measurements. The ratio is successful attempts divided by all attempts.', 'Сынақтың бастапқы өлшемдері. Үлес сәтті әрекеттер санын барлық әрекеттер санына бөлу арқылы есептеледі.'],
  'tests.measurementsCaption': ['Отдельные измерения. Значения с разными единицами не объединяются. Выберите испытание для подробностей.', 'Individual measurements. Values with different units are not combined. Select a test for details.', 'Жеке өлшемдер. Өлшем бірліктері әртүрлі мәндер біріктірілмейді. Мәліметтер үшін сынақты таңдаңыз.'],
  'tests.qualitativeTitle': ['Наблюдения без числового результата', 'Observations without a numeric result', 'Сандық нәтижесі жоқ бақылаулар'],
  'tests.qualitativeEmpty': ['Результат ещё не записан.', 'The result has not been recorded yet.', 'Нәтиже әлі жазылмаған.'],
  'study.emptyTitle': ['Измерения исследования ещё не добавлены', 'No research measurements yet', 'Зерттеу өлшемдері әлі қосылмаған'],
  'study.emptyText': ['Добавьте или импортируйте две длительности одной задачи: без TraceLab и с TraceLab, в секундах. Используйте обезличенные коды участников.', 'Add or import two durations for the same task: without and with TraceLab, in seconds. Use anonymous participant codes.', 'Бір тапсырманың екі ұзақтығын қосыңыз немесе импорттаңыз: TraceLab-сыз және TraceLab-пен, секундпен. Қатысушылардың жасырын кодтарын пайдаланыңыз.'],
  'study.educational': ['Это учебные данные. Для исследования используйте отдельный проект с реальными обезличенными измерениями.', 'These are educational data. Use a separate project with real, anonymized measurements for research.', 'Бұл — оқу деректері. Зерттеу үшін нақты, иесіздендірілген өлшемдері бар жеке жобаны пайдаланыңыз.'],
  'study.context': ['Линия соединяет два результата одной задачи для одного участника. Меньшее время означает более быстрое выполнение, но само по себе не подтверждает качество решения.', 'Each line joins two results for the same task and participant. Less time means faster completion, but does not by itself establish the quality of a solution.', 'Сызық бір қатысушының бір тапсырма бойынша екі нәтижесін қосады. Аз уақыт жылдамырақ орындауды білдіреді, бірақ шешімнің сапасын өздігінен растамайды.'],
  'study.baseline': ['Без TraceLab', 'Without TraceLab', 'TraceLab-сыз'],
  'study.trace': ['С TraceLab', 'With TraceLab', 'TraceLab-пен'],
  'study.chartLabel': ['Время выполнения в секундах. Участники: {count}. Полные значения доступны в таблице.', 'Completion time in seconds. Participants: {count}. Full values are available in the table.', 'Орындау уақыты секундпен. Қатысушылар: {count}. Толық мәндер кестеде берілген.'],
  'study.chartTitle': ['Сравнение времени без TraceLab и с TraceLab', 'Time comparison without and with TraceLab', 'TraceLab-сыз және TraceLab-пен жұмсалған уақытты салыстыру'],
  'study.participant': ['Участник {count}', 'Participant {count}', 'Қатысушы {count}'],
  'study.pair': ['{code}: без TraceLab — {baseline} с; с TraceLab — {trace} с', '{code}: without TraceLab — {baseline} s; with TraceLab — {trace} s', '{code}: TraceLab-сыз — {baseline} с; TraceLab-пен — {trace} с'],
  'study.axis': ['Время выполнения, секунды', 'Completion time, seconds', 'Орындау уақыты, секунд'],
  'study.participantHeader': ['Код участника', 'Participant code', 'Қатысушы коды'],
  'study.baselineHeader': ['Без TraceLab, с', 'Without TraceLab, s', 'TraceLab-сыз, с'],
  'study.traceHeader': ['С TraceLab, с', 'With TraceLab, s', 'TraceLab-пен, с'],
  'study.differenceHeader': ['Разница, с', 'Difference, s', 'Айырмасы, с'],
  'study.tableCaption': ['Исходные парные измерения. Разница = с TraceLab − без TraceLab. Отрицательная разница означает меньшее время.', 'Original paired measurements. Difference = with TraceLab − without TraceLab. A negative difference means less time.', 'Бастапқы жұп өлшемдер. Айырмасы = TraceLab-пен − TraceLab-сыз. Теріс айырма аз уақыт жұмсалғанын білдіреді.'],
  'study.skipped': ['Строки с отсутствующими или некорректными длительностями не показаны: {count}.', 'Rows with missing or invalid durations not shown: {count}.', 'Ұзақтығы жоқ немесе қате жолдар көрсетілмеді: {count}.'],
  'timeline.emptyTitle': ['История проекта пока пуста', 'Your project history is empty', 'Жобаның тарихы әзірге бос'],
  'timeline.emptyText': ['Добавьте первый материал. Итерации, испытания и решения появятся здесь по времени.', 'Add your first source. Iterations, tests, and decisions will appear here in time order.', 'Алғашқы материалды қосыңыз. Итерациялар, сынақтар мен шешімдер мұнда уақыт ретімен көрсетіледі.'],
  'timeline.noMatches': ['В этой выборке нет событий', 'No events match these filters', 'Бұл сүзгілерге сәйкес оқиғалар жоқ'],
  'timeline.today': ['Сегодня', 'Today', 'Бүгін'],
  'timeline.yesterday': ['Вчера', 'Yesterday', 'Кеше'],
  'canvas.region': ['Рабочий холст проекта. Записи можно перемещать, связывать и открывать.', 'Project canvas. Move, connect, and open records.', 'Жобаның жұмыс аймағы. Жазбаларды жылжытып, байланыстырып, ашуға болады.'],
  'canvas.connections': ['Связи записей', 'Record connections', 'Жазбалардың байланыстары'],
  'canvas.title': ['Холст проекта', 'Project canvas', 'Жобаның жұмыс аймағы'],
  'canvas.hint': ['Двигайте записи и соединяйте порты. Колесо — перемещение, Ctrl + колесо — масштаб.', 'Move records and connect ports. Scroll to pan; Ctrl + scroll to zoom.', 'Жазбаларды жылжытып, порттарды қосыңыз. Дөңгелек — жылжу, Ctrl + дөңгелек — масштаб.'],
  'canvas.controls': ['Управление холстом', 'Canvas controls', 'Жұмыс аймағын басқару'],
  'canvas.fit': ['Вписать все видимые записи · F', 'Fit all visible records · F', 'Барлық көрінетін жазбаларды сыйдыру · F'],
  'canvas.unlock': ['Разрешить перемещение записей', 'Allow records to move', 'Жазбаларды жылжытуға рұқсат беру'],
  'canvas.lock': ['Закрепить позиции записей', 'Lock record positions', 'Жазбалардың орнын бекіту'],
  'canvas.locked': ['Позиции закреплены. Холст можно двигать и масштабировать.', 'Positions are locked. You can still pan and zoom the canvas.', 'Орындар бекітілді. Жұмыс аймағын жылжытып, масштабын өзгертуге болады.'],
  'canvas.unlocked': ['Записи снова можно перемещать.', 'Records can move again.', 'Жазбаларды қайта жылжытуға болады.'],
  'canvas.layout': ['Разложить записи по типам', 'Arrange records by type', 'Жазбаларды түрі бойынша орналастыру'],
  'canvas.openList': ['Открыть записи и связи списком', 'Open records and connections as a list', 'Жазбалар мен байланыстар тізімін ашу'],
  'canvas.toggleMap': ['Показать или скрыть мини-карту', 'Show or hide the minimap', 'Шағын картаны көрсету немесе жасыру'],
  'canvas.openHelp': ['Открыть помощь по холсту', 'Open canvas help', 'Жұмыс аймағы туралы анықтаманы ашу'],
  'canvas.list': ['Записи и связи', 'Records and connections', 'Жазбалар мен байланыстар'],
  'canvas.closeList': ['Закрыть список', 'Close list', 'Тізімді жабу'],
  'canvas.help': ['Работа с холстом', 'Using the canvas', 'Жұмыс аймағын пайдалану'],
  'canvas.closeHelp': ['Закрыть помощь', 'Close help', 'Анықтаманы жабу'],
  'canvas.moveHelp': ['Перетащите карточку записи или пустой холст. Колесо перемещает холст, Ctrl или Cmd с колесом меняет масштаб у курсора. На сенсорном экране используйте два пальца для масштабирования.', 'Drag a record card or the empty canvas. Scroll to pan; hold Ctrl or Cmd while scrolling to zoom at the pointer. Use two fingers to zoom on a touch screen.', 'Жазба карточкасын немесе бос жұмыс аймағын сүйреңіз. Дөңгелекпен жылжыңыз; Ctrl немесе Cmd пернесін ұстап, курсор тұсында масштабты өзгертіңіз. Сенсорлық экранда екі саусақпен масштабтаңыз.'],
  'canvas.connectHelp': ['Потяните правый порт к левому порту другой записи. С клавиатуры можно выбрать правый порт, затем нужную запись. На следующем шаге укажите смысл связи.', 'Drag the right port to another record’s left port. With a keyboard, select the right port, then the target record. Describe the connection in the next step.', 'Оң портты басқа жазбаның сол портына сүйреңіз. Пернетақтамен оң портты, содан кейін қажетті жазбаны таңдауға болады. Келесі қадамда байланыстың мағынасын көрсетіңіз.'],
  'canvas.arrows': ['Стрелки', 'Arrow keys', 'Бағыттау пернелері'],
  'canvas.shiftArrows': ['Shift + стрелки', 'Shift + arrow keys', 'Shift + бағыттау пернелері'],
  'canvas.space': ['Пробел', 'Space', 'Бос орын'],
  'canvas.move10': ['Переместить выбранную запись на 10 единиц', 'Move the selected record by 10 units', 'Таңдалған жазбаны 10 бірлікке жылжыту'],
  'canvas.move50': ['Переместить на 50 единиц', 'Move by 50 units', '50 бірлікке жылжыту'],
  'canvas.openRecord': ['Открыть запись', 'Open record', 'Жазбаны ашу'],
  'canvas.pan': ['Перемещать холст вместо записей', 'Pan the canvas instead of moving records', 'Жазбалардың орнына жұмыс аймағын жылжыту'],
  'canvas.cancel': ['Отменить связь или закрыть список', 'Cancel the connection or close the list', 'Байланыстан бас тарту немесе тізімді жабу'],
  'canvas.minimap': ['Мини-карта проекта', 'Project minimap', 'Жобаның шағын картасы'],
  'canvas.overview': ['Обзор', 'Overview', 'Шолу'],
  'canvas.recordRole': ['Запись графа', 'Graph record', 'Граф жазбасы'],
  'canvas.recordLabel': ['{type}: {title}. Enter — открыть, стрелки — переместить.', '{type}: {title}. Enter to open; arrow keys to move.', '{type}: {title}. Enter — ашу, бағыттау пернелері — жылжыту.'],
  'canvas.testResult': ['Успешные попытки: {successes} / {trials}', 'Successful attempts: {successes} / {trials}', 'Сәтті әрекеттер: {successes} / {trials}'],
  'canvas.whySaved': ['Объяснение сохранено', 'Explanation recorded', 'Түсіндірме сақталған'],
  'canvas.whyMissing': ['Нет объяснения', 'No explanation', 'Түсіндірме жоқ'],
  'canvas.fromPort': ['Создать связь от записи «{title}»', 'Create a connection from “{title}”', '«{title}» жазбасынан байланыс жасау'],
  'canvas.toPort': ['Связать с записью «{title}»', 'Connect to “{title}”', '«{title}» жазбасымен байланыстыру'],
  'canvas.chooseSource': ['Сначала выберите правый порт исходной записи.', 'First select the starting record’s right port.', 'Алдымен бастапқы жазбаның оң портын таңдаңыз.'],
  'canvas.lockedHint': ['Позиции закреплены. Нажмите замок, чтобы перемещать записи.', 'Positions are locked. Select the lock button to move records.', 'Орындар бекітілген. Жазбаларды жылжыту үшін құлып батырмасын басыңыз.'],
  'canvas.startConnection': ['Связь от «{title}». Выберите другую запись или её левый порт. Esc — отменить.', 'Connection from “{title}”. Choose another record or its left port. Esc to cancel.', '«{title}» жазбасынан байланыс. Басқа жазбаны немесе оның сол портын таңдаңыз. Esc — бас тарту.'],
  'canvas.selfConnection': ['Выберите другую запись: нельзя связать запись с самой собой.', 'Choose another record. A record cannot connect to itself.', 'Басқа жазбаны таңдаңыз: жазбаны өзімен байланыстыруға болмайды.'],
  'canvas.chooseTarget': ['Выберите запись для связи или нажмите Esc.', 'Choose a target record or press Esc.', 'Байланыстыратын жазбаны таңдаңыз немесе Esc басыңыз.'],
};

export const workspaceKeys = Object.freeze(Object.keys(entries));
export const workspaceMessages = Object.freeze(Object.fromEntries(['ru', 'en', 'kk'].map((locale, index) => [locale, Object.freeze(Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, values[index]])))])));
const intlLocales = { ru: 'ru-RU', en: 'en-GB', kk: 'kk-KZ' };
let locale = 'ru';
let timeZone = 'UTC';
const dateFormats = new Map();
const numberFormats = new Map();

export function missingWorkspaceKeys(messages = workspaceMessages) {
  return ['ru', 'en', 'kk'].flatMap(language => workspaceKeys.filter(key => typeof messages[language]?.[key] !== 'string' || !messages[language][key].trim()).map(key => `${language}:${key}`));
}

export function setWorkspaceLocale(nextLocale, nextTimeZone = timeZone) {
  if (!Object.hasOwn(intlLocales, nextLocale)) throw new RangeError('Unsupported workspace locale');
  // Validate before updating either preference; the host passes the team zone or
  // the guest's explicit preference. UTC is the deterministic initial default.
  new Intl.DateTimeFormat(intlLocales[nextLocale], { timeZone: nextTimeZone }).format(0);
  locale = nextLocale;
  timeZone = nextTimeZone;
  return { locale, timeZone };
}

export const getWorkspaceLocale = () => locale;
export const getWorkspaceTimeZone = () => timeZone;

export function t(key, parameters = {}) {
  if (!Object.hasOwn(workspaceMessages[locale], key)) throw new RangeError(`Missing workspace translation: ${locale}:${key}`);
  return workspaceMessages[locale][key].replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, name) => {
    if (!Object.hasOwn(parameters, name)) throw new TypeError(`Missing workspace translation parameter: ${key}:${name}`);
    return typeof parameters[name] === 'number' ? formatNumber(parameters[name]) : String(parameters[name]);
  });
}

function cached(cache, key, create) {
  if (!cache.has(key)) {
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, create());
  }
  return cache.get(key);
}

export function formatNumber(value, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return t('common.unavailable');
  const settings = { maximumFractionDigits: 2, ...options };
  return cached(numberFormats, `${locale}:${JSON.stringify(settings)}`, () => new Intl.NumberFormat(intlLocales[locale], settings)).format(value);
}

export function formatPercent(value) {
  return formatNumber(value, { style: 'percent', maximumFractionDigits: 1 });
}

export function formatDate(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (value == null || value === '' || Number.isNaN(date.getTime())) return t('common.dateMissing');
  const settings = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...options, timeZone };
  return cached(dateFormats, `${locale}:${JSON.stringify(settings)}`, () => new Intl.DateTimeFormat(intlLocales[locale], settings)).format(date);
}

export function formatDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (value == null || value === '' || Number.isNaN(date.getTime())) return 'unknown';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function formatDayLabel(value, now = new Date()) {
  const key = formatDayKey(value);
  const today = formatDayKey(now);
  if (key === 'unknown') return t('common.dateMissing');
  if (key === today) return t('timeline.today');
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (!Number.isNaN(yesterday.getTime()) && key === yesterday.toISOString().slice(0, 10)) return t('timeline.yesterday');
  return formatDate(value, { hour: undefined, minute: undefined });
}

export function recordType(kind) {
  return t(Object.hasOwn(workspaceMessages[locale], `record.${kind}`) ? `record.${kind}` : 'record.generic');
}
