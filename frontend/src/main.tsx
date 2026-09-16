import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  ArrowLeftRight,
  LayoutDashboard,
  Wallet,
  ChartNoAxesCombined,
  CalendarCheck,
  SlidersHorizontal,
  Sparkles,
  Settings,
  Plus,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  Search,
  X,
  Check,
  Mail,
  Sun,
  Moon,
  Menu,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Leaf,
  Trash2,
  Pencil,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import {
  State,
  Snapshot,
  Session,
  Item,
  Transaction,
  Filter,
  Budget,
  Plan,
  rup,
  dateLabel,
  addDays,
  kinds,
  statuses,
  name,
  filtered,
  summary,
  checkStatus,
} from "./model";
import "./style.css";

type Json = Record<string, unknown>;
type ModalSpec = {
  type: string;
  id?: string;
  table?: "accounts" | "categories" | "tags";
  date?: string;
};
type AppCtx = {
  s: State;
  data: Snapshot;
  session: Session;
  api: (path: string, p?: Json) => Promise<any>;
  refresh: () => Promise<void>;
  mutate: (action: string, p: Json) => Promise<void>;
  open: (m: ModalSpec | null) => void;
  notify: (m: string) => void;
  go: (p: string) => void;
  filters: Filter;
  setFilters: (f: Filter) => void;
};
const Context = createContext<AppCtx>(null!);
const useApp = () => useContext(Context);
const pages = [
  ["home", "Beranda", LayoutDashboard],
  ["transactions", "Transaksi", ArrowLeftRight],
  ["budgets", "Anggaran", Wallet],
  ["analysis", "Analisis", ChartNoAxesCombined],
  ["check", "Pemeriksaan", CalendarCheck],
  ["plans", "Rencana", Sparkles],
  ["settings", "Pengaturan", Settings],
] as const;
function Button({
  children,
  variant = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return (
    <button type="button" className={"btn " + variant} {...props}>
      {children}
    </button>
  );
}
function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={"card " + className}>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <Layers size={30} />
      <h3>Ruang untuk catatan Anda</h3>
      <p>{children}</p>
    </div>
  );
}
function Notice({
  children,
  warn = false,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className={"notice " + (warn ? "warning" : "")}>
      <ShieldCheck size={18} />
      <span>{children}</span>
    </div>
  );
}
function SelectItems({
  table,
  value = "",
  all = "Pilih…",
  predicate = () => true,
  ...props
}: {
  table: "accounts" | "categories" | "tags";
  value?: string;
  all?: string;
  predicate?: (x: Item) => boolean;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value">) {
  const { s } = useApp();
  return (
    <select defaultValue={value} {...props}>
      <option value="">{all}</option>
      {s[table]
        .filter((x) => predicate(x) && (!x.archived || x.id === value))
        .map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
            {x.archived ? " (arsip)" : ""}
          </option>
        ))}
    </select>
  );
}
function Checks({
  table,
  selected = [],
  field = table,
  expenses = false,
}: {
  table: "categories" | "tags";
  selected?: string[];
  field?: string;
  expenses?: boolean;
}) {
  const { s } = useApp();
  return (
    <div className="chips">
      {s[table]
        .filter(
          (x) =>
            (!x.archived || selected.includes(x.id)) &&
            (!expenses || x.kind === "expense"),
        )
        .map((x) => (
          <label key={x.id} className="chip">
            <input
              type="checkbox"
              name={field}
              value={x.id}
              defaultChecked={selected.includes(x.id)}
            />
            <span>{x.name}</span>
          </label>
        ))}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Activity size={24} />
      </span>
      <span>
        arus<span className="brand-dot">.</span>
      </span>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null),
    [data, setData] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState("");
  const initial = new URLSearchParams(location.hash.slice(1));
  const [page, setPage] = useState(initial.get("page") || "home"),
    [modal, setModal] = useState<ModalSpec | null>(null),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(localStorage.getItem("arus-theme") === "dark");
  const [filters, setFilters] = useState<Filter>({
    start: "",
    end: "",
    categories: [],
    tags: [],
    q: "",
  });
  const [action, setAction] = useState(initial.get("action") || ""),
    [token] = useState(initial.get("token") || "");
  const csrf = useRef("");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("arus-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function api(path: string, p?: Json) {
    const r = await fetch("/api/" + path, {
      method: p ? "POST" : "GET",
      headers: p
        ? {
            "Content-Type": "application/json",
            "X-Arus-Request": "1",
            "X-CSRF-Token": csrf.current,
          }
        : {},
      body: p ? JSON.stringify(p) : undefined,
    });
    let body;
    try {
      body = await r.json();
    } catch {
      throw Error("Server belum merespons. Periksa koneksi lalu coba kembali.");
    }
    if (!r.ok) {
      if (r.status === 401) {
        setSession(null);
        setData(null);
      }
      throw Error(body.error || "Permintaan gagal.");
    }
    return body;
  }
  async function refresh() {
    const next: Snapshot = await api("state");
    setData(next);
    setFilters((f) =>
      f.start
        ? f
        : { ...f, start: next.today.slice(0, 7) + "-01", end: next.today },
    );
  }
  async function boot() {
    setFatal("");
    try {
      const v: Session = await api("session");
      csrf.current = v.csrf || "";
      setSession(v);
      if (v.user) await refresh();
    } catch (e) {
      setFatal((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void boot();
  }, []);
  async function mutate(action: string, p: Json) {
    await api("mutate", {
      action,
      data: p,
      revision: data!.revision,
      key: crypto.randomUUID(),
    });
    await refresh();
    setModal(null);
    setToast("Perubahan berhasil disimpan.");
  }
  function go(p: string) {
    setPage(p);
    setMobile(false);
    location.hash = "page=" + p;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const toastNode = (
    <div className={"toast " + (toast ? "visible" : "")} role="status">
      <Check size={18} />
      {toast}
    </div>
  );
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <LoaderCircle className="spin" />
        <p>Membuka ruang keuangan Anda…</p>
      </div>
    );
  if (fatal)
    return (
      <div className="loading">
        <Brand />
        <Notice warn>{fatal}</Notice>
        <Button
          variant="primary"
          onClick={() => {
            setLoading(true);
            void boot();
          }}
        >
          Coba lagi
        </Button>
      </div>
    );
  if (action)
    return (
      <AuthFrame>
        <h1>
          {action === "reset"
            ? "Password baru"
            : action === "unsubscribe"
              ? "Matikan pengingat"
              : "Verifikasi email"}
        </h1>
        <p>Konfirmasi tindakan untuk melanjutkan.</p>
        <SimpleForm
          onSave={async (fd) => {
            await api("token", { action, token, password: fd.get("password") });
            setAction("");
            history.replaceState(null, "", location.pathname);
            await boot();
            setToast("Tindakan berhasil dikonfirmasi.");
          }}
        >
          {action === "reset" && (
            <Field
              label="Password baru"
              name="password"
              type="password"
              minLength={10}
              required
            />
          )}
          <Button type="submit" variant="primary">
            Konfirmasi
          </Button>
          <Button
            onClick={() => {
              setAction("");
              location.hash = "";
            }}
          >
            Kembali
          </Button>
        </SimpleForm>
        {toastNode}
      </AuthFrame>
    );
  if (!session?.user || !data)
    return (
      <Login
        api={api}
        onLogin={boot}
        registration={session?.registration || false}
      />
    );
  const s = data.state;
  return (
    <Context.Provider
      value={{
        s,
        data,
        session,
        api,
        refresh,
        mutate,
        open: setModal,
        notify: setToast,
        go,
        filters,
        setFilters,
      }}
    >
      <div className="app-shell">
        {mobile && (
          <button
            className="nav-scrim"
            aria-label="Tutup menu"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={"sidebar " + (mobile ? "open" : "")}>
          <Brand />
          <div className="workspace-label">PERSONAL WORKSPACE</div>
          <nav aria-label="Navigasi utama">
            {pages.map(([key, label, Icon], i) => (
              <React.Fragment key={key}>
                {i === 6 && <div className="nav-divider" />}
                <button
                  className={page === key ? "active" : ""}
                  aria-current={page === key ? "page" : undefined}
                  onClick={() => go(key)}
                >
                  <Icon size={20} />
                  {label}
                  {page === key && <span className="nav-dot" />}
                </button>
              </React.Fragment>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="quiet-card">
              <Leaf size={21} />
              <strong>Sedikit demi sedikit.</strong>
              <p>
                Satu catatan hari ini,
                <br />
                lebih jelas esok hari.
              </p>
            </div>
            <button className="user-card" onClick={() => go("settings")}>
              <span className="avatar">
                {s.preferences.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{s.preferences.name}</strong>
                <small>@{session.user.username}</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button
              className="logout"
              onClick={async () => {
                try {
                  await api("logout", {});
                  setSession(null);
                  setData(null);
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            >
              <LogOut size={16} />
              Keluar akun
            </button>
          </div>
        </aside>
        <div className="app-body">
          <div className="topbar">
            <Button
              variant="icon menu-toggle"
              aria-label="Buka menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </Button>
            <div className="breadcrumb">
              Workspace <ChevronRight size={14} />
              <strong>
                {pages.find((x) => x[0] === page)?.[1] || "Beranda"}
              </strong>
            </div>
            <div className="topbar-right">
              <span className="connection">
                <i />
                Tersimpan di server
              </span>
              <Button
                variant="icon"
                aria-label={dark ? "Mode terang" : "Mode gelap"}
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </Button>
              <Button
                variant="icon"
                aria-label="Pengaturan email"
                onClick={() => go("settings")}
              >
                <Mail size={19} />
              </Button>
              <span className="avatar small">
                {s.preferences.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          </div>
          <main id="main" key={page} className="main page-enter">
            <header className="page-header">
              <div className="page-heading">
                <div className="eyebrow">
                  {page === "home"
                    ? "RUANG UNTUK KEUANGAN YANG LEBIH TENANG"
                    : "CATAT · PAHAMI · RENCANAKAN"}
                </div>
                <h1>
                  {page === "home"
                    ? "Keuangan, lebih tenang."
                    : pages.find((x) => x[0] === page)?.[1]}
                </h1>
                <p>
                  {page === "home"
                    ? `Halo, ${s.preferences.name}. Mari lihat perjalanan uang Anda.`
                    : (
                        {
                          transactions:
                            "Setiap catatan membawa cerita. Kelola semuanya di sini.",
                          budgets:
                            "Beri ruang untuk kebutuhan, sisihkan untuk tujuan.",
                          analysis:
                            "Pahami pola dari angka yang benar-benar tercatat.",
                          check:
                            "Luangkan sejenak untuk memastikan catatan lengkap.",
                          plans:
                            "Dari catatan menjadi langkah yang bisa dilakukan.",
                          settings:
                            "Atur ruang keuangan agar sesuai dengan Anda.",
                        } as Record<string, string>
                      )[page]}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() =>
                  setModal({
                    type: s.accounts.length ? "transaction" : "accounts",
                  })
                }
              >
                <Plus size={18} />
                Catat transaksi
              </Button>
            </header>
            {page === "home" ? (
              <Home />
            ) : page === "transactions" ? (
              <Transactions />
            ) : page === "budgets" ? (
              <Budgets />
            ) : page === "analysis" ? (
              <Analysis />
            ) : page === "check" ? (
              <Daily />
            ) : page === "plans" ? (
              <Plans />
            ) : page === "settings" ? (
              <SettingsPage />
            ) : (
              <Home />
            )}
            <footer>
              Arus Modern <span>•</span> Saldo berasal dari catatan manual Anda.
            </footer>
          </main>
        </div>
        {modal && <Editor spec={modal} close={() => setModal(null)} />}{" "}
        {toastNode}
      </div>
    </Context.Provider>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <span className="auth-orbit orbit-one" />
        <span className="auth-orbit orbit-two" />
        <div className="story-content">
          <div className="eyebrow">KEUANGAN PRIBADI, DENGAN CARA ANDA</div>
          <h1>
            Langkah kecil.
            <br />
            Rencana besar.
            <br />
            <em>Mulai dari sini.</em>
          </h1>
          <p>
            Kenali arus uang, bangun kebiasaan baik,
            <br />
            dan beri ruang untuk hal yang berarti.
          </p>
          <div className="story-card">
            <span className="story-icon">
              <ChartNoAxesCombined />
            </span>
            <div>
              <strong>Lebih sadar. Lebih terarah.</strong>
              <small>Catat → periksa → rencanakan</small>
            </div>
            <div className="tiny-bars">
              {[30, 50, 40, 70, 60, 85, 100].map((v, i) => (
                <i key={i} style={{ height: v + "%" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="story-foot">
          <ShieldCheck size={17} />
          Data Anda, keputusan Anda.<span>ARUS / 02</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form">
          <div className="auth-mark">
            <Activity size={26} />
          </div>
          {children}
        </div>
        <small className="auth-bottom">
          Satu tempat untuk seluruh catatan keuangan Anda.
        </small>
      </section>
    </div>
  );
}
function Login({
  api,
  onLogin,
  registration,
}: {
  api: AppCtx["api"];
  onLogin: () => Promise<void>;
  registration: boolean;
}) {
  const [mode, setMode] = useState("login"),
    [visible, setVisible] = useState(false),
    [message, setMessage] = useState("");
  return (
    <AuthFrame>
      <div className="eyebrow">SELAMAT DATANG DI ARUS</div>
      <h1>
        {mode === "login"
          ? "Senang Anda kembali."
          : mode === "forgot"
            ? "Pulihkan akun."
            : "Mulai perjalanan Anda."}
      </h1>
      <p>
        {mode === "login"
          ? "Masuk untuk melanjutkan catatan dan rencana Anda."
          : mode === "forgot"
            ? "Gunakan email pemulihan yang terdaftar pada akun."
            : "Buat akun pribadi untuk mulai mencatat."}
      </p>
      <SimpleForm
        onSave={async (f) => {
          const r = await api(mode, Object.fromEntries(f));
          if (mode === "forgot") setMessage(r.message);
          else await onLogin();
        }}
      >
        {mode === "register" && (
          <Field label="Nama tampilan" name="name" required maxLength={120} />
        )}{" "}
        {mode === "forgot" ? (
          <Field
            label="Email akun"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        ) : (
          <Field
            label="Username"
            name="username"
            placeholder="Masukkan username Anda"
            required
            autoComplete="username"
          />
        )}
        {mode !== "forgot" && (
          <label className="field">
            Password
            <div className="password-input">
              <input
                name="password"
                type={visible ? "text" : "password"}
                placeholder="Masukkan password"
                required
                minLength={10}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
              />
              <button
                type="button"
                aria-label={
                  visible ? "Sembunyikan password" : "Tampilkan password"
                }
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        )}
        {mode === "register" && (
          <Field label="Email pemulihan (opsional)" name="email" type="email" />
        )}
        <Button variant="primary full" type="submit">
          {mode === "login"
            ? "Masuk ke Arus"
            : mode === "forgot"
              ? "Kirim tautan pemulihan"
              : "Buat akun"}
          <ArrowRight size={18} />
        </Button>
        {message && <Notice>{message}</Notice>}
      </SimpleForm>
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <button onClick={() => setMode("forgot")}>Lupa password?</button>
            {registration && (
              <button onClick={() => setMode("register")}>
                Buat akun baru
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
          >
            Kembali ke login
          </button>
        )}
      </div>
      <div className="auth-note">
        <LockKeyhole size={16} />
        Catatan hanya tersedia setelah Anda masuk.
      </div>
    </AuthFrame>
  );
}
function SimpleForm({
  children,
  onSave,
  className = "",
}: {
  children: React.ReactNode;
  onSave: (fd: FormData) => Promise<void>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <form
      className={"form " + className}
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        const f = new FormData(e.currentTarget);
        lock.current = true;
        setBusy(true);
        setError("");
        try {
          await onSave(f);
        } catch (ex) {
          setError((ex as Error).message);
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      {busy && (
        <div className="working" role="status">
          <LoaderCircle size={16} className="spin" />
          Memproses…
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}

function Filters() {
  const { s, filters: f, setFilters, data } = useApp();
  const [advanced, setAdvanced] = useState(false);
  const count =
    (f.categories?.length || 0) +
    (f.tags?.length || 0) +
    (f.account ? 1 : 0) +
    (f.kind ? 1 : 0);
  return (
    <div className="filter-bar">
      <SimpleForm
        key={JSON.stringify(f)}
        className="filters-form"
        onSave={async (fd) => {
          const v = Object.fromEntries(fd);
          if (String(v.start) > String(v.end))
            throw Error("Tanggal awal harus sebelum tanggal akhir.");
          setFilters({
            start: String(v.start),
            end: String(v.end),
            q: String(v.q || ""),
            account: String(v.account || ""),
            kind: String(v.kind || ""),
            categories: fd.getAll("categories").map(String),
            tags: fd.getAll("tags").map(String),
          });
        }}
      >
        <div className="filter-top">
          <span className="filter-label">
            <SlidersHorizontal size={17} />
            Periode laporan
          </span>
          <div className="date-range">
            <input
              aria-label="Dari tanggal"
              name="start"
              type="date"
              defaultValue={f.start}
              key={"start" + f.start}
              required
            />
            <span>—</span>
            <input
              aria-label="Sampai tanggal"
              name="end"
              type="date"
              defaultValue={f.end}
              key={"end" + f.end}
              required
            />
          </div>
          <Button
            variant={"subtle " + (advanced ? "selected" : "")}
            onClick={() => setAdvanced(!advanced)}
          >
            Filter{count > 0 && <span className="count">{count}</span>}
            <ChevronDown size={15} />
          </Button>
          <Button type="submit" variant="subtle">
            Terapkan
          </Button>
        </div>
        <div className={"filter-extra " + (advanced ? "expanded" : "")}>
          <div className="form-grid">
            <Field
              label="Cari catatan"
              name="q"
              defaultValue={f.q}
              placeholder="Deskripsi atau kategori…"
            />
            <label className="field">
              Sumber uang
              <select name="account" defaultValue={f.account}>
                <option value="">Semua sumber</option>
                {s.accounts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Jenis
              <select name="kind" defaultValue={f.kind}>
                <option value="">Semua jenis</option>
                {Object.entries(kinds).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Kategori (pilihan digabung dengan “atau”)
          </label>
          <Checks table="categories" selected={f.categories} />
          <label className="field">
            Label (kategori dan label harus sama-sama sesuai)
          </label>
          <Checks table="tags" selected={f.tags} />
          <Button
            onClick={() =>
              setFilters({
                start: data.today.slice(0, 7) + "-01",
                end: data.today,
                categories: [],
                tags: [],
                q: "",
              })
            }
          >
            Reset filter
          </Button>
        </div>
      </SimpleForm>
    </div>
  );
}
function Stats({ rows }: { rows: Transaction[] }) {
  const r = summary(rows);
  return (
    <div className="stats">
      <Card>
        <div className="stat-label">
          <span>Pendapatan</span>
          <span className="metric-icon green">
            <ArrowDownLeft size={19} />
          </span>
        </div>
        <strong className="stat-value">{rup(r.income)}</strong>
        <small>
          <span className="mini-dot green" />
          Dalam periode & filter terpilih
        </small>
      </Card>
      <Card>
        <div className="stat-label">
          <span>Pengeluaran bersih</span>
          <span className="metric-icon orange">
            <ArrowUpRight size={19} />
          </span>
        </div>
        <strong className="stat-value">{rup(r.expense)}</strong>
        <small>Setelah refund pada periode ini</small>
      </Card>
      <Card>
        <div className="stat-label">
          <span>Selisih arus kas</span>
          <span className="metric-icon purple">
            <ArrowLeftRight size={19} />
          </span>
        </div>
        <strong className={"stat-value " + (r.net < 0 ? "negative" : "")}>
          {rup(r.net)}
        </strong>
        <small>Selisih tercatat, bukan dana aman</small>
      </Card>
    </div>
  );
}
function Chart({ rows }: { rows: Transaction[] }) {
  const { s, setFilters, filters, go } = useApp(),
    r = summary(rows),
    max = Math.max(1, ...r.categories.map((x) => Math.abs(x.amount)));
  return (
    <Card className="category-card">
      <div className="card-head">
        <div>
          <h2>Ke mana uang Anda pergi?</h2>
          <p>Pengeluaran bersih per kategori</p>
        </div>
        <span className="badge">{r.categories.length} kategori</span>
      </div>
      {r.categories.length ? (
        <div className="category-bars">
          {r.categories.slice(0, 6).map((x, i) => (
            <button
              className="category-row"
              key={x.id}
              onClick={() => {
                setFilters({ ...filters, categories: [x.id], kind: "" });
                go("transactions");
              }}
            >
              <div>
                <span className={"category-dot shade-" + i} />
                <span>{name(s, "categories", x.id)}</span>
                <strong>{rup(x.amount)}</strong>
              </div>
              <div className="track">
                <i
                  className={"shade-" + i}
                  style={{
                    width: (Math.abs(x.amount) / max) * 100 + "%",
                    animationDelay: i * 65 + "ms",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty>Grafik muncul setelah ada pengeluaran pada periode ini.</Empty>
      )}
      <div className="card-caption">
        {r.categories.length > 6 ? "Enam kategori terbesar. " : ""}Klik kategori
        untuk melihat transaksi pembentuknya.
      </div>
    </Card>
  );
}
function TxTable({
  rows,
  limit = 20,
}: {
  rows: Transaction[];
  limit?: number;
}) {
  const { s, open } = useApp();
  if (!rows.length)
    return (
      <Empty>
        Belum ada transaksi yang cocok. Coba periode lain atau tambahkan
        catatan.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>TRANSAKSI</th>
            <th>TANGGAL</th>
            <th>SUMBER UANG</th>
            <th className="num">NOMINAL</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((t) => (
            <tr key={t.id}>
              <td>
                <div className="tx-title">
                  <span
                    className={
                      "tx-icon " +
                      (t.kind === "expense"
                        ? "orange"
                        : t.kind === "income" || t.kind === "refund"
                          ? "green"
                          : "purple")
                    }
                  >
                    {t.kind === "expense" ? (
                      <ArrowUpRight size={19} />
                    ) : t.kind === "transfer" ? (
                      <ArrowLeftRight size={19} />
                    ) : (
                      <ArrowDownLeft size={19} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {t.note ||
                        name(s, "categories", t.category) ||
                        kinds[t.kind]}
                    </strong>
                    <small>
                      {kinds[t.kind]}
                      {t.category
                        ? " · " + name(s, "categories", t.category)
                        : ""}
                      {t.tags.length
                        ? " · " +
                          t.tags.map((x) => name(s, "tags", x)).join(", ")
                        : ""}
                    </small>
                  </div>
                </div>
              </td>
              <td className="date-cell">{dateLabel(t.date)}</td>
              <td>
                {name(s, "accounts", t.account)}
                {t.target && <small>ke {name(s, "accounts", t.target)}</small>}
              </td>
              <td
                className={
                  "num money " +
                  (["income", "refund"].includes(t.kind) ? "positive" : "")
                }
              >
                {t.kind === "expense"
                  ? "−"
                  : t.kind === "income" || t.kind === "refund"
                    ? "+"
                    : ""}
                {rup(t.amount)}
              </td>
              <td>
                <Button
                  variant="icon"
                  aria-label={"Edit " + (t.note || kinds[t.kind])}
                  onClick={() => open({ type: "transaction", id: t.id })}
                >
                  <Pencil size={15} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const sorted = (rows: Transaction[]) =>
  [...rows].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );
function ExportButton() {
  const { filters } = useApp();
  return (
    <Button
      variant="subtle"
      onClick={() => {
        const q = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) =>
          Array.isArray(v)
            ? v.forEach((x) => q.append(k, x))
            : v && q.set(k, v),
        );
        location.href = "/api/export?" + q;
      }}
    >
      <Download size={16} />
      Ekspor CSV
    </Button>
  );
}
function Home() {
  const { s, data, filters, go, open } = useApp();
  const rows = filtered(s, filters),
    r = summary(rows),
    total = Object.values(data.balances).reduce((a, b) => a + b, 0),
    st = checkStatus(s, data.today);
  return (
    <>
      <Filters />
      <div className="overview">
        <section className="balance-hero">
          <div className="hero-top">
            <span>
              <Wallet size={18} />
              TOTAL SALDO TERCATAT
            </span>
            <span className="hero-chip">Semua sumber</span>
          </div>
          <div className="hero-balance">{rup(total)}</div>
          <p>Saldo global saat ini · terpisah dari filter laporan</p>
          <div className="hero-bottom">
            <span>
              <i />
              {s.accounts.length} sumber uang terhubung dalam catatan
            </span>
            <button
              aria-label="Kelola sumber uang"
              onClick={() => go("settings")}
            >
              <ArrowUpRight size={20} />
            </button>
          </div>
          <div className="hero-rings" />
        </section>
        <Card className="daily-card">
          <div className="daily-top">
            <span className="metric-icon green">
              <CalendarCheck size={22} />
            </span>
            <span className="badge">{dateLabel(data.today)}</span>
          </div>
          <h2>Satu menit untuk hari ini.</h2>
          <p>
            Pastikan semua transaksi sudah tercatat,
            <br />
            termasuk hari tanpa pengeluaran.
          </p>
          <div className="daily-bottom">
            <span
              className={
                "status " + (["complete", "none"].includes(st) ? "good" : "")
              }
            >
              {statuses[st]}
            </span>
            <button className="text-button" onClick={() => go("check")}>
              Periksa
              <ArrowRight size={17} />
            </button>
          </div>
        </Card>
      </div>
      <Stats rows={rows} />
      <div className="two-columns">
        <Chart rows={rows} />
        <Card className="wallet-card">
          <div className="card-head">
            <div>
              <h2>Sumber uang</h2>
              <p>Saldo masing-masing akun</p>
            </div>
            <Button
              variant="icon"
              aria-label="Tambah sumber uang"
              onClick={() => open({ type: "accounts" })}
            >
              <Plus size={18} />
            </Button>
          </div>
          {s.accounts.map((a, i) => (
            <div className="wallet-row" key={a.id}>
              <span className={"wallet-icon " + (i % 2 ? "purple" : "green")}>
                <Wallet size={20} />
              </span>
              <div>
                <strong>{a.name}</strong>
                <small>
                  {a.kind === "bank"
                    ? "Rekening bank"
                    : a.kind === "cash"
                      ? "Uang tunai"
                      : "E-wallet"}
                  {a.archived ? " · Arsip" : ""}
                </small>
              </div>
              <strong>{rup(data.balances[a.id])}</strong>
            </div>
          ))}
          {!s.accounts.length && (
            <Empty>Tambahkan sumber uang untuk memulai.</Empty>
          )}
          <div className="insight">
            <Sparkles size={18} />
            <p>
              {rows.length
                ? r.net >= 0
                  ? "Pendapatan tercatat menutup pengeluaran periode ini. Periksa kelengkapan sebelum membuat rencana."
                  : "Pengeluaran tercatat lebih besar dari pendapatan. Tinjau rincian dan kelengkapan catatan."
                : "Mulai dengan satu transaksi. Ringkasan akan mengikuti catatan Anda."}
            </p>
          </div>
        </Card>
      </div>
      <Card className="recent">
        <div className="card-head">
          <div>
            <h2>Catatan terbaru</h2>
            <p>Perjalanan uang, satu transaksi setiap waktu</p>
          </div>
          <button className="text-button" onClick={() => go("transactions")}>
            Lihat semua
            <ArrowRight size={16} />
          </button>
        </div>
        <TxTable rows={sorted(rows)} limit={5} />
      </Card>
    </>
  );
}
function Transactions() {
  const { s, filters } = useApp();
  const rows = sorted(filtered(s, filters)),
    [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filters]);
  const max = Math.max(1, Math.ceil(rows.length / 15)),
    current = Math.min(page, max - 1);
  return (
    <>
      <Filters />
      <Stats rows={rows} />
      <Card>
        <div className="card-head">
          <div>
            <h2>
              Semua transaksi <span className="badge">{rows.length}</span>
            </h2>
            <p>Catatan sesuai filter yang Anda pilih</p>
          </div>
          <ExportButton />
        </div>
        <TxTable rows={rows.slice(current * 15)} limit={15} />
        <div className="pagination">
          <span>
            {rows.length} catatan · halaman {current + 1} dari {max}
          </span>
          <div>
            <Button
              disabled={current === 0}
              aria-label="Halaman sebelumnya"
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={17} />
            </Button>
            <Button
              disabled={current >= max - 1}
              aria-label="Halaman berikutnya"
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={17} />
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
function Budgets() {
  const { s, open, setFilters, go } = useApp();
  return (
    <>
      <div className="section-toolbar">
        <Notice>
          Anggaran adalah batas penggunaan. Cakupan dapat tumpang tindih; total
          antaranggaran tidak dijumlahkan.
        </Notice>
        <Button variant="primary" onClick={() => open({ type: "budget" })}>
          <Plus size={17} />
          Buat anggaran
        </Button>
      </div>
      <div className="budget-grid">
        {s.budgets.map((b, i) => {
          const used = summary(filtered(s, b)).expense,
            pct = Math.round((used / b.limit) * 100),
            over = used > b.limit;
          return (
            <Card key={b.id}>
              <div className="card-head">
                <span className={"metric-icon " + (i % 2 ? "purple" : "green")}>
                  <Wallet size={21} />
                </span>
                <Button
                  variant="icon"
                  aria-label={"Edit " + b.name}
                  onClick={() => open({ type: "budget", id: b.id })}
                >
                  <Pencil size={16} />
                </Button>
              </div>
              <h2>{b.name}</h2>
              <p className="muted">
                {dateLabel(b.start)} – {dateLabel(b.end)}
              </p>
              <div className="budget-numbers">
                <strong>{rup(used)}</strong>
                <span>dari {rup(b.limit)}</span>
              </div>
              <div className="track">
                <i
                  className={over ? "over" : ""}
                  style={{ width: Math.max(0, Math.min(100, pct)) + "%" }}
                />
              </div>
              <div className="budget-status">
                <span>{pct}% terpakai</span>
                <strong className={over ? "negative" : "positive"}>
                  {over ? "Lebih" : "Sisa"} {rup(Math.abs(b.limit - used))}
                </strong>
              </div>
              <p className="small-muted">
                {b.categories.length
                  ? b.categories
                      .map((x) => name(s, "categories", x))
                      .join(" atau ")
                  : "Semua kategori"}{" "}
                ·{" "}
                {b.tags.length
                  ? b.tags.map((x) => name(s, "tags", x)).join(" atau ")
                  : "Semua label"}
              </p>
              <button
                className="text-button"
                onClick={() => {
                  setFilters({
                    start: b.start,
                    end: b.end,
                    categories: b.categories,
                    tags: b.tags,
                  });
                  go("transactions");
                }}
              >
                Lihat catatan
                <ArrowRight size={16} />
              </button>
            </Card>
          );
        })}
      </div>
      {!s.budgets.length && (
        <Card>
          <Empty>
            Buat anggaran pertama berdasarkan kategori pilihan Anda.
          </Empty>
        </Card>
      )}
    </>
  );
}
function Analysis() {
  const { s, filters: f, data } = useApp(),
    rows = filtered(s, f),
    r = summary(rows),
    days = Math.round((Date.parse(f.end) - Date.parse(f.start)) / 86400000) + 1;
  const prevEnd = addDays(f.start, -1),
    prevStart = addDays(f.start, -days),
    prev = summary(filtered(s, { ...f, start: prevStart, end: prevEnd }));
  let missing = 0;
  for (let i = 0; i < Math.min(days, 40000); i++) {
    const d = addDays(f.start, i);
    if (d <= data.today && !["complete", "none"].includes(checkStatus(s, d)))
      missing++;
  }
  return (
    <>
      <Filters />
      <Stats rows={rows} />
      <Notice warn={missing > 0}>
        {missing
          ? `${missing} hari belum dikonfirmasi lengkap. Pola yang terlihat mungkin berubah setelah catatan dilengkapi.`
          : "Semua hari yang telah berlalu dalam periode ini sudah diperiksa."}
      </Notice>
      <div className="two-columns">
        <Chart rows={rows} />
        <Card>
          <div className="card-head">
            <div>
              <h2>Dibanding periode sebelumnya</h2>
              <p>Durasi sama: {days} hari</p>
            </div>
            <ChartNoAxesCombined size={22} />
          </div>
          <p className="small-muted">
            {dateLabel(prevStart)} – {dateLabel(prevEnd)}
          </p>
          <div className="comparison">
            <span>Pengeluaran sebelumnya</span>
            <strong>{rup(prev.expense)}</strong>
          </div>
          <div className="comparison">
            <span>Pengeluaran saat ini</span>
            <strong>{rup(r.expense)}</strong>
          </div>
          <div className="comparison highlighted">
            <span>Perubahan nominal</span>
            <strong
              className={r.expense > prev.expense ? "negative" : "positive"}
            >
              {rup(r.expense - prev.expense)}
            </strong>
          </div>
          <p className="small-muted">
            Filter selain tanggal tetap sama. Penurunan angka belum membuktikan
            penghematan jika catatan belum lengkap.
          </p>
        </Card>
      </div>
      <Card>
        <div className="card-head">
          <h2>Rincian kategori</h2>
          <ExportButton />
        </div>
        {r.categories.map((x) => (
          <div className="comparison" key={x.id}>
            <span>{name(s, "categories", x.id)}</span>
            <strong>{rup(x.amount)}</strong>
          </div>
        ))}
      </Card>
    </>
  );
}
function Daily() {
  const { s, data, mutate, api, notify, open } = useApp();
  const initial = new URLSearchParams(location.hash.slice(1)).get("date");
  const [day, setDay] = useState(
    initial && /^\d{4}-\d{2}-\d{2}$/.test(initial) ? initial : data.today,
  );
  const rows = s.transactions.filter((t) => t.date === day),
    st = checkStatus(s, day);
  return (
    <div className="two-columns">
      <div className="stack">
        <Card>
          <div className="card-head">
            <span className="metric-icon green">
              <CalendarCheck size={24} />
            </span>
            <Field
              label="Tanggal pemeriksaan"
              type="date"
              value={day}
              max={data.today}
              min="2000-01-01"
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
          </div>
          <h2 className="large-heading">{statuses[st]}</h2>
          <p>
            {rows.length} transaksi pada {dateLabel(day)}. Pastikan semua sumber
            uang telah diperiksa.
          </p>
          <SimpleForm
            onSave={async (fd) => {
              await mutate("checkin", { date: day, status: fd.get("status") });
            }}
          >
            <label className="field">
              Konfirmasi
              <select name="status">
                <option value="complete">Semua catatan sudah lengkap</option>
                <option value="none" disabled={rows.length > 0}>
                  Tidak ada transaksi
                </option>
              </select>
            </label>
            <Button type="submit" variant="primary">
              <Check size={18} />
              Simpan pemeriksaan
            </Button>
          </SimpleForm>
          <div className="action-row">
            <Button onClick={() => open({ type: "transaction", date: day })}>
              <Plus size={16} />
              Tambah catatan
            </Button>
            {day === data.today && (
              <Button
                onClick={async () => {
                  try {
                    await api("snooze", { date: day });
                    notify("Pengingat tambahan dijadwalkan satu jam lagi.");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                Ingatkan nanti
              </Button>
            )}
          </div>
          <p className="small-muted">
            Perubahan transaksi setelah konfirmasi akan meminta pemeriksaan
            ulang.
          </p>
        </Card>
        <Card>
          <h2>Catatan hari ini</h2>
          <TxTable rows={rows} limit={rows.length} />
        </Card>
      </div>
      <Card>
        <div className="card-head">
          <h2>14 hari terakhir</h2>
          <CalendarCheck size={19} />
        </div>
        <div className="day-list">
          {Array.from({ length: 14 }, (_, i) => addDays(data.today, -i)).map(
            (d) => (
              <button
                key={d}
                className={d === day ? "selected" : ""}
                onClick={() => setDay(d)}
              >
                <span
                  className={
                    "day-marker " +
                    (["complete", "none"].includes(checkStatus(s, d))
                      ? "done"
                      : "")
                  }
                >
                  <Check size={15} />
                </span>
                <span>
                  <strong>{dateLabel(d)}</strong>
                  <small>{statuses[checkStatus(s, d)]}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ),
          )}
        </div>
      </Card>
    </div>
  );
}

function Plans() {
  const { s, data, session, api, refresh, notify, open } = useApp(),
    [kind, setKind] = useState("budget");
  return (
    <>
      <div className="plan-intro">
        <Sparkles size={24} />
        <div>
          <h2>Rencana baik dimulai dari angka yang jelas.</h2>
          <p>
            Perhitungan otomatis selalu tersedia. AI lokal bersifat opsional dan
            hasilnya tetap perlu Anda tinjau.
          </p>
        </div>
      </div>
      <div className="tabs">
        {[
          ["budget", "Susun anggaran"],
          ["savings", "Rencana hemat"],
          ["weekly", "Evaluasi periode"],
        ].map(([v, n]) => (
          <button
            key={v}
            className={kind === v ? "active" : ""}
            onClick={() => setKind(v)}
          >
            {n}
          </button>
        ))}
      </div>
      <Card>
        <SimpleForm
          key={kind}
          onSave={async (f) => {
            const p: Json = {
              ...Object.fromEntries(f),
              kind,
              categories: f.getAll("categories"),
              use_ai: f.has("use_ai"),
            };
            for (const n of [
              "fund",
              "obligations",
              "savings",
              "reserve",
              "target",
            ])
              if (n in p) p[n] = Number(p[n]);
            await api("plan", {
              revision: data.revision,
              key: crypto.randomUUID(),
              data: p,
            });
            await refresh();
            notify("Draft tersimpan. Tinjau sebelum diterapkan.");
          }}
        >
          <div className="form-grid">
            <Field
              label="Mulai periode"
              name="start"
              type="date"
              defaultValue={data.today.slice(0, 7) + "-01"}
              required
            />
            <Field
              label="Akhir periode"
              name="end"
              type="date"
              defaultValue={data.today}
              required
            />
            {kind === "budget" && (
              <>
                <Field
                  label="Dana untuk periode (Rp)"
                  name="fund"
                  type="number"
                  min={0}
                  step={1}
                  required
                />
                <Field
                  label="Kewajiban belum dibayar (Rp)"
                  name="obligations"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  required
                />
                <Field
                  label="Alokasi tabungan (Rp)"
                  name="savings"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  required
                />
                <Field
                  label="Cadangan (Rp)"
                  name="reserve"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={0}
                  required
                />
              </>
            )}
            {kind === "savings" && (
              <>
                <Field
                  label="Target penghematan (Rp)"
                  name="target"
                  type="number"
                  min={1}
                  step={1}
                  required
                />
                <Field
                  label="Awal riwayat"
                  name="prior_start"
                  type="date"
                  required
                />
                <Field
                  label="Akhir riwayat"
                  name="prior_end"
                  type="date"
                  required
                />
              </>
            )}
          </div>
          {kind !== "weekly" && (
            <>
              <label className="field">
                Kategori yang boleh dialokasikan / dikurangi
              </label>
              <Checks table="categories" expenses />
            </>
          )}
          <label className="checkline">
            <input
              name="use_ai"
              type="checkbox"
              disabled={!session.ai_model || !s.preferences.ai_consent}
            />
            Gunakan AI lokal (memerlukan konfigurasi dan persetujuan)
          </label>
          <Button type="submit" variant="primary">
            <Sparkles size={17} />
            Buat draft rencana
          </Button>
        </SimpleForm>
      </Card>
      <div className="section-title">
        <h2>Draft & hasil evaluasi</h2>
        <span className="badge">{s.plans.length}</span>
      </div>
      <div className="stack">
        {[...s.plans].reverse().map((p) => (
          <Card key={p.id}>
            <div className="card-head">
              <div>
                <h2>{p.title}</h2>
                <p>
                  {dateLabel(p.start)} – {dateLabel(p.end)}
                </p>
              </div>
              <span className="badge">
                {p.origin === "ollama" ? "AI lokal" : "Perhitungan otomatis"}
              </span>
            </div>
            {p.stale && !p.applied && (
              <Notice warn>
                Data berubah. Susun ulang draft sebelum menerapkannya.
              </Notice>
            )}
            {(p.history_incomplete || p.incomplete) > 0 && (
              <Notice warn>
                Masih ada hari yang belum diperiksa. Rencana perlu ditinjau
                dengan memperhatikan kelengkapan catatan.
              </Notice>
            )}
            {p.ai_error && <Notice warn>{p.ai_error}</Notice>}
            <p>{p.explanation}</p>
            {p.kind === "budget" && (
              <div className="plan-values">
                <div>
                  <small>Sisa dana setelah alokasi khusus</small>
                  <strong>{rup(p.available)}</strong>
                </div>
                <div>
                  <small>Rata-rata per hari</small>
                  <strong>{rup(p.per_day)}</strong>
                </div>
                <p className="small-muted">
                  Kewajiban {rup(p.obligations)} · Tabungan {rup(p.savings)} ·
                  Cadangan {rup(p.reserve)}
                </p>
              </div>
            )}
            {p.allocations.map((x) => (
              <div className="comparison" key={x.category}>
                <span>
                  {name(s, "categories", x.category)}
                  {p.kind === "savings" && (
                    <small>
                      Sebelumnya {rup(x.before)} · potensi hemat {rup(x.saving)}
                    </small>
                  )}
                </span>
                <strong>{rup(x.amount)}</strong>
              </div>
            ))}
            {p.kind === "weekly" && (
              <>
                <div className="plan-values">
                  <div>
                    <small>Pendapatan</small>
                    <strong>{rup(p.summary.income)}</strong>
                  </div>
                  <div>
                    <small>Pengeluaran</small>
                    <strong>{rup(p.summary.expense)}</strong>
                  </div>
                </div>
                {p.budgets?.map((b, i) => (
                  <div key={i} className="comparison">
                    <span>
                      {b.name}
                      <small>
                        {dateLabel(b.start)} – {dateLabel(b.end)}
                      </small>
                    </span>
                    <strong>
                      {rup(b.used)} / {rup(b.limit)}
                    </strong>
                  </div>
                ))}
              </>
            )}
            <div className="action-row">
              {p.applied ? (
                <span className="status good">Sudah diterapkan</span>
              ) : (
                p.kind !== "weekly" && (
                  <>
                    <Button
                      disabled={p.stale}
                      onClick={() => open({ type: "plan-edit", id: p.id })}
                    >
                      Edit alokasi
                    </Button>
                    <Button
                      disabled={p.stale}
                      variant="primary"
                      onClick={() => open({ type: "plan-apply", id: p.id })}
                    >
                      Tinjau & terapkan
                      <ArrowRight size={16} />
                    </Button>
                  </>
                )
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function SettingsPage() {
  const { s, data, session, mutate, open, api, notify } = useApp(),
    p = s.preferences;
  const [tab, setTab] = useState("profile");
  return (
    <>
      <div className="tabs">
        {[
          ["profile", "Profil & Gmail"],
          ["accounts", "Sumber uang"],
          ["categories", "Kategori & label"],
          ["data", "Data & keamanan"],
        ].map(([v, n]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={tab === v ? "active" : ""}
          >
            {n}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <div className="two-columns">
          <Card>
            <div className="card-head">
              <div>
                <h2>Profil & pengingat harian</h2>
                <p>Masuk sebagai @{session.user!.username}</p>
              </div>
              <Mail size={22} />
            </div>
            <SimpleForm
              key={data.revision}
              onSave={async (f) => {
                await mutate("preferences", {
                  ...Object.fromEntries(f),
                  days: f.getAll("days").map(Number),
                  reminder: f.has("reminder"),
                  ai_consent: f.has("ai_consent"),
                });
              }}
            >
              <Field
                label="Nama tampilan"
                name="name"
                defaultValue={p.name}
                required
                maxLength={120}
              />
              <div className="form-grid">
                <label className="field">
                  Zona waktu
                  <select name="zone" defaultValue={p.zone}>
                    {[
                      ["Asia/Jakarta", "WIB · UTC+7"],
                      ["Asia/Makassar", "WITA · UTC+8"],
                      ["Asia/Jayapura", "WIT · UTC+9"],
                      ["UTC", "UTC"],
                    ].map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Jam pengingat"
                  type="time"
                  name="time"
                  defaultValue={p.time}
                  required
                />
              </div>
              <label className="checkline toggle-line">
                <input
                  type="checkbox"
                  name="reminder"
                  defaultChecked={p.reminder}
                />
                <span>
                  <strong>Aktifkan pengingat email</strong>
                  <small>Pengingat dikirim ke alamat yang Anda pilih.</small>
                </span>
              </label>
              <Field
                label="Email tujuan pengingat"
                name="reminder_email"
                type="email"
                defaultValue={p.reminder_email}
                placeholder="nama@gmail.com"
                maxLength={254}
              />
              <Button
                disabled={!session.smtp}
                onClick={async (e) => {
                  const f = e.currentTarget.closest("form")!;
                  const email = String(
                    new FormData(f).get("reminder_email") || "",
                  );
                  try {
                    const r = await api("test-email", { email });
                    notify(r.message);
                  } catch (x) {
                    notify((x as Error).message);
                  }
                }}
              >
                <Mail size={16} />
                Kirim email percobaan
              </Button>
              <label className="field">Hari pengingat</label>
              <div className="chips">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
                  (d, i) => (
                    <label className="chip" key={d}>
                      <input
                        name="days"
                        value={i}
                        type="checkbox"
                        defaultChecked={p.days.includes(i)}
                      />
                      <span>{d}</span>
                    </label>
                  ),
                )}
              </div>
              <Field
                label="Jeda pengingat sampai (opsional)"
                name="pause_until"
                type="date"
                defaultValue={p.pause_until}
              />
              <label className="checkline">
                <input
                  name="ai_consent"
                  type="checkbox"
                  defaultChecked={p.ai_consent}
                />
                Izinkan AI lokal memproses ringkasan kategori dan nominal.
              </label>
              <p className="small-muted">
                AI dijalankan di komputer server, bukan otomatis di perangkat
                browser. Model cloud tidak digunakan oleh paket ini.
              </p>
              <Button type="submit" variant="primary">
                Simpan preferensi
              </Button>
            </SimpleForm>
          </Card>
          <div className="stack">
            <Card>
              <span className="metric-icon green">
                <Mail size={24} />
              </span>
              <h2>Status pengirim</h2>
              <Notice warn={!session.smtp}>
                {session.smtp
                  ? "Pengirim sudah dikonfigurasi. Uji email untuk memeriksa hasil pengiriman."
                  : "Pengirim belum dikonfigurasi. Preferensi bisa disimpan; email belum akan terkirim."}
              </Notice>
              <p className="small-muted">
                Panduan konfigurasi ada di docs/GMAIL.md dalam paket. Kredensial
                pengirim hanya diatur pada server.
              </p>
            </Card>
            <Card>
              <h2>Riwayat pengiriman</h2>
              {data.deliveries.length ? (
                data.deliveries.map((d, i) => (
                  <div className="comparison" key={i}>
                    <span>
                      {dateLabel(d.day)}
                      <small>
                        {d.slot ? "Pengingat tambahan" : "Pengingat utama"}
                      </small>
                    </span>
                    <span className="badge">
                      {(
                        {
                          sent: "Diserahkan ke pengirim",
                          sending: "Diproses",
                          uncertain: "Belum pasti",
                          rejected: "Alamat ditolak",
                        } as Record<string, string>
                      )[d.status] || d.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">Belum ada pengiriman pengingat.</p>
              )}
              <p className="small-muted">
                Pengiriman berhasil ke server belum menjamin pesan masuk ke
                Inbox. Periksa folder Spam.
              </p>
            </Card>
          </div>
        </div>
      ) : tab === "accounts" ? (
        <Manage table="accounts" />
      ) : tab === "categories" ? (
        <div className="two-columns">
          <Manage table="categories" />
          <Manage table="tags" />
        </div>
      ) : (
        <div className="two-columns">
          <Card>
            <h2>Backup & pemulihan</h2>
            <p>
              Unduh seluruh data akun dalam JSON. Pemulihan akan mengganti
              catatan akun aktif setelah konfirmasi password.
            </p>
            <div className="action-row">
              <Button
                variant="primary"
                onClick={() => {
                  location.href = "/api/backup";
                }}
              >
                <Download size={16} />
                Unduh backup JSON
              </Button>
              <Button onClick={() => open({ type: "restore" })}>
                Pulihkan backup
              </Button>
            </div>
            <p className="small-muted">
              Backup JSON tidak berisi password. Simpan salinannya di tempat
              pribadi dan perangkat berbeda.
            </p>
          </Card>
          <Card>
            <h2>Keamanan akun</h2>
            <p>
              Ganti password awal sebelum hosting publik. Akun dan seluruh
              catatan tetap sama.
            </p>
            <Button onClick={() => open({ type: "password" })}>
              <LockKeyhole size={16} />
              Ganti password
            </Button>
            <div className="divider" />
            <Button
              variant="danger"
              onClick={() => open({ type: "delete-user" })}
            >
              <Trash2 size={16} />
              Hapus akun & catatan
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
function Manage({ table }: { table: "accounts" | "categories" | "tags" }) {
  const { s, open, data } = useApp();
  return (
    <Card>
      <div className="card-head">
        <h2>
          {table === "accounts"
            ? "Sumber uang"
            : table === "categories"
              ? "Kategori"
              : "Label"}
        </h2>
        <Button variant="subtle" onClick={() => open({ type: table, table })}>
          <Plus size={16} />
          Tambah
        </Button>
      </div>
      {s[table].map((x) => (
        <div className="manage-row" key={x.id}>
          <span
            className={
              "metric-icon " + (x.kind === "income" ? "green" : "purple")
            }
          >
            {table === "accounts" ? <Wallet size={18} /> : <Layers size={18} />}
          </span>
          <div>
            <strong>{x.name}</strong>
            <small>
              {table === "accounts"
                ? rup(data.balances[x.id])
                : x.kind
                  ? kinds[x.kind]
                  : "Label lintas transaksi"}
              {x.archived ? " · Arsip" : ""}
            </small>
          </div>
          <Button
            variant="icon"
            aria-label={"Edit " + x.name}
            onClick={() => open({ type: table, table, id: x.id })}
          >
            <Pencil size={16} />
          </Button>
        </div>
      ))}
    </Card>
  );
}

function Editor({ spec, close }: { spec: ModalSpec; close: () => void }) {
  const { s, data, mutate, api, refresh, notify } = useApp(),
    dialog = useRef<HTMLDialogElement>(null);
  const id = spec.id || "",
    type = spec.type;
  const tx = s.transactions.find((x) => x.id === id);
  const [kind, setKind] = useState(tx?.kind || "expense");
  const item = ["accounts", "categories", "tags"].includes(type)
    ? s[type as "accounts" | "categories" | "tags"].find((x) => x.id === id)
    : undefined;
  const budget = s.budgets.find((x) => x.id === id);
  const plan = s.plans.find((x) => x.id === id);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const title =
    type === "transaction"
      ? id
        ? "Edit transaksi"
        : "Catat transaksi"
      : type === "budget"
        ? id
          ? "Edit anggaran"
          : "Buat anggaran"
        : type === "restore"
          ? "Pulihkan backup"
          : type === "password"
            ? "Ganti password"
            : type === "delete-user"
              ? "Hapus akun"
              : type === "plan-edit"
                ? "Edit alokasi draft"
                : type === "plan-apply"
                  ? "Terapkan rencana"
                  : (id ? "Edit " : "Tambah ") +
                    (
                      {
                        accounts: "sumber uang",
                        categories: "kategori",
                        tags: "label",
                      } as Record<string, string>
                    )[type];
  async function submit(f: FormData) {
    const v = Object.fromEntries(f);
    if (deleting) {
      await mutate(
        type === "transaction" ? "delete-transaction" : "delete-item",
        type === "transaction"
          ? { id }
          : { id, table: type === "budget" ? "budgets" : type },
      );
      return;
    }
    if (type === "transaction") {
      await mutate("transaction", {
        ...v,
        id,
        kind,
        amount: Number(v.amount),
        tags: f.getAll("tags"),
      });
      return;
    }
    if (["accounts", "categories", "tags"].includes(type)) {
      await mutate(type, {
        ...v,
        id,
        opening: Number(v.opening),
        archived: f.has("archived"),
      });
      return;
    }
    if (type === "budget") {
      await mutate("budget", {
        ...v,
        id,
        limit: Number(v.limit),
        categories: f.getAll("categories"),
        tags: f.getAll("tags"),
      });
      return;
    }
    if (type === "plan-edit") {
      await mutate("edit-plan", {
        id,
        allocations: plan!.allocations.map((x) => ({
          category: x.category,
          amount: Number(f.get(x.category)),
        })),
      });
      return;
    }
    if (type === "plan-apply") {
      await mutate("apply-plan", { id });
      return;
    }
    if (type === "password") {
      await api("password", { current: v.current, password: v.password });
      close();
      notify("Password berhasil diubah.");
      return;
    }
    if (type === "delete-user") {
      await api("delete-user", { password: v.password });
      location.reload();
      return;
    }
    if (type === "restore") {
      const file = f.get("file") as File;
      if (file.size > 8 * 1024 * 1024) throw Error("Backup maksimal 8 MB.");
      await api("restore", {
        password: v.password,
        backup: JSON.parse(await file.text()),
        revision: data.revision,
        key: crypto.randomUUID(),
      });
      await refresh();
      close();
      notify("Data dipulihkan. Pengingat dan AI dinonaktifkan.");
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const r = dialog.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">RUANG CATATAN ANDA</span>
          <h2>{deleting ? "Konfirmasi penghapusan" : title}</h2>
        </div>
        <Button variant="icon" aria-label="Tutup dialog" onClick={close}>
          <X size={20} />
        </Button>
      </div>
      <SimpleForm onSave={submit}>
        {deleting ? (
          <Notice warn>
            {type === "transaction" && tx ? (
              <>
                Hapus transaksi <strong>{tx.note || kinds[tx.kind]}</strong> pada{" "}
                {tx.date} sebesar <strong>{rup(tx.amount)}</strong>? Saldo dan
                laporan akan dihitung ulang. Tindakan ini tidak dapat dibatalkan
                dari aplikasi; unduh backup terlebih dahulu bila ragu.
              </>
            ) : (
              <>Hapus data ini? Data yang sudah digunakan harus diarsipkan agar riwayat tetap utuh.</>
            )}
          </Notice>
        ) : (
          <>
            {type === "transaction" && (
              <>
                <div className="form-grid">
                  <label className="field">
                    Jenis transaksi
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      {Object.entries(kinds).map(([v, n]) => (
                        <option key={v} value={v}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Nominal (Rp)"
                    name="amount"
                    type="number"
                    step={1}
                    min={kind === "adjustment" ? -1000000000000 : 1}
                    max={1000000000000}
                    defaultValue={tx?.amount}
                    placeholder="0"
                    required
                  />
                  <Field
                    label="Tanggal transaksi"
                    name="date"
                    type="date"
                    defaultValue={tx?.date || spec.date || data.today}
                    max={data.today}
                    required
                  />
                  <label className="field">
                    Sumber uang
                    <SelectItems
                      table="accounts"
                      name="account"
                      value={tx?.account}
                      required
                    />
                  </label>
                </div>
                {["income", "expense"].includes(kind) && (
                  <label className="field">
                    Kategori
                    <SelectItems
                      key={kind}
                      table="categories"
                      name="category"
                      value={tx?.kind === kind ? tx.category : ""}
                      predicate={(x) => x.kind === kind}
                      required
                    />
                  </label>
                )}
                {kind === "transfer" && (
                  <label className="field">
                    Akun tujuan
                    <SelectItems
                      table="accounts"
                      name="target"
                      value={tx?.target}
                      required
                    />
                  </label>
                )}
                {kind === "refund" && (
                  <label className="field">
                    Pengeluaran asal
                    <select
                      name="original"
                      defaultValue={tx?.original}
                      required
                    >
                      <option value="">Pilih pengeluaran</option>
                      {s.transactions
                        .filter((t) => t.kind === "expense")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.date} ·{" "}
                            {t.note || name(s, "categories", t.category)} ·{" "}
                            {rup(t.amount)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  {kind === "adjustment"
                    ? "Alasan penyesuaian (wajib)"
                    : "Catatan (opsional)"}
                  <textarea
                    name="note"
                    defaultValue={tx?.note}
                    rows={3}
                    maxLength={500}
                    required={kind === "adjustment"}
                    placeholder="Misalnya: makan siang atau perjalanan ke kantor"
                  />
                </label>
                <label className="field">Label opsional</label>
                <Checks table="tags" selected={tx?.tags} />
                {kind === "transfer" && (
                  <Notice>
                    Transfer tidak dihitung sebagai pengeluaran. Catat biaya
                    admin sebagai pengeluaran terpisah.
                  </Notice>
                )}
              </>
            )}
            {["accounts", "categories", "tags"].includes(type) && (
              <>
                <Field
                  label="Nama"
                  name="name"
                  defaultValue={item?.name}
                  maxLength={120}
                  required
                />
                {type === "accounts" && (
                  <>
                    <label className="field">
                      Tipe sumber uang
                      <select name="kind" defaultValue={item?.kind || "cash"}>
                        <option value="cash">Tunai</option>
                        <option value="bank">Bank</option>
                        <option value="ewallet">E-wallet</option>
                      </select>
                    </label>
                    <Field
                      label="Saldo awal (Rp)"
                      name="opening"
                      type="number"
                      step={1}
                      defaultValue={item?.opening || 0}
                      required
                    />
                    <Field
                      label="Tanggal saldo awal"
                      name="opening_date"
                      type="date"
                      defaultValue={item?.opening_date || data.today}
                      max={data.today}
                      required
                    />
                    <Notice>
                      Saldo awal tidak masuk laporan pendapatan. Gunakan
                      penyesuaian untuk koreksi saldo yang membutuhkan alasan.
                    </Notice>
                  </>
                )}
                {type === "categories" && (
                  <label className="field">
                    Jenis
                    <select name="kind" defaultValue={item?.kind || "expense"}>
                      <option value="expense">Pengeluaran</option>
                      <option value="income">Pendapatan</option>
                    </select>
                  </label>
                )}
                {id && (
                  <label className="checkline">
                    <input
                      name="archived"
                      type="checkbox"
                      defaultChecked={item?.archived}
                    />
                    Arsipkan dari pilihan baru
                  </label>
                )}
              </>
            )}
            {type === "budget" && (
              <>
                <Field
                  label="Nama anggaran"
                  name="name"
                  defaultValue={budget?.name}
                  required
                  maxLength={120}
                />
                <div className="form-grid">
                  <Field
                    label="Mulai periode"
                    name="start"
                    type="date"
                    defaultValue={
                      budget?.start || data.today.slice(0, 7) + "-01"
                    }
                    required
                  />
                  <Field
                    label="Akhir periode"
                    name="end"
                    type="date"
                    defaultValue={budget?.end || data.today}
                    required
                  />
                </div>
                <Field
                  label="Batas anggaran (Rp)"
                  name="limit"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={budget?.limit}
                  required
                />
                <label className="field">Kategori (kosong = semua)</label>
                <Checks
                  table="categories"
                  expenses
                  selected={budget?.categories}
                />
                <label className="field">Label (kosong = semua)</label>
                <Checks table="tags" selected={budget?.tags} />
              </>
            )}
            {type === "plan-edit" && (
              <>
                <Notice>
                  {plan?.kind === "budget"
                    ? "Total alokasi harus tetap " + rup(plan.available)
                    : "Total potensi penghematan harus tetap " +
                      rup(plan?.target)}
                </Notice>
                {plan?.allocations.map((x) => (
                  <Field
                    key={x.category}
                    label={name(s, "categories", x.category) + " (Rp)"}
                    name={x.category}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={x.amount}
                    required
                  />
                ))}
              </>
            )}
            {type === "plan-apply" && (
              <Notice warn>
                Setiap alokasi akan menjadi anggaran baru. Pastikan tidak
                tumpang tindih dengan anggaran yang sudah Anda buat. Draft
                diperiksa ulang sebelum diterapkan.
              </Notice>
            )}
            {type === "restore" && (
              <>
                <Notice warn>
                  Seluruh catatan akun aktif akan diganti. Salinan sebelum
                  perubahan disimpan; izin email dan AI dinonaktifkan.
                </Notice>
                <Field
                  label="File backup JSON"
                  name="file"
                  type="file"
                  accept=".json,application/json"
                  required
                />
                <Field
                  label="Konfirmasi password"
                  name="password"
                  type="password"
                  required
                />
              </>
            )}
            {type === "password" && (
              <>
                <Field
                  label="Password saat ini"
                  name="current"
                  type="password"
                  required
                  autoComplete="current-password"
                />
                <Field
                  label="Password baru"
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={256}
                  required
                  autoComplete="new-password"
                />
              </>
            )}
            {type === "delete-user" && (
              <>
                <Notice warn>
                  Akun dan seluruh catatannya akan dihapus. Unduh backup sebelum
                  melanjutkan; salinan yang sudah diunduh tidak ikut dihapus.
                </Notice>
                <Field
                  label="Konfirmasi password"
                  name="password"
                  type="password"
                  required
                />
              </>
            )}
          </>
        )}
        <div className="modal-actions">
          <Button onClick={deleting ? () => setDeleting(false) : close}>
            Batal
          </Button>
          <Button
            type="submit"
            variant={deleting || type === "delete-user" ? "danger" : "primary"}
          >
            {deleting
              ? type === "transaction"
                ? "Ya, hapus transaksi"
                : "Hapus data"
              : type === "plan-apply"
                ? "Setujui & terapkan"
                : type === "delete-user"
                  ? "Hapus permanen"
                  : type === "restore"
                    ? "Pulihkan data"
                    : "Simpan"}
            <Check size={17} />
          </Button>
        </div>
        {id &&
          ["transaction", "accounts", "categories", "tags", "budget"].includes(
            type,
          ) &&
          !deleting && (
            <button
              className="delete-link"
              type="button"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={15} />
              Hapus {type === "transaction" ? "transaksi" : "data ini"}
            </button>
          )}
      </SimpleForm>
    </dialog>
  );
}
const rootElement = document.getElementById("root");
if (rootElement) createRoot(rootElement).render(<App />);
