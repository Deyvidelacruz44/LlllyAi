/**
 * Natural-language transaction parser (Spanish).
 * Turns phrases like "gasté 500 en comida" or "cobré 2000 de salario" into a
 * structured transaction so the user can capture finances by voice or one line.
 */
import type { TransactionType, TransactionCategory, Currency } from '@/types';

export interface ParsedTransaction {
  type: TransactionType;
  amount: number | null;
  category: TransactionCategory;
  currency: Currency;
  description: string;
  account: string;
  rawText: string;
  /** true when we found an amount (safe to auto-create) */
  confident: boolean;
}

// Pistas de moneda; si no aparece ninguna, se asume DOP (pesos).
const USD_HINTS = ['dólar', 'dolar', 'dólares', 'dolares', 'usd', 'us$', 'u$'];

function detectCurrency(lower: string): Currency {
  return USD_HINTS.some(h => lower.includes(h)) ? 'USD' : 'DOP';
}

// Words that signal income (everything else defaults to expense)
const INCOME_HINTS = [
  'ingres', 'cobr', 'gané', 'gane', 'gane', 'recib', 'me pagaron', 'me pago',
  'salario', 'sueldo', 'nómina', 'nomina', 'depósito', 'deposito', 'deposité', 'deposite',
  'entró', 'entro', 'me dieron', 'pagaron',
];

// Verbs/fillers stripped from the description
const STRIP_WORDS = [
  'gasté', 'gaste', 'gastar', 'pagué', 'pague', 'compré', 'compre', 'comprar',
  'ingresé', 'ingrese', 'cobré', 'cobre', 'gané', 'gane', 'gane', 'recibí', 'recibi',
  'deposité', 'deposite', 'me pagaron', 'pagaron', 'gasto', 'ingreso',
  'pesos', 'peso', 'dólares', 'dolares', 'dólar', 'dolar', 'rd', 'usd', 'dop',
];

// Category keyword map (first match wins, order matters)
const CATEGORY_KEYWORDS: Array<{ cat: TransactionCategory; words: string[] }> = [
  { cat: 'alimentacion', words: ['comida', 'almuerzo', 'desayuno', 'cena', 'super', 'supermercado', 'mercado', 'restaurante', 'restaurant', 'comer', 'café', 'cafe', 'colmado', 'merienda'] },
  { cat: 'transporte', words: ['uber', 'taxi', 'gasolina', 'combustible', 'transporte', 'pasaje', 'bus', 'guagua', 'metro', 'carro', 'auto', 'peaje', 'parqueo'] },
  { cat: 'vivienda', words: ['alquiler', 'renta', 'hipoteca', 'casa', 'apartamento', 'vivienda'] },
  { cat: 'servicios', words: ['luz', 'agua', 'electricidad', 'internet', 'teléfono', 'telefono', 'cable', 'factura', 'servicios', 'wifi', 'celular plan'] },
  { cat: 'entretenimiento', words: ['cine', 'netflix', 'spotify', 'juego', 'salida', 'fiesta', 'bar', 'entretenimiento', 'diversión', 'diversion', 'concierto'] },
  { cat: 'salud', words: ['médico', 'medico', 'farmacia', 'medicina', 'doctor', 'salud', 'hospital', 'dentista', 'consulta'] },
  { cat: 'educacion', words: ['curso', 'universidad', 'colegio', 'libro', 'educación', 'educacion', 'clase', 'estudio', 'matrícula', 'matricula'] },
  { cat: 'ropa', words: ['ropa', 'zapatos', 'camisa', 'pantalón', 'pantalon', 'tienda', 'tenis', 'vestido'] },
  { cat: 'tecnologia', words: ['computadora', 'laptop', 'celular', 'tecnología', 'tecnologia', 'software', 'aplicación', 'audífonos', 'audifonos', 'cargador'] },
  { cat: 'ahorro', words: ['ahorro', 'ahorré', 'ahorre', 'guardé', 'guarde'] },
  { cat: 'deuda', words: ['deuda', 'préstamo', 'prestamo', 'cuota', 'tarjeta de crédito', 'tarjeta de credito'] },
  { cat: 'salario', words: ['salario', 'sueldo', 'nómina', 'nomina', 'quincena'] },
  { cat: 'freelance', words: ['freelance', 'proyecto', 'cliente', 'trabajo', 'servicio'] },
  { cat: 'inversiones', words: ['inversión', 'inversion', 'acciones', 'dividendo', 'interés', 'interes'] },
  { cat: 'regalo', words: ['regalo', 'regalaron', 'obsequio'] },
];

