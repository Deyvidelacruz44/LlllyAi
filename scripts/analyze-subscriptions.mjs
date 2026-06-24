/**
 * Detecta suscripciones digitales recurrentes del historial de Banreservas
 * y las agrega como gastos fijos en la sección Deudas de Lilly AI.
 *
 * Fase 1 — Solo análisis:
 *   node scripts/analyze-subscriptions.mjs deyvifcruz@gmail.com PASSWORD
 *
 * Fase 2 — Limpiar incorrectos + agregar solo servicios digitales:
 *   node scripts/analyze-subscriptions.mjs deyvifcruz@gmail.com PASSWORD --add
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, where, getDocs,
  addDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyChSOUY_pGlVc3aq56ycoxvSPDdwCcCAaA',
  authDomain: 'pruebas2026-9088f.firebaseapp.com',
  projectId: 'pruebas2026-9088f',
  storageBucket: 'pruebas2026-9088f.firebasestorage.app',
  messagingSenderId: '718337103430',
  appId: '1:718337103430:web:e8a3cda57a30ffcc3a1c47',
};

/**
 * Whitelist de servicios digitales con cargo mensual automático fijo.
 * Solo estos se agregan como Gastos Fijos en Deudas.
 * Uber, PedidosYa, BravoVa, Amazon, etc. son gastos variables → van en Presupuestos.
 */
const SUBSCRIPTION_WHITELIST = new Set([
  'netflix', 'anthropic', 'github', 'netlify', 'openai', 'claude',
  'spotify', 'playstation', 'adobe', 'canva', 'leonardo', 'higgsfield',
  'd-id', 'airalo', 'chatgpt', 'midjourney', 'notion', 'figma',
  'dropbox', 'microsoft', 'icloud', 'vapingchiller', 'amazon prime',
  // NOTA: 'amazon prime' (suscripción) ≠ 'amazon' a secas (compras variables)
]);

/**
 * Keywords para reconocer merchants conocidos en descripciones del banco.
 * Solo servicios digitales verificados.
 */
const SUBSCRIPTION_HINTS = [
  'amazon prime',   // específico ANTES que cualquier 'amazon' genérico
  'netflix', 'anthropic', 'github', 'netlify', 'openai', 'claude',
  'spotify', 'playstation', 'adobe', 'canva', 'leonardo', 'higgsfield',
  'd-id', 'airalo', 'chatgpt', 'midjourney', 'notion', 'figma',
  'dropbox', 'microsoft', 'icloud', 'vapingchiller',
];

/** Normaliza descripción del banco a una clave comparable */
function normalizeKey(description) {
  if (!description) return 'unknown';
  const lower = description.toLowerCase();
  for (const hint of SUBSCRIPTION_HINTS) {
    if (lower.includes(hint)) return hint;
  }
  // Para merchants no reconocidos: primera palabra significativa
  const words = lower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  return words[0] || lower.slice(0, 10);
}

/** Mediana de un array de números */
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Nombre limpio para mostrar en la UI */
function displayName(key, rawDescriptions) {
  const names = {
    netflix: 'Netflix',
    anthropic: 'Anthropic (Claude AI)',
    github: 'GitHub',
    netlify: 'Netlify',
    openai: 'OpenAI / ChatGPT',
    claude: 'Claude AI',
    spotify: 'Spotify',
    playstation: 'PlayStation',
    adobe: 'Adobe',
    canva: 'Canva',
    leonardo: 'Leonardo AI',
    higgsfield: 'Higgsfield AI',
    'd-id': 'D-ID AI',
    airalo: 'Airalo (eSIM)',
    chatgpt: 'ChatGPT',
    midjourney: 'Midjourney',
    notion: 'Notion',
    figma: 'Figma',
    dropbox: 'Dropbox',
    microsoft: 'Microsoft',
    icloud: 'iCloud',
    vapingchiller: 'Vaping Chiller',
    'amazon prime': 'Amazon Prime',
  };
  return names[key] || rawDescriptions[0] || key;
}

