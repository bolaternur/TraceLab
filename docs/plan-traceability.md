# Iznera — соответствие десяти исходным документам

Дата исходной сверки: **31 октября 2026 года**. Обновлено по реализации и проверкам **1 ноября 2026 года**. Это живая матрица требований и доказательств, а не заявление о завершённом пилоте, публичном запуске или соответствии всем правилам соревнований.

## Источники и границы

Прочитаны полный `Iznera_Complete_Codex_Prompt_RU.txt`, все десять исходных MD и материалы аудита из `C:/projects/ernurs projects/Iznera_Audit_2026-10-31`. Обозначение `02:129–140` ниже означает строки **исходного**, не отредактированного файла `02_Product_PRD_UX.md`. Копии находятся в `original-plan` пакета аудита. Источники датированы 3 сентября; они не заменяют текущие официальные правила.

| № | Исходный документ |
| --- | --- |
| 00 | `00_Master_Strategy.md` |
| 01 | `01_Problem_Market_Competition.md` |
| 02 | `02_Product_PRD_UX.md` |
| 03 | `03_Technical_Architecture_Data.md` |
| 04 | `04_AI_Compliance_Privacy_Trust.md` |
| 05 | `05_GTM_Business_Model.md` |
| 06 | `06_Validation_Metrics_Risks.md` |
| 07 | `07_Build_Roadmap_Backlog.md` |
| 08 | `08_Brand_Naming_Messaging.md` |
| 09 | `09_Source_Register.md` |

Поздние требования владельца имеют приоритет: бренд **Iznera**, RU/EN/KK (`kk`), существующий чат, отдельные галерея и библиотека GLB, подписанная shadcn-навигация, крупный читаемый текст и согласованные тёмная/молочная темы. Старые запреты на чат и viewer не являются основанием их удалить. Изменения команды, загрузки или удаления при этой документальной сверке не выполнялись.

Видимый frontend: `website/tracelab`, генератор `website/tracelab/build.mjs`, подготовка `scripts/prepare-unified.mjs`, результат `public/_presentation`. `next.config.ts` направляет туда `/`, `/workspace` и публичные страницы. Аккаунты и API обслуживает root Next 16.3.6; `src/app/page.tsx` не следует считать видимой главной. Backend PostgreSQL/Drizzle уже существует. Название папки `tracelab` и исторические ключи хранения не означают прежний публичный бренд и не должны переименовываться с потерей данных.

Статусы: **работает и проверено** — только при наличии указанного результата проверки; **реализовано в коде, не проверено** — найдена реализация, но приёмка не выполнена; **частично** — есть часть сценария; **демонстрация** — вымышленные данные; **код есть, текущий UX не подключён** — старый недоступный путь; **отсутствует**; **отложено по условиям плана**; **нужна внешняя настройка**. Наличие файла теста не означает, что тест запускался или прошёл. Все приведённые ниже пути относительны корню репозитория.

## 00 — продуктовая стратегия и инварианты

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S00-01 · 00:23–42 | Проследить материал → изменение → тест → решение | `workspace-core.js`, `workspace-iterations.js`, inbox/timeline/report; canonical source/annotation/relation | частично | Единая оболочка соединяет основные этапы; scoped fixture/DOM/DB проверки выполнены. Полный замер цепочки с новым участником и реальные пилоты остаются отдельно. |
| S00-02 · 00:79–85 | Сохранить собственное объяснение, не переписав original | `workspace-service.ts`, iteration editor; source_events/annotations/supersedes | работает и проверено | Store и Inbox DB fixtures подтверждают запрет чужой правки, close/reopen и сохранение исходного source/истории. Это проверенный сценарий, не доказательство авторства хешем. |
| S00-03 · 00:87–89 | Рискованное AI-действие проверяет правила; вывод имеет источники | `src/modules/policies/engine.ts`, `src/server/policy.ts`, `actions.ts`; policy_versions/ai_action_logs | частично | Все risky server actions fail safe; generated материал не заменяет student annotation. |
| S00-04 · 00:91–105 | Закрытая команда, process gaps без рейтинга, переносимый архив | RLS migrations, workspace/team/media/report API | частично | Проверить две команды, отзыв доступа, export/delete/restore; не публиковать личные профили/счётчики продуктивности. |
| S00-05 · 00:97 | Записать фото без сети и восстановить после reload | `workspace-outbox.js`, `workspace-outbox-backup.js`, `offline-capture.js`, service worker | частично | Добавлен ZIP с текстами и байтами фото; JSON отдельно не является полным backup. Fixture-проверки очереди/backup есть; физический offline/reload/reconnect на телефоне и весь device lifecycle ещё не подтверждены. |
| S00-06 · 00:99–107 | Одна generic evidence-модель для сезонов | `src/db/schema.ts`, policies, project/season keys | частично | Сезон закрепляет policy; адаптер не создаёт вторую БД и не смешивает старые/новые доказательства. |
| S00-07 · 00:109–125 | Сохранить фокус продукта | Существующие chat/GLB — поздние требования владельца; прочие expansion gates | отложено по условиям плана | Не строить inventory/CRM/scouting/native/vector DB без необходимости; не удалять утверждённые функции. |
| S00-08 · 00:150–184 | Проверить гипотезы распределённого capture, памяти и ценности | Пилотный протокол, `docs/rknp`, исследовательские измерения | отложено по условиям плана | Реальные команды/4 недели/повторное использование и LOI подтверждаются наблюдениями; код и demo не считаются результатом. |

