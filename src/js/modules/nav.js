const SCROLL_THRESHOLD = 40;

export function initNav() {
  const nav = document.querySelector('.nav');
  const burger = document.querySelector('.nav__burger');
  const links = document.querySelector('.nav__links');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > SCROLL_THRESHOLD);
  }, { passive: true });

  if (burger && links) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('open');
      links.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', isOpen);
    });

    links.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('open');
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
}
