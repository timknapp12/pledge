// Pledge Landing Page — main.js

(function () {
  'use strict';

  // --- Scroll-triggered animations ---
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll('.animate-on-scroll').forEach((el) => el.classList.add('visible'));
  }

  // --- Nav background on scroll ---
  const nav = document.getElementById('nav');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
        ticking = false;
      });
      ticking = true;
    }
  });

  // --- Mobile nav toggle ---
  const navMobile = document.getElementById('navMobile');
  const navOpen = document.getElementById('navOpen');
  const navClose = document.getElementById('navClose');

  if (navOpen && navMobile && navClose) {
    navOpen.addEventListener('click', () => navMobile.classList.add('open'));
    navClose.addEventListener('click', () => navMobile.classList.remove('open'));

    navMobile.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => navMobile.classList.remove('open'));
    });
  }
})();
