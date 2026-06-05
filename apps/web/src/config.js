export const companyConfig = {
  tradeName: 'GLOBALAPP+IA',
  legalName: 'GlobalTech Servicios Industriales SpA',
  slogan: 'Mantenimiento industrial en tus manos',
  logoUrl: '/globaltech-logo.svg',
  supportWhatsAppNumber: '56929467522',
  enableEcoKpis: true,
  colors: {
    primary: '#0a66c2',
    primaryLight: '#0b83ee',
    technologyBlack: '#061019',
    steel: '#94a3b8',
    white: '#f8fafc',
    danger: '#ef4444'
  },
  pdfTemplate: {
    title: 'Informe técnico de mantenimiento industrial',
    footer: (year = new Date().getFullYear()) => `Desarrollado por GlobalTech Servicios Industriales SpA. Todos los derechos reservados © ${year}.`
  }
};

export function applyCompanyTheme(config = companyConfig) {
  const root = document.documentElement;
  root.style.setProperty('--gt-blue', config.colors.primary);
  root.style.setProperty('--gt-blue-2', config.colors.primaryLight);
  root.style.setProperty('--gt-black', config.colors.technologyBlack);
  root.style.setProperty('--gt-steel', config.colors.steel);
  root.style.setProperty('--gt-white', config.colors.white);
  root.style.setProperty('--gt-danger', config.colors.danger);
}
