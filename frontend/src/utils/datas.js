// A API já calcula o intervalo exato de uma semana/mês a partir de qualquer
// data dentro dele (GET /cardapio?semana=|mes=) — o frontend só precisa
// navegar (±7 dias / ±1 mês) e formatar para exibição.

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function parseISO(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function formatarISO(date) {
  return date.toISOString().slice(0, 10);
}

export function hojeISO() {
  return formatarISO(new Date());
}

export function anoMesAtual() {
  return hojeISO().slice(0, 7);
}

export function somarDias(iso, n) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatarISO(d);
}

export function somarMeses(anoMes, n) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function nomeDiaSemana(iso) {
  return DIAS_SEMANA[parseISO(iso).getUTCDay()];
}

export function diaCurto(iso) {
  return String(parseISO(iso).getUTCDate()).padStart(2, '0');
}

export function nomeMesExtenso(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

export function listaDeDias(inicio, fim) {
  const dias = [];
  let atual = inicio;
  while (atual <= fim) {
    dias.push(atual);
    atual = somarDias(atual, 1);
  }
  return dias;
}
