// Inicializa o mapa com Leaflet (exemplo para outra página)
var map = L.map('map').setView([-14.2350, -51.9253], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

var cities = [
  { nome: "São Paulo", coords: [-23.5505, -46.6333] },
  { nome: "Rio de Janeiro", coords: [-22.9068, -43.1729] },
  { nome: "Salvador", coords: [-12.9777, -38.5016] }
];

cities.forEach(cidade => {
  L.marker(cidade.coords).addTo(map)
    .bindPopup(`<strong>${cidade.nome}</strong>`);
});

/* ===== Menu Hamburger acessível & sem sobreposição ============== */
const body = document.body;
function toggleMenu() {
  const nav = document.querySelector('.nav-mobile');
  if (!nav) return; // garante que existe
  const opened = nav.classList.toggle('is-active');

  // bloqueia/desbloqueia rolagem da página
  body.style.overflow = opened ? 'hidden' : '';

  // feedback de acessibilidade caso haja botão
  const btn = document.querySelector('.hamburger');
  if (btn) btn.setAttribute('aria-expanded', opened);
}

// registro de eventos
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
  }

  document.querySelectorAll('.nav-mobile a').forEach(link => {
    link.addEventListener('click', () => {
      // fecha o drawer ao tocar em qualquer link
      const hamburgerBtn = document.querySelector('.hamburger');
      if (hamburgerBtn && hamburgerBtn.getAttribute('aria-expanded') === 'true') {
        hamburgerBtn.click();
      }
    });
  });
});
