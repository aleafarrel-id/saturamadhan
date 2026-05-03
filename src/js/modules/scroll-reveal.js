const OBSERVER_OPTIONS = {
  threshold: 0.12,
  rootMargin: '0px 0px -50px 0px',
};

export function initScrollReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    }
  }, OBSERVER_OPTIONS);

  els.forEach(el => observer.observe(el));
}