## 01 — проблема, альтернативы и рынок

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S01-01 · 01:23–36 | Понять, что сохраняется причина изменения, а не просто файл | `astra-copy.js`, `astra-pages.mjs`; public demo | частично | Один конкретный пример подсистемы показывает авторское why и связь с тестом. |
| S01-02 · 01:66–71 | Найти старую попытку, подготовить handoff/отчёт | `workspace-core.js` Memory, `workspace-handoff.js`, `/api/workspace/handoff`, report scope | частично | Память и handoff доступны в текущей оболочке. Lead-only rollover создаёт пустой сезон/проект с сохранением старых ссылок и policy anchor; fixtures проверены. Поиск причины менее чем за 60 секунд с человеком не измерен. |
| S01-03 · 01:87–96 | Работать рядом с GitHub/CAD/ручным журналом | GitHub webhook metadata, manual capture, GLB upload | частично | Не требовать GitHub для первого наблюдения; не выдавать GLB viewer за замену Onshape. |
| S01-04 · 01:104–131 | Честно объяснить отличие от альтернатив | Публичные страницы и source register | частично | Проверяемые примеры вместо «первый knowledge graph»/«гарантированная награда»; дату конкурентного утверждения сохранять. |
| S01-05 · 01:133–178 | Оценить достижимые пилоты, а не выдуманный TAM/спрос | Досье и `docs/rknp` | отложено по условиям плана | Участники событий не считаются платящими командами; цены/retention/ROI требуют отдельного исследования. |
| S01-06 · 01:180–194 | Выяснить реальные инструменты и чувствительность данных | Интервью/пилотный инструментальный список | отложено по условиям плана | Зафиксировать ответы команд до Onshape/chat-bot expansion; не превращать гипотезы в UI-галочки «подключено». |

