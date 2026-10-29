import { copy } from './astra-copy.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const t = key => `<span data-i18n="${key}">${escape(copy.ru[key])}</span>`;
const arrow = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const brand = `<a class="a-brand" href="/" aria-label="Iznera — главная" data-i18n-label="brandHome"><img src="/assets/iznera-logo.png" alt="Iznera" width="126" height="35"></a>`;
const button = (key, href, kind = 'secondary') => `<a class="a-button ${kind}" href="${href}">${t(key)}${arrow}</a>`;
const views = [['tabGraph', 'graph'], ['timeline', 'timeline'], ['tests', 'tests'], ['history', 'history'], ['research', 'study']];
const shortcuts = () => `<nav class="a-shortcuts">${views.map(([key, view]) => `<a href="/workspace/?view=${view}">${t(key)}${arrow}</a>`).join('')}</nav>`;
const faq = () => `<div class="a-faq">${['Storage', 'Backup', 'Authorship', 'Demo', '3d'].map((key, index) => `<details ${index === 0 ? 'open' : ''}><summary>${t(`faq${key}Q`)}</summary><p>${t(`faq${key}A`)}</p></details>`).join('')}</div>`;
const capabilities = () => `<div class="a-capabilities">${['Graph', 'Timeline', 'Evidence', 'Authorship'].map(key => `<article class="a-feature" data-spotlight><h3>${t(`feature${key}Title`)}</h3><p>${t(`feature${key}Text`)}</p></article>`).join('')}</div>`;
const demo = () => `<section class="a-demo a-container" id="demo" aria-labelledby="demo-heading">
  <div class="a-section-head"><div><p class="a-eyebrow">${t('demoLabel')}</p><h2 id="demo-heading">${t('demoTitle')}</h2></div><p>${t('demoText')}</p></div>
  <div class="a-demo-surface" data-demo data-spotlight>
    <div class="a-demo-topline"><span class="a-tag">${t('demoLabel')}</span></div>
    <div class="a-tabs" role="tablist" aria-label="Демонстрация Iznera">
      ${[['graph','tabGraph'],['timeline','tabTimeline'],['materials','tabMaterials']].map(([view,key], i) => `<button type="button" id="demo-tab-${view}" role="tab" data-tab="${view}" aria-controls="demo-panel-${view}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t(key)}</button>`).join('')}
    </div>
    <div class="a-demo-grid">
      <div>
        <div role="tabpanel" id="demo-panel-graph" aria-labelledby="demo-tab-graph">
          <div class="a-graph">
            <svg viewBox="0 0 600 340" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="edge-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#888890"/></marker></defs><path d="M108 190 Q176 78 300 78" fill="none" stroke="#72727a" stroke-width="1.4" marker-end="url(#edge-arrow)"/><path d="M300 78 Q424 78 492 190" fill="none" stroke="#72727a" stroke-width="1.4" marker-end="url(#edge-arrow)"/><text x="125" y="64" text-anchor="middle" stroke="none" fill="#a6a6b0" font-size="10" data-i18n="graphObservationTest">${escape(copy.ru.graphObservationTest)}</text><text x="475" y="64" text-anchor="middle" stroke="none" fill="#a6a6b0" font-size="10" data-i18n="graphTestDecision">${escape(copy.ru.graphTestDecision)}</text></svg>
            ${[['prototype','18%','56%'],['test','50%','23%'],['decision','82%','56%']].map(([id,x,y]) => `<button type="button" class="a-node" style="left:${x};top:${y}" data-record="${id}" aria-pressed="${id === 'prototype'}"><strong>${t(`${id}Title`)}</strong></button>`).join('')}
          </div><button class="a-button text" type="button" data-reset>${t('resetGraph')}</button>
        </div>
        <div role="tabpanel" id="demo-panel-timeline" aria-labelledby="demo-tab-timeline" hidden>
          <div class="a-filter-row">${[['all','filterAll'],['prototype','filterPrototype'],['test','filterTest'],['decision','filterDecision']].map(([id,key]) => `<button type="button" data-filter="${id}" aria-pressed="${id === 'all'}">${t(key)}</button>`).join('')}</div><div class="a-timeline-list" data-timeline></div>
        </div>
        <div role="tabpanel" id="demo-panel-materials" aria-labelledby="demo-tab-materials" hidden><div class="a-material-grid" data-materials></div></div>
      </div>
      <aside class="a-details" aria-live="polite" aria-atomic="true"><p class="a-eyebrow">${t('recordDetails')}</p><h3 class="a-record-title" data-detail-title>${t('prototypeTitle')}</h3><p class="a-meta" data-detail-date>1 октября 2026</p><p class="a-meta">${t('source')}: <span data-detail-source>lab-photo-018</span></p><p data-detail-text>${t('prototypeText')}</p></aside>
    </div>
  </div>
  ${shortcuts()}
  <p class="a-note">${t('projectStorageNote')}</p>
