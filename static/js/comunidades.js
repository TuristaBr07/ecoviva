// comunidades.js

/**************************************
 * Variáveis Globais
 **************************************/
let map;          // Mapa MapLibre
let markers = {}; // Objeto para armazenar os marcadores
let selectedCommunity = null;

/**************************************
 * Inicializa o mapa utilizando MapLibre GL JS
 **************************************/
function initMap() {
  map = new maplibregl.Map({
    container: 'map', // ID do container no HTML
    style: 'https://demotiles.maplibre.org/style.json', // Estilo base
    center: [-51.9253, -14.2350], // [longitude, latitude]
    zoom: 4
  });

  // Adiciona controles de navegação
  map.addControl(new maplibregl.NavigationControl());

  // Quando o mapa terminar de carregar, força o redimensionamento
  map.on('load', () => map.resize());

  // Recalcula o tamanho ao redimensionar a janela
  window.addEventListener('resize', () => map.resize());
}

/**************************************
 * Adiciona uma nova cidade digitada
 **************************************/
function addCity() {
  const cityName = document.getElementById('cityName').value.trim();
  const msgDiv = document.getElementById('addCityMessage');
  msgDiv.style.display = 'none';

  if (!cityName) {
    msgDiv.innerText = "Digite o nome de uma cidade.";
    msgDiv.style.display = 'block';
    return;
  }

  // Primeiro obtém coordenadas
  fetch(`/api/geocode?city=${encodeURIComponent(cityName)}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      const { lat, lon, city } = data;
      const uniqueId = `city_${Date.now()}`;
      const payload = { id: uniqueId, nome: city, lat, lon };

      // Depois salva a comunidade no backend
      return fetch('/api/add_community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    })
    // Aqui tratamos texto/JSON para evitar "Unexpected token '<'"
    .then(async res => {
      const text = await res.text();
      // Se não for status ok ou não for JSON válido, lança texto bruto como erro
      try {
        if (!res.ok) {
          // tenta parsear JSON de erro
          const errObj = JSON.parse(text);
          throw new Error(errObj.error || text);
        }
        return JSON.parse(text);
      } catch (e) {
        // se JSON.parse falhar, repassa o texto HTML ou mensagem
        throw new Error(text);
      }
    })
    .then(result => {
      if (result.error) throw new Error(result.error);
      loadCommunities();
      document.getElementById('cityName').value = "";
    })
    .catch(err => {
      const msgDiv = document.getElementById('addCityMessage');
      msgDiv.innerText = err.message;
      msgDiv.style.display = 'block';
    });
}

/**************************************
 * Carrega a lista de comunidades e atualiza a tabela e o mapa
 **************************************/
function loadCommunities() {
  fetch('/api/communities')
    .then(res => res.json())
    .then(data => {
      const tbody = document.querySelector('#communityTable tbody');
      tbody.innerHTML = "";
      Object.values(markers).forEach(m => m.remove());
      markers = {};

      data.forEach(comm => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${comm.nome}</td>
          <td>${comm.lat.toFixed(4)}</td>
          <td>${comm.lon.toFixed(4)}</td>
          <td>
            <button class="btn btn-sm btn-info" onclick="selectCommunity('${comm.id}')">
              Ver Dados
            </button>
          </td>
        `;
        tbody.appendChild(tr);

        const marker = new maplibregl.Marker()
          .setLngLat([comm.lon, comm.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<strong>${comm.nome}</strong>`))
          .addTo(map);
        markers[comm.id] = marker;
      });

      map.resize();
    })
    .catch(err => console.error(err));
}

/**************************************
 * Seleciona uma comunidade, centraliza o mapa e atualiza o gráfico
 **************************************/
function selectCommunity(commId) {
  selectedCommunity = commId;
  const infoSection = document.getElementById('infoSection');
  if (!infoSection.style.display || infoSection.style.display === 'none') {
    infoSection.style.display = 'block';
    requestAnimationFrame(() => map.resize());
  }

  if (markers[commId]) {
    const { lng, lat } = markers[commId].getLngLat();
    map.flyTo({ center: [lng, lat], zoom: 7 });
    markers[commId].getPopup().addTo(map);
  }
  updateData();
}

/**************************************
 * Atualiza o gráfico de irradiância
 **************************************/
function updateData() {
  if (!selectedCommunity) return;

  let startInput = document.getElementById('startDate').value;
  let endInput = document.getElementById('endDate').value;
  if (!startInput) startInput = '2024-01-01';
  if (!endInput) endInput = '2025-12-31';

  const startDate = startInput.replace(/-/g, '');
  const endDate = endInput.replace(/-/g, '');

  fetch(`/api/irradiance?community_id=${selectedCommunity}&start_year=${startDate}&end_year=${endDate}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      document.getElementById('communityTitle').innerText = data.nome;
      document.getElementById('irradianceChartImg').src =
        `/plot/irradiance?community_id=${selectedCommunity}&start_year=${startDate}&end_year=${endDate}`;
    })
    .catch(err => console.error(err));
}

/**************************************
 * Inicializa o mapa e carrega as comunidades ao carregar o DOM
 **************************************/
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadCommunities();
});