## 02 — пользовательские сценарии и интерфейс

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S02-01 · 02:23–27 | Ответить «почему так?» с точным CAD/code/test | `workspace-core.js`: findMemory/mountMemory; acceptedNeighbors | частично | Детерминированный поиск сохранённого why и прямых принятых связей работает без LLM. Отсутствующее объяснение помечено явно; human retrieval <60 секунд не заявляется. |
| S02-02 · 02:46,89 | Открыть «Обзор / Эта неделя» на реальных данных | `workspace-core.js`: renderOverview; `workspace.js?view=overview` | частично | Обзор проекта работает: последняя итерация/тест, нуждающиеся в объяснении решения и действия первого шага; данные выбранного проекта, включая честные нули. Проверено core fixtures и просмотром оболочки. Отдельного недельного окна пока нет; это не рейтинг учеников. |
| S02-03 · 02:47,91–104 | Быстро сохранить фото/проблему/test/decision/reflection | `workspace-surface.mjs`, `workspace.js`, `offline-capture.js` | частично | Минимум обязательных полей, собственный why, автор и исходная дата; target15/30/45 сек проверять отдельно. |
| S02-04 · 02:71–77,233 | Создать private team/project/season и пригласить | `/auth`, `/onboarding`, `/join/[code]`, `/api/workspace`; team_invites | реализовано в коде, не проверено | Новый и уже вошедший аккаунты, неверный/истёкший код, revoke/last lead на fixtures. |
| S02-05 · 02:79–83,106–116 | Разобрать Inbox и принять группу | `workspace-inbox.js/model/copy`, `/api/workspace/inbox` | частично | Single triage, batch selection, preview/explicit confirm и локальные групповые предложения подключены. DOM test: до подтверждения нет POST; частичный retry сохраняет requestId и revision chain. Sensitive-review workflow и human ≤3 клика ещё не приняты. |
| S02-06 · 02:129–140 | Полная итерация и авторское закрытие | `workspace-iterations.js/model`, workspace-store/service, `/api/workspace/iterations` | работает и проверено | Есть подсистема, цель, изменение, своё why, testOutcome, disposition, next step, revision и выбранные ссылки. Store/DB fixtures проверяют draft→close→reopen, авторство, историю и неизменность original. Readonly открывается с заголовка. |
| S02-07 · 02:146–156 | Сохранить количественный или качественный тест | workspace test form, tests, `workspace-views.js` | частично | Сохранить trials/value/unit/conditions/criterion; добавить exact target/baseline/series и не сравнивать разные единицы. |
| S02-08 · 02:160–168 | Найти прошлый failure и решения без evidence | `workspace-core.js` Memory; `workspace-handoff.js` failures; authorized projects | частично | Поиск объяснений/пробелов и переход к принятым связям подключены; all-project scope выбирает пользователь. Handoff выделяет явно отвергнутые/отменённые подходы. Реальный cross-season retrieval с участником не измерен. |
| S02-09 · 02:174–182 | Выбрать разрешённые материалы для portfolio | `workspace-report.js`, `/api/workspace/report`, `workspace-report-model.ts` / render / service; exports, policy_versions | частично | Подключены порядок, разделы по типу, обзор текстов/вложений, реальные страницы/байты после генерации, отдельный manifest и защищённый PDF preview. Конкурсный PDF: отдельная обложка, проверенный бюджет, без технического приложения. 10 unit + 4 static + 6 report DB fixtures PASS; настоящая политика команды не активировалась, submission/event review остаётся внешней проверкой. |
| S02-10 · 02:190–201 | Права ученика/руководителя/наставника согласованы | `workspace-team-service.ts`, `workspace-product-controls.js`, RLS | частично | Invite UI согласован с student_lead; авторство итераций/решений проверяется сервером. Scoped DB denial/revoke fixtures есть; полный новый-account multi-team browser E2E и внешний пилот отдельно. |
| S02-11 · 02:205–215 | Offline/photo/sync конфликт с неизменным event time | Outbox/backup/signout, revision service, versioned store | частично | Сохранены owner-scoped retry и исходное время; добавлены ZIP с фото и выбор судьбы локальных черновиков при выходе. Conflict store/DB fixtures проверены; реальный полный offline сценарий и общий физический device ещё требуют приёмки. |
| S02-12 · 02:219–227 | Различить empty/no results/error/revoked/stale | Views/core help, inbox batch, media upload queue/editor | частично | Tests/Study empty states имеют действия, Inbox различает статусы/ошибки, upload queue сохраняет удачные файлы. Локальная crop/redaction есть в online photo flow; offline editor отсутствует. |
| S02-13 · 02:249–257 | Хронология по подсистеме, связи tests→decisions, safe export | `workspace-views.js`, `workspace-filters.js`, `workspace-timeline-media.js` | частично | Группы по дням/подсистемам/принятой итерации, active chips, URL-фильтры, 100-record pages, сохранение scroll и authorized thumbnails подключены. 1000-record DOM fixture проверен; полная физическая mobile/Back-Forward acceptance ещё отдельно. |
| S02-14 · 02:259 | Владелец выгружает/удаляет данные команды | Report/account export; `LifecycleSettings`, account lifecycle API/service, миграция `0015_workspace_lifecycle` | частично | Подключён отдельный запрос удаления: lead-only inventory preview, пароль/точное подтверждение, семь дней отмены, немедленное закрытие обычного доступа, durable exact-key DB/files/jobs/report cleanup. На зарегистрированной миграции прошли 11 изолированных lifecycle fixtures; настоящую команду не удаляли. Внешний scheduler и backup retention остаются операторской приёмкой. |
| S02-15 · 02:263–271 | Условные Onshape/AI/coach/VEX/ISEF расширения | Stub endpoints, legacy pages/policy | отложено по условиям плана | Onshape —3 активных пилота со спросом; AI после полезного search; остальные gates из источника. |

