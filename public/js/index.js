// Parallax on scroll
const parallaxBg = document.getElementById('parallax-bg');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (parallaxBg) parallaxBg.style.transform = `translateY(${y * 0.3}px)`;
  const wrap = document.getElementById('parallax-char-wrap');
  if (wrap) wrap.style.marginBottom = `${y * 0.08}px`;
}, { passive: true });

// Nav hide/show + background on scroll
const navEl = document.getElementById('nav');
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  navEl.classList.toggle('hidden', y > lastScroll && y > 80);
  navEl.style.background = y > 40 ? 'rgba(18,18,18,0.99)' : 'rgba(20,20,20,0.97)';
  lastScroll = y;
}, { passive: true });

// Nav active link by section
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');
const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const link = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
      if (link) link.classList.add('active');
    }
  });
}, { threshold: 0.4 });
sections.forEach(s => sectionObs.observe(s));

// Mobile hamburger menu
const hamburger = document.getElementById('nav-hamburger');
const mobileMenu = document.getElementById('nav-mobile-menu');
let menuOpen = false;
function closeMobileMenu() { menuOpen = false; mobileMenu.classList.remove('open'); }
hamburger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('open', menuOpen);
});
