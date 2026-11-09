import { useState } from "react";
import { useCan, useStore, useVisibleTransactions } from "../app/store.tsx";
import {
  Badge,
  Button,
  Empty,
  ErrorMessage,
  Field,
  FormModal,
  Icon,
  LinkButton,
  Page,
  Panel,
  Search,
  Select,
  Tabs,
  href,
  useAction,
  useUnsaved,
} from "../components/ui.tsx";
import {
  balance,
  dateLabel,
  localDay,
  methods,
  money,
  roles,
  stockStatus,
  total,
  uid,
} from "../lib/domain.ts";
import type {
  Method,
  NamedRecord,
  Role,
  Service,
  Settings as SettingsType,
  User,
} from "../lib/domain.ts";

export function Reports() {
  const { state } = useStore();
  const rows = useVisibleTransactions();
  const [tab, setTab] = useState("transactions");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState(
    new URLSearchParams(location.hash.split("?")[1]).get("status") || "",
  );
  const owner = useCan("settings");
  if (!owner) return <Empty title="Laporan finansial hanya untuk owner" />;
  const within = (date: string) =>
    (!from || localDay(new Date(date)) >= from) &&
    (!to || localDay(new Date(date)) <= to);
  const filtered = rows.filter(
    (t) =>
      within(t.date) &&
      (!kind || t.kind === kind) &&
      (!status || t.paymentStatus === status) &&
      `${t.id} ${t.reference}`.toLowerCase().includes(q.toLowerCase()),
  );
  const paid = filtered.filter(
    (t) => t.status === "Final" && t.paymentStatus === "Paid",
  );
  return (
    <Page
      title="Laporan operasional"
      subtitle="Ringkasan yang dapat ditelusuri, bukan laporan akuntansi."
    >
      <div className="report-filter">
        <Search value={q} onChange={setQ} placeholder="Cari nomor referensi" />
        <Field
          label="Dari tanggal"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Field
          label="Sampai tanggal"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            setFrom("");
            setTo("");
            setStatus("");
            setKind("");
          }}
        >
          Reset
        </Button>
      </div>
      <Tabs
        options={[
          { id: "transactions", label: "Transaksi" },
          { id: "reconciliation", label: "Rekonsiliasi" },
          { id: "stock", label: "Stok" },
          { id: "receipt", label: "Barang masuk" },
          { id: "usage", label: "Pemakaian" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {["transactions", "reconciliation"].includes(tab) && (
        <>
          <div className="report-metrics">
            <Panel>
              <span>Pendapatan final</span>
              <strong className="stat-money">
                {money(paid.reduce((n, t) => n + total(t), 0))}
              </strong>
              <small>{paid.length} transaksi lunas</small>
            </Panel>
            <Panel>
              <span>Menunggu pembayaran</span>
              <strong className="stat-number">
                {
                  filtered.filter(
                    (t) =>
                      t.status !== "Batal" && t.paymentStatus === "Pending",
                  ).length
                }
              </strong>
              <small>Tidak termasuk pendapatan</small>
            </Panel>
            <Panel>
              <span>Refund tertunda</span>
              <strong className="stat-money">
                {money(
                  state.refunds
                    .filter((r) => r.status === "Refund Pending")
                    .reduce((n, r) => n + r.amount, 0),
                )}
              </strong>
              <small>Catatan pengembalian dana</small>
            </Panel>
          </div>
          <Panel>
            <div className="toolbar">
              <select
                aria-label="Filter domain"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">Semua domain</option>
                <option>Servis</option>
                <option>Barang</option>
                <option>Motor</option>
              </select>
              <select
                aria-label="Status pembayaran"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Semua pembayaran</option>
                {["Pending", "Paid", "Failed", "Expired", "Cancelled"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Transaksi</th>
                    <th>Metode</th>
                    <th>Nominal</th>
                    <th>Status pembayaran</th>
                    <th>
                      {tab === "reconciliation"
                        ? "Verifikator / referensi"
                        : "Status dokumen"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <a
                          className="stack-link"
                          href={href(`/transaksi/${t.id}`)}
                        >
                          <strong>{t.id}</strong>
                          <small>
                            {t.kind} · {dateLabel(t.date)}
                            {t.corrects ? ` · Koreksi ${t.corrects}` : ""}
                          </small>
                        </a>
                      </td>
                      <td>{t.method || "Belum dipilih"}</td>
                      <td>{money(total(t))}</td>
                      <td>
                        <Badge>{t.paymentStatus}</Badge>
                      </td>
                      <td>
                        {tab === "reconciliation" ? (
                          <>
                            <strong>
                              {t.verifier || "Belum diverifikasi"}
                            </strong>
                            <small className="block muted">
                              {t.reference || "Tanpa referensi"} · {dateLabel(t.paidAt, true)}
                            </small>
                          </>
                        ) : (
                          <Badge>{t.status}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && <Empty />}
          </Panel>
        </>
      )}
      {tab === "stock" && (
        <Panel title="Saldo persediaan">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Barang</th>
                  <th>Saldo</th>
                  <th>Modal rata-rata</th>
                  <th>Harga jual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.items
                  .filter((i) =>
                    `${i.name} ${i.sku}`
                      .toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        <a href={href(`/stok/${i.id}`)}>
                          {i.sku} · {i.name}
                        </a>
                      </td>
                      <td>
                        {balance(state, i.id)} {i.unit}
                      </td>
                      <td>{money(i.cost)}</td>
                      <td>{money(i.price)}</td>
                      <td>
                        <Badge>{stockStatus(state, i)}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {tab === "receipt" && (
        <Panel title="Penerimaan supplier">
          {state.receipts
            .filter((r) => within(r.date))
            .map((r) => (
              <a
                className="list-row"
                href={href(`/penerimaan/${r.id}`)}
                key={r.id}
              >
                <span>
                  <strong>{r.id}</strong>
                  <small>
                    {dateLabel(r.date)} ·{" "}
                    {state.suppliers.find((s) => s.id === r.supplierId)?.name}
                  </small>
                </span>
                <strong>
                  {money(r.lines.reduce((n, l) => n + l.qty * l.cost, 0))}
                </strong>
                <Badge>{r.status}</Badge>
              </a>
            ))}
          {!state.receipts.length && <Empty title="Belum ada penerimaan" />}
        </Panel>
      )}
      {tab === "usage" && (
        <Panel title="Pemakaian & pergerakan barang">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Barang</th>
                  <th>Referensi</th>
                  <th>Jumlah</th>
                  <th>Petugas</th>
                </tr>
              </thead>
              <tbody>
                {state.movements
                  .filter(
                    (m) =>
                      within(m.date) &&
                      `${m.ref} ${m.reason}`
                        .toLowerCase()
                        .includes(q.toLowerCase()),
                  )
                  .slice()
                  .reverse()
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{dateLabel(m.date, true)}</td>
                      <td>
                        {state.items.find((i) => i.id === m.itemId)?.name}
                      </td>
                      <td>
                        {m.ref}
                        <small className="block muted">{m.reason}</small>
                      </td>
                      <td>
                        {m.qty > 0 ? "+" : ""}
                        {m.qty}
                      </td>
                      <td>{m.actor}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </Page>
  );
}
export function AuditPage() {
  const { state } = useStore();
  const owner = useCan("settings");
  const [q, setQ] = useState("");
  const [module, setModule] = useState("");
  const [actor, setActor] = useState("");
  const [date, setDate] = useState("");
  if (!owner) return <Empty title="Audit hanya tersedia untuk owner" />;
  const rows = state.audit.filter(
    (a) =>
      (!module || a.module === module) &&
      (!actor || a.actor === actor) &&
      (!date || localDay(new Date(a.date)) === date) &&
      `${a.ref} ${a.action} ${a.detail}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <Page
      title="Audit aktivitas"
      subtitle="Histori tindakan, bukan tempat mengubahnya."
    >
      <Panel>
        <div className="toolbar">
          <Search
            value={q}
            onChange={setQ}
            placeholder="Cari aksi atau referensi"
          />
          <div className="toolbar-filters">
            <select
              aria-label="Modul audit"
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              <option value="">Semua modul</option>
              {[...new Set(state.audit.map((a) => a.module))].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select
              aria-label="Pengguna audit"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            >
              <option value="">Semua pengguna</option>
              {[...new Set(state.audit.map((a) => a.actor))].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              aria-label="Tanggal audit"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="audit-list">
          {rows.map((a) => (
            <details key={a.id} className="audit-event">
              <summary>
                <span className="audit-icon">
                  <Icon name="shield" size={17} />
                </span>
                <span>
                  <strong>{a.action}</strong>
                  <small>
                    {a.actor} · {a.module} · {a.ref}
                  </small>
                </span>
                <time>{dateLabel(a.date, true)}</time>
                <Icon name="down" size={15} />
              </summary>
              <div>
                <p>{a.detail || "Tidak ada catatan tambahan."}</p>
                <small>ID event: {a.id}</small>
              </div>
            </details>
          ))}
        </div>
        {!rows.length && <Empty />}
      </Panel>
      <p className="field-hint">
        Audit demo tersimpan lokal dan bukan bukti audit yang aman. Backend
        perlu mencatat aktivitas secara immutable.
      </p>
    </Page>
  );
}
function downloadBackup() {
  const raw = localStorage.getItem("garasi-hobby-demo-v1") || "{}";
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `garasi-hobby-demo-${localDay()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
export function Settings() {
  const { state, run, notify, reset, storageError } = useStore();
  const owner = useCan("settings");
  const [tab, setTab] = useState("business");
  const [value, setValue] = useState<SettingsType>(
    structuredClone(state.settings),
  );
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { error, action } = useAction();
  useUnsaved(dirty);
  if (!owner) return <Empty title="Pengaturan hanya untuk owner" />;
  const update = (v: Partial<SettingsType>) => {
    setValue({ ...value, ...v });
    setDirty(true);
  };
  return (
    <Page
      title="Pengaturan"
      subtitle="Identitas garasi, cara kerja tim."
      action={
        <>
          <LinkButton secondary to="/pengaturan/master">
            Master data
          </LinkButton>
          <LinkButton secondary to="/pengaturan/pengguna">
            Pengguna & akses
          </LinkButton>
        </>
      }
    >
      <Tabs
        options={[
          { id: "business", label: "Usaha" },
          { id: "payments", label: "Pembayaran" },
          { id: "policy", label: "Kebijakan" },
          { id: "demo", label: "Data demo" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action(() => {
            run({ type: "settings", value });
            setDirty(false);
            notify("Pengaturan tersimpan.");
          });
        }}
      >
        {tab === "business" && (
          <Panel title="Identitas usaha">
            <div className="form-stack narrow">
              <Field
                label="Nama usaha"
                value={value.name}
                onChange={(e) => update({ name: e.target.value })}
                required
                maxLength={100}
              />
              <Field
                label="Alamat pada nota"
                value={value.address}
                onChange={(e) => update({ address: e.target.value })}
                maxLength={500}
              />
              <Field
                label="Kontak"
                value={value.contact}
                onChange={(e) => update({ contact: e.target.value })}
                maxLength={80}
              />
              <Field
                label="Catatan nota"
                value={value.note}
                onChange={(e) => update({ note: e.target.value })}
                maxLength={500}
              />
              <div className="form-grid">
                <Field label="Mata uang" value="IDR (Rupiah)" disabled />
                <Field label="Zona waktu" value="Asia/Jakarta" disabled />
              </div>
              <p className="field-hint">
                Satu lokasi: Priok. Logo mengikuti wordmark desain.
              </p>
            </div>
          </Panel>
        )}
        {tab === "payments" && (
          <Panel title="Metode pembayaran">
            <div className="settings-list">
              {methods.map((m) => (
                <label key={m} className="setting-row">
                  <span className="part-icon">
                    <Icon name="wallet" />
                  </span>
                  <span>
                    <strong>{m}</strong>
                    <small>
                      {["Tunai", "Transfer bank"].includes(m)
                        ? "Konfirmasi manual oleh staf berizin"
                        : "Gateway · belum terhubung"}
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={value.methods.includes(m)}
                    onChange={(e) =>
                      update({
                        methods: e.target.checked
                          ? [...value.methods, m]
                          : value.methods.filter((x) => x !== m),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="notice">
              Provider belum dipilih. QRIS dan e-wallet hanya simulator lokal;
              tidak meminta API key atau mengirim pembayaran.
            </p>
          </Panel>
        )}
        {tab === "policy" && (
          <Panel title="Kontrol operasional">
            <div className="form-grid">
              <Field
                label="Batas diskon staf (%)"
                type="number"
                min={0}
                max={100}
                value={value.discountLimit}
                onChange={(e) =>
                  update({ discountLimit: Number(e.target.value) })
                }
              />
              <Field
                label="Sesi tidak aktif (menit)"
                type="number"
                min={1}
                max={1440}
                value={value.sessionMinutes}
                onChange={(e) =>
                  update({ sessionMinutes: Number(e.target.value) })
                }
              />
              <Field
                label="Ambang kenaikan estimasi (Rp)"
                type="number"
                min={0}
                step={1}
                value={value.estimateAmount}
                onChange={(e) =>
                  update({ estimateAmount: Number(e.target.value) })
                }
              />
              <Field
                label="Ambang kenaikan estimasi (%)"
                type="number"
                min={0}
                max={100}
                value={value.estimatePercent}
                onChange={(e) =>
                  update({ estimatePercent: Number(e.target.value) })
                }
              />
            </div>
            <p className="field-hint">
              Persetujuan ulang diperlukan ketika salah satu ambang kenaikan
              terlewati. Harga satuan tetap mengikuti master.
            </p>
          </Panel>
        )}
        {tab === "demo" ? (
          <Panel title="Penyimpanan browser">
            <p>
              Semua data di aplikasi ini adalah contoh. Jangan memasukkan data
              pribadi, kredensial, atau pembayaran nyata.
            </p>
            <ErrorMessage error={storageError} />
            <div className="inline">
              <Button
                type="button"
                variant="secondary"
                onClick={downloadBackup}
                icon="receipt"
              >
                Unduh cadangan JSON
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirm(true)}
              >
                Reset data demo
              </Button>
            </div>
            <p className="field-hint">
              Reset hanya menghapus data demo aplikasi ini pada browser ini;
              tidak mengubah dokumen proyek atau Stitch.
            </p>
            <LinkButton secondary to="/status">
              Lihat state sistem
            </LinkButton>
          </Panel>
        ) : (
          <>
            <ErrorMessage error={error} />
            <div className="form-actions">
              <span className="muted">
                {dirty ? "Perubahan belum disimpan" : "Pengaturan tersimpan"}
              </span>
              <Button type="submit">Simpan pengaturan</Button>
            </div>
          </>
        )}
      </form>
      {confirm && (
        <FormModal
          title="Reset data demo?"
          danger
          submit="Hapus dan muat contoh awal"
          onClose={() => setConfirm(false)}
          onSubmit={() => {
            reset();
          }}
        >
          <p>
            Semua perubahan lokal Garasi Hobby pada browser ini akan dihapus
            permanen. Unduh cadangan JSON sebelum melanjutkan.
          </p>
          <Field
            label="Ketik RESET untuk mengonfirmasi"
            name="confirmation"
            required
            pattern="RESET"
          />
        </FormModal>
      )}
    </Page>
  );
}
const permissionOptions = [
  { id: "motor.finalize", label: "Finalisasi penjualan motor" },
  { id: "receipt.create", label: "Buat penerimaan barang" },
  { id: "receipt.finalize", label: "Finalisasi penerimaan barang" },
  { id: "inventory.manage", label: "Kelola master barang" },
  { id: "stock.adjust", label: "Penyesuaian stok" },
  { id: "refund.manage", label: "Catat refund" },
  { id: "suppliers", label: "Kelola supplier" },
];
export function Users() {
  const { state, run, notify } = useStore();
  const owner = useCan("settings");
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("Staf Bengkel");
  const [permissions, setPermissions] = useState<string[]>([]);
  if (!owner) return <Empty title="Pengelolaan pengguna hanya untuk owner" />;
  function edit(u: User | null) {
    setEditing(u);
    setRole(u?.role || "Staf Bengkel");
    setPermissions(u?.permissions || []);
    setOpen(true);
  }
  return (
    <Page
      title="Pengguna & akses"
      back="/pengaturan"
      action={
        <Button icon="plus" onClick={() => edit(null)}>
          Tambah pengguna demo
        </Button>
      }
    >
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Role</th>
                <th>Status</th>
                <th scope="col">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="user-cell">
                      <span className="avatar">{u.name[0]}</span>
                      <span>
                        <strong>{u.name}</strong>
                        <small className="block muted">@{u.username}</small>
                      </span>
                    </span>
                  </td>
                  <td>{u.role}</td>
                  <td>
                    <Badge>{u.active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Ubah akun ${u.name}`}
                      onClick={() => edit(u)}
                    >
                      <Icon name="edit" size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="field-hint">
        Akun demo tidak memiliki kata sandi. Mekanik dan pelanggan bukan
        pengguna login. Keamanan akses nyata harus diterapkan pada API.
      </p>
      {open && (
        <FormModal
          title={editing ? "Ubah akses pengguna" : "Pengguna demo baru"}
          onClose={() => setOpen(false)}
          onSubmit={(data) => {
            run({
              type: "user",
              value: {
                id: editing?.id || uid(),
                name: String(data.get("name")),
                username: String(data.get("username")),
                role,
                active: data.get("active") === "on",
                permissions,
              },
            });
            notify("Pengguna demo tersimpan.");
          }}
        >
          <Field
            label="Nama"
            name="name"
            defaultValue={editing?.name}
            required
            maxLength={100}
          />
          <Field
            label="Nama pengguna"
            name="username"
            defaultValue={editing?.username}
            required
            pattern="[a-zA-Z0-9._-]{3,40}"
          />
          <Select
            label="Role"
            value={role}
            onChange={(v) => setRole(v as Role)}
          >
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />
            Akun aktif
          </label>
          <details className="details">
            <summary>Izin individual</summary>
            <div className="checkboxes vertical">
              {permissionOptions.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(p.id)}
                    onChange={(e) =>
                      setPermissions(
                        e.target.checked
                          ? [...permissions, p.id]
                          : permissions.filter((x) => x !== p.id),
                      )
                    }
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </details>
          <p className="notice">
            Perubahan role dan izin dicatat pada audit. Menonaktifkan akun tidak
            menghapus histori.
          </p>
        </FormModal>
      )}
    </Page>
  );
}
export function MasterData() {
  const { state, run, notify } = useStore();
  const owner = useCan("settings");
  const [tab, setTab] = useState("services");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | NamedRecord | null>(null);
  const [type, setType] = useState<Service["type"]>("Internal");
  if (!owner) return <Empty title="Master data hanya untuk owner" />;
  function edit(value: Service | NamedRecord | null) {
    setEditing(value);
    setType(value && "type" in value ? value.type : "Internal");
    setOpen(true);
  }
  return (
    <Page
      title="Master data"
      back="/pengaturan"
      action={
        <Button icon="plus" onClick={() => edit(null)}>
          Tambah{" "}
          {tab === "services"
            ? "jasa"
            : tab === "mechanics"
              ? "mekanik"
              : tab === "categories"
                ? "kategori"
                : "satuan"}
        </Button>
      }
    >
      <Tabs
        options={[
          { id: "services", label: "Jasa" },
          { id: "mechanics", label: "Mekanik / PIC" },
          { id: "categories", label: "Kategori" },
          { id: "units", label: "Satuan" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Panel>
        {tab === "services" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jasa</th>
                  <th>Tipe</th>
                  <th>Harga jual</th>
                  <th>Modal vendor</th>
                  <th>Status</th>
                  <th scope="col">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.type}</td>
                    <td>{money(s.price)}</td>
                    <td>{s.type === "Vendor Luar" ? money(s.cost) : "Tidak berlaku"}</td>
                    <td>
                      <Badge>{s.active ? "Aktif" : "Nonaktif"}</Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => edit(s)}
                        aria-label={`Ubah jasa ${s.name}`}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "mechanics" ? (
          <>
            {state.mechanics.map((m) => (
              <div className="list-row" key={m.id}>
                <span className="user-cell">
                  <span className="avatar">{m.name[0]}</span>
                  <span>
                    <strong>{m.name}</strong>
                    <small>Referensi pekerjaan · tanpa akun login</small>
                  </span>
                </span>
                <Badge>{m.active ? "Aktif" : "Nonaktif"}</Badge>
                <button
                  className="icon-button"
                  onClick={() => edit(m)}
                  aria-label={`Ubah mekanik ${m.name}`}
                >
                  <Icon name="edit" size={17} />
                </button>
              </div>
            ))}
          </>
        ) : (
          <div className="tag-list">
            {state[tab === "categories" ? "categories" : "units"].map((s) => (
              <span key={s} className="master-tag">
                {s}
              </span>
            ))}
          </div>
        )}
      </Panel>
      {open && (
        <FormModal
          title={editing ? "Ubah master data" : "Tambah master data"}
          onClose={() => setOpen(false)}
          onSubmit={(data) => {
            const name = String(data.get("name"));
            if (tab === "services")
              run({
                type: "service",
                value: {
                  id: editing?.id || uid(),
                  name,
                  type,
                  price: Number(data.get("price")),
                  cost: type === "Vendor Luar" ? Number(data.get("cost")) : 0,
                  active: data.get("active") === "on",
                },
              });
            else if (tab === "mechanics")
              run({
                type: "mechanic",
                value: {
                  id: editing?.id || uid(),
                  name,
                  active: data.get("active") === "on",
                },
              });
            else
              run({
                type: "master",
                kind: tab === "categories" ? "categories" : "units",
                value: name,
              });
            notify("Master data tersimpan.");
          }}
        >
          <Field
            label="Nama"
            name="name"
            defaultValue={editing?.name}
            required
            maxLength={150}
          />
          {tab === "services" && (
            <>
              <Select
                label="Tipe jasa"
                value={type}
                onChange={(v) => setType(v as Service["type"])}
              >
                <option>Internal</option>
                <option>Vendor Luar</option>
              </Select>
              <Field
                label="Harga standar (Rp)"
                name="price"
                type="number"
                min={0}
                step={1}
                defaultValue={editing && "price" in editing ? editing.price : 0}
                required
              />
              {type === "Vendor Luar" && (
                <Field
                  label="Harga modal vendor (Rp)"
                  name="cost"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={editing && "cost" in editing ? editing.cost : 0}
                  required
                />
              )}
            </>
          )}
          {["services", "mechanics"].includes(tab) && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? true}
              />
              Aktif
            </label>
          )}
          <p className="field-hint">
            Master yang sudah dipakai dinonaktifkan, bukan dihapus dari histori.
          </p>
        </FormModal>
      )}
    </Page>
  );
}
export function SystemStates() {
  const [tab, setTab] = useState("empty");
  const [dialog, setDialog] = useState(false);
  return (
    <Page
      title="Status sistem"
      subtitle="Contoh state antarmuka untuk implementasi dan pengujian."
      back="/pengaturan"
    >
      <Tabs
        options={[
          { id: "empty", label: "Kosong" },
          { id: "loading", label: "Memuat" },
          { id: "offline", label: "Offline" },
          { id: "denied", label: "Akses" },
          { id: "error", label: "Validasi" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Panel>
        {tab === "empty" && (
          <Empty
            title="Belum ada work order"
            description="Mulai dengan menerima motor pelanggan."
            action={<LinkButton to="/bengkel/baru">Terima motor</LinkButton>}
          />
        )}{" "}
        {tab === "loading" && (
          <div
            className="skeleton-stack"
            aria-label="Contoh memuat data"
            role="status"
          >
            <span>Contoh memuat data…</span>
            {[1, 2, 3, 4].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        )}
        {tab === "offline" && (
          <Empty
            title="Koneksi terputus"
            description="Formulir tetap tersedia. Transaksi tidak dikirim saat offline."
            action={
              <Button
                variant="secondary"
                onClick={() => setTab("empty")}
                icon="refresh"
              >
                Coba lagi (contoh)
              </Button>
            }
          />
        )}{" "}
        {tab === "denied" && (
          <Empty
            title="Akses dibatasi"
            description="Gunakan akun dengan izin sesuai tugas."
            action={<LinkButton to="/lainnya">Kembali ke menu</LinkButton>}
          />
        )}{" "}
        {tab === "error" && (
          <div className="narrow">
            <Field
              label="Jumlah pemakaian"
              defaultValue={5}
              type="number"
              aria-invalid="true"
            />
            <p className="notice error" role="alert">
              Jumlah melebihi stok. Tersedia 4 botol.
            </p>
            <Button variant="secondary" onClick={() => setDialog(true)}>
              Contoh konfirmasi keluar
            </Button>
          </div>
        )}
      </Panel>
      {dialog && (
        <FormModal
          title="Perubahan belum disimpan"
          onClose={() => setDialog(false)}
          submit="Simpan draft (contoh)"
          onSubmit={() => setDialog(false)}
        >
          <p>
            Simpan draft sebelum meninggalkan halaman. Contoh ini tidak mengubah
            data.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDialog(false)}
          >
            Tetap keluar tanpa menyimpan
          </Button>
        </FormModal>
      )}
    </Page>
  );
}
