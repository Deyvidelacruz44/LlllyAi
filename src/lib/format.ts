/**
 * Formateo de dinero con soporte de múltiples monedas (DOP / USD).
 *
 * Regla de oro: NUNCA sumar montos de monedas distintas. Para agregar use
 * `sumByCurrency` (devuelve un total por moneda) y muestre con `formatMoneyMulti`.
 */
import type { Currency, Transaction } from '@/types';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  DOP: 'RD$',
  USD: 'US$',
};

export const CURRENCIES: Currency[] = ['DOP', 'USD'];

const numberFmt = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "RD$19,000" / "US$12". Default DOP cuando no se especifica moneda. */
export function formatMoney(amount: number, currency: Currency = 'DOP'): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? CURRENCY_SYMBOL.DOP;
  return `${symbol}${numberFmt.format(Math.round(amount || 0))}`;
}

/**
 * Moneda efectiva de una transacción. Usa el campo `currency` si existe; si no,
 * lo deriva de `tags[0]` (los docs de MisFinanzas guardan ahí "DOP"/"USD").
 * Todo lo demás se interpreta como DOP.
 */
export function txCurrency(t: Pick<Transaction, 'currency' | 'tags'>): Currency {
  if (t.currency === 'USD' || t.currency === 'DOP') return t.currency;
  return t.tags?.[0] === 'USD' ? 'USD' : 'DOP';
}

/** Acumulador vacío { DOP: 0, USD: 0 }. */
export function emptyTotals(): Record<Currency, number> {
  return { DOP: 0, USD: 0 };
}

/**
 * Agrega una lista separando por moneda. Reemplaza el patrón
 * `items.reduce((s, x) => s + x.amount, 0)` cuando puede haber varias monedas.
 */
export function sumByCurrency<T>(
  items: T[],
  getAmount: (item: T) => number,
  getCurrency: (item: T) => Currency,
): Record<Currency, number> {
  const totals = emptyTotals();
  for (const item of items) {
    const cur = getCurrency(item);
    totals[cur] += getAmount(item) || 0;
  }
  return totals;
}

/**
 * Renderiza totales por moneda en una sola línea: "RD$19,737 · US$33".
 * Omite las monedas en 0. Si todo es 0, devuelve "RD$0".
 */
export function formatMoneyMulti(
  totals: Record<Currency, number>,
  separator = ' · ',
): string {
  const parts = CURRENCIES
    .filter((c) => Math.round(totals[c] || 0) !== 0)
    .map((c) => formatMoney(totals[c], c));
  return parts.length > 0 ? parts.join(separator) : formatMoney(0, 'DOP');
}
