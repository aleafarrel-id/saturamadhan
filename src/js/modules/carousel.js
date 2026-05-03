const INTERVAL = 4000;

export function initCarousel() {
  document.querySelectorAll('.carousel').forEach(carousel => {
    const track = carousel.querySelector('.carousel__track');
    const slides = carousel.querySelectorAll('.carousel__slide');
    const dotsWrap = carousel.querySelector('.carousel__dots');
    if (!track || slides.length < 2) return;

    let current = 0;
    let timer = null;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = `carousel__dot${i === 0 ? ' active' : ''}`;
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap?.appendChild(dot);
    });

    const dots = dotsWrap?.querySelectorAll('.carousel__dot') || [];

    function goTo(index) {
      current = index;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    function next() {
      goTo((current + 1) % slides.length);
    }

    function startAuto() {
      stopAuto();
      timer = setInterval(next, INTERVAL);
    }

    function stopAuto() {
      if (timer) clearInterval(timer);
    }

    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);

    let startX = 0;
    let isDragging = false;

    const onStart = (x) => {
      startX = x;
      isDragging = true;
      stopAuto();
    };

    const onEnd = (x) => {
      if (!isDragging) return;
      const diff = startX - x;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goTo(Math.min(current + 1, slides.length - 1));
        else goTo(Math.max(current - 1, 0));
      }
      isDragging = false;
      startAuto();
    };

    track.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
    track.addEventListener('touchend', e => onEnd(e.changedTouches[0].clientX), { passive: true });

    track.addEventListener('mousedown', e => {
      onStart(e.clientX);
      track.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', e => {
      if (isDragging) {
        onEnd(e.clientX);
        track.style.cursor = 'grab';
      }
    });

    track.style.cursor = 'grab';
    startAuto();
  });
}