</section>`;
const dotField='<div class="a-dot-field" data-dot-field aria-hidden="true"></div>';
const home = `<section class="a-hero a-container a-dot-surface">${dotField}<h1>${t('heroTitle')}</h1><p>${t('heroText')}</p><div class="a-actions">${button('openWorkspace','/workspace/?view=graph','primary')}${button('exploreDemo','#demo')}${button('navFeatures','/features/','text')}</div></section>
${demo()}
<section class="a-container a-section" id="features"><div class="a-section-head"><h2>${t('capabilitiesTitle')}</h2><p>${t('capabilitiesText')}</p></div>${capabilities()}</section>
<section class="a-container a-section" id="process"><div class="a-section-head"><h2>${t('processTitle')}</h2></div><ol class="a-process">${[1,2,3,4].map(n => `<li><h3>${t(`step${n}Title`)}</h3><p>${t(`step${n}Text`)}</p></li>`).join('')}</ol></section>
<section class="a-container a-section" id="faq"><div class="a-section-head"><h2>${t('faqTitle')}</h2></div>${faq()}</section>
<section class="a-hero a-container a-closing a-dot-surface">${dotField}<h2>${t('finalTitle')}</h2><p>${t('finalText')}</p><div class="a-actions">${button('openWorkspace','/workspace/?view=graph','primary')}${button('materials','/materials/','text')}</div></section>`;
const intro = (title, text) => `<section class="a-page-hero a-container a-dot-surface">${dotField}<h1>${t(title)}</h1><p>${t(text)}</p></section>`;
const body = html => `<div class="a-container a-prose">${html}</div>`;
const documents = [['docOverview','project-overview.md','MD'],['docCapabilities','capabilities.md','MD'],['docProtocol','research-protocol.md','MD'],['docMeasurements','pilot-measurements.csv','CSV'],['docDemo','judge-demo.md','MD']];
const routes = {
  '/': ['homeTitle', 'heroText', home],
  '/demo': ['demoTitle','demoText', intro('demoTitle','demoText') + demo()],
  '/features': ['featuresTitle','featuresText', intro('featuresTitle','featuresText') + body(capabilities() + shortcuts() + `<p class="a-note">${t('projectStorageNote')}</p>`) ],
  '/about': ['aboutTitle','aboutText', intro('aboutTitle','aboutText') + body(`<p>${t('aboutMethod')}</p>${button('research','/research/','primary')}`)],
  '/faq': ['faqTitle','projectStorageNote', intro('faqTitle','projectStorageNote') + body(faq())],
  '/pricing': ['pricingTitle','pricingText', intro('pricingTitle','pricingText') + body(`<p>${t('pricingNote')}</p>${button('openWorkspace','/workspace/?view=graph','primary')}`)],
  '/contact': ['contactTitle','contactText', intro('contactTitle','contactText') + body(button('githubIssues','https://github.com/bolaternur/TraceLab/issues','primary'))],
  '/privacy-policy': ['privacyTitle','privacyText', intro('privacyTitle','privacyText') + body(`<p>${t('privacyControl')}</p>${button('backHome','/','secondary')}`)],
  '/research': ['researchTitle','researchText', intro('researchTitle','researchText') + body(`<h2>${t('researchPlanTitle')}</h2><p>${t('researchPlanText')}</p><p class="a-note">${t('researchLimit')}</p><div class="a-actions">${button('research','/workspace/?view=study','primary')}${button('docProtocol','/materials/research-protocol.md')}</div>`) ],
  '/materials': ['materialsTitle','materialsText', intro('materialsTitle','materialsText') + body(`<div class="a-documents">${documents.map(([key,file,type])=>`<a href="/materials/${file}" download>${t(key)}<small>${type}</small>${arrow}</a>`).join('')}</div>`) ],
  '/404': ['notFoundTitle','notFoundText', intro('notFoundTitle','notFoundText') + body(button('backHome','/','primary'))],
};

const languages=()=>`<div class="a-language" role="group" aria-label="Language / Язык / Тіл">${[['ru','Русский'],['en','English'],['kk','Қазақша']].map(([code,name])=>`<button type="button" data-locale="${code}" aria-label="${name}" aria-pressed="${code==='ru'}">${code.toUpperCase()}</button>`).join('')}</div>`;
const navigationLink=(key,href,route,index)=>`<a class="a-motion-menu-link" href="${href}" style="--menu-order:${index}" ${(route==='/'?href==='/':route+'/'===href)?'aria-current="page"':''}>${t(key)}</a>`;
const navigation=route=>`<header class="a-header"><div class="a-nav-shell">${brand}<div class="a-nav-main"><nav class="a-nav-links" aria-label="${escape(copy.ru.navigationSite)}" data-i18n-label="navigationSite">${[['navFeatures','/features/'],['navAbout','/about/'],['navFaq','/faq/']].map(([key,href])=>`<a href="${href}" ${route+'/'===href?'aria-current="page"':''}>${t(key)}</a>`).join('')}</nav>${languages()}<a class="a-button primary a-nav-cta" href="/workspace/?view=graph">${t('openWorkspace')}${arrow}</a></div><button class="a-menu-toggle" type="button" aria-expanded="false" aria-controls="astra-navigation" aria-haspopup="dialog" data-menu><span data-menu-label>${t('menuOpen')}</span><span class="a-menu-icon" aria-hidden="true"></span></button></div></header>
<dialog class="a-motion-menu" id="astra-navigation" aria-labelledby="astra-navigation-title"><div class="a-motion-menu-bar">${brand}<button class="a-motion-menu-close" type="button" data-menu-close>${t('menuClose')}</button></div><div class="a-motion-menu-layout"><section class="a-motion-menu-primary"><h2 class="a-motion-menu-title" id="astra-navigation-title">${t('navigationTitle')}</h2><nav aria-label="${escape(copy.ru.navigationSite)}" data-i18n-label="navigationSite">${[['navHome','/'],['navFeatures','/features/'],['exploreDemo','/demo/'],['navAbout','/about/']].map(([key,href],index)=>navigationLink(key,href,route,index)).join('')}</nav><div class="a-motion-menu-secondary"><a href="/#process">${t('navProcess')}</a><a href="/faq/">${t('navFaq')}</a><a href="/materials/">${t('materials')}</a></div></section><section class="a-motion-menu-workspace"><h3 class="a-motion-menu-group">${t('navigationWorkspace')}</h3><nav aria-label="${escape(copy.ru.navigationWorkspace)}" data-i18n-label="navigationWorkspace">${[['tabGraph','graph'],['timeline','timeline'],['tests','tests'],['history','history'],['navigationGallery','gallery'],['navigationModels','models'],['navigationChat','chat']].map(([key,view],index)=>navigationLink(key,'/workspace/?view='+view,route,index+2)).join('')}</nav>${languages()}<div class="a-motion-menu-secondary"><a href="/research/">${t('research')}</a><a href="/privacy-policy/">${t('privacy')}</a></div></section></div><div class="a-motion-menu-footer"><p>${t('footerText')}</p><a href="/workspace/?view=graph">${t('openWorkspace')}${arrow}</a></div></dialog>`;
function document(route, titleKey, descriptionKey, content) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0b0e"><title>${escape(copy.ru[titleKey])} — Iznera</title><meta name="description" content="${escape(copy.ru[descriptionKey])}"><link rel="icon" href="/assets/iznera-mark.svg" type="image/svg+xml"><link rel="preload" href="/assets/inter-cyrillic.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/astra.css"><link rel="stylesheet" href="/astra-navigation.css"><link rel="stylesheet" href="/astra-dots.css"><link rel="stylesheet" href="/astra-effects.css"><script type="module" src="/astra.js"></script></head><body class="astra-page" data-title-key="${titleKey}" data-description-key="${descriptionKey}"><a class="a-skip" href="#main">${t('skip')}</a>${navigation(route)}<main id="main">${content}</main><footer class="a-footer"><div class="a-container">${brand}<p>${t('footerText')}</p><nav class="a-footer-links">${[['navFeatures','/features/'],['navAbout','/about/'],['navFaq','/faq/'],['research','/research/'],['materials','/materials/'],['contactTitle','/contact/'],['privacy','/privacy-policy/']].map(([key,href])=>`<a href="${href}">${t(key)}</a>`).join('')}</nav><small>© ${new Date().getUTCFullYear()} Iznera</small></div></footer></body></html>`;
}
export const astraPages = Object.fromEntries(Object.entries(routes).map(([route,[title,description,content]])=>[route,{title:copy.ru[title],description:copy.ru[description],html:document(route,title,description,content)}]));
