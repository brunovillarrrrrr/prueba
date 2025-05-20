document.getElementById('year').textContent = new Date().getFullYear();
// Efecto de scroll en el navbar
window.addEventListener('scroll', function() {
  const header = document.querySelector('header');
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Activar el enlace actual en el navbar
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function() {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
  });
});
// En script.js
// document.querySelectorAll('a[href^="#"]').forEach(anchor => {
//   anchor.addEventListener('click', function() {
//     gtag('event', 'navegacion_interna', {
//       'event_category': 'Engagement',
//       'event_label': this.getAttribute('href')
//     });
//   });
// });
// Mejora el tracking de navegación interna
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      // Track antes de navegar
      gtag('event', 'navegacion_interna', {
        'event_category': 'Engagement',
        'event_label': this.getAttribute('href')
      });
      
      // Scroll suave con polyfill si es necesario
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});