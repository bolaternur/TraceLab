import { getWorkspaceLocale } from './workspace-i18n.js';

/** Interface-only translations. Values inside user records and form inputs are never rewritten. */
const entries = {
  'record.hideGraph': ['Убрать из графа', 'Remove from graph', 'Графтан алып тастау'],
  'record.restoreGraph': ['Вернуть в граф', 'Restore to graph', 'Графқа қайтару'],
  'feedback.recordHidden': ['Убрано из графа. Вернуть можно через «Скрытые записи».', 'Removed from graph. Restore it through Hidden records.', 'Графтан алынды. «Жасырылған жазбалар» арқылы қайтара аласыз.'],
  'feedback.recordRestored': ['Запись возвращена в граф.', 'Record restored to graph.', 'Жазба графқа қайтарылды.'],
  "shell.title": [
    "Рабочее место",
    "Workspace",
    "Жұмыс орны"
  ],
  "shell.home": [
    "Iznera — главная",
    "Iznera home",
    "Iznera — басты бет"
  ],
  "project.label": [
    "Проект",
    "Project",
    "Жоба"
  ],
  "project.choose": [
    "Выбрать проект",
    "Select project",
    "Жобаны таңдау"
  ],
  "project.new": [
    "Новый проект",
    "New project",
    "Жаңа жоба"
  ],
  "project.create": [
    "Создать проект",
    "Create project",
    "Жоба құру"
  ],
  "project.copyExample": [
    "Редактировать учебный пример",
    "Edit a learning example",
    "Оқу мысалын өңдеу"
  ],
  "project.editableCopy": [
    "Создать редактируемую копию",
    "Create an editable copy",
    "Өңделетін көшірме жасау"
  ],
  "project.importJson": [
    "Импорт JSON",
    "Import JSON",
    "JSON импорттау"
  ],
  "project.exportJson": [
    "Экспорт JSON",
    "Export JSON",
    "JSON экспорттау"
  ],
  "project.reportHtml": [
    "Отчёт HTML",
    "HTML report",
    "HTML есебі"
  ],
  "project.name": [
    "Название проекта",
    "Project name",
    "Жоба атауы"
  ],
  "project.description": [
    "Что вы разрабатываете?",
    "What are you developing?",
    "Нені әзірлеп жатырсыз?"
  ],
  "project.nameHint": [
    "Например, робот для сортировки деталей",
    "For example, a robot that sorts parts",
    "Мысалы, бөлшектерді сұрыптайтын робот"
  ],
  "project.close": [
    "Закрыть создание проекта",
    "Close project creation",
    "Жоба құруды жабу"
  ],
  "toolbar.fullscreen": [
    "На весь экран",
    "Enter fullscreen",
    "Толық экранға шығу"
  ],
  "toolbar.hideInspector": [
    "Скрыть подробности",
    "Hide details",
    "Мәліметтерді жасыру"
  ],
  "toolbar.addRecord": [
    "Добавить запись",
    "Add record",
    "Жазба қосу"
  ],
  "view.label": [
    "Представления проекта",
    "Project views",
    "Жоба көріністері"
  ],
  "view.graphLabel": [
    "Граф связей",
    "Connection graph",
    "Байланыстар графы"
  ],
  "view.timelineLabel": [
    "Хронология",
    "Timeline",
    "Хронология"
  ],
  "view.testsLabel": [
    "Испытания и графики",
    "Tests and charts",
    "Сынақтар мен диаграммалар"
  ],
  "view.historyLabel": [
    "Решения и поиск",
    "Decisions and search",
    "Шешімдер мен іздеу"
  ],
  "view.studyLabel": [
    "Замеры исследования",
    "Research measurements",
    "Зерттеу өлшемдері"
  ],
  "view.graph": [
    "Граф",
    "Graph",
    "Граф"
  ],
  "view.timeline": [
    "История",
    "Timeline",
    "Тарих"
  ],
  "view.tests": [
    "Тесты",
    "Tests",
    "Сынақтар"
  ],
  "view.history": [
    "Решения",
    "Decisions",
    "Шешімдер"
  ],
  "view.study": [
    "Замеры",
    "Measurements",
    "Өлшемдер"
  ],
  "filter.search": [
    "Поиск по записям",
    "Search records",
    "Жазбаларды іздеу"
  ],
  "filter.searchHint": [
    "Поиск: название, автор, заметка",
    "Search title, author, note",
    "Атауы, авторы, жазбасы бойынша іздеу"
  ],
  "filter.kind": [
    "Тип записи",
    "Record type",
    "Жазба түрі"
  ],
  "filter.all": [
    "Все записи",
    "All records",
    "Барлық жазбалар"
  ],
  "filter.sources": [
    "Материалы",
    "Sources",
    "Материалдар"
  ],
  "filter.iterations": [
    "Итерации",
    "Iterations",
    "Итерациялар"
  ],
  "filter.tests": [
    "Испытания",
    "Tests",
    "Сынақтар"
  ],
  "connection.title": [
    "Связать записи",
    "Connect records",
    "Жазбаларды байланыстыру"
  ],
  "connection.directional": [
    "Создать направленную связь",
    "Create a directed connection",
    "Бағытталған байланыс құру"
  ],
  "connection.close": [
    "Закрыть создание связи",
    "Close connection creation",
    "Байланыс құруды жабу"
  ],
  "connection.from": [
    "Откуда",
    "From",
    "Қайдан"
  ],
  "connection.to": [
    "Куда",
    "To",
    "Қайда"
  ],
  "connection.meaning": [
    "Значение связи",
    "Connection meaning",
    "Байланыстың мағынасы"
  ],
  "connection.related": [
    "Связана с",
    "Related to",
    "Байланысты"
  ],
  "connection.supports": [
    "Подтверждает",
    "Supports",
    "Растайды"
  ],
  "connection.leads": [
    "Приводит к",
    "Leads to",
    "Әкеледі"
  ],
  "connection.contradicts": [
    "Противоречит",
    "Contradicts",
    "Қайшы келеді"
  ],
  "connection.supersedes": [
    "Заменяет",
    "Supersedes",
    "Алмастырады"
  ],
  "connection.explanation": [
    "Пояснение",
    "Explanation",
    "Түсіндірме"
  ],
  "connection.hint": [
    "Например, испытание обосновывает решение",
    "For example, the test supports a decision",
    "Мысалы, сынақ шешімді негіздейді"
  ],
  "connection.create": [
    "Создать связь",
    "Create connection",
    "Байланыс құру"
  ],
  "timeline.replay": [
    "Воспроизвести историю",
    "Replay timeline",
    "Тарихты ойнату"
  ],
  "study.add": [
    "Добавить замер",
    "Add measurement",
    "Өлшем қосу"
  ],
  "study.import": [
    "Импорт CSV",
    "Import CSV",
    "CSV импорттау"
  ],
  "study.template": [
    "Шаблон CSV",
    "CSV template",
    "CSV үлгісі"
  ],
  "study.title": [
    "Добавить парный замер",
    "Add paired measurement",
    "Жұп өлшем қосу"
  ],
  "study.close": [
    "Закрыть замер",
    "Close measurement",
    "Өлшемді жабу"
  ],
  "study.hint": [
    "Внесите два сопоставимых измерения одного участника. Используйте код, а не личные данные.",
    "Enter two comparable measurements for one participant. Use a participant code instead of personal information.",
    "Бір қатысушының салыстыруға болатын екі өлшемін енгізіңіз. Жеке деректердің орнына қатысушы кодын қолданыңыз."
  ],
  "study.participant": [
    "Код участника",
    "Participant code",
    "Қатысушы коды"
  ],
  "study.participantHint": [
    "P-01",
    "P-01",
    "P-01"
  ],
  "study.before": [
    "До Iznera, секунд",
    "Before Iznera, seconds",
    "Iznera-қа дейін, секунд"
  ],
  "study.with": [
    "С Iznera, секунд",
    "With Iznera, seconds",
    "Iznera-пен, секунд"
  ],
  "study.save": [
    "Сохранить замер",
    "Save measurement",
    "Өлшемді сақтау"
  ],
  "inspector.title": [
    "Подробности записи",
    "Record details",
    "Жазба мәліметтері"
  ],
  "inspector.width": [
    "Ширина подробностей",
    "Details panel width",
    "Мәліметтер панелінің ені"
  ],
  "inspector.close": [
    "Закрыть подробности",
    "Close details",
    "Мәліметтерді жабу"
  ],
  "inspector.label": [
    "Подробности выбранной записи",
    "Selected record details",
    "Таңдалған жазбаның мәліметтері"
  ],
  "inspector.choose": [
    "Выберите запись",
    "Select a record",
    "Жазбаны таңдаңыз"
  ],
  "inspector.hint": [
    "Нажмите запись на полотне, чтобы увидеть основание и связи.",
    "Select a record on the canvas to see its evidence and connections.",
    "Негіздемесі мен байланыстарын көру үшін жұмыс аймағындағы жазбаны таңдаңыз."
  ],
  "help.open": [
    "Как работать",
    "How to use",
    "Қалай қолдану керек"
  ],
  "help.title": [
    "Работа с полотном",
    "Using the canvas",
    "Жұмыс аймағын пайдалану"
  ],
  "help.close": [
    "Закрыть справку",
    "Close help",
    "Анықтаманы жабу"
  ],
  "help.navigation": [
    "Перетаскивайте записи за карточку. Перемещайте полотно за свободное место или удерживая пробел. Колесо перемещает полотно; Ctrl / ⌘ + колесо меняет масштаб. F — показать весь граф, 1 — масштаб 100%.",
    "Drag a card to move a record. Drag empty space or hold Space to pan the canvas. Scroll to pan; Ctrl / ⌘ + scroll to zoom. Press F to fit the graph, or 1 for 100% zoom.",
    "Жазбаны жылжыту үшін карточканы сүйреңіз. Жұмыс аймағын жылжыту үшін бос жерді сүйреңіз немесе бос орын пернесін басып тұрыңыз. Дөңгелек жылжытады; Ctrl / ⌘ + дөңгелек масштабты өзгертеді. F — графты толық көрсету, 1 — 100% масштаб."
  ],
  "help.connections": [
    "Для связи перетяните выходную точку записи к входной точке другой. Можно нажать «Связать записи» и выбрать направление в форме. Положения записей сохраняются вместе с проектом.",
    "To connect records, drag an output port to another record's input port. You can also choose Connect records and set the direction in the form. Record positions are saved with the project.",
    "Байланыс құру үшін жазбаның шығыс нүктесін басқа жазбаның кіріс нүктесіне сүйреңіз. Сондай-ақ «Жазбаларды байланыстыру» батырмасын басып, пішінде бағытты таңдауға болады. Жазбалардың орны жобамен бірге сақталады."
  ],
  "help.storage": [
    "В демо данные остаются в этом браузере. В рабочем месте команды записи сохраняются на сервере. Экспорт JSON создаёт резервную копию проекта.",
    "Demo data stay in this browser. Team workspace records are saved on the server. Export JSON to create a project backup.",
    "Демо деректері осы браузерде қалады. Команданың жұмыс орнындағы жазбалар серверде сақталады. Жобаның сақтық көшірмесін жасау үшін JSON экспорттаңыз."
  ],
  "record.close": [
    "Закрыть запись",
    "Close record",
    "Жазбаны жабу"
  ],
  "record.kind": [
    "Тип",
    "Type",
    "Түрі"
  ],
  "record.source": [
    "Материал",
    "Source",
    "Материал"
  ],
  "record.iteration": [
    "Итерация",
    "Iteration",
    "Итерация"
  ],
  "record.test": [
    "Испытание",
    "Test",
    "Сынақ"
  ],
  "record.decision": [
    "Решение",
    "Decision",
    "Шешім"
  ],
  "record.occurred": [
    "Когда произошло",
    "When it happened",
    "Қашан болды"
  ],
  "record.title": [
    "Название",
    "Title",
    "Атауы"
  ],
  "record.author": [
    "Автор",
    "Author",
    "Автор"
  ],
  "record.authorHint": [
    "Имя или код участника",
    "Name or participant code",
    "Аты немесе қатысушы коды"
  ],
  "record.version": [
    "Версия / источник",
    "Version / source",
    "Нұсқасы / дереккөзі"
  ],
  "record.versionHint": [
    "v03, commit или название файла",
    "v03, commit, or filename",
    "v03, коммит немесе файл атауы"
  ],
  "record.body": [
    "Наблюдение или описание",
    "Observation or description",
    "Бақылау немесе сипаттама"
  ],
  "record.related": [
    "Связать с существующей записью",
    "Connect to an existing record",
    "Бар жазбамен байланыстыру"
  ],
  "record.later": [
    "Свяжу позже",
    "Connect later",
    "Кейін байланыстырамын"
  ],
  "record.relatedHint": [
    "Связь направляется от выбранной существующей записи к новой. Её можно дополнить в панели подробностей.",
    "The connection points from the selected existing record to the new record. You can add details in the details panel.",
    "Байланыс таңдалған бар жазбадан жаңа жазбаға бағытталады. Оны мәліметтер панелінде толықтыруға болады."
  ],
  "record.save": [
    "Сохранить запись",
    "Save record",
    "Жазбаны сақтау"
  ],
  "test.result": [
    "Результат испытания",
    "Test result",
    "Сынақ нәтижесі"
  ],
  "test.trials": [
    "Количество попыток",
    "Number of attempts",
    "Әрекеттер саны"
  ],
  "test.successes": [
    "Успешных попыток",
    "Successful attempts",
    "Сәтті әрекеттер"
  ],
  "test.measurement": [
    "Другой численный результат",
    "Another numeric result",
    "Басқа сандық нәтиже"
  ],
  "test.unit": [
    "Единицы",
    "Units",
    "Өлшем бірліктері"
  ],
  "test.unitHint": [
    "с, мм, г",
    "s, mm, g",
    "с, мм, г"
  ],
  "test.conditions": [
    "Условия и процедура",
    "Conditions and procedure",
    "Жағдайлар мен рәсім"
  ],
  "test.conditionsHint": [
    "Что оставалось одинаковым при сравнении",
    "What remained the same in the comparison",
    "Салыстыру кезінде не өзгеріссіз қалды"
  ],
  "test.criterion": [
    "Критерий успеха",
    "Success criterion",
    "Сәттілік критерийі"
  ],
  "test.criterionHint": [
    "Например, удержать деталь на высоте 20 см",
    "For example, hold a part 20 cm above the surface",
    "Мысалы, бөлшекті беттен 20 см биіктікте ұстап тұру"
  ],
  "decision.explanation": [
    "Авторское объяснение",
    "Author's explanation",
    "Автордың түсіндірмесі"
  ],
  "decision.status": [
    "Состояние решения",
    "Decision status",
    "Шешімнің күйі"
  ],
  "decision.draft": [
    "Черновик — обоснование ещё готовится",
    "Draft — rationale in progress",
    "Жоба — негіздемесі дайындалуда"
  ],
  "decision.closed": [
    "Завершено — объяснение обязательно",
    "Completed — explanation required",
    "Аяқталды — түсіндірме міндетті"
  ],
  "decision.why": [
    "Почему выбрали этот вариант?",
    "Why did you choose this option?",
    "Неліктен осы нұсқаны таңдадыңыз?"
  ],
  "decision.whyHint": [
    "Объясните решение своими словами и укажите основание",
    "Explain the decision in your own words and cite the evidence",
    "Шешімді өз сөзіңізбен түсіндіріп, негіздемесін көрсетіңіз"
  ],
  "error.unavailable": [
    "Рабочее пространство недоступно",
    "Workspace unavailable",
    "Жұмыс орны қолжетімсіз"
  ],
  "common.retry": [
    "Повторить",
    "Try again",
    "Қайталау"
  ],
  "common.home": [
    "На главную",
    "Go to home",
    "Басты бетке"
  ],
  "feedback.importedTeam": [
    "Проект перенесён. Исходный проект сохранён.",
    "Project imported. The original project is preserved.",
    "Жоба көшірілді. Бастапқы жоба сақталды."
  ],
  "feedback.outboxSent": [
    "Отправлено отложенных записей: {count}.",
    "Queued records sent: {count}.",
    "Жіберілген кезектегі жазбалар: {count}."
  ],
  "feedback.outboxPending": [
    "На устройстве остались неотправленные записи: {count}. Откройте быструю запись.",
    "Unsent records on this device: {count}. Open quick capture.",
    "Құрылғыда жіберілмеген жазбалар бар: {count}. Жылдам жазбаны ашыңыз."
  ],
  "error.action": [
    "Не удалось выполнить действие.",
    "The action could not be completed.",
    "Әрекет орындалмады."
  ],
  "project.copyName": [
    "Мой проект — на основе учебного примера",
    "My project — based on a learning example",
    "Менің жобам — оқу мысалы негізінде"
  ],
  "feedback.copied": [
    "Создана редактируемая копия. Исходный пример сохранён; учебные числа помечены.",
    "Editable copy created. The original example is preserved and learning data remain marked.",
    "Өңделетін көшірме жасалды. Бастапқы мысал сақталды, оқу деректері белгіленді."
  ],
  "toolbar.showInspector": [
    "Показать подробности",
    "Show details",
    "Мәліметтерді көрсету"
  ],
  "error.twoRecords": [
    "Для связи нужны две записи. Добавьте ещё одну запись.",
    "A connection needs two records. Add another record.",
    "Байланыс үшін екі жазба қажет. Тағы бір жазба қосыңыз."
  ],
  "inspector.empty": [
    "Нажмите узел графа, событие хронологии или строку испытания. Здесь появятся источник, авторское объяснение и связанные записи.",
    "Select a graph node, timeline event or test row to see its source, author's explanation and connected records.",
    "Дереккөзін, автордың түсіндірмесін және байланысты жазбаларды көру үшін граф түйінін, хронология оқиғасын немесе сынақ жолын таңдаңыз."
  ],
  "inspector.resultRatio": [
    "Успешных попыток: {successes} / {trials} ({percent}).",
    "Successful attempts: {successes} / {trials} ({percent}).",
    "Сәтті әрекеттер: {successes} / {trials} ({percent})."
  ],
  "inspector.why": [
    "Почему принято это решение?",
    "Why was this decision made?",
    "Бұл шешім неліктен қабылданды?"
  ],
  "inspector.noRationale": [
    "Авторское объяснение не добавлено.",
    "The author's explanation has not been added.",
    "Автордың түсіндірмесі қосылмаған."
  ],
  "inspector.linkedTests": [
    "Связанные испытания: {tests}.",
    "Linked tests: {tests}.",
    "Байланысты сынақтар: {tests}."
  ],
  "inspector.noTests": [
    "Связанное испытание не указано. Основание пока не задокументировано полностью.",
    "No linked test is recorded. The evidence is not fully documented yet.",
    "Байланысты сынақ көрсетілмеген. Негіздеме әлі толық құжатталмаған."
  ],
  "inspector.noteHistory": [
    "История заметок",
    "Note history",
    "Ескертпелер тарихы"
  ],
  "inspector.provenance": [
    "Происхождение",
    "Provenance",
    "Шығу тегі"
  ],
  "common.notProvided": [
    "не указано",
    "not provided",
    "көрсетілмеген"
  ],
  "inspector.noDescription": [
    "Описание ещё не добавлено.",
    "No description has been added yet.",
    "Сипаттама әлі қосылмаған."
  ],
  "inspector.noDescriptionShort": [
    "Описание пока не добавлено.",
    "No description has been added yet.",
    "Сипаттама әлі қосылмаған."
  ],
  "inspector.noAuthor": [
    "Автор не указан",
    "Author not provided",
    "Автор көрсетілмеген"
  ],
  "inspector.date": [
    "Дата",
    "Date",
    "Күні"
  ],
  "inspector.version": [
    "Версия",
    "Version",
    "Нұсқасы"
  ],
  "inspector.result": [
    "Результат",
    "Result",
    "Нәтиже"
  ],
  "inspector.measurement": [
    "Измерение",
    "Measurement",
    "Өлшем"
  ],
  "inspector.noUnit": [
    "единица не указана",
    "unit not provided",
    "өлшем бірлігі көрсетілмеген"
  ],
  "inspector.related": [
    "Связанные записи",
    "Connected records",
    "Байланысты жазбалар"
  ],
  "inspector.suggested": [
    "предложенная связь",
    "suggested connection",
    "ұсынылған байланыс"
  ],
  "inspector.noLinks": [
    "Связи пока не добавлены.",
    "No connections have been added yet.",
    "Байланыстар әлі қосылмаған."
  ],
  "record.edit": [
    "Изменить запись",
    "Edit record",
    "Жазбаны өңдеу"
  ],
  "connection.add": [
    "Добавить связь",
    "Add connection",
    "Байланыс қосу"
  ],
  "connection.selectedTo": [
    "Связать выбранную запись с",
    "Connect the selected record to",
    "Таңдалған жазбаны байланыстыру"
  ],
  "connection.what": [
    "Что означает связь",
    "What does this connection mean?",
    "Бұл байланыс нені білдіреді?"
  ],
  "connection.save": [
    "Сохранить связь",
    "Save connection",
    "Байланысты сақтау"
  ],
  "feedback.linkSaved": [
    "Связь сохранена в проекте.",
    "Connection saved in the project.",
    "Байланыс жобада сақталды."
  ],
  "history.noMatch": [
    "Подходящих записей нет",
    "No matching records",
    "Сәйкес жазбалар жоқ"
  ],
  "history.noMatchHint": [
    "Измените запрос или фильтр. В новом проекте начните с материала, испытания или решения.",
    "Change the search or filter. Start a new project with a source, test or decision.",
    "Іздеу сұрауын немесе сүзгіні өзгертіңіз. Жаңа жобаны материалдан, сынақтан немесе шешімнен бастаңыз."
  ],
  "storage.synthetic": [
    "Учебный пример · вымышленные данные",
    "Learning example · synthetic data",
    "Оқу мысалы · ойдан алынған деректер"
  ],
  "storage.copy": [
    "Учебная копия · исходные данные вымышлены",
    "Learning copy · original data are synthetic",
    "Оқу көшірмесі · бастапқы деректер ойдан алынған"
  ],
  "storage.team": [
    "Команда",
    "Team",
    "Команда"
  ],
  "storage.local": [
    "Локальный проект · ваши записи",
    "Local project · your records",
    "Жергілікті жоба · сіздің жазбаларыңыз"
  ],
  "storage.syncing": [
    "Отправляется в команду…",
    "Sending to the team…",
    "Командаға жіберілуде…"
  ],
  "storage.failed": [
    "Не сохранено · проверьте сообщение",
    "Not saved · check the message",
    "Сақталмады · хабарламаны тексеріңіз"
  ],
  "storage.savedTeam": [
    "Сохранено в команде",
    "Saved in the team",
    "Командада сақталды"
  ],
  "storage.savedLocal": [
    "Сохранено в этом браузере",
    "Saved in this browser",
    "Осы браузерде сақталды"
  ],
  "storage.memory": [
    "Хранение в памяти · скачайте JSON",
    "Memory only · download JSON",
    "Тек жадта · JSON жүктеп алыңыз"
  ],
  "storage.syntheticHint": [
    "Участники, даты и результаты 6/10 → 9/10 вымышлены. Выберите запись, чтобы увидеть её связи и авторское объяснение. Для своих данных создайте проект или импортируйте JSON.",
    "Participants, dates and results 6/10 → 9/10 are synthetic. Select a record to see its connections and author's explanation. Create a project or import JSON for your own data.",
    "Қатысушылар, күндер және 6/10 → 9/10 нәтижелері ойдан алынған. Байланыстар мен автордың түсіндірмесін көру үшін жазбаны таңдаңыз. Өз деректеріңіз үшін жоба құрыңыз немесе JSON импорттаңыз."
  ],
  "storage.device": [
    "Записи хранятся на этом устройстве.",
    "Records are stored on this device.",
    "Жазбалар осы құрылғыда сақталады."
  ],
  "storage.backup": [
    "Скачивайте JSON для резервной копии или переноса проекта.",
    "Download JSON to back up or transfer the project.",
    "Жобаның сақтық көшірмесін жасау немесе көшіру үшін JSON жүктеп алыңыз."
  ],
  "storage.copyHint": [
    "Проект создан из учебного примера: исходные записи и числа вымышлены. Замените их своими данными.",
    "This project was copied from a learning example: original records and figures are synthetic. Replace them with your own data.",
    "Бұл жоба оқу мысалынан жасалған: бастапқы жазбалар мен сандар ойдан алынған. Оларды өз деректеріңізбен ауыстырыңыз."
  ],
  "project.counts": [
    "Записи: {records} · Испытания: {tests} · Решения: {decisions}",
    "Records: {records} · Tests: {tests} · Decisions: {decisions}",
    "Жазбалар: {records} · Сынақтар: {tests} · Шешімдер: {decisions}"
  ],
  "record.addCopy": [
    "Добавить запись в отдельную редактируемую копию",
    "Add a record to a separate editable copy",
    "Жазбаны бөлек өңделетін көшірмеге қосу"
  ],
  "feedback.linkRemoved": [
    "Связь удалена из текущего проекта.",
    "Connection removed from the current project.",
    "Байланыс ағымдағы жобадан жойылды."
  ],
  "common.loading": [
    "Загрузка…",
    "Loading…",
    "Жүктелуде…"
  ],
  "media.title": [
    "Материалы команды",
    "Team materials",
    "Команда материалдары"
  ],
  "media.signinHint": [
    "Загрузка фотографий и моделей доступна после входа в рабочую область команды.",
    "Sign in to a team workspace to upload photos and models.",
    "Фотосуреттер мен модельдерді жүктеу үшін команданың жұмыс орнына кіріңіз."
  ],
  "common.signin": [
    "Войти",
    "Sign in",
    "Кіру"
  ],
  "report.synthetic": [
    "Учебные данные: участники, даты и измерения вымышлены. Это не результаты исследования Iznera.",
    "Learning data: participants, dates and measurements are synthetic. These are not Iznera research results.",
    "Оқу деректері: қатысушылар, күндер және өлшемдер ойдан алынған. Бұл Iznera зерттеу нәтижелері емес."
  ],
  "report.copy": [
    "Проект создан на основе учебного примера. Исходные участники, даты и измерения вымышлены. Пользовательские изменения не проверены.",
    "This project is based on a learning example. Original participants, dates and measurements are synthetic. User changes have not been verified.",
    "Жоба оқу мысалы негізінде жасалған. Бастапқы қатысушылар, күндер және өлшемдер ойдан алынған. Пайдаланушы өзгерістері тексерілмеген."
  ],
  "report.local": [
    "Локальные данные проекта, введённые или импортированные пользователем. Этот отчёт не подтверждает достоверность или исследовательский эффект.",
    "Local project data entered or imported by the user. This report does not establish data validity or a research effect.",
    "Пайдаланушы енгізген немесе импорттаған жергілікті жоба деректері. Бұл есеп деректердің дұрыстығын немесе зерттеу әсерін растамайды."
  ],
  "report.records": [
    "Записи",
    "Records",
    "Жазбалар"
  ],
  "report.of": [
    "из",
    "of",
    "/"
  ],
  "report.attempts": [
    "попыток.",
    "attempts.",
    "әрекет."
  ],
  "report.conditions": [
    "Условия",
    "Conditions",
    "Жағдайлар"
  ],
  "report.criterion": [
    "Критерий",
    "Criterion",
    "Критерий"
  ],
  "report.links": [
    "Связи",
    "Connections",
    "Байланыстар"
  ],
  "report.from": [
    "От записи",
    "From record",
    "Жазбадан"
  ],
  "report.to": [
    "К записи",
    "To record",
    "Жазбаға"
  ],
  "report.meaning": [
    "Значение",
    "Meaning",
    "Мағынасы"
  ],
  "report.status": [
    "Статус",
    "Status",
    "Күйі"
  ],
  "report.paired": [
    "Парные замеры исследования",
    "Paired research measurements",
    "Зерттеудің жұп өлшемдері"
  ],
  "report.code": [
    "Код",
    "Code",
    "Код"
  ],
  "report.before": [
    "До, с",
    "Before, s",
    "Дейін, с"
  ],
  "report.with": [
    "С Iznera, с",
    "With Iznera, s",
    "Iznera-пен, с"
  ],
  "report.noMeasurements": [
    "Замеры не добавлены.",
    "No measurements have been added.",
    "Өлшемдер қосылмаған."
  ],
  "feedback.report": [
    "HTML-отчёт скачан с записями, связями и пометкой о происхождении данных.",
    "HTML report downloaded with records, connections and data provenance.",
    "Жазбалар, байланыстар және деректердің шығу тегі көрсетілген HTML есебі жүктелді."
  ],
  "error.csvLarge": [
    "CSV слишком большой. Максимум — 2 MiB.",
    "CSV is too large. The limit is 2 MiB.",
    "CSV тым үлкен. Шегі — 2 MiB."
  ],
  "error.csvQuotes": [
    "В CSV не закрыты кавычки.",
    "CSV contains an unclosed quotation mark.",
    "CSV ішінде тырнақша жабылмаған."
  ],
  "error.csvColumns": [
    "Нужны столбцы participant_code, baseline_seconds и trace_seconds. Скачайте шаблон CSV.",
    "Required columns: participant_code, baseline_seconds and trace_seconds. Download the CSV template.",
    "participant_code, baseline_seconds және trace_seconds бағандары қажет. CSV үлгісін жүктеп алыңыз."
  ],
  "error.csvEmpty": [
    "В CSV нет измерений.",
    "CSV contains no measurements.",
    "CSV ішінде өлшемдер жоқ."
  ],
  "error.measurementLimit": [
    "Максимум — 1000 парных замеров в проекте.",
    "A project can contain up to 1,000 paired measurements.",
    "Жобада ең көбі 1000 жұп өлшем болуы мүмкін."
  ],
  "error.csvDuplicate": [
    "Код участника повторяется в строке {row}. Используйте уникальный код для каждой пары.",
    "Participant code repeats on row {row}. Use a unique code for each pair.",
    "Қатысушы коды {row}-жолда қайталанады. Әр жұп үшін бірегей код қолданыңыз."
  ],
  "error.csvRow": [
    "Проверьте код и неотрицательные числа в строке {row}.",
    "Check the code and non-negative numbers on row {row}.",
    "{row}-жолдағы код пен теріс емес сандарды тексеріңіз."
  ],
  "error.offlineStorage": [
    "Офлайн-хранилище недоступно в этом браузере.",
    "Offline storage is unavailable in this browser.",
    "Бұл браузерде офлайн сақтау қолжетімсіз."
  ],
  "feedback.opened": [
    "Открыт выбранный проект.",
    "Selected project opened.",
    "Таңдалған жоба ашылды."
  ],
  "feedback.projectCreated": [
    "Проект создан. Теперь добавьте первую запись.",
    "Project created. Add your first record.",
    "Жоба құрылды. Алғашқы жазбаны қосыңыз."
  ],
  "feedback.connectionCreated": [
    "Связь создана. Направление и значение сохранены в проекте.",
    "Connection created. Its direction and meaning are saved in the project.",
    "Байланыс құрылды. Бағыты мен мағынасы жобада сақталды."
  ],
  "feedback.fullscreen": [
    "Полотно уже занимает всю вкладку. Полный экран браузера можно включить клавишей F11.",
    "The canvas already fills this tab. Press F11 for browser fullscreen.",
    "Жұмыс аймағы бүкіл қойындыны алып тұр. Браузердің толық экранын F11 арқылы қосуға болады."
  ],
  "toolbar.exitFullscreen": [
    "Выйти из полного экрана",
    "Exit fullscreen",
    "Толық экраннан шығу"
  ],
  "feedback.queued": [
    "Сохранено на устройстве. Отправится в команду после восстановления соединения.",
    "Saved on this device. It will be sent to the team when the connection returns.",
    "Осы құрылғыда сақталды. Байланыс қалпына келгенде командаға жіберіледі."
  ],
  "connection.rationale": [
    "Основание решения",
    "Decision evidence",
    "Шешім негіздемесі"
  ],
  "connection.next": [
    "Следующий этап",
    "Next step",
    "Келесі кезең"
  ],
  "feedback.recordSaved": [
    "Запись сохранена. Граф, хронология и диаграммы обновлены.",
    "Record saved. Graph, timeline and charts updated.",
    "Жазба сақталды. Граф, хронология және диаграммалар жаңартылды."
  ],
  "error.fields": [
    "Проверьте заполненные поля.",
    "Check the completed fields.",
    "Толтырылған өрістерді тексеріңіз."
  ],
  "error.jsonLarge": [
    "JSON слишком большой. Максимум — 2 MiB.",
    "JSON is too large. The limit is 2 MiB.",
    "JSON тым үлкен. Шегі — 2 MiB."
  ],
  "feedback.imported": [
    "Проект импортирован. Старые проекты сохранены.",
    "Project imported. Existing projects are preserved.",
    "Жоба импортталды. Бар жобалар сақталды."
  ],
  "feedback.exported": [
    "JSON проекта скачан. Он содержит записи, связи и происхождение данных.",
    "Project JSON downloaded with records, connections and provenance.",
    "Жазбалар, байланыстар және шығу тегі бар жоба JSON файлы жүктелді."
  ],
  "feedback.measurementSaved": [
    "Парный замер добавлен. Диаграмма обновлена.",
    "Paired measurement added. Chart updated.",
    "Жұп өлшем қосылды. Диаграмма жаңартылды."
  ],
  "feedback.measurementsImported": [
    "Импортировано парных замеров: {count}.",
    "Paired measurements imported: {count}.",
    "Импортталған жұп өлшемдер: {count}."
  ],
  "timeline.needsRecords": [
    "Для воспроизведения нужны записи.",
    "Add records to replay the timeline.",
    "Тарихты ойнату үшін жазбалар қажет."
  ],
  "timeline.stop": [
    "Остановить воспроизведение",
    "Stop replay",
    "Ойнатуды тоқтату"
  ],
  "timeline.finished": [
    "История просмотрена до последней записи.",
    "The timeline has reached the latest record.",
    "Тарих соңғы жазбаға дейін көрсетілді."
  ],
  "server.loaded": [
    "Записи получены из базы команды.",
    "Records loaded from the team database.",
    "Жазбалар команданың дерекқорынан алынды."
  ],
  "server.autoRefresh": [
    "Обновления команды проверяются каждые 5 секунд. Открытая форма и перемещение записей не прерываются.",
    "Team updates are checked every 5 seconds. Open forms and record dragging are not interrupted.",
    "Команда өзгерістері 5 секунд сайын тексеріледі. Ашық пішіндер мен жазбаларды жылжыту үзілмейді."
  ],
  "server.saved": [
    "Сохранено в базе команды.",
    "Saved in the team database.",
    "Команданың дерекқорында сақталды."
  ],
  "server.onboarding": [
    "Создайте команду или присоединитесь по приглашению.",
    "Create a team or join one with an invitation.",
    "Команда құрыңыз немесе шақыру арқылы қосылыңыз."
  ],
  "error.session": [
    "Сессия завершена. Войдите снова; введённые данные остаются в форме.",
    "Your session has ended. Sign in again; entered details remain in the form.",
    "Сеанс аяқталды. Қайта кіріңіз; енгізілген деректер пішінде қалады."
  ],
  "error.forbidden": [
    "Нет доступа к этой команде или записи.",
    "You do not have access to this team or record.",
    "Бұл командаға немесе жазбаға рұқсатыңыз жоқ."
  ],
  "error.verification": [
    "Сначала подтвердите адрес электронной почты.",
    "Confirm your email address first.",
    "Алдымен электрондық поштаңызды растаңыз."
  ],
  "error.savedProject": [
    "Сохранённый проект не удалось проверить; исходные данные не изменены.",
    "The saved project could not be validated. Original data have not changed.",
    "Сақталған жобаны тексеру мүмкін болмады. Бастапқы деректер өзгерген жоқ."
  ],
  "error.rateLimit": [
    "Слишком много запросов. Подождите перед повтором.",
    "Too many requests. Wait before trying again.",
    "Сұрау саны тым көп. Қайталаудан бұрын күтіңіз."
  ],
  "error.idempotency": [
    "Этот запрос уже использован с другими данными.",
    "This request was already used with different data.",
    "Бұл сұрау басқа деректермен қолданылған."
  ],
  "error.previewExpired": [
    "Подтвердите новый просмотр импорта; файл или команда изменились.",
    "Review and confirm the import again. The file or team has changed.",
    "Импортты қайта қарап, растаңыз. Файл немесе команда өзгерді."
  ],
  "error.revision": [
    "Проект изменён другим участником. Ваш ввод не сохранён поверх его работы. Обновите проект и сравните версии.",
    "Another member changed the project. Your input has not overwritten their work. Refresh the project and compare versions.",
    "Жобаны басқа қатысушы өзгертті. Енгізгеніңіз оның жұмысын алмастырған жоқ. Жобаны жаңартып, нұсқаларды салыстырыңыз."
  ],
  "error.revisionSaved": [
    "Запись уже изменилась. Ваш вариант сохранён отдельно в подробностях записи → «Мои сохранённые спорные варианты».",
    "The record changed. Your draft was saved separately in record details → My saved conflicting drafts.",
    "Жазба өзгерген. Нобайыңыз жазба мәліметтеріндегі «Менің сақталған қайшы нобайларым» бөлімінде бөлек сақталды."
  ],
  "error.origin": [
    "Не удалось проверить запрос. Обновите страницу и повторите попытку.",
    "This request could not be verified. Reload the page and try again.",
    "Сұрауды тексеру мүмкін болмады. Бетті жаңартып, қайталаңыз."
  ],
  "error.requestLarge": [
    "Слишком много данных в запросе. Уменьшите размер и повторите.",
    "The request contains too much data. Reduce its size and try again.",
    "Сұрауда деректер тым көп. Көлемін азайтып, қайталаңыз."
  ],
  "error.service": [
    "Не удалось связаться с сервером. Изменения не сохранены в команде.",
    "Could not reach the server. Changes have not been saved in the team.",
    "Сервермен байланысу мүмкін болмады. Өзгерістер командада сақталмады."
  ]
};
export const shellKeys = Object.freeze(Object.keys(entries));
export const shellMessages = Object.freeze(Object.fromEntries(['ru', 'en', 'kk'].map((locale, index) => [locale, Object.freeze(Object.fromEntries(Object.entries(entries).map(([key, values]) => [key, values[index]])))])));

