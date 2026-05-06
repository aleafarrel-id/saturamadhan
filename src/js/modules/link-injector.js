import { LINKS } from '../config/config.js';

export function initLinks() {
  document.querySelectorAll('[data-link]').forEach(el => {
    const key = el.dataset.link;
    if (LINKS[key]) {
      if (key === 'contactEmail') {
        el.setAttribute('href', 'javascript:void(0);');
        el.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = `mailto:${LINKS[key].user}@${LINKS[key].domain}`;
        });
        return;
      }
      
      el.setAttribute('href', LINKS[key]);
      if (!key.startsWith('#')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    }
  });
}
