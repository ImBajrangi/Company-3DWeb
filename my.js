/**
 * my.js — Moblinks-style spring-physics parallax
 *
 * Features:
 *   ① Staggered cursor trail — outer rings react first, inner follow
 *   ② Spring physics per-layer — snappy + fluid elastic settling
 *   ③ Idle float — gentle sine oscillation when mouse is still
 *   ④ Scroll-driven sequential close — rings swallow inward one-by-one
 *   ⑤ Menu / Cart — click-triggered only
 */

const STIFF = 0.15;
const DAMP = 0.75;
const STAGGER = 3;
const SENSITIVITY = 0.12;

const hero = document.querySelector('.hero');
const depthLayers = gsap.utils.toArray('.depth-layer');
const mascot = document.getElementById('model-canvas');
const N = depthLayers.length;

// Cache post-scroll UI elements
const menuOverlay = document.getElementById('menu-overlay');
const menuCloseBtn = document.querySelector('.menu-close');
const cartPanel = document.querySelector('.cart-panel');
const cartCloseBtn = document.querySelector('.cart-close');
const navMenu = document.getElementById('nav-menu');
const navCart = document.getElementById('nav-cart');

// Performance: cache rect once, update on resize
let heroRect = hero.getBoundingClientRect();
window.addEventListener('resize', () => {
    heroRect = hero.getBoundingClientRect();
}, { passive: true });

// Cursor state
const mouse = { x: 0, y: 0 };

hero.addEventListener('mousemove', (e) => {
    mouse.x = ((e.clientX - heroRect.left) / heroRect.width - 0.5) * 2;
    mouse.y = ((e.clientY - heroRect.top) / heroRect.height - 0.5) * 2;
}, { passive: true });

hero.addEventListener('mouseleave', () => {
    mouse.x = 0;
    mouse.y = 0;
});

// Cursor trail buffer
const BUFFER = N * STAGGER + 1;
const trail = [];

// Base hole sizes for layers (Outer to Inner) — vmin to reach screen edges
const BASE_SIZES = [150, 120, 95, 75, 55];

// Per-layer spring state
const layers = depthLayers.map((el, i) => ({
    el,
    mask: el.querySelector('.depth-mask'),
    baseSize: BASE_SIZES[i] || 20,
    delay: (N - 1 - i) * STAGGER,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    lastSize: -1
}));

// Initialize Lenis smooth scroll
const lenis = new Lenis({
    duration: 1.5,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    lerp: 0.05,
    wheelMultiplier: 0.9,
    infinite: false,
});

// Scroll progress state (0–1)
let globalProgress = 0;
lenis.on('scroll', (e) => {
    globalProgress = e.progress;
});

// Idle float start time
const t0 = performance.now();

