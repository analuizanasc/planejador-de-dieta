'use strict';

const AppError = require('./AppError');

function parseData(str) {
  const [ano, mes, dia] = str.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function formatarData(date) {
  return date.toISOString().slice(0, 10);
}

function diaAnterior(str) {
  const d = parseData(str);
  d.setUTCDate(d.getUTCDate() - 1);
  return formatarData(d);
}

function somarDias(str, n) {
  const d = parseData(str);
  d.setUTCDate(d.getUTCDate() + n);
  return formatarData(d);
}

// Semana ISO: segunda-feira a domingo, contendo `str`.
function inicioFimSemana(str) {
  const d = parseData(str);
  const diaSemana = d.getUTCDay(); // 0 = domingo ... 6 = sábado
  const offsetSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const inicio = new Date(d);
  inicio.setUTCDate(d.getUTCDate() + offsetSegunda);
  const fim = new Date(inicio);
  fim.setUTCDate(inicio.getUTCDate() + 6);
  return { inicio: formatarData(inicio), fim: formatarData(fim) };
}

// `anoMes` no formato 'YYYY-MM'.
function inicioFimMes(anoMes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(anoMes)) {
    throw new AppError(400, "mes deve estar no formato YYYY-MM (ex.: '2026-08')");
  }
  const [ano, mes] = anoMes.split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0)); // dia 0 do mês seguinte = último dia do mês atual
  return { inicio: formatarData(inicio), fim: formatarData(fim) };
}

module.exports = { parseData, formatarData, diaAnterior, somarDias, inicioFimSemana, inicioFimMes };
