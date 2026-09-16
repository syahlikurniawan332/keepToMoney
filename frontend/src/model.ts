export type Item = {
  id: string;
  name: string;
  archived?: boolean;
  kind?: string;
  opening?: number;
  opening_date?: string;
};
export type Transaction = {
  id: string;
  kind: string;
  amount: number;
  date: string;
  account: string;
  category: string;
  target: string;
  original: string;
  tags: string[];
  note: string;
  created_at: string;
};
export type Filter = {
  start: string;
  end: string;
  account?: string;
  kind?: string;
  categories?: string[];
  tags?: string[];
  q?: string;
};
export type Budget = {
  id: string;
  name: string;
  start: string;
  end: string;
  limit: number;
  categories: string[];
  tags: string[];
};
export type Preferences = {
  name: string;
  zone: string;
  reminder: boolean;
  reminder_email: string;
  time: string;
  days: number[];
  pause_until: string;
  ai_consent: boolean;
};
export type Summary = {
  income: number;
  expense: number;
  net: number;
  categories: { id: string; amount: number }[];
};
export type Plan = {
  id: string;
  kind: string;
  title: string;
  start: string;
  end: string;
  origin: string;
  model?: string;
  applied: boolean;
  stale: boolean;
  explanation: string;
  incomplete: number;
  history_incomplete?: number;
  ai_error?: string;
  available?: number;
  per_day?: number;
  obligations?: number;
  savings?: number;
  reserve?: number;
  target?: number;
  allocations: {
    category: string;
    amount: number;
    before?: number;
    saving?: number;
  }[];
  summary: Summary;
  budgets?: {
    name: string;
    used: number;
    limit: number;
    start: string;
    end: string;
  }[];
};
export type State = {
  accounts: Item[];
  categories: Item[];
  tags: Item[];
  transactions: Transaction[];
  budgets: Budget[];
  checkins: Record<string, { status: string }>;
  plans: Plan[];
  preferences: Preferences;
};
export type Snapshot = {
  state: State;
  revision: number;
  today: string;
  balances: Record<string, number>;
  deliveries: { day: string; slot: number; status: string; at: number }[];
};
export type Session = {
  user: {
    id: string;
    username: string;
    email: string;
    verified: boolean;
  } | null;
  csrf: string | null;
  smtp: boolean;
  ai_model: string;
  registration: boolean;
};
export const rup = (n: number = 0) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (d: string) =>
  d
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(d + "T12:00:00Z"))
    : "—";
export const addDays = (d: string, n: number) =>
  new Date(new Date(d + "T12:00:00Z").getTime() + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const kinds: Record<string, string> = {
  income: "Pendapatan",
  expense: "Pengeluaran",
  transfer: "Transfer",
  refund: "Refund",
  adjustment: "Penyesuaian",
};
export const statuses: Record<string, string> = {
  unchecked: "Belum diperiksa",
  recorded: "Ada catatan",
  complete: "Sudah lengkap",
  none: "Tidak ada transaksi",
  recheck: "Periksa ulang",
};
export const name = (
  s: State,
  table: "accounts" | "categories" | "tags",
  id: string,
) => s[table].find((x) => x.id === id)?.name || "—";
export function filtered(s: State, f: Filter) {
  return s.transactions.filter(
    (t) =>
      (!f.start || t.date >= f.start) &&
      (!f.end || t.date <= f.end) &&
      (!f.account || [t.account, t.target].includes(f.account)) &&
      (!f.kind || t.kind === f.kind) &&
      (!f.categories?.length || f.categories.includes(t.category)) &&
      (!f.tags?.length || t.tags.some((x) => f.tags!.includes(x))) &&
      (!f.q ||
        (
          t.note +
          " " +
          name(s, "categories", t.category) +
          " " +
          name(s, "accounts", t.account)
        )
          .toLocaleLowerCase()
          .includes(f.q.toLocaleLowerCase())),
  );
}
export function summary(rows: Transaction[]): Summary {
  let income = 0,
    expense = 0;
  const cats: Record<string, number> = {};
  for (const t of rows) {
    if (t.kind === "income") income += t.amount;
    if (["expense", "refund"].includes(t.kind)) {
      const v = t.kind === "expense" ? t.amount : -t.amount;
      expense += v;
      cats[t.category] = (cats[t.category] || 0) + v;
    }
  }
  return {
    income,
    expense,
    net: income - expense,
    categories: Object.entries(cats)
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
export const checkStatus = (s: State, d: string) =>
  s.checkins[d]?.status ||
  (s.transactions.some((t) => t.date === d) ? "recorded" : "unchecked");
