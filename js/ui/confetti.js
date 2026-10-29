/**
 * Draws a short confetti celebration on the shared canvas.
 * Respects the "reduce motion" setting and cleans up after itself.
 */

// Call this to stop whatever animation is running right now (or null if none).
let stopCurrent = null;

/**
 * Launches the confetti. Calling it again restarts the animation cleanly.
 * @param {{ durationMs?: number, particleCount?: number }} [options]
 */
export function launchConfetti({ durationMs = 2500, particleCount = 120 } = {}) {
  if (stopCurrent) stopCurrent();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('confetti-canvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 2500;
  const safeCount = Number.isFinite(particleCount)
    ? Math.max(0, Math.min(500, Math.floor(particleCount)))
    : 120;
  if (safeDuration === 0 || safeCount === 0) return;

  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const colors = getConfettiColors();

  let width = 0;
  let height = 0;
  let particles = [];
  let animationFrameId = null;
  let timeoutId = null;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function createParticles() {
    particles = Array.from({ length: safeCount }, () => ({
      x: Math.random() * width,
      y: -Math.random() * height * 0.8,
      size: 4 + Math.random() * 7,
      speed: 1.5 + Math.random() * 3.5,
      drift: (Math.random() - 0.5) * 1.8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.12,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() < 0.65 ? 'rect' : 'circle',
    }));
  }

  function drawFrame(timestamp) {
    context.clearRect(0, 0, width, height);

    for (const particle of particles) {
      particle.y += particle.speed;
      particle.x += particle.drift + Math.sin(timestamp / 400 + particle.rotation) * 0.5;
      particle.rotation += particle.rotationSpeed;

      // Pieces that fall off the bottom come back in at the top.
      if (particle.y > height + particle.size) {
        particle.y = -particle.size;
        particle.x = Math.random() * width;
      }
      if (particle.x < -particle.size) particle.x = width + particle.size;
      else if (particle.x > width + particle.size) particle.x = -particle.size;

      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      if (particle.shape === 'rect') {
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.65);
      } else {
        context.beginPath();
        context.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    animationFrameId = requestAnimationFrame(drawFrame);
  }

  function stop() {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    if (timeoutId !== null) clearTimeout(timeoutId);
    window.removeEventListener('resize', resizeCanvas);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (stopCurrent === stop) stopCurrent = null;
  }

  stopCurrent = stop;
  resizeCanvas();
  createParticles();
  window.addEventListener('resize', resizeCanvas);
  animationFrameId = requestAnimationFrame(drawFrame);
  timeoutId = setTimeout(stop, safeDuration);
}

/**
 * Reads the theme colours from CSS variables, with fallbacks.
 * @returns {string[]}
 */
function getConfettiColors() {
  const styles = getComputedStyle(document.documentElement);
  const readColor = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return [
    readColor('--color-accent', '#FFC83D'),
    readColor('--color-correct', '#32D583'),
    readColor('--color-wrong', '#FF5C7A'),
    readColor('--color-text', '#FBF3E4'),
  ];
}
