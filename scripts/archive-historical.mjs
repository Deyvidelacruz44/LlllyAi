/**
 * Archiva las transacciones históricas de Banreservas anteriores a junio 2026.
 * Las transacciones archivadas NO se eliminan — se marcan con `archived: true`
 * y dejan de aparecer en el dashboard y en el contexto de Lilly AI.
 *
 * Modo lectura (dry-run, por defecto):
 *   node scripts/archive-historical.mjs <email> <password>
 *
 * Modo archivado:
 *   node scripts/archive-historical.mjs <email> <password> --apply
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, where, getDocs,
  updateDoc, doc, Timestamp,
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

// Punto de corte: solo se archivan transacciones ANTES del 1 de junio de 2026.
const CUTOFF_DATE = new Date('2026-06-01T00:00:00.000Z');

async function main() {
  const email    = process.argv[2];
  const password = process.argv[3];
  const apply    = process.argv.includes('--apply');

  if (!email || !password) {
    console.error('Uso: node scripts/archive-historical.mjs <email> <password> [--apply]');
    process.exit(1);
  }

  const app  = initializeApp(firebaseConfig);
  const db   = getFirestore(app);
  const auth = getAuth(app);

  console.log('🔐 Autenticando...');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid  = cred.user.uid;
  console.log(`✅ Autenticado como ${cred.user.email}\n`);

  // Query: tarjeta_banreservas + fecha < 2026-06-01
  console.log(`📡 Buscando transacciones de Banreservas antes del ${CUTOFF_DATE.toLocaleDateString('es-DO')}...`);
  const snap = await getDocs(
    query(
      collection(db, 'transactions'),
      where('userId', '==', uid),
      where('account', '==', 'tarjeta_banreservas'),
      where('date', '<', Timestamp.fromDate(CUTOFF_DATE)),
    )
  );

  if (snap.size === 0) {
    console.log('✅ No hay transacciones históricas para archivar.');
    process.exit(0);
  }

  console.log(`\n   Encontradas: ${snap.size} transacciones históricas\n`);

  // Agrupar por mes para un resumen legible
  const byMonth = {};
  snap.docs.forEach(d => {
    const date = d.data().date?.toDate?.() || new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  });

  console.log('📊 Distribución por mes:');
  Object.entries(byMonth).sort().forEach(([month, count]) => {
    console.log(`   ${month}: ${count} transacciones`);
  });

  if (!apply) {
    console.log(`\n─────────────────────────────────────────────────────`);
    console.log(`ℹ️  Esto es un DRY-RUN. Las transacciones NO se modificaron.`);
    console.log(`   Para archivar, añade --apply:`);
    console.log(`   node scripts/archive-historical.mjs ${email} <password> --apply`);
    process.exit(0);
  }

  // ── Modo aplicado: archivar ──────────────────────────────────
  console.log(`\n⚙️  Archivando ${snap.size} transacciones...`);
  const now = Timestamp.now();
  let archived = 0;
  let errors = 0;

  for (const docSnap of snap.docs) {
    try {
      await updateDoc(doc(db, 'transactions', docSnap.id), {
        archived: true,
        updatedAt: now,
      });
      archived++;
      if (archived % 20 === 0) console.log(`   ${archived}/${snap.size} archivadas...`);
    } catch (err) {
      console.error(`   ❌ Error en ${docSnap.id}:`, err.message);
      errors++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ ${archived} transacciones archivadas`);
  if (errors > 0) console.log(`⚠️  ${errors} errores`);
  console.log(`\n📱 El dashboard ahora solo mostrará transacciones desde junio 2026.`);
  console.log(`   Las transacciones históricas siguen en Firestore (archived: true).`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