// ── Main animation loop ───────────────────────────────────────────
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
    const now = performance.now() - t0;

    // ① Cursor trail
    trail.push({
        x: Math.round(mouse.x * heroRect.width * SENSITIVITY * 10) / 10,
        y: Math.round(mouse.y * heroRect.height * SENSITIVITY * 10) / 10,
    });
    if (trail.length > BUFFER) trail.shift();

    // ② Animate each layer
    layers.forEach((layer, i) => {
        const idx = Math.max(0, trail.length - 1 - layer.delay);
        const target = trail[idx] || { x: 0, y: 0 };
        const floatY = Math.sin(now * 0.0006 + i * 1.2) * (2 + i);

        // Spring physics
        layer.vel.x += (target.x - layer.pos.x) * STIFF;
        layer.vel.y += (target.y + floatY - layer.pos.y) * STIFF;
        layer.vel.x *= DAMP;
        layer.vel.y *= DAMP;
        layer.pos.x += layer.vel.x;
        layer.pos.y += layer.vel.y;

        // Sequential closing: innermost (i=4) shuts first, outermost (i=0) last
        const closeOrder = (N - 1 - i);
        const start = closeOrder * 0.06;
        const end = start + 0.25;
        const layerProgress = gsap.utils.clamp(0, 1, (globalProgress - start) / (end - start));

        const dynamicSize = layer.baseSize * (1.0 - layerProgress);

        if (layer.mask && Math.abs(layer.lastSize - dynamicSize) > 0.01) {
            layer.mask.style.setProperty('--size', `${dynamicSize.toFixed(2)}vmin`);
            layer.lastSize = dynamicSize;
        }

        const breathe = 1 + 0.01 * Math.sin(now * 0.0005 + i * 1.4);
        const tx = Math.round(layer.pos.x * 10) / 10;
        const ty = Math.round(layer.pos.y * 10) / 10;
        const sc = ((1 + layerProgress * 0.05) * breathe).toFixed(3);

        // Direct DOM Update — Much faster than GSAP.set in a ticker
        layer.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sc})`;
    });

    // ③ Mascot sync — fades out as the innermost ring closes
    if (mascot) {
        const innermostProgress = gsap.utils.clamp(0, 1, globalProgress / 0.25);
        const mScale = (1.0 - (innermostProgress * 0.8)).toFixed(3);
        const mOpacity = gsap.utils.clamp(0, 1, 1 - innermostProgress * 1.1).toFixed(3);

        mascot.style.transform = `scale(${mScale})`;
        mascot.style.opacity = mOpacity;
        mascot.style.display = mOpacity < 0.01 ? 'none' : 'block';
    }
});

// ── Manual override states ────────────────────────────────────────
let menuOpenedByClick = false;
let cartOpenedByClick = false;

// MENU button — opens the full-screen overlay
if (navMenu) {
    navMenu.addEventListener('click', () => {
        menuOpenedByClick = !menuOpenedByClick;
        menuOverlay.classList.toggle('is-active', menuOpenedByClick);
    });
}

// Menu close button (red X inside menu)
if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', () => {
        menuOpenedByClick = false;
        menuOverlay.classList.remove('is-active');
    });
}

// CART button — slides the cart panel
if (navCart) {
    navCart.addEventListener('click', () => {
        cartOpenedByClick = !cartOpenedByClick;
        cartPanel.classList.toggle('is-active', cartOpenedByClick);
    });
}

// Cart close button (red X inside cart)
if (cartCloseBtn) {
    cartCloseBtn.addEventListener('click', () => {
        cartOpenedByClick = false;
        cartPanel.classList.remove('is-active');
    });
}

// ── Wave IIFE factory helper ──────────────────────────────────────
function makeWave(canvasId, color, amps, freqs, speeds, drift, base, h) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const H = h || 140;
    function resize() { canvas.width = window.innerWidth; canvas.height = H; }
    resize();
    window.addEventListener('resize', resize, { passive: true });
    (function draw() {
        const t = performance.now();
        // drift clamped to ±8% so wave stays well within canvas
        const midY = (base + Math.sin(t * drift) * 0.08) * H;
        ctx.clearRect(0, 0, canvas.width, H);
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= canvas.width; x += 2) {
            ctx.lineTo(x,
                midY
                + amps[0] * Math.sin(x * freqs[0] + t * speeds[0])
                + amps[1] * Math.sin(x * freqs[1] + t * speeds[1] + 1.2)
                + amps[2] * Math.sin(x * freqs[2] + t * speeds[2] + 2.7)
            );
        }
        ctx.lineTo(canvas.width, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        requestAnimationFrame(draw);
    })();
}

// 1) Amber → Navy (dream section top)
makeWave('footer-wave', '#001850', [24, 14, 8], [0.004, 0.007, 0.012], [0.0006, 0.0004, 0.0008], 0.00025, 0.55);
// 2) Navy → Brown (dream → ticker)
makeWave('dream-wave-bottom', '#3B1E00', [22, 13, 8], [0.005, 0.009, 0.014], [0.0008, 0.0005, 0.001], 0.0003, 0.52);
// 3) Brown → Amber (ticker → manifesto)
makeWave('wave-ticker-bottom', '#ffbf00', [20, 12, 7], [0.005, 0.008, 0.013], [0.0007, 0.0005, 0.0009], 0.00028, 0.54);
// 4) Amber → Navy (manifesto → cards)
makeWave('wave-manifesto-bottom', '#001850', [21, 13, 7], [0.004, 0.007, 0.011], [0.0006, 0.0004, 0.0008], 0.0003, 0.55);
// 5) Navy → Amber (cards → footer)
makeWave('wave-to-footer', '#ffbf00', [22, 14, 8], [0.004, 0.008, 0.011], [0.0005, 0.0007, 0.001], 0.00022, 0.53);


// ── Card hover particles ─────────────────────────────────────────
(function initCardParticles() {
    const ICONS = ["🧩", "✦", "⭐", "🌙", "💛", "🎯"];

    function spawnParticles(card) {
        const rect = card.getBoundingClientRect();
        const count = 6;
        for (let i = 0; i < count; i++) {
            const el = document.createElement('span');
            el.className = 'card-particle';
            el.textContent = ICONS[Math.floor(Math.random() * ICONS.length)];
            // random position within card
            el.style.cssText = `
                left: ${10 + Math.random() * 80}%;
                top: ${20 + Math.random() * 60}%;
                font-size: ${14 + Math.random() * 20}px;
                animation-delay: ${Math.random() * 0.3}s;
                animation-duration: ${0.6 + Math.random() * 0.6}s;
            `;
            card.appendChild(el);
            el.addEventListener('animationend', () => el.remove(), { once: true });
        }
    }

    document.querySelectorAll('.card').forEach(card => {
        let timeout;
        card.addEventListener('mouseenter', () => {
            spawnParticles(card);
            timeout = setInterval(() => spawnParticles(card), 600);
        });
        card.addEventListener('mouseleave', () => clearInterval(timeout));
    });
})();

// ── Pinned horizontal scroll section (manual, Lenis-compatible) ──
(function initPinSection() {
    const wrapper = document.querySelector('.pin-wrapper');
    const track = document.getElementById('pin-track');
    const dots = document.querySelectorAll('.pin-dot');
    if (!wrapper || !track) return;

    const PANELS = 3;

    function updatePin() {
        const rect = wrapper.getBoundingClientRect();
        const wrapperH = wrapper.offsetHeight;
        const viewH = window.innerHeight;
        const scrollableDistance = wrapperH - viewH;

        // How far into the wrapper we've scrolled (0 → 1)
        // rect.top goes from positive (below viewport) to negative (scrolled past)
        let progress = 0;
        if (scrollableDistance > 0) {
            progress = -rect.top / scrollableDistance;
            progress = Math.max(0, Math.min(1, progress));
        }

        // Translate track: 0vw → -200vw
        const translateX = progress * -(PANELS - 1) * 100;
        track.style.transform = `translateX(${translateX}vw)`;

        // Update active dot
        const idx = Math.round(progress * (PANELS - 1));
        dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));

        requestAnimationFrame(updatePin);
    }

    requestAnimationFrame(updatePin);
})();

