export function initStarfield() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let stars = [];
  const DENSITY = 5000;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    buildStars();
  }

  function buildStars() {
    const count = Math.floor((canvas.width * canvas.height) / DENSITY);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      speed: Math.random() * 0.5 + 0.1,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const s of stars) {
      const opacity = 0.3 + 0.7 * Math.abs(Math.sin(s.phase + time * s.speed * 0.001));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${opacity * 0.7})`;
      ctx.fill();
    }

    const g1 = ctx.createRadialGradient(canvas.width * 0.7, canvas.height * 0.3, 0, canvas.width * 0.7, canvas.height * 0.3, canvas.width * 0.3);
    g1.addColorStop(0, 'rgba(45,158,158,0.04)');
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const g2 = ctx.createRadialGradient(canvas.width * 0.2, canvas.height * 0.7, 0, canvas.width * 0.2, canvas.height * 0.7, canvas.width * 0.25);
    g2.addColorStop(0, 'rgba(212,175,55,0.03)');
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    requestAnimationFrame(draw);
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  requestAnimationFrame(draw);
}