## 03 — архитектура и данные

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S03-01 · 03:23,126–138 | Не смешивать original, student и generated | Canonical sources/annotations; iteration/inbox/store services | работает и проверено | Scoped store/Inbox DB fixtures подтверждают original неизменным, версии rationale и неповышение suggested links до accepted без подтверждения. Generated-authority не выводится из источника. |
| S03-02 · 03:29–41 | Один root Next/Postgres/storage/outbox стек | Root Next + beforeFiles static presentation + unified APIs | работает и проверено | Изменён исходный website/tracelab и общие API, без второй БД/авторизации; генератор и localhost проверяются root validation отдельно. Старые незакоммиченные изменения сохранены. |
| S03-03 · 03:47–93 | Команда/сезон/проект/подсистема имеют устойчивые keys | Canonical seasons/projects/subsystems; iteration taxonomy; handoff service | частично | Подсистемы редактора/фильтров связаны с проектом. Транзакционный rollover по явному lead confirm создаёт пустой проект, переносит только выбранные taxonomy names, закрепляет старые policy и не наследует их новым сезоном; fixtures проходят. |
| S03-04 · 03:101–124 | Typed edge имеет понятный смысл; causal только после автора | `workspace-inbox-model.js`, typed links, iterationEvidence | частично | Группировка лишь выбирает материалы; preview и confirm создают явные связи. Accepted-only grouping/summary проверены. Полный human review причинных смыслов во всех старых формах ещё требуется. |
| S03-05 · 03:142–150 | GitHub metadata поступает однажды без repo-content ingestion | GitHub webhook contract/service; Inbox DB fixtures | частично | HMAC/replay/oversize/triage и immutable original проверяются изолированными DB suites. Настоящая доставка внешнего GitHub на staging и подтверждение external actor ещё не выполнены. |
| S03-06 · 03:156–166 | Точный Onshape microversion без scraping | Onshape API/webhook возвращают 501; ручной GLB путь существует | отложено по условиям плана | Не показывать Connected; minimal OAuth/scopes/rotation только после пилотного gate. |
| S03-07 · 03:174–179 | Идемпотентная очередь и conflict, blob до ack | `workspace-outbox.js`, `workspace-outbox-backup.js`, versioned store | частично | Request identity/retry/конфликты покрыты fixtures; ZIP включает реальные blobs и owner filter. Это не forensic timestamps и не доказательство полного offline phone E2E. |
| S03-08 · 03:185–196 | Policy immutable, UI+server gate, stale fail safe | policy engine, policy_versions, `workspace-report-model.ts` / service; season.izneraPolicyAnchor | частично | В compоser показаны программа/сезон/версия/источники/даты и причина блокировки. FTC требует явной проверки cover/content, decimal MB и периода материалов; формат только PDF. Зарезервированный season anchor читает точную policy ID; null/повреждённый anchor не наследует правила команды. Проверка anchors — `workspace-timeline-media.test.ts`; административный review и production activation не выполнены автоматически. |
| S03-09 · 03:202–212 | Core без LLM; generated отдельно | `src/modules/ai/provider.ts`, DisabledProvider, workspace deterministic memory | частично | Fake provider запрещён в production; hosted fetch имеет timeout/abort, bounded input/output и нейтральные ошибки. Core memory не использует LLM. Настоящий provider/секреты/production deployment не подключены. |
| S03-10 · 03:225–235 | Две команды и private files изолированы | RLS + membership checks, private media/report/handoff APIs | частично | Scoped disposable DB suites проверяют foreign-team/author/coach/revoke denials; rollover не меняет рабочую БД. Наличие этих проверок не заявляется полным security audit или школьной сертификацией. |
| S03-11 · 03:239–251 | GPS очищен, секреты private, revoke и export/delete | Sharp normalization, local redaction, private storage, account-data/lifecycle services | частично | Фото очищаются от EXIF/GPS; online redaction выполняется до отправки. Account export/signout и password-confirmed closure/team deletion подключены. Lifecycle fixtures проверяют точные ключи фото/миниатюры/чата, чужие ключи, cancel, late PUT/ACK и last-lead concurrency. Malware scanning, production/provider erasure и реальные сроки backup остаются незавершёнными. Account closure сохраняет командные объяснения и готовые отчёты с техническим авторством. |
| S03-12 · 03:257–269 | Метрики полезного процесса без private prose | analytics_events, `src/server/audit.ts`, study protocol | частично | Определить counters/duration, исключить demo, не логировать rationale/email/токены, не ранжировать учеников. |
| S03-13 · 03:34–36,271–289 | Надёжные jobs/health и порядок развития | `background-jobs.ts`, `/api/jobs/run`, health, mail/report/lifecycle workers | частично | Добавлены lease expiry, ограниченные попытки и нейтральные error codes. Lifecycle подтверждает DB commit и точный остаток storage, приостанавливает очистку при неизвестном PUT и после пяти ошибок без прогресса требует оператора. Legacy prefix cleanup запрещён. Fixture tests есть; production scheduler/mail/storage readiness и эксплуатационный мониторинг требуют внешней настройки. |

