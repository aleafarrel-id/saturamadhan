import { initStarfield } from './modules/starfield.js';
import { initNav } from './modules/nav.js';
import { initScrollReveal } from './modules/scroll-reveal.js';
import { initSmoothScroll } from './modules/smooth-scroll.js';
import { initLinks } from './modules/link-injector.js';
import { initI18n } from './modules/i18n.js';
import { initCarousel } from './modules/carousel.js';
import { initLightbox } from './modules/lightbox.js';

document.addEventListener('DOMContentLoaded', async () => {
  initLinks();
  await initI18n();
  initStarfield();
  initNav();
  initScrollReveal();
  initSmoothScroll();
  initCarousel();
  initLightbox();
});