const CUR_SYMBOL = { DOP: 'RD$', USD: 'US$' };

/** Formatea con el símbolo de la moneda (RD$ / US$). */
function fmt(amount, currency = 'DOP') {
  return `${CUR_SYMBOL[currency] || 'RD$'}${Math.round(amount || 0).toLocaleString()}`;
}

/** Subtotal separado por moneda: "RD$1,137 · US$33". Nunca mezcla monedas. */
function subtotalByCurrency(list) {
  const t = { DOP: 0, USD: 0 };
  for (const s of list) t[s.currency] += s.amount;
  const parts = [];
  if (t.DOP) parts.push(fmt(t.DOP, 'DOP'));
  if (t.USD) parts.push(fmt(t.USD, 'USD'));
  return parts.length ? parts.join(' · ') : fmt(0, 'DOP');
}

function printTable(list) {
  if (list.length === 0) { console.log('   (ninguno)'); return; }
  console.log(' #  Nombre                          Monto típico   Meses');
  console.log(' ─  ─────────────────────────────── ─────────────  ─────');
  list.forEach((s, i) => {
    const n      = String(i + 1).padStart(2);
    const name   = s.name.padEnd(34);
    const amount = fmt(s.amount, s.currency).padStart(12);
    const months = String(s.months).padStart(5);
    console.log(` ${n}  ${name} ${amount}  ${months}`);
  });
}

