export function initLightbox() {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = '<div class="lightbox__backdrop"></div><img class="lightbox__img" alt="" /><button class="lightbox__close" aria-label="Close"><i class="bx bx-x"></i></button>';
  document.body.appendChild(overlay);

  const img = overlay.querySelector('.lightbox__img');
  const closeBtn = overlay.querySelector('.lightbox__close');
  const backdrop = overlay.querySelector('.lightbox__backdrop');

  function open(src, alt) {
    img.src = src;
    img.alt = alt || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  document.querySelectorAll('.feature-preview__img, .hero__gallery-img, .carousel__slide img').forEach(el => {
    el.style.cursor = 'zoom-in';
    el.addEventListener('click', () => open(el.src, el.alt));
  });
}
