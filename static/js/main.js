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
