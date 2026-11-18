import {getWorkspaceLocale,formatDate,formatNumber,recordType} from './workspace-i18n.js';
import {reportOrderedRecords,moveReportRecord,reportSectionSequence,reportAttachmentStatus} from './workspace-report-model.js';

const messages={
  title:['Отчёт проекта','Project report','Жоба есебі'],
  intro:['Выберите сохранённые материалы. Тексты авторов и происхождение сохраняются; новые выводы не генерируются.','Choose saved evidence. Authors’ text and provenance are preserved; no new conclusions are generated.','Сақталған материалдарды таңдаңыз. Автор мәтіні мен шығу тегі сақталады; жаңа қорытынды жасалмайды.'],
  format:['Формат','Format','Пішімі'],paper:['Размер страницы','Paper size','Парақ өлшемі'],purpose:['Назначение','Purpose','Мақсаты'],
  engineering:['Инженерный отчёт','Engineering report','Инженерлік есеп'],competition:['Конкурсная подача','Competition submission','Байқауға ұсыну'],
  scope:['Состав','Scope','Құрамы'],project:['Материалы проекта','Project evidence','Жоба материалдары'],personal:['Мои авторские записи','My authored records','Менің авторлық жазбаларым'],handoff:['Передача проекта','Project handoff','Жобаны тапсыру'],
  selection:['Выбор записей','Record selection','Жазбаларды таңдау'],all:['Выбрать все','Select all','Барлығын таңдау'],none:['Снять выбор','Clear selection','Таңдауды алып тастау'],
  selected:['Выбрано','Selected','Таңдалды'],records:['Доступно записей','Available records','Қолжетімді жазбалар'],empty:['В выбранном составе нет записей.','No records in this scope.','Таңдалған құрамда жазбалар жоқ.'],
  ack:['Я проверил выбранные материалы, предупреждения и разрешения на передачу','I reviewed the selected evidence, warnings and permission to share','Таңдалған материалдарды, ескертулерді және бөлісу рұқсаттарын тексердім'],
  create:['Сформировать отчёт','Generate report','Есепті құрастыру'],close:['Закрыть','Close','Жабу'],pending:['Формируется…','Generating…','Құрастырылуда…'],
  download:['Скачать отчёт','Download report','Есепті жүктеу'],loading:['Проверяем состав и правила…','Checking evidence and policy…','Құрам мен ережелер тексерілуде…'],
  blocked:['Конкурсный режим доступен после проверки актуальных правил. Инженерный отчёт можно создать сейчас.','Competition mode requires reviewed current rules. You can create an engineering report now.','Байқау режиміне өзекті ережелерді тексеру қажет. Инженерлік есепті қазір жасауға болады.'],
  prepared:['Отчёт готов. Проверьте документ перед передачей.','Report ready. Review the document before sharing.','Есеп дайын. Бөліспес бұрын құжатты тексеріңіз.'],
  warnings:['Проверка перед экспортом','Before you export','Экспорт алдында тексеру'],warningScope:['Предупреждения относятся к выбранным материалам; файлы дополнительно проверяются при формировании.','Warnings concern the selected records; files are checked again during generation.','Ескертулер таңдалған материалдарға қатысты; файлдар құрастыру кезінде қайта тексеріледі.'],
  history:['Сохранённые отчёты','Saved reports','Сақталған есептер'],refresh:['Обновить','Refresh','Жаңарту'],noHistory:['Отчётов пока нет.','No reports yet.','Әзірге есеп жоқ.'],version:['Версия','Version','Нұсқа'],pages:['стр.','pages','бет'],
  ready:['Готов','Ready','Дайын'],rendering:['Формируется','Generating','Құрастырылуда'],failed:['Ошибка; можно повторить','Failed; retry available','Қате; қайталауға болады'],cancelled:['Отменён','Cancelled','Бас тартылды'],cleanup_pending:['Ожидает очистки временного файла','Temporary file cleanup pending','Уақытша файлдың тазартылуы күтілуде'],queued:['В очереди','Queued','Кезекте'],
  retry:['Повторить этот отчёт','Retry this report','Осы есепті қайталау'],cancel:['Отменить запуск','Cancel generation','Құрастырудан бас тарту'],
  pendingNote:['Закрытие окна не отменяет формирование. Готовый документ появится в сохранённых отчётах.','Closing this dialog does not cancel generation. The document will appear in saved reports.','Терезені жабу құрастыруды тоқтатпайды. Құжат сақталған есептерде пайда болады.'],
  readOnly:['С вашей ролью доступны готовые отчёты. Создать новый может автор или руководитель команды.','Your role can read saved reports. A student or team lead can generate a new report.','Сіздің рөліңіз дайын есептерді оқи алады. Жаңа есепті оқушы немесе топ жетекшісі жасай алады.'],
  unavailable:['Не удалось выполнить действие. Данные сохранены; повторите позже.','The action failed. Your evidence is safe; try again later.','Әрекет орындалмады. Деректер сақталған; кейінірек қайталаңыз.'],
  missing_why:['В решении не записано обоснование.','A decision has no recorded rationale.','Шешімнің негіздемесі жазылмаған.'],
  missing_evidence:['У решения нет подтверждённой связи с материалами.','A decision has no confirmed evidence link.','Шешімнің материалдармен расталған байланысы жоқ.'],
  possible_personal_data:['Возможны персональные данные: проверьте перед передачей.','Possible personal data: review before sharing.','Жеке деректер болуы мүмкін: бөліспес бұрын тексеріңіз.'],
  unverified_import_author:['Импортированная подпись автора; личность не проверена.','Imported author label; identity has not been verified.','Импортталған автор белгісі; тұлғасы тексерілмеген.'],
  educational_origin:['Учебные данные нельзя представлять как результаты реального исследования.','Educational data must not be presented as real research.','Оқу деректерін нақты зерттеу нәтижелері ретінде көрсетуге болмайды.'],
  human_privacy_review_required:['Проверьте личные сведения и разрешения на передачу. Автоматическая проверка не заменяет ваше решение.','Review personal information and sharing permission. Automated checks do not replace your judgment.','Жеке мәліметтер мен бөлісу рұқсаттарын тексеріңіз. Автоматты тексеру сіздің шешіміңізді алмастырмайды.'],
  engineering_not_competition_approval:['Инженерный отчёт не подтверждает соответствие правилам соревнования.','An engineering report does not certify competition compliance.','Инженерлік есеп жарыс ережелеріне сәйкестікті растамайды.'],
  media_reference_only:['Файл указан в манифесте; его содержимое не встроено в документ.','The file is listed in the manifest; its contents are not embedded.','Файл манифестте көрсетілген; мазмұны құжатқа енгізілмеген.'],
  image_not_embedded:['Изображение превышает лимит отчёта или файл отсутствует.','An image exceeds the report limit or its file is missing.','Сурет есеп шегінен асады немесе файл жоқ.'],
  missing_or_changed_asset:['Вложенный файл отсутствует или его контрольная сумма не совпадает.','An attached file is missing or its checksum does not match.','Тіркелген файл жоқ немесе бақылау сомасы сәйкес емес.'],
  unauthenticated:['Сессия закончилась. Войдите снова, затем повторите действие.','Your session ended. Sign in again and retry.','Сессия аяқталды. Қайта кіріп, әрекетті қайталаңыз.'],
  forbidden:['Доступ к проекту или отчёту отсутствует.','You do not have access to this project or report.','Бұл жобаға немесе есепке кіру рұқсаты жоқ.'],
  policy_review_required:['Нужна актуальная проверенная версия правил соревнования.','A current reviewed competition policy is required.','Жарыс ережелерінің өзекті тексерілген нұсқасы қажет.'],
  empty_report:['Выберите хотя бы одну доступную запись.','Select at least one available record.','Кемінде бір қолжетімді жазбаны таңдаңыз.'],
  report_limit_exceeded:['Превышен лимит страниц или объёма. Выберите меньше материалов.','The page or file limit was exceeded. Select fewer records.','Бет немесе көлем шегі асқан. Азырақ материал таңдаңыз.'],
  report_preflight_blocked:['Для конкурсной подачи нужны отсутствующие файлы, обоснования или связи.','Competition submission needs the missing files, rationale or evidence links.','Байқауға ұсыну үшін жетіспейтін файлдар, негіздемелер немесе байланыстар қажет.'],
  report_in_progress:['Этот отчёт уже формируется. Обновите список позже.','This report is already being generated. Refresh the list shortly.','Бұл есеп құрастырылып жатыр. Тізімді кейінірек жаңартыңыз.'],
  report_cancelled:['Запуск отменён. Для нового отчёта используйте форму выше.','Generation was cancelled. Use the form above for a new report.','Құрастыру тоқтатылды. Жаңа есеп үшін жоғарыдағы пішінді пайдаланыңыз.'],
  rate_limited:['Слишком много запросов. Повторите через несколько минут.','Too many requests. Try again in a few minutes.','Сұрау тым көп. Бірнеше минуттан кейін қайталаңыз.'],
  invalid_fields:['Проверьте параметры и выбор записей.','Check report settings and record selection.','Есеп параметрлері мен жазба таңдауын тексеріңіз.']
};
Object.assign(messages,{
  policy_content_window_unreviewed:['Нужно проверить допустимый период материалов по правилам сезона.','The season’s permitted evidence period needs review.','Маусым ережесіндегі материал кезеңі тексерілуі керек.'],outside_policy_content_window:['Запись выходит за допустимый период материалов по правилам.','This record is outside the policy’s permitted evidence period.','Жазба ережеде рұқсат етілген материал кезеңінен тыс.'],contentSince:['Материалы начиная с','Evidence from','Материалдардың басталу күні'],
  policyDetails:['Программа, сезон и правила','Program, season and policy','Бағдарлама, маусым және ережелер'],program:['Программа','Program','Бағдарлама'],season:['Сезон','Season','Маусым'],policyVersion:['Версия правил','Policy version','Ереже нұсқасы'],reviewed:['Проверено','Reviewed','Тексерілген'],effective:['Действует с','Effective from','Қолданысқа енгізілген'],sources:['Официальные источники','Official sources','Ресми дереккөздер'],unknown:['Не указано','Not specified','Көрсетілмеген'],
  reviewPath:['Администратор должен зарегистрировать проверенную версию правил с датой, источниками и ограничениями. Это окно не присваивает правилам статус проверки.','An administrator must register a reviewed policy with dates, sources and limits. This dialog cannot mark a policy reviewed.','Әкімші тексерілген ережені күнімен, дереккөздерімен және шектеулерімен тіркеуі керек. Бұл терезе ережені тексерілген деп белгілемейді.'],
  policy_unknown:['Правила для команды ещё не выбраны.','No policy is selected for the team.','Командаға ереже әлі таңдалмаған.'],policy_season_unreviewed:['Программа или сезон не соответствуют активным правилам.','The program or season does not match an active policy.','Бағдарлама немесе маусым белсенді ережеге сәйкес емес.'],policy_review_incomplete:['В проверке правил не хватает даты, источников или ответственного.','The policy review is missing dates, sources or a reviewer.','Ережені тексеруде күн, дереккөз немесе тексеруші көрсетілмеген.'],policy_stale:['Срок проверки или действия правил истёк.','The policy review or validity period has expired.','Ереженің тексеру немесе қолданыс мерзімі өткен.'],policy_export_blocked:['Эта версия правил блокирует данный вид экспорта.','This policy blocks this export action.','Бұл ереже осы экспорт әрекетін бұғаттайды.'],policy_action_unknown:['Для этого вида экспорта ещё нет проверенного решения.','This export action has not been reviewed.','Бұл экспорт әрекеті әлі тексерілмеген.'],policy_limits_unreviewed:['Лимиты страниц и размера ещё не проверены.','Page and file limits have not been reviewed.','Бет және файл көлемі шектеулері әлі тексерілмеген.'],policy_layout_unreviewed:['Нужно проверить отдельные лимиты обложки, содержания и точную единицу размера файла.','Cover, content and exact file-size limits need review.','Мұқаба, мазмұн және файл көлемінің нақты шектеулері тексерілуі керек.'],
  teamNumber:['Номер команды для обложки','Team number for the cover','Мұқабаға арналған команда нөмірі'],team_number_required:['Укажите номер команды для обложки.','Enter the team number for the cover.','Мұқабаға команда нөмірін енгізіңіз.'],competition_pdf_required:['Для конкурсной подачи нужен PDF с измеренным числом страниц.','Competition submission requires a PDF with a measured page count.','Байқауға ұсыну үшін бет саны өлшенген PDF қажет.'],report_preview_changed:['Материалы изменились после предпросмотра. Откройте отчёт заново и проверьте состав.','Evidence changed after the preview. Reopen the report and review the selection.','Алдын ала қараудан кейін материалдар өзгерді. Есепті қайта ашып, құрамын тексеріңіз.'],
  sections:['Разделы документа','Document sections','Құжат бөлімдері'],plain:['Без разделов','No sections','Бөлімдерсіз'],byKind:['По типам выбранных записей','By selected record type','Таңдалған жазба түрлері бойынша'],preview:['Содержание и порядок','Contents and order','Мазмұны және реті'],previewNote:['Ниже — выбранные тексты и вложения. Точное число страниц и размер появятся после формирования PDF; проверьте его перед передачей.','Selected text and attachments are shown below. Exact pages and file size are available after PDF generation; inspect the PDF before sharing.','Төменде таңдалған мәтіндер мен файлдар көрсетілген. Нақты бет саны мен көлемі PDF құрастырылғаннан кейін белгілі болады; бөліспес бұрын тексеріңіз.'],moveUp:['Переместить выше','Move up','Жоғары жылжыту'],moveDown:['Переместить ниже','Move down','Төмен жылжыту'],attachments:['Вложения выбранных записей','Attachments in selected records','Таңдалған жазбалардың файлдары'],eligible_image:['Изображение будет проверено для встраивания','Image will be checked for embedding','Сурет енгізу үшін тексеріледі'],reference_only:['Только ссылка в манифесте; содержимое не встроено','Manifest reference only; contents are not embedded','Тек манифесттегі сілтеме; мазмұны енгізілмеген'],noAttachments:['У выбранных записей нет вложений.','Selected records have no attachments.','Таңдалған жазбаларда файл жоқ.'],openPreview:['Открыть PDF для проверки','Inspect the PDF','PDF-ті тексеру үшін ашу'],manifest:['Скачать манифест отдельно','Download separate manifest','Манифестті бөлек жүктеу'],actualSize:['Фактический размер','Actual size','Нақты көлем'],cover:['Обложка','Cover','Мұқаба'],content:['Содержание','Content','Мазмұн'],budget:['Проверенный бюджет','Reviewed budget','Тексерілген шектеу'],manifestNote:['Манифест происхождения хранится отдельно от конкурсного PDF и не занимает страницы портфолио.','The provenance manifest is separate from the competition PDF and does not consume portfolio pages.','Шығу тегі манифесті жарыс PDF-інен бөлек сақталады және портфолио беттерін алмайды.']
});
export function reportText(key,locale=getWorkspaceLocale()){return messages[key]?.[{ru:0,en:1,kk:2}[locale]??0]??messages.unavailable[{ru:0,en:1,kk:2}[locale]??0];}
const make=(tag,text,props={})=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;Object.assign(node,props);return node;};
export function reportSelection(records,scope,selected){return records.filter(r=>(scope!=='personal'||r.authoredByMe)&&selected.has(r.id)).map(r=>r.id);}
export async function openReportDialog(store,initialOptions={}){
  const locale=getWorkspaceLocale(),t=key=>reportText(key,locale),project=store.getProject(),user=store.getState().user;
  const opener=document.activeElement,dialog=make('dialog',null,{className:'ws-dialog ws-report-dialog'});
  const heading=make('div',null,{className:'ws-dialog-heading'}),title=make('h2',t('title'),{id:'ws-report-title'}),close=make('button',t('close'),{type:'button',className:'ws-tool-button'});
  dialog.setAttribute('aria-labelledby',title.id);close.onclick=()=>dialog.close();heading.append(title,close);
  const status=make('p',t('loading'));status.setAttribute('role','status');
  dialog.append(heading,make('h3',project.name),make('p',t('intro')),status);document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();},{once:true});dialog.showModal();
  async function request(url,options={}){const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(125000),...options});const data=await response.json();if(!response.ok){const error=new Error(t(data.error?.code));error.code=data.error?.code;throw error;}return data;}
  try{
    let preview=await request('/api/workspace/report?project='+encodeURIComponent(project.id));
    if(!dialog.open)return;
    status.textContent=t('records')+': '+formatNumber(preview.records.length);
    const canWrite=['student','student_lead'].includes(store.getState().role);
    const form=make('form'),settings=make('div',null,{className:'ws-report-settings'});form.append(settings);
    function select(key,options){const label=make('label',t(key)),input=make('select');for(const [value,name]of options)input.append(make('option',name,{value}));label.append(input);settings.append(label);return input;}
    const format=select('format',[['pdf','PDF'],['html','HTML'],['json','JSON']]),paper=select('paper',[['A4','A4'],['LETTER','Letter']]);
    const purpose=select('purpose',[['engineering',t('engineering')],['competition',t('competition')]]);
    const scope=select('scope',[['project',t('project')],['personal',t('personal')],['handoff',t('handoff')]]);
    if(['project','personal','handoff'].includes(initialOptions.scope))scope.value=initialOptions.scope;
    const grouping=select('sections',[['plain',t('plain')],['kind',t('byKind')]]);
    const numberLabel=make('label',t('teamNumber')),teamNumber=make('input',null,{type:'text',inputMode:'numeric',maxLength:8,pattern:'[0-9]{1,8}'});numberLabel.append(teamNumber);settings.append(numberLabel);numberLabel.hidden=true;
    purpose.options[1].disabled=!preview.policyGate.allowed;
    if(!preview.policyGate.allowed)form.append(make('p',t('blocked'),{className:'ws-form-hint'}));
    const policyPanel=make('section',null,{className:'ws-report-policy'});form.append(policyPanel);
    function renderPolicy(){const gate=preview.policyGate,policy=gate.policy;policyPanel.replaceChildren(make('h3',t('policyDetails')));const dl=make('dl');for(const [label,value]of [[t('program'),preview.project.program],[t('season'),preview.project.season],[t('policyVersion'),policy?.version],[t('reviewed'),policy?.reviewedAt?formatDate(policy.reviewedAt):null],[t('effective'),policy?.effectiveFrom?formatDate(policy.effectiveFrom):null]])dl.append(make('dt',label),make('dd',value||t('unknown')));policyPanel.append(dl);if(policy){const links=make('div');links.append(make('strong',t('sources')));for(const source of policy.sourceUrls||[])if(/^https:\/\//.test(source))links.append(make('p',null),make('a',source,{href:source,target:'_blank',rel:'noopener noreferrer'}));policyPanel.append(links);const limits=policy.constraints||{};if(gate.allowed)policyPanel.append(make('p',`${t('budget')}: ${limits.coverPages??1} ${t('cover')} + ${limits.maxContentPages??Math.max(0,Number(limits.maxPages)-1)} ${t('pages')} · < ${limits.maxFileMb} ${limits.fileUnit||'MiB'}`,{className:'ws-report-budget'}));}if(!gate.allowed)policyPanel.append(make('p',t(gate.code)),make('p',t('reviewPath'),{className:'ws-form-hint'}));}
    renderPolicy();
    const fieldset=make('fieldset',null,{className:'ws-report-records'}),legend=make('legend',t('selection')),actions=make('div',null,{className:'ws-report-actions'});
    const all=make('button',t('all'),{type:'button',className:'ws-tool-button'}),none=make('button',t('none'),{type:'button',className:'ws-tool-button'}),counter=make('span');
    counter.setAttribute('role','status');actions.append(all,none,counter);
    const list=make('div',null,{className:'ws-report-list'});fieldset.append(legend,actions,list);form.append(fieldset);
    const requested=Array.isArray(initialOptions.recordIds)?new Set(initialOptions.recordIds):null;
    let selected=new Set(preview.records.filter(record=>!requested||requested.has(record.id)).map(record=>record.id)),order=preview.records.map(r=>r.id),busy=false;const checks=new Map();
    const orderedRecords=()=>reportOrderedRecords(preview.records,order);
    const selectedIds=()=>reportSelection(orderedRecords(),scope.value,selected);
    const contentPreview=make('details',null,{className:'ws-report-composer-preview'}),contentSummary=make('summary',t('preview')),contentList=make('ol'),attachmentList=make('ul',null,{className:'ws-report-attachment-list'});contentPreview.append(contentSummary,make('p',t('previewNote')),contentList,make('h4',t('attachments')),attachmentList);form.append(contentPreview);
    const warnings=make('section',null,{className:'ws-report-warnings'});form.append(warnings);
    const ackLabel=make('label',null,{className:'ws-report-check'}),ack=make('input',null,{type:'checkbox',required:true});ackLabel.append(ack,make('span',t('ack')));form.append(ackLabel);
    const error=make('p',null,{className:'ws-form-error'});error.setAttribute('role','alert');
    const submit=make('button',t('create'),{className:'ws-app-primary',type:'submit'});form.append(error,submit);
    const result=make('div');result.setAttribute('role','status');form.append(result,make('p',t('pendingNote'),{className:'ws-form-hint'}));
    function updateSelection(){const ids=selectedIds();counter.textContent=t('selected')+': '+formatNumber(ids.length);submit.disabled=busy||!canWrite||!ids.length||ids.length>preview.limits.records;ack.checked=false;
      warnings.replaceChildren(make('h3',t('warnings')),make('p',t('warningScope'),{className:'ws-form-hint'}));
      const relevant=(preview.warnings||[]).filter(w=>w.code!=='missing_evidence'&&(!w.recordId||ids.includes(w.recordId)));
      for(const record of preview.records)if(record.kind==='decision'&&ids.includes(record.id)&&!record.evidenceIds?.some(id=>ids.includes(id)))relevant.push({code:'missing_evidence',recordId:record.id});
      for(const warning of relevant){const record=preview.records.find(r=>r.id===warning.recordId);warnings.append(make('p',t(warning.code)+(record?' — '+record.title:''),{className:'ws-form-hint'}));}
      contentList.replaceChildren();for(const record of orderedRecords().filter(item=>ids.includes(item.id))){const li=make('li');li.append(make('strong',record.title),make('small',[recordType(record.kind),record.author,record.revision].filter(Boolean).join(' · ')));if(record.summary)li.append(make('p',record.summary));contentList.append(li);}attachmentList.replaceChildren();const attachments=(preview.attachments||[]).filter(item=>ids.includes(item.recordId));if(!attachments.length)attachmentList.append(make('li',t('noAttachments')));for(const attachment of attachments){const record=preview.records.find(item=>item.id===attachment.recordId),li=make('li');li.textContent=[attachment.caption||record?.title||t('unknown'),attachment.mimeType,formatNumber(attachment.bytes/1024,{maximumFractionDigits:1})+' KiB',t(reportAttachmentStatus(attachment,preview.limits))].join(' · ');attachmentList.append(li);}
    }
    function renderSelection(){list.replaceChildren();checks.clear();const records=orderedRecords().filter(r=>scope.value!=='personal'||r.authoredByMe);
      if(!records.length)list.append(make('p',t('empty')));
      for(const [index,record]of records.entries()){const row=make('div',null,{className:'ws-report-record-row'}),label=make('label',null,{className:'ws-report-check'}),input=make('input',null,{type:'checkbox',checked:selected.has(record.id)}),text=make('span');
        text.append(make('strong',record.title),make('small',[recordType(record.kind),record.author,record.revision].filter(Boolean).join(' · ')));label.append(input,text);row.append(label);const controls=make('div',null,{className:'ws-report-order'});for(const [offset,key,path]of [[-1,'moveUp','M5 15l7-7 7 7'],[1,'moveDown','M5 9l7 7 7-7']]){const move=make('button',null,{type:'button',disabled:index+(offset)<0||index+offset>=records.length});move.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;move.setAttribute('aria-label',t(key)+' — '+record.title);move.title=t(key);move.onclick=()=>{const visible=records.map(item=>item.id),moved=moveReportRecord(visible,record.id,offset),visibleSet=new Set(visible);let cursor=0;order=order.map(id=>visibleSet.has(id)?moved[cursor++]:id);renderSelection();checks.get(record.id)?.focus();};controls.append(move);}row.append(controls);list.append(row);checks.set(record.id,input);
        input.onchange=()=>{if(input.checked)selected.add(record.id);else selected.delete(record.id);updateSelection();};
      }updateSelection();
    }
    all.onclick=()=>{for(const[id,check]of checks){selected.add(id);check.checked=true;}updateSelection();};
    none.onclick=()=>{for(const[id,check]of checks){selected.delete(id);check.checked=false;}updateSelection();};
    scope.onchange=renderSelection;grouping.onchange=updateSelection;format.onchange=()=>{paper.disabled=format.value!=='pdf';ack.checked=false;};purpose.onchange=()=>{const competition=purpose.value==='competition';if(competition)format.value='pdf';for(const option of format.options)option.disabled=competition&&option.value!=='pdf';format.disabled=competition;paper.disabled=format.value!=='pdf';numberLabel.hidden=!competition||preview.project.program!=='FTC';teamNumber.required=!numberLabel.hidden;ack.checked=false;};
    renderSelection();if(canWrite)dialog.append(form);else dialog.append(policyPanel,make('p',t('readOnly')));
    const history=make('section',null,{className:'ws-report-history'});dialog.append(history);
    async function refreshHistory(){const latest=await request('/api/workspace/report?project='+encodeURIComponent(project.id));preview.exports=latest.exports;preview.policyGate=latest.policyGate;if(dialog.open){renderPolicy();renderHistory();}}
    function renderHistory(){
      history.replaceChildren();const top=make('div',null,{className:'ws-dialog-heading'}),refresh=make('button',t('refresh'),{type:'button',className:'ws-tool-button'});
      refresh.onclick=async()=>{refresh.disabled=true;try{await refreshHistory();}catch(e){status.textContent=e.message;refresh.disabled=false;}};
      top.append(make('h3',t('history')),refresh);history.append(top);
      if(!preview.exports.length)history.append(make('p',t('noHistory')));
      for(const item of preview.exports){
        const row=make('article',null,{className:'ws-report-job'}),meta=item.manifest||{},output=meta.output;
        row.append(make('strong',t('version')+' '+formatNumber(item.version)+' · '+String(meta.format||'').toUpperCase()),make('p',formatDate(item.createdAt)+' · '+t(item.state)));
        if(output)row.append(make('small',(output.pages?formatNumber(output.pages)+' '+t('pages')+' · ':'')+formatNumber(output.bytes/1024,{maximumFractionDigits:1})+' KiB'));
        const controls=make('div',null,{className:'ws-report-actions'});row.append(controls);
        if(item.downloadUrl)controls.append(make('a',t('download'),{href:item.downloadUrl,download:'',className:'ws-tool-button'}));
        if(item.downloadUrl){if(meta.format==='pdf')controls.append(make('a',t('openPreview'),{href:item.downloadUrl+'&preview=1',target:'_blank',rel:'noopener noreferrer',className:'ws-tool-button'}));controls.append(make('a',t('manifest'),{href:item.downloadUrl+'&manifest=1',download:'',className:'ws-tool-button'}));}
        if(item.creatorId===user?.id&&['failed','cleanup_pending','rendering','queued'].includes(item.state)){
          if(['failed','cleanup_pending'].includes(item.state)){const retry=make('button',t('retry'),{type:'button',className:'ws-tool-button'});retry.onclick=()=>historyAction(retry,async()=>request('/api/workspace/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item.options,requestId:item.requestId})}));controls.append(retry);}
          const cancel=make('button',t('cancel'),{type:'button',className:'ws-tool-button'});cancel.onclick=()=>historyAction(cancel,()=>request('/api/workspace/report?id='+encodeURIComponent(item.id),{method:'DELETE'}));controls.append(cancel);
        }
        history.append(row);
      }
    }
    async function historyAction(button,action){button.disabled=true;status.textContent=t('pending');try{await action();await refreshHistory();status.textContent='';}catch(e){status.textContent=e.message;button.disabled=false;}}
    renderHistory();let requestId='',lastBody='';
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;const recordIds=selectedIds();if(!recordIds.length){error.textContent=t('empty_report');return;}
      const input={projectId:project.id,format:format.value,paper:paper.value,purpose:purpose.value,scope:scope.value,recordIds,sections:reportSectionSequence(orderedRecords(),recordIds,grouping.value==='kind',recordType),teamNumber:purpose.value==='competition'&&teamNumber.value.trim()?teamNumber.value.trim():undefined,expectedProjectRevision:preview.project.revision,locale,acknowledgeWarnings:ack.checked},body=JSON.stringify(input);
      if(body!==lastBody){requestId=crypto.randomUUID();lastBody=body;}
      busy=true;submit.disabled=true;submit.textContent=t('pending');error.textContent='';result.replaceChildren();
      try{const data=await request('/api/workspace/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,requestId})});
        result.className='ws-report-generated';result.append(make('p',t('prepared')));const output=data.manifest?.output;if(output)result.append(make('p',`${output.pages?formatNumber(output.pages)+' '+t('pages')+' · ':''}${t('actualSize')}: ${formatNumber(output.bytes)} B (${formatNumber(output.bytes/1_000_000,{maximumFractionDigits:3})} MB)`));result.append(make('a',t('download'),{href:data.downloadUrl,download:'',className:'ws-app-primary'}));if(input.format==='pdf')result.append(make('a',t('openPreview'),{href:data.downloadUrl+'&preview=1',target:'_blank',rel:'noopener noreferrer',className:'ws-tool-button'}));result.append(make('a',t('manifest'),{href:data.downloadUrl+'&manifest=1',download:'',className:'ws-tool-button'}));if(input.purpose==='competition')result.append(make('p',t('manifestNote')));
        for(const warning of data.warnings||[])if(!preview.warnings.some(w=>w.code===warning.code&&w.artifactId===warning.artifactId))result.append(make('p',t(warning.code),{className:'ws-form-hint'}));
        // A subsequent click explicitly creates a new immutable output version.
        lastBody='';requestId='';await refreshHistory();
      }catch(e){error.textContent=e.message;}
      finally{busy=false;submit.disabled=!selectedIds().length;submit.textContent=t('create');}
    };
  }catch(error){status.textContent=error.message||t('unavailable');}
}

