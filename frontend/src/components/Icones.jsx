// Ícones de traço próprio (não de biblioteca) — um único estilo consistente:
// viewBox 20x20, stroke=currentColor, cantos arredondados, sem preenchimento.
const propsBase = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function IconeCafe(props) {
  return (
    <svg {...propsBase} {...props}>
      <rect x="4" y="8" width="10" height="7" rx="2" />
      <path d="M14 10h1.5a2 2 0 0 1 0 4H14" />
      <path d="M7 6c0-1 1-1 1-2M11 6c0-1 1-1 1-2" />
    </svg>
  );
}

export function IconeAlmoco(props) {
  return (
    <svg {...propsBase} {...props}>
      <circle cx="10.5" cy="11" r="4.6" />
      <path d="M3 3v5M4.6 3v5M4.6 8v9" />
      <path d="M15.4 3c1 1 1 2 0 3l-.8.8V17" />
    </svg>
  );
}

export function IconeJantar(props) {
  return (
    <svg {...propsBase} {...props}>
      <path d="M13.5 4.2a6.4 6.4 0 1 0 0 11.6 5.1 5.1 0 0 1 0-11.6z" />
    </svg>
  );
}

export function IconeLanche(props) {
  return (
    <svg {...propsBase} {...props}>
      <circle cx="7" cy="12.2" r="2.5" />
      <circle cx="11" cy="13" r="2.5" />
      <circle cx="9" cy="9.2" r="2.5" />
      <path d="M9 6.6V5M9 5c1-1.1 2.3-.9 2.7.1" />
    </svg>
  );
}
