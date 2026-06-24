import { describe, it, expect } from 'vitest';
import { parseTransaction } from '@/lib/parseTransaction';

describe('parseTransaction', () => {
  it('parses a basic expense', () => {
    const r = parseTransaction('gasté 500 en comida');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(500);
    expect(r.category).toBe('alimentacion');
    expect(r.description).toBe('Comida');
    expect(r.confident).toBe(true);
  });

  it('parses an income with "cobré"', () => {
    const r = parseTransaction('cobré 2000 de salario');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(2000);
    expect(r.category).toBe('salario');
    expect(r.confident).toBe(true);
  });

  it('parses "ingreso" as income', () => {
    const r = parseTransaction('ingreso 5000 freelance proyecto');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(5000);
    expect(r.category).toBe('freelance');
  });

  it('handles "X mil"', () => {
    const r = parseTransaction('gasté 2 mil en gasolina');
    expect(r.amount).toBe(2000);
    expect(r.category).toBe('transporte');
    expect(r.type).toBe('expense');
  });

  it('handles thousands separator with comma', () => {
    const r = parseTransaction('1,500 supermercado');
    expect(r.amount).toBe(1500);
    expect(r.category).toBe('alimentacion');
  });

  it('handles decimals', () => {
    const r = parseTransaction('pagué 350.50 en farmacia con tarjeta');
    expect(r.amount).toBe(350.5);
    expect(r.category).toBe('salud');
    expect(r.account).toBe('tarjeta_credito');
  });

  it('detects category from a single keyword + amount', () => {
    const r = parseTransaction('uber 350');
    expect(r.category).toBe('transporte');
    expect(r.amount).toBe(350);
    expect(r.description).toBe('Uber');
  });

  it('detects expense category "ropa"', () => {
    const r = parseTransaction('compré ropa 800');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(800);
    expect(r.category).toBe('ropa');
  });

  it('maps utility bills to servicios', () => {
    const r = parseTransaction('pagué 1200 de luz');
    expect(r.category).toBe('servicios');
    expect(r.amount).toBe(1200);
  });

  it('is not confident when there is no amount', () => {
    const r = parseTransaction('hola lilly');
    expect(r.amount).toBeNull();
    expect(r.confident).toBe(false);
  });

  it('defaults to expense + otro for unknown text with amount', () => {
    const r = parseTransaction('250 cosas varias');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(250);
    expect(r.category).toBe('otro');
  });

  it('detects cash account', () => {
    const r = parseTransaction('gasté 100 en café en efectivo');
    expect(r.account).toBe('efectivo_yo');
    expect(r.category).toBe('alimentacion');
  });

  it('defaults to DOP when no currency is mentioned', () => {
    const r = parseTransaction('gasté 500 en comida');
    expect(r.currency).toBe('DOP');
  });

  it('detects USD from "dólares"', () => {
    const r = parseTransaction('gasté 12 dólares en Netflix');
    expect(r.currency).toBe('USD');
    expect(r.amount).toBe(12);
    expect(r.category).toBe('entretenimiento');
  });

  it('detects USD from "usd"', () => {
    const r = parseTransaction('pagué 33 usd de GitHub');
    expect(r.currency).toBe('USD');
    expect(r.amount).toBe(33);
  });

  it('detects USD from "dolares" (sin tilde)', () => {
    const r = parseTransaction('20 dolares en Spotify');
    expect(r.currency).toBe('USD');
    expect(r.amount).toBe(20);
  });
});
