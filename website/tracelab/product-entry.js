// The same presentation can run independently on Pages or as part of the server app.
// Never label browser-local data as team storage on the static build.
const labels = {
  ru: { create: 'Создать команду бесплатно', signin: 'Войти', demo: 'Посмотреть демо', storage: 'В рабочей области записи хранятся в базе вашей команды. Демо хранится только в этом браузере; перенос личного проекта выполняется после предварительного просмотра и подтверждения.' },
  en: { create: 'Create a team — free', signin: 'Sign in', demo: 'View demo', storage: 'The workspace saves records in your team database. Demo projects stay in this browser; moving a personal project requires a preview and confirmation.' },
  kk: { create: 'Команданы тегін құру', signin: 'Кіру', demo: 'Демоны көру', storage: 'Жұмыс кеңістігіндегі жазбалар команда дерекқорында сақталады. Демо жобалар осы браузерде қалады; жеке жобаны көшіру үшін алдын ала қарау және растау қажет.' },
};
const serverCopy = {
  ru: {
    faqBackupA:'Скачай резервную копию JSON или отчёт PDF / HTML. Перенос проекта в команду начинается с предварительного просмотра; исходная копия сохраняется.',
    faq3dA:'После входа доступны приватная галерея JPEG, PNG, WebP и просмотр 3D-моделей GLB. PDF и CSV можно хранить как вложения. STEP и OBJ пока не преобразуются.',
    featuresText:'Рабочая область объединяет граф, хронологию, испытания, решения, галерею и 3D-модели в базе команды.',
    pricingTitle:'Все функции бесплатны.',pricingText:'Создавай команду, связывай записи и сохраняй отчёты без подписки.',pricingNote:'Общие ограничения объёма файлов и запросов защищают доступность сервиса. Платных уровней доступа нет.',
    privacyTitle:'Материалы доступны твоей команде.',privacyText:'Записи и версии сохраняются в базе команды, файлы — в приватном хранилище. Доступ проверяется по членству в команде. Офлайн-черновики остаются на этом устройстве до отправки.',
    privacyControl:'Сохраняй отдельные резервные копии. Проверяй фотографии перед загрузкой. Облачные сервисы и публичное размещение требуют отдельной настройки; текущий запуск работает локально.',
    step4Text:'Вернись к записям через граф и хронологию. Скачай JSON или отчёт PDF / HTML.'
  },
  en: {
    faqBackupA:'Download a JSON backup or a PDF / HTML report. Team imports start with a preview and preserve the original copy.',
    faq3dA:'Sign in to use the private JPEG, PNG and WebP gallery and GLB model viewer. PDF and CSV can be stored as attachments. STEP and OBJ conversion is not supported yet.',
    featuresText:'The workspace brings the graph, timeline, tests, decisions, gallery and 3D models together in the team database.',
    pricingTitle:'All features are free.',pricingText:'Create a team, connect records and save reports without a subscription.',pricingNote:'Shared file and request limits protect service availability. There are no paid access tiers.',
    privacyTitle:'Evidence belongs in your team.',privacyText:'Records and versions are saved in the team database; files use private storage. Access is checked against team membership. Offline drafts stay on this device until sent.',
    privacyControl:'Keep separate backups and review photos before uploading. Cloud services and public hosting require separate configuration; this installation currently runs locally.',
    step4Text:'Return to records through the graph and timeline. Download JSON or a PDF / HTML report.'
  },
  kk: {
    faqBackupA:'JSON сақтық көшірмесін немесе PDF / HTML есебін жүктеп ал. Командаға көшіру алдын ала қараудан басталады; бастапқы көшірме сақталады.',
    faq3dA:'Кіргеннен кейін JPEG, PNG, WebP жеке галереясы және GLB 3D модельдерін қарау қолжетімді. PDF пен CSV файлдарын тіркеуге болады. STEP және OBJ түрлендіруі әзірге жоқ.',
    featuresText:'Жұмыс кеңістігі графты, хронологияны, сынақтарды, шешімдерді, галереяны және 3D модельдерді команда дерекқорында біріктіреді.',
    pricingTitle:'Барлық мүмкіндік тегін.',pricingText:'Жазылымсыз команда құр, жазбаларды байланыстыр және есептерді сақта.',pricingNote:'Файлдар мен сұрауларға ортақ шектеулер қызметтің қолжетімділігін қорғайды. Ақылы рұқсат деңгейлері жоқ.',
    privacyTitle:'Материалдар өз командаңа қолжетімді.',privacyText:'Жазбалар мен нұсқалар команда дерекқорында, файлдар жеке қоймада сақталады. Рұқсат команда мүшелігі бойынша тексеріледі. Офлайн нобайлар жіберілгенше осы құрылғыда қалады.',
    privacyControl:'Бөлек сақтық көшірмелерін сақта. Фотоларды жүктемес бұрын тексер. Бұлттық қызметтер мен жария орналастыру бөлек баптауды қажет етеді; қазір сайт жергілікті жұмыс істейді.',
    step4Text:'Жазбаларға граф пен хронология арқылы орал. JSON немесе PDF / HTML есебін жүктеп ал.'
  },
};
function update() {
  const locale = document.documentElement.lang in labels ? document.documentElement.lang : 'ru';
  const text = labels[locale];
  document.querySelectorAll('a.a-button.primary[href*="/workspace"]').forEach(link => {
    link.href = '/auth?mode=signup';
    const label = link.querySelector('[data-i18n]');
    if (label) { label.dataset.productLabel = 'create'; label.removeAttribute('data-i18n'); label.textContent = text.create; }
  });
  document.querySelectorAll('[data-product-label="create"]').forEach(label => label.textContent = text.create);
  document.querySelectorAll('[data-i18n="projectStorageNote"],[data-i18n="faqStorageA"]').forEach(el => el.textContent = text.storage);
  for(const [key,value] of Object.entries(serverCopy[locale]))document.querySelectorAll(`[data-i18n="${key}"]`).forEach(el=>el.textContent=value);
  let signIn = document.querySelector('[data-product-signin]');
  if (!signIn) {
    const actions = document.querySelector('.a-hero .a-actions');
    if (actions) { signIn = document.createElement('a'); signIn.className = 'a-button secondary'; signIn.href = '/auth?mode=signin'; signIn.dataset.productSignin = ''; actions.append(signIn); }
  }
  if (signIn) signIn.textContent = text.signin;
  try { document.cookie = `pt_lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
}
update();
new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
