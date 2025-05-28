// static/js/doacoes_plotly.js

// Função para controlar o menu responsivo
function toggleMenu() {
  const navMenu = document.getElementById('navMenu');
  navMenu.classList.toggle('active');
}

// Variável global para armazenar dados das comunidades
let comunidadesData = [];

/**
 * Atualiza o gráfico de barras com os dados vindos do backend
 */
function updateDonationChart() {
  fetch("/api/communities")
    .then(res => res.json())
    .then(data => {
      comunidadesData = data;
      const names  = data.map(c => c.nome);
      const values = data.map(c => c.doacao_atual);

      const trace = {
        x: names,
        y: values,
        type: 'bar'
      };
      const layout = {
        title: 'Valor Doado por Região',
        xaxis: { title: 'Comunidade' },
        yaxis: { title: 'Valor Doado (R$)' }
      };

      Plotly.newPlot('donationBarChart', [trace], layout);
    })
    .catch(err => console.error("Erro ao carregar gráfico:", err));
}

/**
 * Popula o <select> de comunidades do formulário
 */
function loadCommunitySelect() {
  fetch("/api/communities")
    .then(res => res.json())
    .then(data => {
      comunidadesData = data;
      const sel = document.getElementById("communitySelect");
      sel.innerHTML = '<option value="">-- selecione --</option>';
      data.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nome;
        sel.appendChild(opt);
      });
    })
    .catch(err => console.error("Erro ao carregar comunidades:", err));
}

/**
 * Exibe o modal de PIX com contagem regressiva de 10s
 */
function showPixModal(callback) {
  const pixModal = document.getElementById('pixModal');
  const countdownEl = document.getElementById('pixCountdown');
  let countdown = 10;
  countdownEl.textContent = countdown;
  pixModal.style.display = 'flex';

  const interval = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;
    if (countdown <= 0) clearInterval(interval);
  }, 1000);

  setTimeout(() => {
    pixModal.style.display = 'none';
    callback();
  }, 10000);
}

/**
 * Envia a doação para o backend e, em caso de sucesso,
 * atualiza o gráfico e mostra mensagem de confirmação.
 * Antes disso, simula um pagamento via PIX.
 */
function donate(event) {
  event.preventDefault();
  const donorName   = document.getElementById("donorName").value.trim();
  const donorEmail  = document.getElementById("donorEmail").value.trim();
  const communityId = document.getElementById("communitySelect").value;
  const amountInput = document.getElementById("donationAmount").value;
  const messageDiv  = document.getElementById("donationMessage");

  messageDiv.style.display = 'none';

  // validações básicas
  if (!donorName || !donorEmail || !communityId || !amountInput) {
    messageDiv.textContent = "Preencha todos os campos.";
    messageDiv.style.color = "red";
    messageDiv.style.display = 'block';
    return;
  }
  const amount = parseFloat(amountInput);
  if (isNaN(amount) || amount <= 0) {
    messageDiv.textContent = "Informe um valor de doação válido.";
    messageDiv.style.color = "red";
    messageDiv.style.display = 'block';
    return;
  }

  // Simula pagamento via PIX
  showPixModal(() => {
    // após 10s, envia ao backend
    fetch("/api/add_donation", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        community_id: communityId,
        amount: amount
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.error) throw new Error(result.error);
      // sucesso!
      messageDiv.textContent = `Obrigado, ${donorName}! Doação de R$ ${amount.toFixed(2)} registrada.`;
      messageDiv.style.color = "green";
      messageDiv.style.display = 'block';
      // limpa valores e atualiza tudo
      document.getElementById("donorName").value       = "";
      document.getElementById("donorEmail").value      = "";
      document.getElementById("communitySelect").value = "";
      document.getElementById("donationAmount").value  = "";
      updateDonationChart();
    })
    .catch(err => {
      messageDiv.textContent = err.message;
      messageDiv.style.color = "red";
      messageDiv.style.display = 'block';
    });
  });
}

// Inicialização ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  loadCommunitySelect();
  updateDonationChart();
  document.getElementById("donationForm")
          .addEventListener("submit", donate);
});