async function main() {
  const email   = process.argv[2];
  const password = process.argv[3];
  const addMode  = process.argv.includes('--add');

  if (!email || !password) {
    console.error('Uso: node scripts/analyze-subscriptions.mjs <email> <password> [--add]');
    process.exit(1);
  }

  const app  = initializeApp(firebaseConfig);
  const db   = getFirestore(app);
  const auth = getAuth(app);

  console.log('🔐 Autenticando...');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;
  console.log(`✅ Autenticado como ${cred.user.email}\n`);

  // ── Query all Banreservas transactions ──────────────────────────────
  console.log('📡 Leyendo transacciones de tarjeta Banreservas...');
  const txSnap = await getDocs(
    query(collection(db, 'transactions'),
      where('userId', '==', uid),
      where('account', '==', 'tarjeta_banreservas'),
    )
  );
  console.log(`   ${txSnap.size} transacciones encontradas\n`);

  if (txSnap.size === 0) {
    console.log('⚠️  No hay transacciones de tarjeta_banreservas en Firestore.');
    process.exit(0);
  }

  // ── Group by (merchant + currency) ─────────────────────────────────
  // Importante: agrupar por moneda evita que la mediana mezcle cargos
  // en RD$ y US$ del mismo comercio (lo que daba montos sin sentido).
  const merchants = {};

  for (const docSnap of txSnap.docs) {
    const d = docSnap.data();
    if (d.type !== 'expense') continue;

    const merchantKey = normalizeKey(d.description);
    const currency    = d.currency === 'USD' || d.tags?.[0] === 'USD' ? 'USD' : 'DOP';
    const groupKey    = `${merchantKey}__${currency}`;
    const date        = d.date?.toDate?.() || new Date();
    const monthKey    = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!merchants[groupKey]) {
      merchants[groupKey] = { merchantKey, currency, amounts: [], months: new Set(), descriptions: [], category: d.category || 'otro' };
    }
    merchants[groupKey].amounts.push(d.amount || 0);
    merchants[groupKey].months.add(monthKey);
    if (!merchants[groupKey].descriptions.includes(d.description)) {
      merchants[groupKey].descriptions.push(d.description);
    }
  }

  // ── Build subscription list (≥ 2 months) ───────────────────────────
  const all = Object.values(merchants)
    .filter(m => m.months.size >= 2)
    .map(m => ({
      key:             m.merchantKey,
      currency:        m.currency,
      name:            displayName(m.merchantKey, m.descriptions),
      amount:          Math.round(median(m.amounts)),
      months:          m.months.size,
      category:        m.category,
      rawDescriptions: m.descriptions,
      isSubscription:  SUBSCRIPTION_WHITELIST.has(m.merchantKey),
    }))
    .sort((a, b) => b.amount - a.amount);

  const digitalSubs  = all.filter(s => s.isSubscription);
  const variableExps = all.filter(s => !s.isSubscription);

  // ── Display analysis ────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ANÁLISIS DE GASTOS RECURRENTES (tarjeta Banreservas)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n✅ SUSCRIPCIONES DIGITALES (cargo fijo automático → irán a Deudas):');
  printTable(digitalSubs);
  if (digitalSubs.length > 0) console.log(`\n   Subtotal suscripciones: ${subtotalByCurrency(digitalSubs)}/mes`);

  console.log('\n📈 GASTOS VARIABLES FRECUENTES (→ configura Presupuestos en Finanzas):');
  printTable(variableExps);
  if (variableExps.length > 0) {
    console.log(`\n   Subtotal gastos variables: ${subtotalByCurrency(variableExps)}/mes`);
    console.log('   💡 Crea presupuestos para estas categorías en Finanzas → Presupuestos');
    console.log('      para recibir alertas cuando te acerques al límite.');
  }

  if (!addMode) {
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('Para agregar las suscripciones digitales a Deudas:');
    console.log('  node scripts/analyze-subscriptions.mjs <email> <password> --add');
    process.exit(0);
  }

  // ── Add mode ─────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 ACTUALIZANDO GASTOS FIJOS EN LILLY AI...\n');

  // Limpiar TODOS los auto-detectados (incluyendo los incorrectos de pasadas anteriores)
  const existingDebts = await getDocs(
    query(collection(db, 'debts'), where('userId', '==', uid))
  );
  let removed = 0;
  for (const d of existingDebts.docs) {
    if ((d.data().notes || '').includes('Detectado automáticamente')) {
      await deleteDoc(doc(db, 'debts', d.id));
      removed++;
    }
  }
  if (removed > 0) console.log(`   🗑️  ${removed} entradas anteriores eliminadas (Uber, PedidosYa, BravoVa, etc.)\n`);

  if (digitalSubs.length === 0) {
    console.log('⚠️  No se detectaron suscripciones digitales en el historial.');
    console.log('   (Ningún merchant de la whitelist aparece en ≥ 2 meses)');
    process.exit(0);
  }

  // Agregar solo las suscripciones de la whitelist
  const now = Timestamp.now();
  let created = 0;

  for (const sub of digitalSubs) {
    const debtCategory = ['netflix', 'spotify', 'playstation', 'vapingchiller'].includes(sub.key)
      ? 'suscripcion'
      : 'membresia';

    await addDoc(collection(db, 'debts'), {
      userId:       uid,
      type:         'fixed_expense',
      category:     debtCategory,
      name:         sub.name,
      description:  sub.rawDescriptions[0] || sub.name,
      amount:       sub.amount,
      currency:     sub.currency,
      totalDebt:    0,
      totalPaid:    0,
      frequency:    'monthly',
      dueDay:       null,
      nextDueDate:  null,
      startDate:    now,
      endDate:      null,
      status:       'active',
      creditor:     sub.name,
      interestRate: null,
      notes:        `Detectado automáticamente del historial Banreservas (${sub.months} meses)`,
      lastPaidDate: null,
      payments:     [],
      createdAt:    now,
      updatedAt:    now,
    });
    console.log(`   ✅ ${sub.name}: ${fmt(sub.amount, sub.currency)}/mes`);
    created++;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉 ${created} suscripciones digitales agregadas como Gastos Fijos`);
  console.log(`   Total en suscripciones: ${subtotalByCurrency(digitalSubs)}/mes`);
  console.log('\n📱 Verifica en: lillyai.deyvidev.com/dashboard/debts → Gastos Fijos');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