## 04 — доверие, правила и приватность

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S04-01 · 04:23,29–31 | Программа/сезон не наследует чужие правила | CompetitionProfile/PolicyVersion, seed profiles | частично | Сентябрьский UNKNOWN не вечен; актуальный официальный manual нужно проверить, исторический policy закрепить. |
| S04-02 · 04:41–59 | Action-level AI gate вместо общего обещания AI-safe | POLICY_ACTIONS/evaluatePolicy + server gate | реализовано в коде, не проверено | Rewrite/organize/summary/transcription/code имеют отдельные решения; strict transforms блокируются server-side. |
| S04-03 · 04:63–77 | Опубликовать новую reviewed policy и changelog | `actions.ts:createPolicyVersion`, policy_versions | код есть, текущий UX не подключён | Проверяющий, URL, version/effective/reviewed dates и regression evidence; не подделывать review timestamp. |
| S04-04 · 04:81–89 | Coach/generated/proposal не скрываются в student тексте | Versioned annotations + accepted-only Inbox/Memory/handoff | работает и проверено | Store/DB fixtures сохраняют исходного автора и запрещают чужую правку. Групповые предложения не меняют текст; handoff советы создаются отдельной авторской записью. |
| S04-05 · 04:95–102 | Приватные профили/фото/минимальные внешние данные | Private teams/files, online photo editor, owner-scoped outbox backup | частично | Маскирование видимых данных доступно до online upload; ZIP локальных фото приватен и может содержать оригинальный EXIF. Offline photo editor, malware service и внешняя AI privacy acceptance не завершены. |
| S04-06 · 04:108–124 | Школьный запуск имеет фактическую privacy/DPA/retention | `docs/PRIVACY.md`, `/privacy-policy`, deployment guides | нужна внешняя настройка | Владелец определяет провайдеров/регион/contact/правовую проверку; интерфейс не сертификат COPPA/KZ compliance. |
| S04-07 · 04:130–134 | Публичные утверждения соответствуют поведению | astra copy, public docs | частично | Не «cheat-proof», «официально approved», гарантированная награда, hash=authorship; проверяемые факты и ограничения. |
| S04-08 · 04:140–146 | Новый экспорт — immutable snapshot с provenance | `workspace-report-service.ts`, exports/manifest/output hashes; account lifecycle | частично | На свежей отдельной DB прошли 6 report-fixtures: новый snapshot после правки, неизменность прежнего файла, retry исходного snapshot, порядок/разделы, stale-preview conflict и tenant/revoke checks. Принятые связи включаются явно; предложения не становятся доказательствами. Отдельные lifecycle fixtures подтверждают team cleanup и сохранение ready report при account anonymization; production backup retention этими тестами не объявляется PASS. |
| S04-09 · 04:150–160 | Будущая AI-память цитирует и знает пробелы | `workspace-core.js` deterministic Memory; generated AI остаётся gated | отложено по условиям плана | Детерминированный поиск уже подключён. Генеративная память/автоматический вывод причин не добавлялись; human source quality/retrieval proof до открытия AI gate ещё нужен. |
| S04-10 · 04:166–172 | Red-team на своих fixtures | Role/RLS/media/inbox/handoff negative fixtures | частично | На свежих fixture DB проверены чужой автор/команда, revoke и rollover no-inheritance/rollback. Это ограниченные проверки, а не эксплуатационный pentest или подтверждение отсутствия всех уязвимостей. |

## 05 — пилоты и модель распространения

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S05-01 · 05:23–44 | Локальная FTC-команда начинает работу наRU/EN/KK | Auth/sidebar/core/iteration/inbox/handoff RU/EN/KK copy | частично | Новые рабочие сценарии имеют три набора подписей, user content не переводится. Global i18n:audit сейчас FAIL на старых redirected src/app/app English copy; проверка носителем KK не выполнена. |
| S05-02 · 05:50–58 | Пройти реальный 6-недельный пилот | `docs/PILOT_LAUNCH.md`, `docs/rknp` | отложено по условиям плана | Согласованные команды, consent, baseline и weekly observations; создание сайта не результат пилота. |
| S05-03 · 05:68–82 | Полезные ресурсы и поддержка до массовой рекламы | `/materials`, `/faq`, `/contact`, USER_GUIDE docs | частично | Checklist/handoff/non-AI guides доступны без private logs; никакой автоматической рассылки без поручения. |
| S05-04 · 05:88–92 | Invite и handoff помогают продолжить команду | Invites + `workspace-handoff.js/service`, existing report handoff scope | частично | Подготовка/выбор отчёта и явный lead rollover доступны. Новая команда/проект не копируют private evidence автоматически; old links/policy anchor сохранены на fixtures. Реальный сезонный handoff с пилотом ещё не наблюдался. |
| S05-05 · 05:100–121 | Бесплатны capture/linking/export/privacy | Free entitlements, no billing UI needed | реализовано в коде, не проверено | Нет paywall integrity/data export; предлагаемая цена школы — гипотеза, не подключённый тариф. |
| S05-06 · 05:139–165 | Проверить бюджет и права на реальные интеграции | Customer discovery; current metadata-only GitHub | отложено по условиям плана | Интервью с artifact walkthrough; интеграция не означает partnership/endorsement. |
| S05-07 · 05:169–175 | Expansion следует реальному retention | Evidence retrieval, organization/VEX/Contribution gates | отложено по условиям плана | Записать требуемый proof point до build org/платежей/новой программы. |