export function shellT(key, parameters = {}, locale = getWorkspaceLocale()) {
  const value = shellMessages[locale]?.[key];
  if (typeof value !== 'string') throw new Error(`Missing shell translation: ${locale}:${key}`);
  return value.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, parameter) => {
    if (!(parameter in parameters)) throw new Error(`Missing shell parameter: ${key}:${parameter}`);
    return String(parameters[parameter]);
  });
}

/** Apply to static shell text only; never traverse or translate record content. */
export function applyWorkspaceShellLocale(root = document, locale = getWorkspaceLocale()) {
  for (const element of root.querySelectorAll('[data-ws-key]')) element.textContent = shellT(element.dataset.wsKey, {}, locale);
  for (const [attribute, datasetKey] of [['aria-label', 'wsLabel'], ['title', 'wsTitle'], ['placeholder', 'wsPlaceholder']]) {
    for (const element of root.querySelectorAll(`[data-ws-${datasetKey.slice(2).toLowerCase()}]`)) element.setAttribute(attribute, shellT(element.dataset[datasetKey], {}, locale));
  }
}
const errorKeys = {
  unauthenticated: 'error.session', forbidden: 'error.forbidden',
  verification_required: 'error.verification', invalid_fields: 'error.fields',
  invalid_saved_project: 'error.savedProject', rate_limited: 'error.rateLimit',
  idempotency_conflict: 'error.idempotency', preview_expired: 'error.previewExpired',
  revision_conflict: 'error.revision', origin_rejected: 'error.origin',
  request_too_large: 'error.requestLarge', service_unavailable: 'error.service',
  invalid_request: 'error.fields', network: 'error.service',
};
export function workspaceErrorText(error) {
  if(error?.code==='revision_conflict'&&error?.details?.draftId)return shellT('error.revisionSaved');
  const code = String(error?.code || '').toLowerCase();
  const key = errorKeys[code] || ({ 401: 'error.session', 403: 'error.forbidden', 409: 'error.revision', 413: 'error.requestLarge', 422: 'error.fields', 429: 'error.rateLimit' })[error?.status];
  if (key) return shellT(key);
  // Local validation messages already in this dictionary retain their meaning.
  const entry = Object.entries(entries).find(([, values]) => values.includes(error?.message));
  return entry ? shellT(entry[0]) : shellT('error.action');
}
