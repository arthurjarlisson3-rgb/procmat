// ===== ESTADO GLOBAL =====
const CO2_POR_LITRO = 2.68;

function loadState() {
  try {
    const frota     = JSON.parse(localStorage.getItem('ecodrive_frota'))     || [];
    const registros = JSON.parse(localStorage.getItem('ecodrive_registros')) || [];
    return { frota, registros };
  } catch (e) {
    return { frota: [], registros: [] };
  }
}

function saveState() {
  localStorage.setItem('ecodrive_frota',     JSON.stringify(state.frota));
  localStorage.setItem('ecodrive_registros', JSON.stringify(state.registros));
}

const state = loadState();
let chartInstance = null;

// ===== NAVEGAÇÃO =====
function switchTab(name) {
  const names = ['frota', 'registro', 'historico', 'grafico', 'motoristas', 'ranking', 'medalhas'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'ranking')    renderRanking();
  if (name === 'medalhas')   renderMedalhas();
  if (name === 'registro')   { populateVehicleSelect('r-veiculo'); populateDriverDatalist(); }
  if (name === 'historico')  { populateVehicleSelect('h-filtro-veiculo', true); populateDriverSelect('h-filtro-motorista', true); renderHistorico(); }
  if (name === 'grafico')    { populateVehicleSelect('g-veiculo', true); renderGrafico(); }
  if (name === 'motoristas') { populateDriverSelect('m-filtro', true); renderMotoristas(); }
}

// ===== FROTA =====
function addVehicle() {
  const placa    = document.getElementById('v-placa').value.trim().toUpperCase();
  const modelo   = document.getElementById('v-modelo').value.trim();
  const ano      = document.getElementById('v-ano').value.trim();
  const comb     = document.getElementById('v-comb').value;
  const consumo  = parseFloat(document.getElementById('v-consumo').value);

  if (!placa || !modelo || !consumo) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }
  if (state.frota.find(v => v.placa === placa)) {
    alert('Já existe um veículo com essa placa.');
    return;
  }

  state.frota.push({ placa, modelo, ano, comb, consumo, pontos: 70 });
  saveState();
  ['v-placa', 'v-modelo', 'v-ano', 'v-consumo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  renderFrota();
}