## 06 — измерения и риски

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S06-01 · 06:23,29–36 | Проверить поведение до больших расширений | Пилотный протокол/интервью | отложено по условиям плана |10 интервью, повторное использование, capture/exports и budget discussion измеряются вне кода. |
| S06-02 · 06:42–56 | Наблюдать поиск старого решения без подсказки | Study fixtures и task protocol | частично | Timestamp start/result/failed, одинаковая задача, не сообщать заранее правильный ответ. |
| S06-03 · 06:62–79 | Обновлять assumption ledgerA1–A10 | Research docs, no automatic confidence inference | отложено по условиям плана | Источник/дата/observed result для каждого assumption, не заменять похвалой владельца. |
| S06-04 · 06:87–94 | Evidence rate / closeout / retrieval / export time | analytics_events, study rows, accepted links | частично | Явные числитель/знаменатель, missing values≠0, real/demo раздельно; исходные тексты в analytics не нужны. |
| S06-05 · 06:98–112 | Не поощрять note/commit spam | UI/coach metrics | реализовано в коде, не проверено | Нет publicXP/student ranking; проверить будущие views и exports на accidental leaderboard. |
| S06-06 · 06:118–133 | Честные kill/pivot сигналы | Пилотные evidence reports | отложено по условиям плана | После 6–8 недель сравнить coverage/retrieval/cleanup/budget; нехватка данных не «успех». |
| S06-07 · 06:141–155 | Контролировать leak/stale policy/loss/cost/ownership | Denial tests, policy, quota/storage/team roles | частично | Owner и monitoring для риска; backup restore и multitenant tests до beta; отсутствие известного бага не гарантия безопасности. |
| S06-08 · 06:163–191 | Расширение gated реальными результатами | Onshape/AI/coach/VEX/org gates | отложено по условиям плана | Не реализовывать gated feature ради статуса матрицы; сохранять причину и критерий открытия. |

## 07 — исполнение и beta gates

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S07-01 · 07:23–49 | Валидация не подменяется полировкой | Пилот и research docs | отложено по условиям плана | Реальные согласованные команды/интервью и записи недели; simulated demo помечается. |
| S07-02 · 07:55–62 | Foundation evidence core работает совместно | Unified current shell/core/iteration/inbox/media/report/handoff | частично | Основные сценарии соединены и проверены scoped unit/DOM/DB tests. Полный человеко-управляемый guest→verify→offline→sync→report E2E и все launch gates ещё не подтверждены. |
| S07-03 · 07:68–78 | Первый пассивный источник надёжен | GitHub HMAC/idempotency/delivery history | нужна внешняя настройка | Fixtures локально плюс реальная delivery на staging; mapping автора подтверждён явно. |
| S07-04 · 07:84–108 | Composer и deterministic memory раньше writer | Report gate, explainWhy/search | частично | Текущая policy, selection/preview, old-evidence retrieval; AI отключён без потери core. |
| S07-05 · 07:112–124 | Coach/org/Onshape не задерживают core | legacy functions,501stubs | отложено по условиям плана | Подтверждённые usage/retention demand gates; no student ranking. |
| S07-06 · 07:130–160 |40foundation задач имеют реальные evidence | migrations/schema/tests/CI/source files | частично | Сопоставлены группамиS03; strictTS, env separation, RLS, canonical source и exports проверять, не просто считать файлы. |
| S07-07 · 07:166–172 | Проверки риска и доступности | Static/unit, disposable DB suites, browser QA; root validation log | частично | Фактические passed/failed/not-run фиксируются отдельно; i18n:audit имеет известный legacy FAIL. Physical touch, screen reader, носитель KK и вся ручная приёмка не заявляются пройденными. |
| S07-08 · 07:178–192 | Публичная beta имеет все launch gates | `docs/PILOT_LAUNCH.md`, privacy/security/recovery docs | частично |3 пилота≥4 нед, две команды используют memory,≤45 сек closeout, revoke/export/delete, policy, legalreview и support подтверждены отдельно. |
| S07-09 · 07:194–206 | Scope firewall с поправками владельца | Root promptpriority | отложено по условиям плана | Не добавлять inventory/CRM/leaderboard/native/graph DB; утверждённый chat и GLB сохраняются. |

