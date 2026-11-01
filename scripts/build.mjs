// Cruza a carteira ABC com o histórico de check-ins do minhavisita.
// Função pura: não acessa rede nem disco, para poder ser testada.

// Atividades que não contam como visita presencial.
const NAO_PRESENCIAL = new Set(['REUNIAO ONLINE']);

export function normalizar(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {Array} carteira  [{ grupo, posicao, nome, total, mesesAtivos }]
 * @param {Array} checks    [{ id, deviceCheckinDate, activity:{name}, customer:{id,name,address,latitude,longitude} }]
 * @param {Date}  agora
 */
export function montarDados(carteira, checks, agora = new Date()) {
  const porCliente = new Map();
  for (const c of checks) {
    if (!c.customer || !c.customer.name || !c.deviceCheckinDate) continue;
    const chave = normalizar(c.customer.name);
    let o = porCliente.get(chave);
    if (!o) {
      o = { visitas: [], online: null, cliente: c.customer };
      porCliente.set(chave, o);
    }
    const atividade = normalizar(c.activity && c.activity.name);
    if (NAO_PRESENCIAL.has(atividade)) {
      if (!o.online || c.deviceCheckinDate > o.online) o.online = c.deviceCheckinDate;
      continue;
    }
    // Endereço/coordenadas do registro mais recente que tenha localização.
    if (c.customer.latitude && (!o.dataCliente || c.deviceCheckinDate > o.dataCliente)) {
      o.cliente = c.customer;
      o.dataCliente = c.deviceCheckinDate;
    }
    o.visitas.push(c.deviceCheckinDate);
  }

  // Um check-in e o check-out do mesmo dia contam como uma visita só.
  // O dia é calculado no fuso de Manaus (UTC-4).
  const dia = (iso) => new Date(Date.parse(iso) - 4 * 3600e3).toISOString().slice(0, 10);
  const umAnoAtras = new Date(agora.getTime() - 365 * 864e5).toISOString();

  const medicos = carteira.map((m) => {
    const o = porCliente.get(normalizar(m.nome));
    const dias = o ? [...new Set(o.visitas.map(dia))].sort().reverse() : [];
    const ultima = o && o.visitas.length ? o.visitas.reduce((a, b) => (a > b ? a : b)) : null;
    const lat = o && parseFloat(o.cliente.latitude);
    const lng = o && parseFloat(o.cliente.longitude);
    return {
      g: m.grupo,
      p: m.posicao,
      n: m.nome,
      t: Math.round(m.total || 0),
      ma: m.mesesAtivos || 0,
      u: ultima,                                   // data/hora ISO da última visita presencial
      v12: dias.filter((d) => d >= dia(umAnoAtras)).length, // visitas nos últimos 12 meses
      h: dias.slice(0, 6),                        // últimos dias com visita
      on: o ? o.online : null,                     // última reunião online
      e: o ? o.cliente.address || '' : '',
      la: Number.isFinite(lat) ? lat : null,
      lo: Number.isFinite(lng) ? lng : null,
      cad: !!o,                                    // encontrado no minhavisita
    };
  });

  const datas = checks.map((c) => c.deviceCheckinDate).filter(Boolean).sort();
  return {
    geradoEm: agora.toISOString(),
    historicoDesde: datas[0] || null,
    ultimoCheck: datas[datas.length - 1] || null,
    totalChecks: checks.length,
    medicos,
  };
}
