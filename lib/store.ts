export type Account = 'CASH' | 'GCASH';
export type TxType = 'CASH_IN' | 'CASH_OUT';
export type FinanceType = 'CAPITAL' | 'WITHDRAWAL' | 'TRANSFER';

export type Rate = {
  id: string;
  min: number;
  max: number;
  fee: number;
  appliesTo: 'BOTH' | TxType;
};

export type Transaction = {
  id: string;
  date: string;
  type: TxType;
  account: 'GCASH';
  amount: number;
  fee: number;
  autoFee: number;
  reference?: string;
  receiptId?: string;
  createdAt: string;
};

export type FinanceEntry = {
  id: string;
  date: string;
  type: FinanceType;
  amount: number;
  account?: Account;
  fromAccount?: Account;
  toAccount?: Account;
  note?: string;
  createdAt: string;
};

export type AppData = {
  rates: Rate[];
  transactions: Transaction[];
  finance: FinanceEntry[];
};

export const DEFAULT_DATA: AppData = {
  rates: [
    { id: 'r1', min: 10, max: 500, fee: 10, appliesTo: 'BOTH' },
    { id: 'r2', min: 501, max: 1000, fee: 20, appliesTo: 'BOTH' },
  ],
  transactions: [],
  finance: [],
};

const DATA_KEY = 'asaplab_cashflow_v1';
const SESSION_KEY = 'asaplab_cashflow_session';
const USER_KEY = 'asaplab_cashflow_user';

export function loadData(): AppData {
  if (typeof window === 'undefined') return DEFAULT_DATA;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as any;

    // Backward-compatible migration: old BANK entries are folded into GCASH
    // so users do not lose previously entered values after BANK is removed.
    const finance: FinanceEntry[] = (Array.isArray(parsed.finance) ? parsed.finance : []).map((x: any) => ({
      ...x,
      account: x.account === 'BANK' ? 'GCASH' : x.account,
      fromAccount: x.fromAccount === 'BANK' ? 'GCASH' : x.fromAccount,
      toAccount: x.toAccount === 'BANK' ? 'GCASH' : x.toAccount,
    }));
    const transactions: Transaction[] = (Array.isArray(parsed.transactions) ? parsed.transactions : []).map((x: any) => ({
      ...x,
      account: 'GCASH',
    }));

    return {
      rates: Array.isArray(parsed.rates) ? parsed.rates : DEFAULT_DATA.rates,
      transactions,
      finance,
    };
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export async function hashText(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type LocalUser = { username: string; passwordHash: string };
export function getLocalUser(): LocalUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
export function setLocalUser(user: LocalUser) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
export function setSession(active: boolean) { active ? sessionStorage.setItem(SESSION_KEY, '1') : sessionStorage.removeItem(SESSION_KEY); }
export function hasSession() { return sessionStorage.getItem(SESSION_KEY) === '1'; }

export function money(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value || 0);
}

export function todayISO() {
  const d = new Date();
  const z = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - z).toISOString().slice(0, 10);
}

export function calculateFee(amount: number, type: TxType, rates: Rate[]): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const applicable = rates
    .filter((r) => r.appliesTo === 'BOTH' || r.appliesTo === type)
    .filter((r) => r.min >= 0 && r.max >= r.min && r.fee >= 0)
    .sort((a, b) => a.min - b.min || a.max - b.max);
  if (!applicable.length) return 0;

  const exact = applicable.find((r) => amount >= r.min && amount <= r.max);
  if (exact) return exact.fee;

  const first = applicable[0];
  if (amount < first.min) return first.fee;

  const last = applicable[applicable.length - 1];
  if (amount > last.max) {
    if (applicable.length === 1) {
      const block = Math.max(1, last.max);
      return Math.ceil(amount / block) * last.fee;
    }
    const prev = applicable[applicable.length - 2];
    const width = Math.max(1, last.max - last.min + 1);
    const increment = Math.max(0, last.fee - prev.fee) || last.fee;
    const extraBlocks = Math.ceil((amount - last.max) / width);
    return last.fee + extraBlocks * increment;
  }

  const lower = [...applicable].reverse().find((r) => r.max < amount);
  const upper = applicable.find((r) => r.min > amount);
  return lower?.fee ?? upper?.fee ?? 0;
}

export function getBalances(data: AppData): Record<Account, number> {
  const balances: Record<Account, number> = { CASH: 0, GCASH: 0 };

  for (const item of data.finance) {
    if (item.type === 'CAPITAL' && item.account) balances[item.account] += item.amount;
    if (item.type === 'WITHDRAWAL' && item.account) balances[item.account] -= item.amount;
    if (item.type === 'TRANSFER' && item.fromAccount && item.toAccount) {
      balances[item.fromAccount] -= item.amount;
      balances[item.toAccount] += item.amount;
    }
  }

  for (const tx of data.transactions) {
    if (tx.type === 'CASH_IN') {
      balances.CASH += tx.amount + tx.fee;
      balances.GCASH -= tx.amount;
    } else {
      balances.CASH -= tx.amount;
      balances.GCASH += tx.amount + tx.fee;
    }
  }
  return balances;
}

export function validateTransaction(data: AppData, type: TxType, amount: number) {
  const b = getBalances(data);
  if (type === 'CASH_IN' && b.GCASH < amount) return 'Not enough GCASH balance.';
  if (type === 'CASH_OUT' && b.CASH < amount) return 'Not enough CASH balance.';
  return '';
}

export function totalRevenue(data: AppData) {
  return data.transactions.reduce((sum, tx) => sum + tx.fee, 0);
}
export function totalCashInProcessed(data: AppData) {
  return data.transactions.filter((x) => x.type === 'CASH_IN').reduce((s, x) => s + x.amount, 0);
}
export function totalCashOutProcessed(data: AppData) {
  return data.transactions.filter((x) => x.type === 'CASH_OUT').reduce((s, x) => s + x.amount, 0);
}
export function totalCapital(data: AppData) {
  return data.finance.filter((x) => x.type === 'CAPITAL').reduce((s, x) => s + x.amount, 0);
}
export function totalWithdrawals(data: AppData) {
  return data.finance.filter((x) => x.type === 'WITHDRAWAL').reduce((s, x) => s + x.amount, 0);
}

function openReceiptDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('asaplab_receipts', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('receipts')) req.result.createObjectStore('receipts');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReceipt(id: string, file: Blob) {
  const db = await openReceiptDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('receipts', 'readwrite');
    tx.objectStore('receipts').put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getReceipt(id: string): Promise<Blob | null> {
  const db = await openReceiptDb();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction('receipts', 'readonly');
    const req = tx.objectStore('receipts').get(id);
    req.onsuccess = () => resolve((req.result as Blob) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}