## 08 — имя, стиль и сообщения

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S08-01 · 08:23–54 | Использовать выбранное имя Iznera | Brand assets/copy; exact protected demo label refresh in workspace-store | частично | Публичный бренд Iznera. Из старого встроенного synthetic demo обновляется только точная заводская подпись; authored/copy/team text и storage keys не переписываются. Formal trademark clearance не выполнен. |
| S08-02 · 08:60–89 | Простое обещание сохранённой истории и авторского why | astra copy/public demo | частично | Конкретный механизм source→test→decision, no AI boilerplate или unverifiable ROI. |
| S08-03 · 08:95–101 | Нет ложных сертификатов/award guarantees | Public pages/docs/export disclaimers | частично | Audit copy для «officially»,«award»,«cheat-proof»; original authorship не доказывается hash. |
| S08-04 · 08:107–123 | Безопасное public demo и честный CTA | `/demo/workspace`, product-entry/session CTA, static demo routes | работает и проверено | Публичный пример отделён от server workspace; вошедший пользователь не получает demo вместо реальной команды. Synthetic labels остаются явными; readonly editor не создаёт фиктивного why. |
| S08-05 · 08:125–135 | Единые tokens/крупный текст/functional motion | Theme bootstrap/controller + public/workspace/account CSS, sidebar/command | частично | Согласованы dark/milk иконка, сохранение preference/cross-tab, reduced motion и крупная типографика. Переключение темы не вызывает render данных. Browser QA выполнен ограниченно; физический touch/zoom200/screen-reader coverage не полный. |
| S08-06 · 08:139–153 | Trust statements доказуемы | Privacy/export/provenance/policy | частично | Claims соответствуют data lifecycle; «export anytime» не означает backup всего storage; unknown riskyAIoff. |
| S08-07 · 08:159–168 | Понятные названия Capture/Inbox/Why/handoff | `workspace-core.js` context help, command dialog, shared labels | частично | Контекстная справка доступна по представлению; Ctrl/⌘+K находит раздел/запись, Ctrl/⌘+B сворачивает sidebar. Новые core labels трёхъязычны; весь legacy English UI ещё не локализован. |

## 09 — актуальность источников

| ID / источник | Проверяемый сценарий | Реализация / сущность | Статус сверки | Задача и приёмка |
| --- | --- | --- | --- | --- |
| S09-01 · 09:23–31 | Датированные правила перед policy-sensitive release | Source register, PolicyVersion source URLs; `docs/REPORT_COMPOSER.md` | частично | 01.11.2026 прочитан официальный FTC manual 2026–2027 TU06, A201–A202. Это source check, а не human review/production activation. Ограничения хранятся в проверяемой версии; текущий сезон и инструкции мероприятия перепроверяются перед регистрацией policy и подачей. |
| S09-02 · 09:37–48,58–82 | Реестр различает rule/market/vendor/community evidence | Исходное dossier S01–S30 | реализовано в коде, не проверено | Исправить malformedURL из PDF extraction перед запросом; не принимать vendorclaim за независимый ROI. |
| S09-03 · 09:160–165 | Сезонный/квартальный refresh имеет owner и trigger | Docs/operational process; policy UI ещё не завершён | частично | Newmanual/stale→review; publiclaunch→brand/competitors; schoolsale→privacy/DPA; прошлый сезон остаётся pinned. |
| S09-04 · 09:171–179 | Не использовать устаревшую неопределённость как вечный факт | Sept baseline +31Octaudit | частично | Прямое свежее подтверждение; число участников≠платёжный рынок, сайт конкурента≠его retention. |

## Реализация к 1 ноября и незавершённая приёмка

Подключены Обзор, полные Итерации, решения по умолчанию с явным журналом, детерминированная Память, группируемая Хронология, Inbox batch/proposals, контекстная справка, быстрый переход, согласованные темы и подготовка handoff. Lead-only переход сезона проходит только после отдельного preview/confirm: новый проект пустой, перенос taxonomy опционален, source/annotations/links остаются в старом проекте. Old-season policy закрепляется; новый сезон имеет явный UNKNOWN и не наследует прежние правила.

Не следует объявлять выполненными:

