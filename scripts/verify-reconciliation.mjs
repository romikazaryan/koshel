import { findReconciliationMatches } from '../src/lib/transactionReconciliation.ts';
import { parseBankPushNotification } from '../src/lib/bankPushNotification.ts';

function assert(name, pass) {
  console.log(pass ? '✓' : '✗', name);
  if (!pass) process.exit(1);
}

const bank = [
  { id: 'b1', date: '2025-06-10', amount: 1500, kind: 'expense', title: 'MAGNIT', source: 'bank' },
  { id: 'b2', date: '2025-06-12', amount: 500, kind: 'expense', title: 'Яндекс Go', source: 'bank' },
];

const quick = [
  { id: 'q1', date: '2025-06-11', amount: 1500, kind: 'expense', title: 'Магнит', source: 'voice' },
  { id: 'q2', date: '2025-06-12', amount: 500, kind: 'expense', title: 'Яндекс Go поездка', source: 'manual' },
  { id: 'q3', date: '2025-06-12', amount: 500, kind: 'expense', title: 'Другое', source: 'manual' },
];

const matches = findReconciliationMatches(bank, quick);
assert('Сверяется голосовая запись с банком', matches.some((m) => m.quickId === 'q1' && m.bankId === 'b1'));
assert('Сверяется быстрая ручная запись', matches.some((m) => m.quickId === 'q2' && m.bankId === 'b2'));
assert('Не сверяет две быстрые записи на одну банковскую', matches.filter((m) => m.bankId === 'b2').length === 1);

const push = parseBankPushNotification('Списание 1 500,00 RUB. MAGNIT. Баланс 12 000 RUB');
assert('Парсит пуш банка', push?.amount === 1500 && push?.kind === 'expense' && /magnit/i.test(push.title));

console.log('\nВсе проверки пройдены.');
