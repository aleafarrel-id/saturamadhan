import { LINKS } from '../config/config.js';

export function initLinks() {
  document.querySelectorAll('[data-link]').forEach(el => {
    const key = el.dataset.link;
    if (LINKS[key]) {
      el.setAttribute('href', LINKS[key]);
      if (!key.startsWith('#') && key !== 'contactEmail') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    }
  });
}