- проверку полезности и времени поиска с настоящим новым участником, интервью/четыре недели пилота и готовность платить;
- очистку production/provider copies и всех backups: локально проверенный lifecycle удаляет зарегистрированные командные данные/объекты, а закрытие аккаунта сохраняет командные инженерные объяснения и готовые отчёты; реальные scheduler/retention/operator acceptance ещё нужны;
- рабочие внешние Resend/Supabase/GitHub delivery/TURN/public HTTPS и эксплуатационную поддержку;
- полный auth/offline/reload/reconnect E2E на физических телефонах, screen-reader acceptance и проверку носителем KK;
- глобальную локализацию: `i18n:audit` выдаёт FAIL на legacy redirected `src/app/app` English copy. Это известная незавершённая проверка, а не PASS новых словарей всего продукта;
- автоматическое назначение правил новому сезону: после rollover его конкурсный режим остаётся закрытым до отдельного явно проверенного policy назначения;
- школьную правовую сертификацию или гарантию награды. Известные ограничения CSP не называются доказанной эксплуатацией XSS.

Batch gallery, bounded geometry GLB thumbnail, owner-scoped полный ZIP outbox и lease/AI guard реализованы в текущем коде. Для старой GLB без новой миниатюры сохраняется fallback; orthographic thumbnail не обещает достоверное отображение всех материалов/текстур.

## Журнал доказательств этого документа

| Проверка | Результат |
| --- | --- |
| Полный промпт, исходные 00–09, источники текущего frontend/backend | Прочитаны; route и entity mapping сверены чтением кода 31.10.2026. |
| Git baseline | Существующие незакоммиченные изменения сохранены; этот документ не меняет данные/схему. |
| Backend существует | Подтверждено source: auth, membership, transactions, canonical entities, private storage, report и outbox. Не browser-only app. |
| Unit/static/typecheck/build/DB/E2E | После исходного аудита выполнены scoped core/iteration/timeline/inbox/handoff tests, DB fixtures и TypeScript. Общие totals/build и browser evidence добавляет root validation; i18n:audit имеет известный FAIL, full physical E2E не подтверждён. |
| Реальные Resend/Supabase/GitHub/TURN/public deployment | **Не проверены** этой сверкой. Configuration state не читается с раскрытием секретов. |
| Интервью/4-week pilots/польза/готовность платить | **Не выполнены этой разработкой**; это продуктовые эксперименты. |

После изменения сценария обновляется соответствующая строка с конкретной проверкой. Статус «работает и проверено» допустим только для проверенного scope, не для всей строки с неподтверждёнными внешними или человеческими условиями.

## Дополнение: проверенный scope новых сценариев, 1 ноября 2026

- `workspace-iterations.test.mjs` / `workspace-store.test.mjs`: draft/close/reopen, неизменяемые версии, readonly initial focus и exact factory demo rebrand без переписывания копий.
- `workspace-filters.test.mjs` / `workspace-i18n.test.mjs`: accepted-only grouping, 1000-record paging, scroll retention и локализованные empty actions.
- `workspace-inbox.test.mjs`: proposal selection и preview не отправляют POST; confirmation, revision chaining и partial retry с прежним requestId проверены.
- `workspace-handoff.test.mjs`: ручной export selection и двухэтапный rollover confirm, повтор после network failure с прежним payload.
- `workspace-handoff.db.test.ts`: два теста пройдены на свежей disposable БД `tracelab_unified_test_1793517985150_522b1f9b`. Проверены lead-only/negative roles, stale preview, rollback, concurrent idempotency, пустой новый проект, старые originals/links/revision и old-policy pin/new-policy UNKNOWN после смены текущего профиля команды. Рабочая база команды не была целью этого прогона.
- `account-lifecycle.db.test.ts`: 11 сценариев зарегистрированной `0015` на новой disposable БД: pending/cancel/fences, last-lead concurrency, exact-key team purge, account anonymization с сохранённым инженерным авторством, NULL/чужой cleanup receipt, lease/late ACK и unresolved PUT pause/recovery. [Операторская процедура и исключения](ACCOUNT_LIFECYCLE.md).

Агрегированные итоги unit/static/DB не дублируются здесь, чтобы не выдать scoped run за полный product acceptance.

Полный последующий disposable DB run и итоговые counts фиксируются [журналом валидации](VALIDATION_2026-11-01.md) и приватным логом `C:/projects/ernurs projects/iznera-isolated-db-final.log`. Отдельная [репетиция восстановления](RECOVERY_REHEARSAL.md) проверяет новую БД и три fixture-объекта с хешами и отказом чужой команде. Эти результаты не подтверждают production backup/retention, удаление настоящей команды или доставку внешних сервисов.
