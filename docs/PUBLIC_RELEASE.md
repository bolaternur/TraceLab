# Iznera: подготовленный публичный выпуск

Проверено 10 ноября 2026. Это пакет конфигурации, а не опубликованный сайт: публичный URL, облачная база, отправитель писем и проверка двумя аккаунтами ещё не подтверждены. Разворачивается **корневое Next.js приложение** с API. Статическая презентация из `website/` не заменяет сервер регистрации и командных данных.

## Что подключить

Нужны доступ Render к актуальному репозиторию и выбранной ветке, отдельный Supabase проект пилота и Resend с подтверждённым доменом отправителя. Секреты вводятся в панели провайдеров или защищённое окружение release-процесса, не в чат, Git или командную строку. Собственный домен сайта необязателен: Render выдаёт HTTPS `onrender.com`; домен отправителя писем должен принадлежать владельцу. [Render Web Services](https://render.com/docs/web-services), [Resend Verified Domains](https://resend.com/docs/dashboard/domains/introduction).

В Supabase создаются отдельная restricted login role `tracelab_runtime` и private Storage bucket. Для runtime нужны `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`, без владения таблицами/членства в owner role. В отдельном проекте пилота **до миграций отключить Data API**: Dashboard → Integrations → Data API → Enable Data API off. Таблицы `users`, `sessions` и `account_*` рассчитаны на server-only PostgreSQL и не все имеют RLS; автоматические grants Supabase могут открыть их через REST. Storage API остаётся отдельным используемым сервисом. Сервис использует собственные аккаунты и PostgreSQL; Supabase Auth не подключается автоматически. [Роли PostgreSQL](https://supabase.com/docs/guides/database/postgres/roles), [защита Data API](https://supabase.com/docs/guides/api/securing-your-api).

`DATABASE_URL` — Session pooler с пользователем `tracelab_runtime.<project-ref>`; `DATABASE_RUNTIME_ROLE=tracelab_runtime`. Используйте URL из Connect своего проекта, а не пример. IPv4 Session pooler поддерживает постоянный Node-процесс. `DATABASE_MIGRATION_URL` — отдельный owner URL того же проекта/базы, только в release-процессе; Direct connection подходит при доступном IPv6, иначе Session pooler. Transaction pooler на 6543 wrapper не принимает. [Соединения Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Оба URL должны содержать `sslmode=verify-full`. Если цепочке сертификата нужен root CA, скачайте сертификат проекта, добавьте его на Render как secret file и укажите `sslrootcert=/etc/secrets/<имя-файла>` в URL; для release-процесса путь будет его собственным. Не используйте `rejectUnauthorized=false`, `sslmode=no-verify` или `NODE_TLS_REJECT_UNAUTHORIZED=0`. Проверка сертификата должна реально пройти. [Supabase TLS](https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-ssl).

Private bucket хранит фото, модели, чат-вложения и PDF. `SUPABASE_SERVICE_ROLE_KEY` остаётся серверным: он привилегированный, поэтому выделен отдельный проект, bucket проверяется как private, а доступ участников проверяет сервер Iznera. Ограничение bucket должно допускать поддерживаемые файлы, включая видео до 30 MiB; приёмка включает фото 15 MiB и GLB 25 MiB. [Private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Порядок выпуска

1. Зафиксировать проверенный исходный код вместе с `render.yaml`; выбрать region рядом с Supabase **до** создания ресурсов. По умолчанию указан Frankfurt. Существующие личные базы и `.data` не переносить автоматически: новый пилот начинает с пустой выделенной БД.
2. В отдельном чистом checkout без `.env*` файлов (кроме `.env.example`) установить зависимости: `npm ci --include=dev`. Через secret settings передать `DATABASE_URL`, `DATABASE_RUNTIME_ROLE`, `DATABASE_MIGRATION_URL`, `SUPABASE_URL`. Выполнить `node scripts/release-migrate.mjs` — это только read-only проверка настроек/идентичностей. После проверки целевой базы выполнить `node scripts/release-migrate.mjs --apply`. Применяются зарегистрированные миграции и grants, затем проверяются хеши; на дату пакета в journal 15 миграций. `db:seed`, `db:push`, reset и импорт чужой локальной базы не выполняются.
3. Создать Blueprint из `render.yaml`. Он содержит только один **бесплатный preview** Web Service, без автоматических deploy после новых коммитов, cron, paid disk или migration hook. Поля `sync: false` запрашиваются при первом создании. Задать runtime DB URL, два независимых случайных секрета минимум 32 символа (`SECRETS_ENCRYPTION_KEY`, `CRON_SECRET`), Resend key/`MAIL_FROM`, Supabase URL/key/bucket. Сохранить защищённую резервную копию encryption key. Owner URL в Web Service запрещён. [Blueprint reference](https://render.com/docs/blueprint-spec).
4. Build: `npm ci --include=dev && npm run build`. Start: `node scripts/start-production.mjs`. Скрипт проверяет production-настройки и ограниченную DB role, затем запускает `next start` на `0.0.0.0:$PORT`. Если `APP_URL` не задан, используется настоящий `RENDER_EXTERNAL_URL`. Для собственного домена задать точный HTTPS `APP_URL` и выполнить новый build/deploy. Node ограничен веткой 22.x. [Render env](https://render.com/docs/environment-variables), [Node version](https://render.com/docs/node-version).
5. Проверить `/api/health`, затем регистрацию, письмо, подтверждение, вход, код команды и общие материалы в двух разных профилях браузера; третий аккаунт другой команды должен получить отказ на прямые API/файлы. Проверить upload/download/PDF после restart. Проверить точные Host/Origin/HTTPS forwarded headers и реальное число доверенных proxy hops перед многокомандным пилотом. Полная процедура: [PILOT_LAUNCH.md](PILOT_LAUNCH.md).

Миграция и старт разделены намеренно: Web Service никогда не получает owner connection. Wrapper отказывается читать локальные `.env`, `.env.local`, `.env.production` и `.env.production.local`, чтобы случайная development-конфигурация не подменила целевую базу. Конфигурационные ошибки выводят имена настроек, без значений секретов. Внешние проверки не подтверждены локальными fixture-тестами.

## Доставка писем без ручного запуска

Для повторных попыток доставки нужен доверенный scheduler раз в минуту. Подготовлена команда `node scripts/dispatch-account-mail.mjs`, ей нужны только публичный `APP_URL` и тот же `CRON_SECRET`. Она делает POST `/api/account/mail-dispatch`, запрещает redirects и пишет только числовые счётчики. Не запускайте её до настройки живого Resend: вызов действительно отправляет ожидающие письма.

После выбора стоимости можно создать Render Cron Job отдельно: runtime Node, build command `node --version`, command выше, schedule `* * * * *`, Node 22.x, две переменные в secret settings. Включить уведомления оператору о failed runs; 503 означает проблему доставки/исчерпанные попытки. Blueprint сам scheduler не создаёт. Render Cron стоит минимум $1/месяц и тарифицируется по длительности. [Render Cron Jobs](https://render.com/docs/cronjobs).

## Стоимость и ограничения

Снимок цен, без покупки; итог панели, налоги, домен и превышение квот проверяются перед заказом.

| Вариант | Основа расходов | Для чего годится |
| --- | --- | --- |
| Preview | Render Free + Supabase Free + Resend Free | Проверка подключения; Render засыпает после 15 минут и теряет локальные файлы, Supabase Free может паузиться после недели неактивности. Не обещать постоянную доступность. |
| Небольшой always-on пилот | Render `0.5c-512mb` $7/месяц; либо `1c-2g` $25/месяц; Supabase Pro от $25/месяц; Resend Free в пределах квот | Минимальная сумма с 512 MB и одним Cron — от $33/месяц, до usage/tax/domain. Это оценка, не подтверждённая ёмкость под PDF/модели; проверить память и нагрузку. |

Render plan IDs и цены: [официальная таблица](https://render.com/pricing), [официальное пояснение планов](https://render.com/articles/set-up-self-hosted-github-actions-runners-on-render). Ограничения Free: [Render](https://render.com/docs/free). Supabase Free: 500 MB БД и 1 GB файлов; Pro начинается с $25/месяц: [Supabase pricing](https://supabase.com/pricing). Resend Free: 3 000 писем/месяц, 100/день; подтверждение своего домена всё равно обязательно: [Resend pricing](https://resend.com/pricing). Никакой план этой подготовкой не куплен.

## Индексация и сохранность

HTTPS-сайт и появление в Google — разные этапы. По умолчанию `INDEX_PUBLIC_SITE=false`: robots закрывает обход, sitemap пустой, статические страницы сохраняют noindex. После приёмки можно выставить `INDEX_PUBLIC_SITE=true` **и пересобрать**: только `/`, `/features`, `/about`, `/faq`, `/contact`, `/privacy-policy` получают index/follow и canonical, попадают в sitemap. Research/materials, demo, auth, workspace, API и прямые `/_presentation/*` дубликаты исключены. Отдельно подтвердить владение сайтом в Search Console и отправить sitemap; срок/наличие индексации не гарантируется. Robots/noindex не заменяют авторизацию. [Google о sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Общий storage adapter теперь обслуживает также legacy capture/media/export; выбор Supabase не оставляет эти пути на временном диске. При отсутствии cloud-настроек/ошибке облака fallback на local не происходит. Для существующего local проекта сохранён local provider: смена переменной **не переносит старые файлы**. Перед переключением существующей базы переносить все referenced objects с теми же keys, сверять хеши и связи; до этого сохранять прежний provider/диск. Подготовка не удаляет старые файлы и не меняет их ключи.

Перед реальными данными команд требуется проверенное восстановление БД + объектов + encryption key в отдельной среде. Бэкап PostgreSQL сам по себе не содержит Storage objects. [Supabase database backups](https://supabase.com/docs/guides/platform/backups). Пока не проверены живая доставка, межкомандная изоляция в облаке, восстановление, proxy headers, scheduler и загрузки у лимитов, пакет считается подготовленным, а публичный пилот — не принятым.
