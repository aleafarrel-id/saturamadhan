const STORAGE_KEY = 'sr-lang';
const DEFAULT_LANG = 'id';
const SUPPORTED = ['id', 'en'];

let strings = {};
let currentLang = DEFAULT_LANG;

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function applyStrings() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const value = getNestedValue(strings, key);
    if (value) el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    const value = getNestedValue(strings, key);
    if (value) el.innerHTML = value;
  });

  document.querySelectorAll('[data-i18n-list]').forEach(el => {
    const key = el.dataset.i18nList;
    const items = getNestedValue(strings, key);
    if (Array.isArray(items)) {
      const isMarquee = el.classList.contains('marquee-track');
      if (isMarquee) {
        // For marquee, repeat items to ensure continuous flow
        const repeated = [...items, ...items, ...items];
        el.innerHTML = repeated.map(text => `<span class="marquee-item">${text} <span class="marquee-dot"></span></span>`).join('');
      } else {
        const liTemplate = el.querySelector('li');
        const liClass = liTemplate?.className || '';
        const iconHtml = liTemplate?.querySelector('i')?.outerHTML || '';
        
        el.innerHTML = items.map(text => {
          return `<li class="${liClass}">${iconHtml} ${text}</li>`;
        }).join('');
      }
    }
  });

  document.documentElement.lang = currentLang;
}

export async function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return;
  try {
    const res = await fetch(`/assets/multilanguage/${lang}/strings.json`);
    strings = await res.json();
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyStrings();
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langBtn === lang);
    });
  } catch (e) {
    console.error(`Failed to load language: ${lang}`, e);
  }
}

export function getCurrentLang() {
  return currentLang;
}

export async function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  await setLanguage(saved);

  document.querySelectorAll('[data-lang-btn]').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.langBtn));
  });
}
