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
  go,
  href,
  useAction,
  useUnsaved,
} from "../components/ui.tsx";
import {
  CustomerSelect,
  DiscountEditor,
  LineEditor,
} from "../components/editors.tsx";
import {
  dateLabel,
  maySeeTransaction,
  methods,
  money,
  newTransaction,
  subtotal,
  total,
} from "../lib/domain.ts";
import type {
  Line,
  Method,
  PaymentStatus,
  Transaction,
} from "../lib/domain.ts";

export function Transactions({ path }: { path: string }) {
  const { state } = useStore();
  const rows = useVisibleTransactions();
  const service = useCan("transactions.service");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const id = path.split("/")[2];
  if (id) return <TransactionDetail id={id} />;
  const visible = rows.filter(
    (t) =>
      (!status || t.status === status) &&
      (!kind || t.kind === kind) &&
      `${t.id} ${state.customers.find((c) => c.id === t.customerId)?.name} ${t.reference}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <Page
      title="Transaksi"
      subtitle="Dari pekerjaan sampai pembayaran."
      action={
        service && (
          <LinkButton to="/kasir" icon="plus">
            Penjualan barang
          </LinkButton>
        )
      }
    >
      <Panel>
        <div className="toolbar">
          <Search
            value={q}
            onChange={setQ}
            placeholder="Cari nota, pelanggan, atau referensi"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Jenis transaksi"
          >
            <option value="">Semua jenis</option>
            {["Servis", "Barang", "Motor"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <Tabs
          options={[
            { id: "", label: "Semua" },
            ...["Draft", "Menunggu Pembayaran", "Final", "Batal"].map((s) => ({
              id: s,
              label: s,
            })),
          ]}
          value={status}
          onChange={setStatus}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaksi</th>
                <th className="hide-mobile">Pelanggan</th>
                <th>Total</th>
                <th>Pembayaran</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    <a className="stack-link" href={href(`/transaksi/${t.id}`)}>
                      <strong>
                        {t.id}
                        {t.corrects && <span className="count">Koreksi</span>}
                      </strong>
                      <small>
                        {t.kind} · {dateLabel(t.date)}
                      </small>
                    </a>
                  </td>
                  <td className="hide-mobile">
                    {state.customers.find((c) => c.id === t.customerId)?.name ||
                      "Pelanggan umum"}
                  </td>
                  <td className="money">{money(total(t))}</td>
                  <td>
                    <Badge>{t.paymentStatus}</Badge>
                    <small className="block muted">
                      {t.method || "Belum dipilih"}
                    </small>
                  </td>
                  <td>
                    <Badge>{t.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <Empty />}
      </Panel>
    </Page>
  );
}
function TransactionDetail({ id }: { id: string }) {
  const { state, user } = useStore();
  const t = state.transactions.find((t) => t.id === id);
  const owner = useCan("transaction.cancel");
  if (!t || !user || !maySeeTransaction(user, t))
    return <Empty title="Transaksi tidak tersedia untuk akun ini" />;
  return (
    <Page
      title={t.id}
      subtitle={t.kind}
      back="/transaksi"
      action={<Badge>{t.status}</Badge>}
    >
      <div className="detail-columns">
        <Panel title="Rincian transaksi">
          <LineEditor lines={t.lines} readonly onChange={() => {}} />
          <div className="total-row">
            <span>Diskon</span>
            <strong>{money(t.discount.amount)}</strong>
          </div>
          <div className="total-row grand">
            <span>Total transaksi</span>
            <strong>{money(total(t))}</strong>
          </div>
          {t.corrects && (
            <p className="notice">
              Mengoreksi {t.corrects}. Pembayaran dialihkan {money(t.credit)}.
            </p>
          )}
        </Panel>
        <Panel title="Pembayaran">
          <dl>
            <dt>Pelanggan</dt>
            <dd>
              {state.customers.find((c) => c.id === t.customerId)?.name ||
                "Pelanggan umum"}
            </dd>
            <dt>Metode</dt>
            <dd>{t.method || "Belum dipilih"}</dd>
            <dt>Status</dt>
            <dd>
              <Badge>{t.paymentStatus}</Badge>
            </dd>
            <dt>Referensi</dt>
            <dd>{t.reference || "Belum dicatat"}</dd>
            <dt>Waktu bayar</dt>
            <dd>{dateLabel(t.paidAt, true)}</dd>
            <dt>Verifikator</dt>
            <dd>{t.verifier || "Belum diverifikasi"}</dd>
          </dl>
          <div className="form-stack">
            {t.status === "Final" && t.paymentStatus === "Paid" && (
              <LinkButton to={`/nota/${t.id}`} icon="receipt">
                Lihat nota final
              </LinkButton>
            )}
            {!["Batal", "Final"].includes(t.status) && (
              <LinkButton to={`/pembayaran/${t.id}`} icon="wallet">
                Lanjut pembayaran
              </LinkButton>
            )}
            {t.woId && (
              <LinkButton secondary to={`/bengkel/${t.woId}`}>
                Buka work order
              </LinkButton>
            )}
            {owner && (
              <LinkButton secondary to="/kontrol">
                Kontrol transaksi
              </LinkButton>
            )}
          </div>
        </Panel>
      </div>
    </Page>
  );
}
export function PointOfSale() {
  const { state, run, notify } = useStore();
  const allowed = useCan("transactions.service");
  const [value, setValue] = useState(() => newTransaction("Barang", state));
  const [dirty, setDirty] = useState(false);
  const { error, action } = useAction();
  useUnsaved(dirty);
  if (!allowed) return <Empty title="Tidak memiliki akses kasir barang" />;
  const update = (patch: Partial<Transaction>) => {
    setValue({ ...value, ...patch });
    setDirty(true);
  };
  return (
    <Page title="Penjualan barang" subtitle={value.id} back="/transaksi">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action(() => {
            run({ type: "transaction", value });
            setDirty(false);
            notify("Draft penjualan tersimpan. Stok belum dipotong.");
            go(`/pembayaran/${value.id}`);
          });
        }}
      >
        <div className="detail-columns">
          <Panel title="Barang yang dijual">
            <LineEditor
              lines={value.lines}
              onChange={(lines) => update({ lines })}
            />
            <DiscountEditor
              value={value.discount}
              onChange={(discount) => update({ discount })}
            />
            <div className="total-row grand">
              <span>Total</span>
              <strong>{money(total(value))}</strong>
            </div>
          </Panel>
          <Panel title="Pelanggan">
            <CustomerSelect
              optional
              value={value.customerId}
              onChange={(customerId) => update({ customerId })}
            />
            <p className="field-hint">
              Pelanggan umum dapat bertransaksi tanpa akun. Stok diperiksa
              kembali saat pembayaran final.
            </p>
          </Panel>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <LinkButton secondary to="/transaksi">
            Batal
          </LinkButton>
          <Button type="submit">
            Lanjut pembayaran
          </Button>
        </div>
      </form>
    </Page>
  );
}
export function Checkout({ id }: { id: string }) {
  const { state, user, run, notify } = useStore();
  const t = state.transactions.find((t) => t.id === id);
  const [method, setMethod] = useState<Method>("Tunai");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [event, setEvent] = useState<PaymentStatus>("Paid");
  const { error, action } = useAction();
  const simulator = useCan("settings");
  if (!t || !user || !maySeeTransaction(user, t))
    return <Empty title="Transaksi tidak ditemukan atau akses ditolak" />;
  if (t.status === "Final")
    return (
      <Page title="Pembayaran selesai" back="/transaksi">
        <div className="payment-success">
          <div className="success-ring">
            <Icon name="check" size={42} />
          </div>
          <h2>Pembayaran tercatat.</h2>
          <p>
            {t.id} · {money(total(t))}
          </p>
          <p className="muted">Simulasi lokal. Bukan bukti pembayaran nyata.</p>
          <LinkButton to={`/nota/${t.id}`} icon="receipt">
            Buka nota final
          </LinkButton>
          {t.woId && (
            <LinkButton secondary to={`/bengkel/${t.woId}`}>
              Lanjut serah terima motor
            </LinkButton>
          )}
        </div>
      </Page>
    );
  if (t.status === "Batal")
    return (
      <Page title="Transaksi dibatalkan" back="/transaksi">
        <Empty
          title="Pembayaran tidak tersedia"
          description="Histori transaksi tetap tersimpan."
        />
      </Page>
    );
  const due = Math.max(0, total(t) - t.credit);
  const cash = method === "Tunai";
  const gateway = ["QRIS", "E-wallet"].includes(method);
  const pendingGateway =
    ["QRIS", "E-wallet"].includes(t.method) &&
    t.status === "Menunggu Pembayaran";
  return (
    <Page title="Pembayaran" subtitle={t.id} back={`/transaksi/${t.id}`}>
      <ErrorMessage error={error} />
      <div className="checkout-grid">
        <Panel title="Rincian tagihan">
          <div className="checkout-customer">
            <Icon name={t.kind === "Motor" ? "motor" : "receipt"} size={27} />
            <div>
              <strong>
                {state.customers.find((c) => c.id === t.customerId)?.name ||
                  "Pelanggan umum"}
              </strong>
              <small>
                {t.vehicleId
                  ? state.vehicles.find((v) => v.id === t.vehicleId)?.model
                  : t.kind}
              </small>
            </div>
          </div>
          <LineEditor lines={t.lines} readonly onChange={() => {}} />
          <div className="total-row">
            <span>Diskon</span>
            <span>{money(t.discount.amount)}</span>
          </div>
          <div className="total-row grand">
            <span>Total</span>
            <strong>{money(total(t))}</strong>
          </div>
          {t.credit > 0 && (
            <div className="total-row">
              <span>Dialihkan dari transaksi asal</span>
              <strong>{money(t.credit)}</strong>
            </div>
          )}
          {t.credit > 0 && (
            <div className="total-row">
              <span>Sisa bayar</span>
              <strong>{money(due)}</strong>
            </div>
          )}
          <Badge>{t.discount.status}</Badge>
          {t.discount.status !== "Disetujui" && (
            <p className="notice">
              Owner perlu memproses diskon melalui menu Persetujuan.
            </p>
          )}
        </Panel>
        <Panel
          title={
            pendingGateway
              ? "Status pembayaran digital"
              : "Pilih metode pembayaran"
          }
        >
          {pendingGateway ? (
            <div className="gateway-panel">
              <Badge>{t.paymentStatus}</Badge>
              <strong className="gateway-amount">{money(due)}</strong>
              {t.method === "QRIS" && (
                <div
                  className="qr-demo"
                  aria-label="Ilustrasi kode QR, tidak dapat digunakan membayar"
                >
                  <div className="qr-finder a" />
                  <div className="qr-finder b" />
                  <div className="qr-finder c" />
                  <span>DEMO</span>
                </div>
              )}
              <p className="field-hint">Contoh, bukan untuk membayar.</p>
              <p className="muted">
                Belum terhubung payment gateway. Status tidak berubah otomatis
                dalam demo ini.
              </p>
              <details className="details">
                <summary>Rincian permintaan</summary>
                <dl>
                  <dt>Referensi</dt>
                  <dd>{t.reference}</dd>
                  <dt>Batas waktu contoh</dt>
                  <dd>{dateLabel(t.expires, true)}</dd>
                  <dt>Metode</dt>
                  <dd>{t.method}</dd>
                </dl>
              </details>
              <Button
                variant="secondary"
                onClick={() =>
                  notify(
                    `Status demo ${t.id}: ${t.paymentStatus}. Tidak ada permintaan ke gateway nyata.`,
                  )
                }
                icon="refresh"
              >
                Periksa status
              </Button>
              {t.paymentStatus !== "Pending" && (
                <Button
                  onClick={() =>
                    action(() => {
                      run({
                        type: "pay",
                        id,
                        method: t.method as Method,
                        received: due,
                        reference: "",
                      });
                      notify("Permintaan gateway demo baru dibuat.");
                    })
                  }
                >
                  Buat permintaan demo baru
                </Button>
              )}
              {simulator && t.paymentStatus === "Pending" && (
                <details className="simulator">
                  <summary>Simulator gateway · khusus demo</summary>
                  <p>Hanya untuk menguji tampilan. Tidak memindahkan uang.</p>
                  <Select
                    label="Event contoh"
                    value={event}
                    onChange={(s) => setEvent(s as PaymentStatus)}
                  >
                    {["Paid", "Failed", "Expired", "Cancelled"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      action(() => {
                        run({ type: "gateway", id, status: event });
                        notify(`Event demo ${event} diproses.`);
                      })
                    }
                  >
                    Jalankan event contoh
                  </Button>
                </details>
              )}
            </div>
          ) : (
            <>
              <div className="method-grid">
                {state.settings.methods.map((m) => (
                  <button
                    key={m}
                    className={method === m ? "active" : ""}
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                  >
                    <Icon
                      name={
                        m === "Tunai"
                          ? "wallet"
                          : m === "Transfer bank"
                            ? "receipt"
                            : "grid"
                      }
                      size={21}
                    />
                    <span>{m}</span>
                  </button>
                ))}
              </div>
              <div className="form-stack payment-fields">
                <Badge>{t.paymentStatus}</Badge>
                {!gateway ? (
                  <>
                    <Field
                      label={
                        cash
                          ? "Uang diterima (Rp)"
                          : "Jumlah transfer diterima (Rp)"
                      }
                      type="number"
                      min={0}
                      step={1}
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder={String(due)}
                    />
                    {!cash && (
                      <Field
                        label="Referensi transfer (opsional)"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        maxLength={120}
                      />
                    )}
                    <div className="change-summary">
                      <span>{cash ? "Kembalian" : "Sisa bayar"}</span>
                      <strong>
                        {money(
                          cash
                            ? Math.max(0, Number(received) - due)
                            : Math.max(0, due - Number(received)),
                        )}
                      </strong>
                    </div>
                  </>
                ) : (
                  <p className="notice">
                    Buat permintaan simulasi {method}. Nominal tidak dapat
                    dibayar melalui aplikasi ini.
                  </p>
                )}
                <Button
                  className="full"
                  disabled={t.discount.status !== "Disetujui"}
                  onClick={() => {
                    if (gateway)
                      action(() => {
                        run({
                          type: "pay",
                          id,
                          method,
                          received: due,
                          reference: "",
                        });
                        notify("Permintaan gateway demo dibuat.");
                      });
                    else setConfirm(true);
                  }}
                  icon="check"
                >
                  {gateway
                    ? `Buat ${method} demo`
                    : cash
                      ? "Konfirmasi tunai"
                      : "Verifikasi transfer"}
                </Button>
                <p className="field-hint">
                  Pembayaran penuh, satu metode. Nota final tersedia setelah
                  lunas.
                </p>
              </div>
            </>
          )}
        </Panel>
      </div>
      {confirm && (
        <FormModal
          title={
            cash ? "Konfirmasi pembayaran tunai?" : "Verifikasi transfer bank?"
          }
          onClose={() => setConfirm(false)}
          submit={
            cash
              ? "Konfirmasi pembayaran demo"
              : "Transfer telah diperiksa (demo)"
          }
          onSubmit={() => {
            run({
              type: "pay",
              id,
              method,
              received: Number(received),
              reference,
            });
            notify("Pembayaran demo tercatat.");
          }}
        >
          <dl className="spec-list">
            <dt>Transaksi</dt>
            <dd>{t.id}</dd>
            <dt>Metode</dt>
            <dd>{method}</dd>
            <dt>Tagihan</dt>
            <dd>{money(due)}</dd>
            <dt>Diterima</dt>
            <dd>{money(Number(received))}</dd>
            <dt>Kembalian</dt>
            <dd>{money(Math.max(0, Number(received) - due))}</dd>
            <dt>Petugas</dt>
            <dd>{user.name}</dd>
          </dl>
          <p>
            Pastikan jumlah diterima benar. Tindakan ini memfinalisasi transaksi
            demo; perubahan berikutnya melalui pembatalan atau koreksi oleh
            owner.
          </p>
        </FormModal>
      )}
    </Page>
  );
}
export function Invoice({ id }: { id: string }) {
  const { state, user } = useStore();
  const t = state.transactions.find((t) => t.id === id);
  if (
    !t ||
    !user ||
    !maySeeTransaction(user, t) ||
    t.status !== "Final" ||
    t.paymentStatus !== "Paid"
  )
    return (
      <Page title="Nota belum tersedia">
        <Empty
          title="Pembayaran belum final"
          description="Nota final hanya tersedia setelah pembayaran penuh terverifikasi."
        />
      </Page>
    );
  const c = state.customers.find((c) => c.id === t.customerId);
  const v = state.vehicles.find((v) => v.id === t.vehicleId);
  return (
    <Page
      title="Nota transaksi"
      subtitle={t.id}
      back={`/transaksi/${t.id}`}
      action={
        <Button icon="print" onClick={() => window.print()}>
          Cetak / Simpan PDF
        </Button>
      }
    >
      <article className="invoice">
        <header className="invoice-header">
          <div>
            <div className="brand dark">
              <img className="brand-emblem" src="/brand/emblem.png" width="48" height="48" alt="" />
              <span>{state.settings.name}</span>
            </div>
            <p>{state.settings.address}</p>
            <p>{state.settings.contact}</p>
          </div>
          <div className="invoice-reference">
            <Badge>Lunas</Badge>
            <strong>{t.id}</strong>
            <span>{dateLabel(t.paidAt, true)}</span>
          </div>
        </header>
        <div className="invoice-parties">
          <div>
            <span>Pelanggan</span>
            <strong>{c?.name || "Pelanggan umum"}</strong>
            <p>{c?.contact}</p>
          </div>
          <div>
            <span>{t.kind === "Barang" ? "Jenis transaksi" : "Motor"}</span>
            <strong>{v ? `${v.brand} ${v.model}` : t.kind}</strong>
            <p>{v?.plate}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Rincian</th>
              <th>Jumlah</th>
              <th>Harga</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.qty}</td>
                <td>{money(l.price)}</td>
                <td>{money(l.qty * l.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal(t.lines))}</strong>
          </div>
          <div>
            <span>Diskon</span>
            <strong>{money(t.discount.amount)}</strong>
          </div>
          <div className="grand">
            <span>Total</span>
            <strong>{money(total(t))}</strong>
          </div>
          {t.credit > 0 && (
            <div>
              <span>Pembayaran dialihkan</span>
              <span>{money(t.credit)}</span>
            </div>
          )}
          <div>
            <span>Diterima · {t.method}</span>
            <span>{money(t.received)}</span>
          </div>
          <div>
            <span>Kembalian</span>
            <span>{money(t.change)}</span>
          </div>
        </div>
        <footer className="invoice-footer">
          <div>
            <p>{state.settings.note}</p>
            <small>Petugas: {t.verifier}</small>
          </div>
          <span>
            CONTOH DEMO
            <br />
            Bukan bukti transaksi nyata
          </span>
        </footer>
      </article>
    </Page>
  );
}
export function Controls() {
  const { state, run, notify } = useStore();
  const owner = useCan("transaction.cancel");
  const [tab, setTab] = useState("discount");
  const [modal, setModal] = useState("");
  const [id, setId] = useState("");
  const [docKind, setDocKind] = useState<"wo" | "transaction">("wo");
  const [lines, setLines] = useState<Line[]>([]);
  if (!owner) return <Empty title="Kontrol ini hanya tersedia untuk owner" />;
  const pending = [
    ...state.workOrders
      .filter((w) => w.discount.status === "Menunggu")
      .map((w) => ({
        id: w.id,
        discount: w.discount,
        amount: total(w),
        kind: "wo" as const,
      })),
    ...state.transactions
      .filter((t) => t.discount.status === "Menunggu" && t.status !== "Batal")
      .map((t) => ({
        id: t.id,
        discount: t.discount,
        amount: total(t),
        kind: "transaction" as const,
      })),
  ];
  const selected = state.transactions.find((t) => t.id === id);
  return (
    <Page
      title="Persetujuan & kontrol"
      subtitle="Tindakan penting, tetap dapat ditelusuri."
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { id: "discount", label: "Diskon", count: pending.length },
          { id: "transactions", label: "Pembatalan & koreksi" },
          {
            id: "refund",
            label: "Refund",
            count: state.refunds.filter((r) => r.status === "Refund Pending")
              .length,
          },
        ]}
      />
      {tab === "discount" && (
        <Panel title="Menunggu persetujuan">
          {pending.map((d) => (
            <div className="list-row" key={d.id}>
              <span>
                <strong>{d.id}</strong>
                <small>{d.discount.reason}</small>
                <small>
                  Diskon {money(d.discount.amount)} · total {money(d.amount)}
                </small>
              </span>
              <div className="inline">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setId(d.id);
                    setDocKind(d.kind);
                    setModal("reject");
                  }}
                >
                  Tolak
                </Button>
                <Button
                  onClick={() => {
                    setId(d.id);
                    setDocKind(d.kind);
                    setModal("approve");
                  }}
                >
                  Setujui
                </Button>
              </div>
            </div>
          ))}
          {!pending.length && (
            <Empty
              title="Semua pengajuan sudah diproses"
              description="Pengajuan diskon di atas batas akan muncul di sini."
            />
          )}
        </Panel>
      )}
      {tab === "transactions" && (
        <Panel title="Pembatalan & koreksi transaksi">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaksi</th>
                  <th>Total</th>
                  <th>Pembayaran</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {state.transactions
                  .filter((t) => t.status !== "Batal")
                  .map((t) => (
                    <tr key={t.id}>
                      <td>
                        <a href={href(`/transaksi/${t.id}`)}>{t.id}</a>
                        <small className="block muted">{t.kind}</small>
                      </td>
                      <td>{money(total(t))}</td>
                      <td>{t.method}</td>
                      <td>
                        <div className="inline">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setId(t.id);
                              setModal("cancel");
                            }}
                          >
                            Batalkan
                          </Button>
                          {t.status === 'Final' && <Button
                            variant="secondary"
                            onClick={() => {
                              setId(t.id);
                              setLines(
                                structuredClone(t.lines).map((line) => ({
                                  ...line,
                                  used: false,
                                })),
                              );
                              setModal("correct");
                            }}
                          >
                            Koreksi
                          </Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {tab === "refund" && (
        <Panel title="Pengembalian dana">
          {state.refunds.map((r) => (
            <div className="list-row" key={r.id}>
              <span>
                <strong>{r.id}</strong>
                <small>
                  {r.txId} · {r.method}
                </small>
                <small>{r.reason}</small>
              </span>
              <span>
                <strong>{money(r.amount)}</strong>
                <Badge>{r.status}</Badge>
              </span>
              {r.status === "Refund Pending" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setId(r.id);
                    setModal("refund");
                  }}
                >
                  Catat pengembalian
                </Button>
              )}
            </div>
          ))}
          {!state.refunds.length && <Empty title="Tidak ada refund" />}
        </Panel>
      )}
      {modal && (
        <FormModal
          title={
            modal === "cancel"
              ? "Batalkan transaksi final?"
              : modal === "correct"
                ? "Transaksi koreksi"
                : modal === "refund"
                  ? "Catat refund"
                  : modal === "approve"
                    ? "Setujui diskon?"
                    : "Tolak diskon?"
          }
          onClose={() => setModal("")}
          wide={modal === "correct"}
          danger={modal === "cancel"}
          submit={modal === "cancel" ? "Batalkan transaksi demo" : "Konfirmasi"}
          onSubmit={(data) => {
            const reason = String(data.get("reason") || "");
            if (modal === "approve" || modal === "reject")
              run({
                type: "discountDecision",
                id,
                kind: docKind,
                approve: modal === "approve",
                reason,
              });
            if (modal === "cancel")
              run({ type: "cancelTransaction", id, reason });
            if (modal === "correct")
              run({ type: "correct", id, lines, reason });
            if (modal === "refund")
              run({
                type: "refund",
                id,
                recipient: String(data.get("recipient")),
                reference: String(data.get("reference")),
              });
            notify("Tindakan demo tercatat pada audit.");
          }}
        >
          {modal === "cancel" && (
            <p>
              Transaksi <strong>{id}</strong> dibatalkan. Histori tetap ada.
              {selected?.status === 'Final' ? <> Efek stok dibalik; refund <strong>{money(total(selected))}</strong> berstatus Refund Pending.</> : <> Tidak ada dana dikembalikan karena transaksi belum lunas.</>}
              {' '}Ini simulasi, tidak mengirim uang. Permintaan gateway Pending harus diselesaikan statusnya terlebih dahulu.
            </p>
          )}
          {modal === "correct" && (
            <>
              <p>
                Dokumen KOR menggantikan <strong>{id}</strong>. Pembayaran asal
                dialihkan; hanya selisih lebih bayar menjadi refund.
              </p>
              <LineEditor
                service={selected?.kind === "Servis"}
                correction
                lines={lines}
                onChange={setLines}
              />
              <div className="total-row">
                <span>Selisih terhadap pembayaran asal</span>
                <strong>
                  {money(subtotal(lines) - (selected ? total(selected) : 0))}
                </strong>
              </div>
            </>
          )}
          {modal === "refund" ? (
            <>
              <p>
                Catat pengembalian yang sudah dilakukan melalui metode asal.
                Aplikasi tidak memindahkan dana.
              </p>
              <Field label="Penerima dana" name="recipient" required />
              <Field
                label="Referensi transfer / provider (wajib non-tunai)"
                name="reference"
              />
            </>
          ) : (
            <Field
              label="Catatan / alasan"
              name="reason"
              required
              maxLength={2000}
            />
          )}
        </FormModal>
      )}
    </Page>
  );
}
