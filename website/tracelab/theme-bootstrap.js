export const THEME_STORAGE_KEY='iznera.theme.v1';
export const THEME_COLORS={dark:'#0b0b0e',milk:'#f7f6f3'};
// Trusted, synchronous head script: only the two allowed names can reach the DOM.
// Shared by generated HTML and Next's root layout to avoid a dark flash on reload.
export const themeBootstrap=`(function(){var t='dark';try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='milk'||s==='dark')t=s;}catch(e){}var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t==='milk'?'light':'dark';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='milk'?'${THEME_COLORS.milk}':'${THEME_COLORS.dark}');})();`;
