const langObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.lang-bar-fill').forEach(bar => {
        const w = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => bar.style.width = w, 200);
      });
      langObs.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });

const langGrid = document.querySelector('.lang-grid');
if (langGrid) langObs.observe(langGrid);