function renderFrota() {
  const el = document.getElementById('frota-list');
  if (!state.frota.length) {
    el.innerHTML = '<p class="muted center" style="padding:1rem">Nenhum veículo cadastrado ainda.</p>';
    return;
  }
  el.innerHTML = `
    <div class="card">
      <table class="fleet-table">
        <thead>
          <tr>
            <th style="width:22%">Placa</th>
            <th style="width:42%">Modelo</th>
            <th style="width:18%">km/L meta</th>
            <th style="width:18%">Comb.</th>
          </tr>
        </thead>
        <tbody>
          ${state.frota.map(v => `
            <tr>
              <td><strong>${v.placa}</strong></td>
              <td>${v.modelo} ${v.ano}</td>
              <td>${v.consumo.toFixed(1)}</td>
              <td>${v.comb.split(' ')[0]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ===== SELECT HELPERS =====
function populateVehicleSelect(id, withAll = false) {
  const sel = document.getElementById(id);
  const placeholder = withAll ? 'Todos os veículos' : 'Selecione um veículo cadastrado';
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    state.frota.map(v => `<option value="${v.placa}">${v.placa} — ${v.modelo}</option>`).join('');
}

function getMotoristasUnicos() {
  const nomes = state.registros.map(r => r.motorista);
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function populateDriverSelect(id, withAll = false) {
  const sel = document.getElementById(id);
  const placeholder = withAll ? 'Todos os motoristas' : 'Selecione um motorista';
  const motoristas = getMotoristasUnicos();
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    motoristas.map(m => `<option value="${m}">${m}</option>`).join('');
}

function populateDriverDatalist() {
  const dl = document.getElementById('lista-motoristas');
  const motoristas = getMotoristasUnicos();
  dl.innerHTML = motoristas.map(m => `<option value="${m}"></option>`).join('');
}

// ===== REGISTRO =====
function calcRegistro() {
  const placa     = document.getElementById('r-veiculo').value;
  const motorista = document.getElementById('r-motorista').value.trim();
  const kmIni  = parseFloat(document.getElementById('r-km-ini').value);
  const kmFim  = parseFloat(document.getElementById('r-km-fim').value);
  const litros = parseFloat(document.getElementById('r-litros').value);
  const ocorr  = parseInt(document.getElementById('r-ocorr').value);
  const trein  = parseInt(document.getElementById('r-trein').value);

  if (!placa) { alert('Selecione um veículo.'); return; }
  if (!motorista) { alert('Informe o nome do motorista.'); return; }
  if (!kmIni || !kmFim || !litros || kmFim <= kmIni) {
    alert('Preencha corretamente os campos de KM e litros.');
    return;
  }

  const v          = state.frota.find(x => x.placa === placa);
  const distancia  = kmFim - kmIni;
  const consumoReal = distancia / litros;
  const meta       = v.consumo;
  const ganhoPerc  = ((consumoReal - meta) / meta) * 100;
  const co2Emitido = litros * CO2_POR_LITRO;

  let pontos = 70;
  if      (ganhoPerc >= 15) pontos = 100;
  else if (ganhoPerc >= 10) pontos = 92;
  else if (ganhoPerc >= 5)  pontos = 85;
  else if (ganhoPerc >= 0)  pontos = 78;
  else                       pontos = 65;
  pontos -= ocorr * 4;
  pontos += trein;
  pontos = Math.max(0, Math.min(100, pontos));

  const agora = new Date();
  const data = agora.toLocaleDateString('pt-BR');

  state.registros.push({
    placa, motorista, distancia, litros,
    consumoReal, meta, ganhoPerc, co2Emitido, pontos, data,
    kmIni, kmFim,
    timestamp: agora.getTime(),
    mes: agora.getMonth(),
    ano: agora.getFullYear()
  });
  saveState();

  const cor    = ganhoPerc >= 0 ? 'green' : 'red';
  const sinal  = ganhoPerc >= 0 ? '+' : '';
  const medalha = ganhoPerc >= 15 ? '🥇 Ouro' : ganhoPerc >= 10 ? '🥈 Prata' : ganhoPerc >= 5 ? '🥉 Bronze' : '—';

  document.getElementById('resultado-box').innerHTML = `
    <div class="card">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px">
        Resultado — ${motorista} · ${placa} · ${data}
      </div>
      <div class="grid3" style="margin-bottom:12px">
        <div class="result-box"><div class="result-label">Distância</div><div class="result-val">${distancia} km</div></div>
        <div class="result-box"><div class="result-label">Consumo real</div><div class="result-val ${cor}">${consumoReal.toFixed(2)} km/L</div></div>
        <div class="result-box"><div class="result-label">Meta</div><div class="result-val">${meta.toFixed(1)} km/L</div></div>
      </div>
      <div class="grid3" style="margin-bottom:12px">
        <div class="result-box"><div class="result-label">Ganho vs meta</div><div class="result-val ${cor}">${sinal}${ganhoPerc.toFixed(1)}%</div></div>
        <div class="result-box"><div class="result-label">Combustível consumido</div><div class="result-val">${litros.toFixed(1)} L</div></div>
        <div class="result-box"><div class="result-label">Nota ESG</div><div class="result-val green">${pontos}</div></div>
      </div>
      <div class="result-box" style="margin-bottom:12px">
        <div class="result-label">CO₂ emitido na viagem</div>
        <div class="result-val red">${co2Emitido.toFixed(1)} kg</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="muted">Medalha conquistada:</span>
        <span style="font-size:15px">${medalha}</span>
      </div>
    </div>`;

  ['r-km-ini', 'r-km-fim', 'r-litros'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('r-motorista').value = '';
  document.getElementById('r-ocorr').value = '0';
  document.getElementById('r-trein').value = '0';
}

// ===== HISTÓRICO =====
function renderHistorico() {
  const filtroVeiculo   = document.getElementById('h-filtro-veiculo').value;
  const filtroMotorista = document.getElementById('h-filtro-motorista').value;
  const el = document.getElementById('historico-list');

  let lista = state.registros;
  if (filtroVeiculo)   lista = lista.filter(r => r.placa === filtroVeiculo);
  if (filtroMotorista) lista = lista.filter(r => r.motorista === filtroMotorista);

  if (!lista.length) {
    el.innerHTML = '<div class="card"><p class="muted center">Nenhum registro encontrado.</p></div>';
    return;
  }

  el.innerHTML = '<div class="card">' +
    [...lista].reverse().map(r => {
      const cor   = r.ganhoPerc >= 0 ? 'darkgreen' : 'firebrick';
      const sinal = r.ganhoPerc >= 0 ? '+' : '';
      const m     = r.ganhoPerc >= 15 ? '🥇' : r.ganhoPerc >= 10 ? '🥈' : r.ganhoPerc >= 5 ? '🥉' : '';
      return `
        <div class="hist-row">
          <div class="hist-header">
            <span>${r.motorista} — ${r.placa} ${m}</span>
            <span class="muted">${r.data}</span>
          </div>
          <div class="hist-details">
            <span>${r.distancia} km</span>
            <span><strong>Combustível consumido: ${r.litros.toFixed(1)} L</strong></span>
            <span style="color:${cor}">${r.consumoReal.toFixed(2)} km/L (${sinal}${r.ganhoPerc.toFixed(1)}%)</span>
            <span style="color:firebrick">CO₂ emitido: ${r.co2Emitido.toFixed(1)} kg</span>
            <span class="muted">ESG: ${r.pontos}</span>
          </div>
        </div>`;
    }).join('') +
  '</div>';
}

// ===== GRÁFICO =====
function renderGrafico() {
  const placa = document.getElementById('g-veiculo').value;
  const dados = placa
    ? state.registros.filter(r => r.placa === placa)
    : state.registros;

  const labels   = dados.map((r, i) => `#${i + 1} ${r.data}`);
  const consumos = dados.map(r => parseFloat(r.consumoReal.toFixed(2)));
  const metas    = dados.map(r => r.meta);

  if (!dados.length) {
    document.getElementById('stat-melhor').textContent = '—';
    document.getElementById('stat-media').textContent  = '—';
    document.getElementById('stat-litros').textContent = '—';
    document.getElementById('stat-co2-emitido').textContent = '—';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const melhor   = Math.max(...consumos);
  const media    = consumos.reduce((a, b) => a + b, 0) / consumos.length;
  const litrosTotal = dados.reduce((a, r) => a + r.litros, 0);
  const co2EmitidoTotal = dados.reduce((a, r) => a + r.co2Emitido, 0);

  document.getElementById('stat-melhor').textContent = melhor.toFixed(2) + ' km/L';
  document.getElementById('stat-media').textContent  = media.toFixed(2)  + ' km/L';
  document.getElementById('stat-litros').textContent = litrosTotal.toFixed(1) + ' L';
  document.getElementById('stat-co2-emitido').textContent = co2EmitidoTotal.toFixed(1) + ' kg';

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(document.getElementById('chartConsumo'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Consumo real (km/L)',
          data: consumos,
          borderColor: 'olivedrab',
          backgroundColor: 'rgba(107,142,35,0.1)',
          tension: 0.3,
          pointBackgroundColor: 'olivedrab',
          pointRadius: 5,
          fill: true
        },
        {
          label: 'Meta (km/L)',
          data: metas,
          borderColor: 'darkgray',
          borderDash: [6, 3],
          pointRadius: 0,
          tension: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { font: { size: 11 }, autoSkip: true, maxRotation: 30 },
          grid: { display: false }
        },
        y: {
          ticks: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }
  });
}

// ===== MOTORISTAS =====
function renderMotoristas() {
  const filtro = document.getElementById('m-filtro').value;
  const el = document.getElementById('motoristas-list');
  const motoristas = filtro ? [filtro] : getMotoristasUnicos();

  if (!motoristas.length) {
    el.innerHTML = '<p class="muted center" style="padding:1rem">Nenhum registro de motorista ainda. Registre jornadas na aba Registro.</p>';
    return;
  }

  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();

  el.innerHTML = motoristas.map(nome => {
    const regs = state.registros.filter(r => r.motorista === nome);
    const regsMes = regs.filter(r => r.mes === mesAtual && r.ano === anoAtual);

    const totalLitros = regs.reduce((a, r) => a + r.litros, 0);
    const totalDistancia = regs.reduce((a, r) => a + r.distancia, 0);
    const mediaConsumo = totalDistancia > 0 ? totalDistancia / totalLitros : 0;

    const litrosMes = regsMes.reduce((a, r) => a + r.litros, 0);
    const pontosMedia = regs.length ? Math.round(regs.reduce((a, r) => a + r.pontos, 0) / regs.length) : 0;
    const co2EmitidoTotal = regs.reduce((a, r) => a + r.co2Emitido, 0);

    const veiculosUsados = [...new Set(regs.map(r => r.placa))];

    const historicoLitros = [...regs].reverse().map(r => `
      <div class="hist-row">
        <div class="hist-header">
          <span>${r.placa} — ${r.data}</span>
          <span class="muted">${r.distancia} km</span>
        </div>
        <div class="hist-details">
          <span><strong>Combustível consumido: ${r.litros.toFixed(1)} L</strong></span>
          <span class="muted">${r.consumoReal.toFixed(2)} km/L</span>
        </div>
      </div>`).join('');

    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:15px;font-weight:600">${nome}</div>
          <div class="esg-score">${pontosMedia}</div>
        </div>
        <div class="muted" style="margin-bottom:10px">
          ${regs.length} jornada(s) · Veículos utilizados: ${veiculosUsados.join(', ') || '—'}
        </div>
        <div class="grid3">
          <div class="result-box">
            <div class="result-label">Média de consumo</div>
            <div class="result-val">${mediaConsumo ? mediaConsumo.toFixed(2) : '0.00'} km/L</div>
          </div>
          <div class="result-box">
            <div class="result-label">Combustível gasto (mês atual)</div>
            <div class="result-val">${litrosMes.toFixed(1)} L</div>
          </div>
          <div class="result-box">
            <div class="result-label">Combustível gasto (total)</div>
            <div class="result-val">${totalLitros.toFixed(1)} L</div>
          </div>
        </div>
        <div class="grid2" style="margin-top:12px">
          <div class="result-box">
            <div class="result-label">CO₂ emitido (total)</div>
            <div class="result-val red">${co2EmitidoTotal.toFixed(1)} kg</div>
          </div>
        </div>
        <h3 class="section-sub" style="margin-top:1rem">Histórico de combustível consumido</h3>
        <div class="card" style="padding:0.25rem 1.25rem">
          ${historicoLitros || '<p class="muted center" style="padding:0.5rem">Sem jornadas registradas.</p>'}
        </div>
      </div>`;
  }).join('');
}

// ===== RANKING =====
function renderRanking() {
  const el = document.getElementById('ranking-list');
  const motoristas = getMotoristasUnicos();

  if (!motoristas.length) {
    el.innerHTML = '<p class="muted center" style="padding:1rem">Registre jornadas para ver o ranking.</p>';
    return;
  }

  const ranking = motoristas.map(nome => {
    const regs = state.registros.filter(r => r.motorista === nome);
    const pontosMedia = regs.length ? Math.round(regs.reduce((a, r) => a + r.pontos, 0) / regs.length) : 0;
    const ultimoVeiculo = regs.length ? regs[regs.length - 1].placa : '—';
    return { nome, pontos: pontosMedia, jornadas: regs.length, ultimoVeiculo };
  }).sort((a, b) => b.pontos - a.pontos);

  el.innerHTML = ranking.map((r, i) => {
    const cls = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : '';
    const m   = r.pontos >= 90 ? '🥇' : r.pontos >= 82 ? '🥈' : r.pontos >= 74 ? '🥉' : '';
    return `
      <div class="rank-row">
        <div class="rank-num ${cls}">${i + 1}</div>
        <div style="flex:1">
          <div class="rank-name">${r.nome} ${m}</div>
          <div class="rank-veh">${r.jornadas} jornada(s) · último veículo: ${r.ultimoVeiculo}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${r.pontos}%"></div>
          </div>
        </div>
        <div class="esg-score">${r.pontos}</div>
      </div>`;
  }).join('');
}

// ===== MEDALHAS =====
function renderMedalhas() {
  const dest = document.getElementById('destaque-esg');
  const conq = document.getElementById('conquistas-list');
  const motoristas = getMotoristasUnicos();

  if (!motoristas.length) {
    dest.innerHTML = '<p class="muted center">Registre jornadas para apurar o destaque do mês.</p>';
    conq.innerHTML = '';
    return;
  }

  const ranking = motoristas.map(nome => {
    const regs = state.registros.filter(r => r.motorista === nome);
    const pontosMedia = regs.length ? Math.round(regs.reduce((a, r) => a + r.pontos, 0) / regs.length) : 0;
    return { nome, pontos: pontosMedia, jornadas: regs.length };
  }).sort((a, b) => b.pontos - a.pontos);

  const lider = ranking[0];
  dest.innerHTML = `
    <div style="font-size:32px;margin-bottom:8px">🏆</div>
    <div style="font-size:18px;font-weight:700">${lider.nome}</div>
    <div class="muted">Nota ESG média: ${lider.pontos}</div>
    <div style="margin-top:8px;font-size:13px;color:darkgreen;font-weight:600">Motorista ESG do Mês</div>`;

  conq.innerHTML = ranking.map(r => {
    const m = r.pontos >= 90
      ? { icon: '🥇', label: 'Ouro',   cls: 'badge-gold'   }
      : r.pontos >= 82
      ? { icon: '🥈', label: 'Prata',  cls: 'badge-silver' }
      : r.pontos >= 74
      ? { icon: '🥉', label: 'Bronze', cls: 'badge-bronze' }
      : null;
    return `
      <div class="card conquista-card">
        <div class="conquista-avatar">${m ? m.icon : '⬜'}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600">${r.nome}</div>
          <div class="muted">${r.jornadas} jornada(s) registrada(s)</div>
        </div>
        ${m
          ? `<span class="badge ${m.cls}">${m.label}</span>`
          : `<span class="muted" style="font-size:12px">Sem medalha</span>`
        }
      </div>`;
  }).join('');
}

// ===== EXPORTAR CSV =====
function exportCSV() {
  if (!state.registros.length) { alert('Nenhum registro para exportar.'); return; }
  const header = 'Data,Placa,Motorista,Distância(km),Combustível Consumido(L),Consumo(km/L),Meta(km/L),Ganho(%),CO2 Emitido(kg),Nota ESG\n';
  const rows = state.registros.map(r =>
    `${r.data},${r.placa},${r.motorista},${r.distancia},${r.litros.toFixed(1)},` +
    `${r.consumoReal.toFixed(2)},${r.meta.toFixed(1)},${r.ganhoPerc.toFixed(1)},` +
    `${r.co2Emitido.toFixed(1)},${r.pontos}`
  ).join('\n');
  download('procmat_registros.csv', 'data:text/csv;charset=utf-8,\uFEFF' + header + rows);
}

// ===== EXPORTAR RELATÓRIO TXT =====
function exportRelatorio() {
  if (!state.registros.length) { alert('Nenhum registro para exportar.'); return; }
  const hoje        = new Date().toLocaleDateString('pt-BR');
  const totalLitros = state.registros.reduce((a, r) => a + r.litros, 0);
  const totalCO2Emitido = state.registros.reduce((a, r) => a + r.co2Emitido, 0);
  const mediaConsumo = state.registros.reduce((a, r) => a + r.consumoReal, 0) / state.registros.length;
  const motoristas  = getMotoristasUnicos();
  const ranking = motoristas.map(nome => {
    const regs = state.registros.filter(r => r.motorista === nome);
    const pontosMedia = regs.length ? Math.round(regs.reduce((a, r) => a + r.pontos, 0) / regs.length) : 0;
    return { nome, pontos: pontosMedia };
  }).sort((a, b) => b.pontos - a.pontos);

  let txt = `PROCMAT — RELATÓRIO GERAL\nGerado em: ${hoje}\n${'='.repeat(50)}\n\n`;
  txt += `RESUMO\n${'-'.repeat(30)}\n`;
  txt += `Total de jornadas registradas: ${state.registros.length}\n`;
  txt += `Média de consumo: ${mediaConsumo.toFixed(2)} km/L\n`;
  txt += `Total de combustível consumido: ${totalLitros.toFixed(1)} L\n`;
  txt += `Total de CO₂ emitido na atmosfera: ${totalCO2Emitido.toFixed(1)} kg\n\n`;
  txt += `RANKING ESG (por motorista)\n${'-'.repeat(30)}\n`;
  ranking.forEach((r, i) => {
    txt += `${i + 1}. ${r.nome} — Nota média: ${r.pontos}\n`;
  });
  txt += `\nJORNADAS DETALHADAS\n${'-'.repeat(30)}\n`;
  state.registros.forEach(r => {
    txt += `\n${r.data} | ${r.placa} | ${r.motorista}\n`;
    txt += `  Distância: ${r.distancia} km | Combustível consumido: ${r.litros.toFixed(1)} L\n`;
    txt += `  Consumo: ${r.consumoReal.toFixed(2)} km/L | Meta: ${r.meta.toFixed(1)} km/L | Ganho: ${r.ganhoPerc.toFixed(1)}%\n`;
    txt += `  CO₂ emitido: ${r.co2Emitido.toFixed(1)} kg | Nota ESG: ${r.pontos}\n`;
  });

  download('procmat_relatorio.txt', 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt));
}

// ===== LIMPAR DADOS =====
function limparDados() {
  if (!confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita.')) return;
  localStorage.removeItem('ecodrive_frota');
  localStorage.removeItem('ecodrive_registros');
  state.frota.length = 0;
  state.registros.length = 0;
  renderFrota();
  renderRanking();
  renderMedalhas();
  document.getElementById('resultado-box').innerHTML = '';
  document.getElementById('historico-list').innerHTML = '';
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  alert('Dados apagados com sucesso.');
}

// ===== HELPER DOWNLOAD =====
function download(filename, dataUri) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===== INIT =====
renderFrota();
renderRanking();
renderMedalhas();