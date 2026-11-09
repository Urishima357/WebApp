import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { flushSync } from "react-dom";
import { StoreProvider, useCan, useStore } from "./store.tsx";
import {
  Button,
  Badge,
  DemoNote,
  Empty,
  ErrorMessage,
  FormModal,
  Icon,
  Page,
  Panel,
  Photo,
  go,
  href,
  useAction,
} from "../components/ui.tsx";
import {
  dateLabel,
  localDay,
  money,
  permitted,
  stockStatus,
  total,
  woStatuses,
} from "../lib/domain.ts";
import { Workshop } from "../features/Workshop.tsx";
import { Showroom, VehicleEditor } from "../features/Showroom.tsx";
import {
  Inventory,
  ItemEditor,
  Purchasing,
  Suppliers,
} from "../features/Inventory.tsx";
import { Customers } from "../features/Customers.tsx";
import {
  Transactions,
  Checkout,
  PointOfSale,
  Invoice,
  Controls,
} from "../features/Transactions.tsx";
import {
  Reports,
  AuditPage,
  Settings,
  Users,
  MasterData,
  SystemStates,
} from "../features/Administration.tsx";

const nav = [
  { path: "/ringkasan", label: "Ringkasan", icon: "grid", permission: "owner" },
  {
    path: "/bengkel",
    label: "Bengkel",
    icon: "wrench",
    permission: "workshop",
  },
  { path: "/motor", label: "Motor", icon: "motor", permission: "showroom" },
  { path: "/stok", label: "Stok", icon: "box", permission: "inventory.read" },
  {
    path: "/transaksi",
    label: "Transaksi",
    icon: "receipt",
    permission: "transactions",
  },
  {
    path: "/pelanggan",
    label: "Pelanggan",
    icon: "users",
    permission: "customers",
  },
  {
    path: "/supplier",
    label: "Supplier",
    icon: "truck",
    permission: "suppliers",
  },
  {
    path: "/penerimaan",
    label: "Barang masuk",
    icon: "receive",
    permission: "receipt.create",
  },
  { path: "/laporan", label: "Laporan", icon: "chart", permission: "owner" },
  {
    path: "/kontrol",
    label: "Persetujuan",
    icon: "shield",
    permission: "owner",
  },
  {
    path: "/audit",
    label: "Audit aktivitas",
    icon: "clock",
    permission: "owner",
  },
  {
    path: "/pengaturan",
    label: "Pengaturan",
    icon: "settings",
    permission: "owner",
  },
];
function useRoute() {
  const [path, setPath] = useState(
    () => location.hash.slice(1) || "/ringkasan",
  );
  useEffect(() => {
    let transition: ViewTransition | undefined;
    let previous = location.hash.slice(1) || "/ringkasan";
    const change = () => {
      transition?.skipTransition();
      const next = location.hash.slice(1) || "/ringkasan";
      const photo = (previous === "/motor" && /^\/motor\/[^/]+$/.test(next)) ||
        (next === "/motor" && /^\/motor\/[^/]+$/.test(previous));
      previous = next;
      document.documentElement.dataset.navigation = photo ? "photo" : "page";
      const update = () => {
        flushSync(() => setPath(next));
        window.scrollTo(0, 0);
      };
      if (
        photo && document.startViewTransition &&
        !document.hidden &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        transition = document.startViewTransition(update);
        const current = transition;
        void current.finished.finally(() => { if (transition === current) transition = undefined; });
      } else update();
    };
    window.addEventListener("hashchange", change);
    return () => {
      window.removeEventListener("hashchange", change);
      transition?.skipTransition();
    };
  }, []);
  return path;
}
export default function App() {
  return (
    <StoreProvider>
      <Application />
    </StoreProvider>
  );
}
function Application() {
  const { user, state, logout, message, notify, storageError } = useStore();
  const path = useRoute();
  const [menu, setMenu] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [account, setAccount] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!menu) return;
    const desktop = matchMedia("(min-width: 761px)");
    const resize = () => { if (desktop.matches) setMenu(false); };
    desktop.addEventListener("change", resize);
    const first = sidebar.current?.querySelector<HTMLAnchorElement>("a");
    const focus = () => {
      if (!sidebar.current?.contains(document.activeElement)) first?.focus({ preventScroll: true });
    };
    focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        flushSync(() => setMenu(false));
        menuTrigger.current?.focus();
      }
      if (e.key !== "Tab") return;
      const controls = sidebar.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!controls?.length) return;
      const end = controls[controls.length - 1];
      if (!sidebar.current?.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? end : controls[0]).focus();
      } else if (e.shiftKey && document.activeElement === controls[0]) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", key);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", key);
      document.body.classList.remove("nav-open");
      desktop.removeEventListener("change", resize);
    };
  }, [menu]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  if (!user || path === "/masuk") return <Login />;
  const allowed = nav.filter((n) =>
    n.permission === "owner"
      ? user.role === "Owner"
      : n.permission === "transactions"
        ? permitted(user, "transactions.service") ||
          permitted(user, "transactions.motor")
        : permitted(user, n.permission),
  );
  const root = "/" + path.split("?")[0].split("/")[1];
  const protectedEntry = nav.find((n) => n.path === root);
  const access = !protectedEntry || allowed.some((n) => n.path === root);
  let content;
  if (!access)
    content = (
      <Page title="Akses dibatasi">
        <Empty
          title="Halaman ini bukan untuk akun Anda"
          description="Gunakan menu yang tersedia atau masuk dengan akun demo lain."
          action={<Button onClick={logout}>Ganti akun demo</Button>}
        />
      </Page>
    );
  else if (path === "/ringkasan") content = <Dashboard />;
  else if (root === "/bengkel") content = <Workshop path={path} />;
  else if (path === "/motor/baru" || /\/motor\/[^/]+\/edit$/.test(path))
    content = (
      <VehicleEditor
        id={path.split("/")[2] === "baru" ? undefined : path.split("/")[2]}
      />
    );
  else if (root === "/motor") content = <Showroom path={path} />;
  else if (path === "/stok/baru" || /\/stok\/[^/]+\/edit$/.test(path))
    content = (
      <ItemEditor
        id={path.split("/")[2] === "baru" ? undefined : path.split("/")[2]}
      />
    );
  else if (root === "/stok") content = <Inventory path={path} />;
  else if (root === "/supplier") content = <Suppliers />;
  else if (root === "/penerimaan") content = <Purchasing path={path} />;
  else if (root === "/pelanggan") content = <Customers path={path} />;
  else if (root === "/transaksi") content = <Transactions path={path} />;
  else if (root === "/kasir") content = <PointOfSale />;
  else if (root === "/pembayaran")
    content = <Checkout id={path.split("/")[2]} />;
  else if (root === "/nota") content = <Invoice id={path.split("/")[2]} />;
  else if (root === "/kontrol") content = <Controls />;
  else if (root === "/laporan") content = <Reports />;
  else if (root === "/audit") content = <AuditPage />;
  else if (path === "/pengaturan/pengguna") content = <Users />;
  else if (path === "/pengaturan/master") content = <MasterData />;
  else if (root === "/pengaturan") content = <Settings />;
  else if (root === "/notifikasi") content = <Notifications />;
  else if (root === "/status") content = <SystemStates />;
  else if (root === "/lainnya")
    content = (
      <Page title="Lainnya">
        <div className="more-menu">
          {allowed.map((n) => (
            <a key={n.path} href={href(n.path)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              <Icon name="chevron" size={17} />
            </a>
          ))}
          <Button variant="ghost" icon="logout" onClick={logout}>
            Keluar akun demo
          </Button>
        </div>
      </Page>
    );
  else
    content = (
      <Page title="Halaman tidak ditemukan">
        <Empty
          action={
            <Button onClick={() => go("/ringkasan")}>Ke ringkasan</Button>
          }
        />
      </Page>
    );
  const mobile =
    user.role === "Owner"
      ? ["/ringkasan", "/bengkel", "/motor"]
      : user.role === "Staf Showroom"
        ? ["/motor", "/transaksi", "/pelanggan"]
        : user.role === "Staf Gudang"
          ? ["/stok", "/penerimaan", "/supplier"]
          : ["/bengkel", "/stok", "/transaksi"];
  const taskView =
    /\/(baru|edit)$/.test(path) ||
    ["/pembayaran", "/nota", "/kasir"].includes(root);
  return (
    <div className={`app-shell atelier ${taskView ? "task-view" : ""}`}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Lewati ke konten
      </a>
      <button
        className={`nav-scrim ${menu ? "open" : ""}`}
        aria-label="Tutup navigasi"
        tabIndex={-1}
        aria-hidden={!menu}
        onClick={() => {
          flushSync(() => setMenu(false));
          menuTrigger.current?.focus();
        }}
      />
      <aside id="sidebar" ref={sidebar} className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href={href(allowed[0]?.path || "/lainnya")} onClick={() => setMenu(false)}>
          <img className="brand-emblem" src="/brand/emblem.png" width="48" height="48" alt="" />
          <span>
            {state.settings.name}
            <small>Bengkel & showroom · Priok</small>
          </span>
        </a>
        <nav aria-label="Navigasi utama">
          <div className="nav-primary">
            {allowed.filter((n) => ["/ringkasan", "/bengkel", "/motor", "/stok", "/transaksi", "/pelanggan"].includes(n.path)).map((n) => (
              <a
                key={n.path}
                className={root === n.path ? "selected" : ""}
                href={href(n.path)}
                onClick={() => setMenu(false)}
                aria-current={root === n.path ? "page" : undefined}
              >
                <Icon name={n.icon} size={22} />
                <span>{n.label}</span>
              </a>
            ))}
          </div>
          <span className="nav-caption">Kelola garasi</span>
          {allowed.filter((n) => !["/ringkasan", "/bengkel", "/motor", "/stok", "/transaksi", "/pelanggan"].includes(n.path)).map((n) => (
            <a
              key={n.path}
              className={root === n.path ? "selected" : ""}
              href={href(n.path)}
              onClick={() => setMenu(false)}
              aria-current={root === n.path ? "page" : undefined}
            >
              <Icon name={n.icon} size={22} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-pill">Demo lokal</div>
          <button className="account" onClick={() => setAccount(true)}>
            <span className="avatar">
              {user.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span>
              {user.name}
              <small>{user.role}</small>
            </span>
            <Icon name="more" size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace" inert={menu}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-only"
              ref={menuTrigger}
              onClick={() => setMenu(true)}
              aria-label="Buka menu"
              aria-expanded={menu}
              aria-controls="sidebar"
            >
              <Icon name="menu" />
            </button>
            <span className="mobile-brand">
              Garasi Hobby <span className="topbar-divider">/</span>{" "}
              <strong>
                {nav.find((n) => n.path === root)?.label || "Operasional"}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="sample-indicator">Data contoh</span>
            <a
              className="icon-button notification-button"
              href={href("/notifikasi")}
              aria-label="Buka notifikasi stok"
            >
              <Icon name="bell" />
              {state.items.some((i) => i.active && ["Menipis", "Habis"].includes(stockStatus(state, i))) && <i aria-hidden="true" />}
            </a>
            <button
              className="avatar small"
              aria-label="Akun demo"
              onClick={() => setAccount(true)}
            >
              {user.name[0]}
            </button>
          </div>
        </header>
        {(offline || storageError) && (
          <div className="global-notice" role="alert">
            <Icon name="alert" size={18} />
            {offline
              ? "Koneksi terputus. Formulir tetap tersedia; perubahan belum dapat disimpan."
              : storageError}
          </div>
        )}
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div key={path} className="route-view">{content}</div>
          <DemoNote />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navigasi mobile" inert={menu} style={{ "--active-nav": mobile.includes(root) ? mobile.indexOf(root) : 3 } as CSSProperties}>
        {mobile.map((p) => {
          const n = nav.find((x) => x.path === p)!;
          return (
            <a
              key={p}
              href={href(p)}
              className={root === p ? "selected" : ""}
              aria-current={root === p ? "page" : undefined}
            >
              <Icon name={n.icon} />
              <span>{p === "/ringkasan" ? "Beranda" : n.label}</span>
            </a>
          );
        })}
        <a
          href={href("/lainnya")}
          className={path === "/lainnya" ? "selected" : ""}
        >
          <Icon name="more" />
          <span>Lainnya</span>
        </a>
      </nav>
      {message && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Tutup pesan"
            onClick={() => notify("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {account && (
        <FormModal
          title="Akun demo"
          onClose={() => setAccount(false)}
          submit="Keluar akun"
          onSubmit={() => logout()}
        >
          <div className="account-card">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <strong>{user.name}</strong>
              <p>{user.role}</p>
            </div>
          </div>
          <p className="muted">
            Akun ini hanya simulasi tampilan. Data browser bukan penyimpanan
            aman.
          </p>
        </FormModal>
      )}
    </div>
  );
}
function Login() {
  const { state, login } = useStore();
  const [username, setUsername] = useState("arif");
  const { error, action } = useAction();
  useEffect(() => { document.title = "Masuk | Garasi Hobby"; }, []);
  return (
    <main className="login-screen atelier">
      <div className="login-form-side">
        <a className="brand dark" href="#/masuk">
          <img className="brand-emblem" src="/brand/emblem.png" width="48" height="48" alt="" />
          <span>
            Garasi Hobby<small>Bengkel & showroom · Priok</small>
          </span>
        </a>
        <div className="login-form">
          <h1>Masuk ke garasi</h1>
          <p className="muted">Bengkel, showroom, dan tim dalam satu tempat.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(() => login(username));
            }}
          >
            <label className="field">
              <span>Akun demo</span>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              >
                {state.users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.name} ({u.role})
                    </option>
                  ))}
              </select>
            </label>
            <ErrorMessage error={error} />
            <Button type="submit" className="full">
              Masuk demo
            </Button>
          </form>
          <p className="login-disclaimer">
            Tanpa kredensial nyata. Autentikasi server belum terhubung.
          </p>
        </div>
        <footer className="login-footer">
          Garasi Hobby · Sistem operasional internal
        </footer>
      </div>
      <div className="login-photo">
        <Photo
          src="/images/workshop.jpg"
          alt="Motor custom, foto referensi demo, bukan inventaris nyata"
          priority
        />
        <div className="login-photo-caption">
          <span>Garasi Hobby · Priok</span>
          <h2>Setiap motor<br />punya cerita.</h2>
          <small>Foto referensi atelier, bukan inventaris nyata.</small>
        </div>
      </div>
    </main>
  );
}
function Dashboard() {
  const { state } = useStore();
  const [period, setPeriod] = useState("today");
  const revenueDetails = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 761px)");
    const update = () => { if (revenueDetails.current) revenueDetails.current.open = desktop.matches; };
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);
  const today = localDay();
  const tx = state.transactions.filter(
    (t) =>
      t.status === "Final" &&
      t.paymentStatus === "Paid" &&
      (period === "all" || localDay(new Date(t.paidAt)) === today),
  );
  const revenue = tx.reduce((n, t) => n + total(t), 0);
  const active = state.workOrders.filter(
    (w) => !["Selesai", "Dibatalkan"].includes(w.status),
  );
  const low = state.items.filter(
    (i) => i.active && ["Menipis", "Habis"].includes(stockStatus(state, i)),
  );
  const counts = woStatuses
    .filter((s) => !["Draft", "Selesai", "Dibatalkan"].includes(s))
    .map((s) => ({
      name: s,
      count: active.filter((w) => w.status === s).length,
    }));
  return (
    <Page
      title="Ringkasan"
      subtitle={dateLabel(new Date().toISOString())}
      action={
        <>
          <select
            aria-label="Periode pendapatan"
            className="compact-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Hari ini</option>
            <option value="all">Semua periode</option>
          </select>
          <a href={href("/bengkel/baru")} className="button primary">
            <Icon name="plus" size={18} />
            Buat WO
          </a>
        </>
      }
    >
      <section className="revenue-panel" aria-label="Pendapatan demo">
        <div className="revenue-top">
          <span>Total pendapatan {period === "today" ? "hari ini" : "semua periode"}</span>
          <span className="subtle-label">Data demo · transaksi final & lunas</span>
        </div>
        <div className="revenue-amount">{money(revenue)}</div>
        <details ref={revenueDetails} className="revenue-details">
          <summary>Rincian pendapatan<Icon name="down" size={16} /></summary>
        <div className="revenue-breakdown">
          {(["Servis", "Barang", "Motor"] as const).map((k) => (
            <div key={k}>
              <span>
                {k === "Servis"
                  ? "Bengkel"
                  : k === "Barang"
                    ? "Penjualan barang"
                    : "Penjualan motor"}
              </span>
              <strong>
                {money(
                  tx
                    .filter((t) => t.kind === k)
                    .reduce((n, t) => n + total(t), 0),
                )}
              </strong>
            </div>
          ))}
        </div>
        </details>
      </section>
      <div className="attention-strip">
        <span>Pembayaran</span>
        <div>
          {(["Pending", "Failed", "Expired"] as const).map((status) => (
            <a key={status} className={`payment-count payment-${status.toLowerCase()}`} href={href(`/laporan?status=${status}`)}>
              {status === "Failed"
                ? "Gagal"
                : status === "Expired"
                  ? "Kedaluwarsa"
                  : "Pending"}{" "}
              <b>
                {
                  state.transactions.filter(
                    (t) => t.status !== "Batal" && t.paymentStatus === status,
                  ).length
                }
              </b>
            </a>
          ))}
          <a className="payment-count payment-refund" href={href("/kontrol")}>
            Refund{" "}
            <b>
              {
                state.refunds.filter((r) => r.status === "Refund Pending")
                  .length
              }
            </b>
          </a>
        </div>
        <a href={href("/laporan")} className="text-link">
          Periksa pembayaran
        </a>
      </div>
       <div className="dashboard-layout">
      <Panel
        className="workbench-jobs"
        title="Servis aktif"
        action={
          <a className="text-link" href={href("/bengkel")}>
            Semua WO ({active.length})
          </a>
        }
      >
        <div className="status-summary">
          {counts.map((c) => (
            <a
              key={c.name}
              href={href(`/bengkel?status=${encodeURIComponent(c.name)}`)}
            >
              {c.name}
              <b>{c.count}</b>
            </a>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                 <th className="hide-mobile">No. WO</th>
                 <th>Model motor</th>
                 <th className="hide-mobile">Pelat</th>
                 <th className="hide-mobile">Pelanggan</th>
                 <th className="hide-mobile">Mekanik</th>
                <th>Status</th>
                <th className="table-end" scope="col">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {active.slice(0, 3).map((w) => {
                const v = state.vehicles.find((v) => v.id === w.vehicleId)!;
                return (
                  <tr key={w.id}>
                    <td className="hide-mobile"><a className="document-link" href={href(`/bengkel/${w.id}`)}>{w.id}</a></td>
                    <td>
                      <a
                        className="vehicle-cell"
                        href={href(`/bengkel/${w.id}`)}
                      >
                        <span className="plate mobile-plate">
                          {v.plate || "Tanpa pelat"}
                        </span>
                        <span>
                          {v.brand} {v.model}
                        </span>
                      </a>
                    </td>
                    <td className="hide-mobile"><span className="plate">{v.plate || "Tanpa pelat"}</span></td>
                    <td className="hide-mobile">
                      {state.customers.find((c) => c.id === w.customerId)?.name}
                    </td>
                    <td className="hide-mobile">
                      {state.mechanics.find((m) => m.id === w.mechanic)?.name}
                    </td>
                    <td>
                      <Badge>{w.status}</Badge>
                    </td>
                    <td className="table-end">
                      <a
                        className="icon-button"
                        href={href(`/bengkel/${w.id}`)}
                        aria-label={`Buka ${w.id}`}
                      >
                        <Icon name="chevron" size={17} />
                      </a>
                    </td>
                  </tr>
                );
              })}
              {!active.length && (
                <tr><td colSpan={7}><Empty title="Tidak ada servis aktif" description="Pekerjaan selesai atau belum ada motor masuk." action={<Button onClick={() => go("/bengkel/baru")}>Terima motor</Button>} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="workbench-showroom" title="Unit showroom" action={<a className="text-link" href={href("/motor")}>Inventaris motor</a>}>
        <div className="showroom-module">
          <a className="showroom-preview" href={href("/motor")} aria-label="Buka inventaris motor">
            <Photo src="/images/w175.jpg" alt="Motor custom, foto referensi demo" />
          </a>
          <div className="showroom-module-data">
            <div className="showroom-counts">
              {["Tersedia", "Reserved", "Terjual"].map((s) => (
                <a key={s} href={href(`/motor?status=${s}`)}>
                  <strong>{state.vehicles.filter((v) => v.showroom && v.status === s).length}</strong>
                  <span>{s}</span>
                </a>
              ))}
            </div>
            <small>Inventaris demo · foto referensi</small>
          </div>
        </div>
      </Panel>
        <Panel
          className="workbench-stock"
          title="Peringatan stok"
          action={
            <a className="text-link" href={href("/stok")}>
              Buka stok
            </a>
          }
        >
          <div className="low-stock-list">
            {low.map((i) => (
              <a href={href(`/stok/${i.id}`)} key={i.id}>
                <span className="stock-item-name">
                  <strong>{i.name}</strong>
                  <small>
                    Minimum {i.minimum} {i.unit}
                  </small>
                </span>
                <span
                  className={
                    stockStatus(state, i) === "Habis"
                      ? "danger-text"
                      : "amber-text"
                  }
                >
                  {stockStatus(state, i) === "Habis"
                    ? "Habis"
                    : `Sisa ${state.movements.filter((m) => m.itemId === i.id).reduce((n, m) => n + m.qty, 0)} ${i.unit}`}
                </span>
              </a>
            ))}
            {!low.length && (
              <Empty
                title="Stok aman"
                description="Tidak ada barang di bawah minimum."
              />
            )}
          </div>
          <p className="stock-footer">Saldo mengikuti pergerakan barang.</p>
        </Panel>
      </div>
    </Page>
  );
}
function Notifications() {
  const { state } = useStore();
  const can = useCan("inventory.read");
  const low = state.items.filter((i) =>
    ["Menipis", "Habis"].includes(stockStatus(state, i)),
  );
  return (
    <Page title="Notifikasi" back="/lainnya">
      <Panel title="Stok perlu perhatian">
        {can ? (
          low.length ? low.map((i) => (
            <a className="list-row" key={i.id} href={href(`/stok/${i.id}`)}>
              <Icon name="alert" />
              <span>
                <strong>{i.name}</strong>
                <small>
                  {stockStatus(state, i)} · minimum {i.minimum} {i.unit}
                </small>
              </span>
              <Icon name="chevron" />
            </a>
          )) : <Empty title="Tidak ada peringatan stok" description="Semua barang aktif berada di atas batas minimum." />
        ) : (
          <Empty title="Tidak ada notifikasi untuk role ini" />
        )}
      </Panel>
    </Page>
  );
}
