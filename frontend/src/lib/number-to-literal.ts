const UNITS = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  ];

function underHundred(value: number): string {
  if (value < 16) return UNITS[value];
  if (value < 20) return `dieci${UNITS[value - 10]}`;
  if (value < 30) return value === 20 ? 'veinte' : `veinti${UNITS[value - 20]}`;
  const tens = ['','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'][Math.floor(value / 10)];
  return value % 10 ? `${tens} y ${UNITS[value % 10]}` : tens;
}

function underThousand(value: number): string {
  if (value < 100) return underHundred(value);
  if (value === 100) return 'cien';
  const hundreds = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  return `${hundreds[Math.floor(value / 100)]}${value % 100 ? ` ${underHundred(value % 100)}` : ''}`;
}

function integerToWords(value: number): string {
  if (value < 1000) return underThousand(value);
  if (value < 1000000) {
    const thousands = Math.floor(value / 1000);
    const rest = value % 1000;
    return `${thousands === 1 ? 'mil' : `${integerToWords(thousands)} mil`}${rest ? ` ${underThousand(rest)}` : ''}`;
  }
  const millions = Math.floor(value / 1000000);
  const rest = value % 1000000;
  return `${millions === 1 ? 'un millón' : `${integerToWords(millions)} millones`}${rest ? ` ${integerToWords(rest)}` : ''}`;
}

export function numberToLiteral(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const integer = Math.floor(safeAmount);
  const cents = Math.round((safeAmount - integer) * 100)
    .toString()
    .padStart(2, '0');
  return `${integerToWords(integer)} ${cents}/100 Bolivianos`;
}