const ACCOUNT_KEYWORDS: Array<{ value: string; words: string[] }> = [
  { value: 'efectivo_yo', words: ['efectivo', 'en cash', 'cash'] },
  { value: 'tarjeta_credito', words: ['tarjeta', 'crédito', 'credito'] },
  { value: 'banco', words: ['banco', 'transferencia', 'débito', 'debito'] },
];

function detectType(lower: string): TransactionType {
  return INCOME_HINTS.some(h => lower.includes(h)) ? 'income' : 'expense';
}

function extractAmount(lower: string): number | null {
  // "2 mil", "dos mil" → handle "<n> mil"
  const milMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (milMatch) {
    const base = parseFloat(milMatch[1].replace(',', '.'));
    if (!isNaN(base)) return Math.round(base * 1000);
  }
  if (/\bmil\b/.test(lower) && !/\d/.test(lower)) return 1000;

  // Grab the first number; treat commas as thousands separators
  const numMatch = lower.replace(/\$/g, '').match(/\d[\d.,]*/);
  if (!numMatch) return null;
  let token = numMatch[0];
  // 1,500 or 1,500.50 → remove thousands commas
  if (/,\d{3}(\D|$)/.test(token) || /^\d{1,3}(,\d{3})+/.test(token)) {
    token = token.replace(/,/g, '');
  } else {
    token = token.replace(',', '.');
  }
  // 1.500 (thousands dot, no decimals of 2) → keep as-is would be 1.5; only
  // treat dot as thousands when exactly 3 digits follow and there's no other dot
  if (/^\d{1,3}\.\d{3}$/.test(token)) token = token.replace('.', '');
  const value = parseFloat(token);
  return isNaN(value) ? null : value;
}

function detectCategory(lower: string, type: TransactionType): TransactionCategory {
  for (const { cat, words } of CATEGORY_KEYWORDS) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  // Sensible default by type
  return type === 'income' ? 'otro' : 'otro';
}

function detectAccount(lower: string): string {
  for (const { value, words } of ACCOUNT_KEYWORDS) {
    if (words.some(w => lower.includes(w))) return value;
  }
  return 'banco';
}

// Connectors, articles, and account words that don't belong in the description.
// Token-based filtering avoids regex \b issues with accented words (gasté…).
const STOP_TOKENS = new Set<string>([
  ...STRIP_WORDS,
  'me', 'en', 'de', 'por', 'para', 'del', 'la', 'el', 'los', 'las',
  'un', 'una', 'con', 'mil', 'y', 'a', 'al',
  'tarjeta', 'crédito', 'credito', 'efectivo', 'cash', 'banco',
  'transferencia', 'débito', 'debito',
]);

function buildDescription(raw: string, _amount: number | null): string {
  const tokens = raw
    .toLowerCase()
    .replace(/\$/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => !/^\d[\d.,]*$/.test(tok)) // drop number/amount tokens
    .filter((tok) => !STOP_TOKENS.has(tok));   // drop verbs/connectors/account words
  let text = tokens.join(' ').replace(/\s+/g, ' ').trim();
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  return text;
}

export function parseTransaction(rawText: string): ParsedTransaction {
  const raw = (rawText || '').trim();
  const lower = raw.toLowerCase();

  const type = detectType(lower);
  const amount = extractAmount(lower);
  const category = detectCategory(lower, type);
  const account = detectAccount(lower);
  const currency = detectCurrency(lower);
  let description = buildDescription(raw, amount);

  // Fall back to a readable description from the category
  if (!description) {
    const labels: Record<string, string> = {
      alimentacion: 'Comida', transporte: 'Transporte', vivienda: 'Vivienda',
      servicios: 'Servicios', entretenimiento: 'Entretenimiento', salud: 'Salud',
      educacion: 'Educación', ropa: 'Ropa', tecnologia: 'Tecnología',
      ahorro: 'Ahorro', deuda: 'Deuda', salario: 'Salario', freelance: 'Freelance',
      inversiones: 'Inversiones', cobros_clientes: 'Cobro', regalo: 'Regalo', otro: type === 'income' ? 'Ingreso' : 'Gasto',
    };
    description = labels[category] || (type === 'income' ? 'Ingreso' : 'Gasto');
  }

  return {
    type,
    amount,
    category,
    currency,
    description,
    account,
    rawText: raw,
    confident: amount !== null && amount > 0,
  };
}
