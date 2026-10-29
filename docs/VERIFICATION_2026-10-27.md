# Iznera — проверка реализации, 27 октября 2026

Рабочая копия: C:/Users/User/projects/TraceLab-web. Журнал доказательств не является сертификатом готовности. [Матрица](IMPLEMENTATION_MATRIX.md) · [исходный аудит](IMPLEMENTATION_BASELINE_2026-10-26.md).

Основной root Next.js и отдельная PostgreSQL tracelab_unified_dev_20261026. Тесты используют собственные случайные фикстуры; личные данные не сбрасывались и db:seed не запускался.

| Проверка | Результат | Граница |
| --- | --- | --- |
| Полный typecheck | Pass, root 27.10; повтор после account также pass | Типы текущего дерева на момент запуска |
| Default unit suite | 83 pass / 0 fail / 38 skip, root 27.10 до последних расширений | DB skip видимы; отдельные legacy DB suites не объявлены проверенными |
| Explicit current DB suites | 44 pass / 0 skip, 7 suites, root 27.10 после team | Отдельный запуск с env; не сумма с default результатом |
| Все website/tracelab/*.test.mjs | 74/74, root 27.10 до offline-photo расширения | Static/store/i18n/server/outbox/filter/editor/source-copy, не browser E2E |
| Core PostgreSQL | 8/8, также в объединённых 44 | RLS, author/version, transaction rollback, replay/import/layout и конфликтное предложение |
| Media | 15 unit + 7 DB; editor Node 2/2 | Bytes/GLB/budgets/roles/staging/quota/version; не live Supabase |
| Offline photos | 10 outbox + 1 media HTTP owner-binding | Blob/idempotency/ownership/limits/ACK, не физический offline-restart |
| Account settings | 7 unit/HTTP + 6 DB, scoped lint/typecheck pass | Profile/name/locale, own sessions/revoke; email change/deletion отсутствуют |
| Team management | 6 DB, также в объединённых 44 | Role boundaries, last-lead race, revoke/restore/invitations/audit |
| GitHub Sources | 6 contract + 6 DB, copy 2/2, scoped lint/typecheck pass | Подписанные фикстуры, replay/failure/RLS; реального подключения нет |
| Report без DATABASE_URL | Ранний запуск: 4 pass / 5 skip | Без БД suite собирается безопасно и явно пропускает DB |
| Report с .env.local | **11/11: 6 unit + 5 DB**, 27.10 после preflight-fix | Policy/escaping/PDF/immutable retry/revoke/access/directed evidence |
| Report syntax/scoped ESLint | Pass 27.10 | Frontend composer, service/model/render и tests |
| A4/Letter visual PDF | **3 + 3 страницы**, все 6 просмотрены | RU/KK глифы, изображение, поля, footer без лишних страниц |
| Next production build | Pass у root до последних account/member изменений | Требуется итоговый повтор после финальных правок |
| Backup/restore | DB-only pass | Core table counts изолированной копии совпали; файлы отдельно |

Первый report DB запуск после прерывания дал ECONNREFUSED на 127.0.0.1:5432. PostgreSQL был остановлен. После штатного start-local-db report DB 5/5 прошли; suite не отключалась ради зелёного результата.

## Проверка отчётов

- Неизвестная, устаревшая или иная сезонная политика блокирует конкурсный прямой API-запрос; инженерный отчёт разрешён с предупреждением.
- Авторский HTML экранируется; ключи приватного storage не попадают в публикуемый manifest.
- Реальные PDF содержат Noto Sans, изображение и вложенный tracelab-manifest.json. Число объектов Page совпадает с сообщённым числом страниц.
- Тот же request ID/payload возвращает тот же экспорт; иной payload отклоняется.
- Правка аннотации даёт новую версию экспорта; старый output остаётся неизменным.
- Ошибка после storage удаляет неподтверждённый объект и сохраняет failed job. Retry использует исходный snapshot.
- Другой tenant не получает файл. Отзыв членства во время storage-read блокирует выдачу.
- Preview содержит проверенную ownership-метку для персонального выбора и параметры повторения собственного job.
- Отмена незавершённого job сохраняется; готовый отчёт не перезаписывается.
- Ошибочная связь решение → будущая итерация, обратный SUPPORTS, другое решение, suggested/rejected или исключённый из отчёта источник не скрывают отсутствие доказательства. Preview учитывает текущий выбор записей; сервер повторяет проверку.
- Неконечные, нулевые, отрицательные и дробные page limits политики отклоняются вместо неявного разрешения.

Команда: задать DOTENV_CONFIG_PATH=.env.local, затем node node_modules/vitest/vitest.mjs run tests/workspace-report.test.ts tests/workspace-report.db.test.ts.

Визуальные синтетические фикстуры: C:/projects/ernurs projects/tracelab-report-qa/. Это не пользовательское портфолио. Все шесть PNG просмотрены после исправления footer drawing: пустых footer-only страниц нет.

## Наблюдения в браузере

Root наблюдал signup → локальная verification → signin → пустая команда/проект → первая запись → reload. После нового запуска сервера тестовый аккаунт и запись сохранились. Это подтверждает серверное сохранение на проверенном пути.

Root 27.10 загрузил фото и GLB через интерфейс: обе фикстуры сохранены, фото открылось и синтетический куб действительно отрисовался в Three viewer. Обновлённый Composer, account и offline проходят дополнительную проверку; результаты дополняются ниже. Физический телефон, Safari/Firefox, screen reader, реальный offline restart, 200% zoom и все responsive размеры пока не подтверждены.

## Внешние и человеческие gates

Не активированы реальные Resend/Supabase/GitHub; нет production deployment, миграции личной старой БД, combined object restore, пилота 3 команды × 4 недели, юридической проверки/актуальных правил. Нет production-профильных LCP/INP/CLS. Тестовые числа не заменяют эти проверки.

## Поздние результаты

Итоговый проверенный checkpoint, 27 октября 2026 года, перед завершением по просьбе пользователя:

| Команда / проверка | Результат |
| --- | --- |
| npm test | 86 passed, 44 DB skipped; пропуск базы в этом запуске явный |
| npm run test:db | 44 passed, 0 skipped, 7 suites с отдельным локальным DB окружением |
| Все website/tracelab/*.test.mjs | 82/82 passed |
| npm run typecheck | Passed |
| npm run lint | Passed |
| npm run build | Passed; production build завершён в 11:42 |
| scripts/check-migrations.mjs | 12 зарегистрированных миграций применены, все хеши совпали |

В браузере root сохранил фото в локальную очередь, перезагрузил страницу, скачал те же байты (SHA-256 совпал), выполнил sync: 1 sent / 0 pending, затем увидел файл в Gallery. /account открывается. Это проверка персистентной очереди/выдачи/синхронизации; физический режим без сети и перезапуск устройства не имитировались как пройденные.

Настоящая модель отрисована в viewer; синтетическое фото загружено и открыто. Полный responsive/axe/manual accessibility, LCP/INP/CLS и полный многоаккаунтный browser E2E остаются непроверенными. Новый axe harness не создавался. Отдельного combined DB+object restore нет; старые опасные удаления fail-closed, но новый пользовательский lifecycle удаления не реализован.

Последние изменения после production build относятся к документации. Ни одна итоговая цифра не заменяет внешние сервисы, актуальные правила, проверку приватности или реальные исследования.


## Финальная остановка по просьбе владельца

27.10.2026: production build и ESLint прошли после подключения готового Inbox. Typecheck также прошёл. Последний общий прогон: 86 passed / 0 failed / 44 skipped (DB opt-in); отдельный DB прогон — 44 passed / 0 failed / 0 skipped. Static suite — 82 passed / 0 failed / 0 skipped. Дополнительные Inbox-проверки фиксируются отдельной записью ниже, если завершены после этих прогонов.

Все 12 зарегистрированных миграций применены, SHA256 каждого SQL совпал с журналом базы. Старые массовые cleanup jobs и небезопасное удаление команды теперь отклоняются, сохраняя исходные файлы.

Browser QA: тестовое фото сохранено в IndexedDB, осталось после reload, скачанный исходник имеет тот же SHA256; отправка завершилась с 1 sent / 0 pending, фото появилось в приватной Gallery. Тестовая GLB-модель отрисовалась; аккаунт, Timeline и Inbox открылись. Снимки сохранены в C:/projects/ernurs projects/tracelab-final-2026-10-27/ (home, account, timeline, gallery). Внешних писем и реального GitHub push webhook не выполнялось.

Полные Axe, пять целевых CSS viewport размеров, 200% zoom, физический touch, Safari/Firefox и production Web Vitals остаются непроверенными. Проверка backup пока DB-only; объединённый restore файлов и базы не подтверждён. Эти пункты и остальные частичные этапы перечислены в IMPLEMENTATION_MATRIX.md. Изменения сохранены в локальной рабочей копии; этот этап не объявляет весь ZIP-промпт выполненным.

Финальный повтор 11:48 после Inbox: npm test — 86 passed / 0 failed / 48 skipped (DB opt-in); npm run test:db — 48 passed / 0 failed / 0 skipped, 8 suites; npm run test:static — 85 passed / 0 failed / 0 skipped. Inbox DB4/4 включены в штатный test:db. Build, lint и typecheck прошли; более поздние правки касались тестового runner и документации.
