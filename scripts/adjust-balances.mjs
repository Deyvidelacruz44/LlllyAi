/**
 * One-time script to reset and set initial account balances in Firestore.
 * Run with: node scripts/adjust-balances.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyChSOUY_pGlVc3aq56ycoxvSPDdwCcCAaA',
  authDomain: 'pruebas2026-9088f.firebaseapp.com',
  projectId: 'pruebas2026-9088f',
  storageBucket: 'pruebas2026-9088f.firebasestorage.app',
  messagingSenderId: '718337103430',
  appId: '1:718337103430:web:e8a3cda57a30ffcc3a1c47',
};

const DESIRED_BALANCES = [
  { account: 'banco',            description: 'Balance inicial - Banco',             amount: 11000 },
  { account: 'efectivo_tio_nano', description: 'Balance inicial - Efectivo (Tío Nano)', amount: 460000 },
  { account: 'efectivo_mami',    description: 'Balance inicial - Efectivo (Mami)',    amount: 11000 },
  { account: 'efectivo_yo',      description: 'Balance inicial - Efectivo (Yo)',      amount: 126250 },
];

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Prompt for credentials
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Uso: node scripts/adjust-balances.mjs <email> <password>');
    process.exit(1);
  }

  console.log('🔐 Autenticando...');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log(`✅ Autenticado como ${cred.user.email} (uid: ${uid})`);

  // 1. Read existing transactions
  const ref = collection(db, 'transactions');
  const q = query(ref, where('userId', '==', uid));
  const snapshot = await getDocs(q);
  console.log(`📊 Transacciones existentes: ${snapshot.size}`);

  // 2. Compute current balances per account
  const currentBalances = {};
  snapshot.docs.forEach(d => {
    const data = d.data();
    const acct = data.account || 'principal';
    if (!currentBalances[acct]) currentBalances[acct] = 0;
    if (data.type === 'income') currentBalances[acct] += data.amount;
    else if (data.type === 'expense') currentBalances[acct] -= data.amount;
  });

  console.log('\n📋 Balances actuales:');
  for (const [acct, bal] of Object.entries(currentBalances)) {
    console.log(`   ${acct}: $${bal.toLocaleString()}`);
  }

  // 3. Delete ALL existing transactions
  console.log(`\n🗑️  Eliminando ${snapshot.size} transacciones existentes...`);
  let deleted = 0;
  for (const d of snapshot.docs) {
    await deleteDoc(doc(db, 'transactions', d.id));
    deleted++;
    if (deleted % 10 === 0) process.stdout.write(`   ${deleted}/${snapshot.size} eliminadas\r`);
  }
  console.log(`   ✅ ${deleted} transacciones eliminadas`);

  // 4. Create one income transaction per account with the desired balance
  console.log('\n💰 Creando transacciones de balance inicial...');
  const now = Timestamp.now();
  const dateTs = Timestamp.fromDate(new Date('2026-02-17T12:00:00'));

  for (const entry of DESIRED_BALANCES) {
    await addDoc(collection(db, 'transactions'), {
      userId: uid,
      type: 'income',
      category: 'salario',
      amount: entry.amount,
      description: entry.description,
      date: dateTs,
      account: entry.account,
      isRecurring: false,
      recurringFrequency: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`   ✅ ${entry.description}: $${entry.amount.toLocaleString()}`);
  }

  const total = DESIRED_BALANCES.reduce((s, e) => s + e.amount, 0);
  console.log(`\n🎉 Listo! Balance total: $${total.toLocaleString()}`);
  console.log('   Banco: $11,000');
  console.log('   Efectivo (Tío Nano): $460,000');
  console.log('   Efectivo (Mami): $11,000');
  console.log('   Efectivo (Yo): $126,250');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
