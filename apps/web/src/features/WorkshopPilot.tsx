import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Badge, Button, ErrorMessage, Field, LinkButton } from "../components/ui.tsx";
import { money } from "../lib/domain.ts";

type Session = {
  csrf: string;
  user: { name: string; role: string; canWork: boolean; canReceive: boolean } | null;
};
type Entry = { id: number; name: string };
type Item = Entry & { code: string; kind: "part" | "service"; unit: string; balance: number; price?: number; average_cost?: number };
type Vehicle = { id: number; model: string; plate: string | null; customer_id: number };
type Catalog = { catalog: Item[]; customers: Entry[]; vehicles: Vehicle[]; suppliers: Entry[] };
type Receipt = { id: number; reference: string; supplier: string; finalized_at: string | null };
type Work = {
  id: number; number: string; status: string; model: string; plate: string | null;
  customer: string; version: number; complaint: string;
};
type WorkLine = { id: number; catalog_id: number; kind: Item["kind"]; name: string; quantity: number; price: number };
type WorkDetail = Work & {
  inspection: string | null; mechanic: string | null; cancel_reason: string | null;
  lines: WorkLine[]; total: number;
  photos: { id: number; kind: string }[];
  approval: { name: string; decision: string } | null;
  invoice: { number: string; received: number; total: number; reference: string | null; method: "tunai" | "transfer"; cashier: string; paid_at: string } | null;
};
type Send = <T>(url: string, data?: object | FormData) => Promise<T>;
type Action = (callback: () => Promise<void>) => void;

const emptyCatalog: Catalog = { catalog: [], customers: [], vehicles: [], suppliers: [] };
const api = "/pilot/api/";
async function request<T>(path: string, method = "GET", csrf = "", data?: object | FormData): Promise<T> {
  const json = data !== undefined && !(data instanceof FormData);
  const response = await fetch(api + path, {
    method,
    headers: {
      Accept: "application/json",
      ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(data) : data as FormData | undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result === null) {
    const detail = response.status === 419 || response.status === 401
      ? "Sesi berakhir. Muat ulang halaman dan masuk kembali."
      : response.status >= 500 || !result
        ? "Server pilot belum dapat dihubungi."
        : Object.values(result.errors ?? {}).flat()[0] ?? result.message ?? "Permintaan tidak berhasil.";
    throw new Error(String(detail));
  }
  return result as T;
}

let pendingSession: Promise<Session> | undefined;
function sessionRequest() {
  pendingSession ??= request<Session>("session").finally(() => { pendingSession = undefined; });
  return pendingSession;
}

function text(form: FormData, field: string) {
  return String(form.get(field) ?? "").trim();
}

function Form({ title, label, disabled, children, submit }: {
  title?: string; label: string; disabled: boolean; children: ReactNode; submit: (data: FormData) => void;
}) {
  return (
    <form className="panel pilot-form" onSubmit={(event) => {
      event.preventDefault();
      if (!disabled) submit(new FormData(event.currentTarget));
    }}>
      {title && <h2>{title}</h2>}
      <fieldset disabled={disabled}>
        {children}
        <Button type="submit">{label}</Button>
      </fieldset>
    </form>
  );
}

function Pick({ label, name, children, value }: { label: string; name: string; children: ReactNode; value?: string | number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} required defaultValue={value ?? ""}>
        <option value="" disabled>Pilih {label.toLowerCase()}</option>
        {children}
      </select>
    </label>
  );
}

function Entries({ entries }: { entries: Entry[] }) {
  return entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>);
}

function useCommandKey() {
  const key = useRef("");
  return {
    current: () => key.current || (key.current = crypto.randomUUID()),
    clear: () => { key.current = ""; },
  };
}

export function WorkshopPilot() {
  const [session, setSession] = useState<Session>();
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [works, setWorks] = useState<Work[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [draftForm, resetDraftForm] = useState(0);
  const [detail, setDetail] = useState<WorkDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState("wo");
  const running = useRef(false);
  const workKey = useCommandKey();
  const receiptKey = useCommandKey();

  const action: Action = (callback) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setNote("");
    void callback().catch((problem: Error) => setError(problem.message)).finally(() => {
      running.current = false;
      setBusy(false);
    });
  };

  async function refresh(active: Session, work?: number) {
    if (!active.user) return;
    const [nextCatalog, nextWorks, nextReceipts, nextWork] = await Promise.all([
      request<Catalog>("catalog"),
      active.user.canWork ? request<Work[]>("work-orders") : [],
      active.user.canReceive ? request<Receipt[]>("receipts") : [],
      work ? request<WorkDetail>("work-orders/" + work) : undefined,
    ]);
    setCatalog(nextCatalog);
    setWorks(nextWorks);
    setReceipts(nextReceipts);
    setDetail(nextWork);
  }

  useEffect(() => {
    document.title = "Pilot bengkel | Garasi Hobby";
    let live = true;
    void sessionRequest().then(async (active) => {
      if (!live) return;
      setSession(active);
      setTab(active.user?.canWork === false ? "stok" : "wo");
      await refresh(active);
    }).catch((problem: Error) => { if (live) setError(problem.message); });
    return () => { live = false; };
  }, []);

  const send: Send = (path, data) => request(path, "POST", session?.csrf, data);
  const reload = (work = detail?.id) => session ? refresh(session, work) : Promise.resolve();
  const create = (path: string, data: object) => action(async () => {
    await send(path, data);
    await reload();
    setNote("Data tersimpan.");
  });

  return (
    <main className="pilot-page">
      <header className="pilot-header">
        <div><h1>Bengkel Garasi Hobby</h1><p>Pilot pengembangan · Gunakan data uji</p></div>
        <LinkButton to="/masuk" secondary>Demo tampilan</LinkButton>
      </header>
      {error && <ErrorMessage error={error} />}
      {note && <p role="status">{note}</p>}
      {!session && <p>{error ? "Muat ulang setelah server siap." : "Memeriksa sesi…"}</p>}
      {session && !session.user && (
        <Form title="Masuk ke pilot" label="Masuk" disabled={busy} submit={(fields) => action(async () => {
          const active = await send<Session>("session", { email: text(fields, "email"), password: fields.get("password") });
          setSession(active);
          setTab(active.user?.canWork ? "wo" : "stok");
          await refresh(active);
        })}>
          <Field label="Email" name="email" type="email" required autoComplete="username" />
          <Field label="Kata sandi" name="password" type="password" required autoComplete="current-password" />
        </Form>
      )}
      {session?.user && <>
        <div className="pilot-toolbar">
          <span>{session.user.name} · {session.user.role}</span>
          <Button variant="secondary" disabled={busy} onClick={() => action(() => reload())}>Muat ulang</Button>
          <Button variant="ghost" disabled={busy} onClick={() => action(async () => {
            setSession(await request<Session>("session", "DELETE", session.csrf));
            setDetail(undefined);
            setCatalog(emptyCatalog);
            setWorks([]);
            setReceipts([]);
          })}>Keluar</Button>
        </div>
        <nav aria-label="Menu pilot" className="pilot-toolbar">
          {session.user.canWork && <Button variant={tab === "wo" ? "primary" : "secondary"} onClick={() => setTab("wo")}>Work order</Button>}
          <Button variant={tab === "stok" ? "primary" : "secondary"} onClick={() => setTab("stok")}>Stok dan penerimaan</Button>
          <Button variant={tab === "master" ? "primary" : "secondary"} onClick={() => setTab("master")}>Data master</Button>
        </nav>
        {tab === "master" && <div className="pilot-grid">
          {session.user.canWork && <>
            <Form title="Pelanggan" label="Tambah pelanggan" disabled={busy} submit={(d) => create("customers", { name: text(d, "name"), phone: text(d, "phone") })}>
              <Field name="name" label="Nama pelanggan" required maxLength={120} />
              <Field name="phone" label="Telepon" maxLength={32} />
            </Form>
            <Form title="Motor" label="Tambah motor" disabled={busy || !catalog.customers.length} submit={(d) => create("vehicles", {
              customer_id: Number(d.get("customer_id")), model: text(d, "model"), plate: text(d, "plate"), frame: text(d, "frame"), engine: text(d, "engine"),
            })}>
              <Pick name="customer_id" label="Pelanggan"><Entries entries={catalog.customers} /></Pick>
              <Field name="model" label="Model motor" required maxLength={120} />
              <Field name="plate" label="Nomor polisi" maxLength={20} />
              <Field name="frame" label="Nomor rangka" maxLength={40} />
              <Field name="engine" label="Nomor mesin" maxLength={40} />
            </Form>
          </>}
          {session.user.role === "owner" && <>
            <Form title="Pemasok" label="Tambah pemasok" disabled={busy} submit={(d) => create("suppliers", { name: text(d, "name") })}>
              <Field name="name" label="Nama pemasok" maxLength={120} required />
            </Form>
            <Form title="Barang atau jasa" label="Tambah ke katalog" disabled={busy} submit={(d) => create("items", {
              code: text(d, "code"), name: text(d, "name"), kind: text(d, "kind"), unit: text(d, "unit"), price: Number(d.get("price")),
            })}>
              <Pick name="kind" label="Jenis"><option value="part">Suku cadang</option><option value="service">Jasa</option></Pick>
              <Field name="code" label="Kode" maxLength={32} required />
              <Field name="name" label="Nama barang atau jasa" maxLength={120} required />
              <Field name="unit" label="Satuan" maxLength={24} required />
              <Field name="price" label="Harga jual (Rp)" type="number" min="0" max="100000000" required />
            </Form>
          </>}
          {session.user.role === "gudang" && <p>Owner mengelola katalog dan pemasok. Buka menu stok untuk mencatat barang masuk.</p>}
        </div>}
        {tab === "stok" && <div className="pilot-grid">
          <section className="panel pilot-panel">
            <h2>Saldo suku cadang</h2>
            {catalog.catalog.filter((item) => item.kind === "part").map((item) =>
              <p key={item.id}>{item.name} · {item.balance} {item.unit}{item.average_cost !== undefined && " · Modal rata-rata " + money(item.average_cost)}</p>)}
          </section>
          {session.user.canReceive && <>
            <ReceiptForm key={draftForm} catalog={catalog} busy={busy} save={(supplierId, reference, lines) => action(async () => {
              await send("receipts", { request_id: receiptKey.current(), supplier_id: supplierId, reference, lines });
              receiptKey.clear();
              resetDraftForm((key) => key + 1);
              await reload();
              setNote("Draft tersimpan. Finalisasi untuk menambah stok.");
            })} />
            <section className="panel pilot-panel">
              <h2>Penerimaan terakhir</h2>
              {receipts.map((receipt) => <div className="pilot-row" key={receipt.id}>
                <span>{receipt.reference} · {receipt.supplier}</span>
                {receipt.finalized_at ? <Badge>Final</Badge> : <Button disabled={busy} onClick={() => action(async () => {
                  await send("receipts/" + receipt.id + "/finalize", {});
                  await reload();
                  setNote("Penerimaan final. Saldo telah diperbarui.");
                })}>Finalisasi</Button>}
              </div>)}
            </section>
          </>}
        </div>}
        {tab === "wo" && session.user.canWork && <>
          {!detail ? <div className="pilot-grid">
            <Form title="Terima motor" label="Buat WO" disabled={busy || !catalog.vehicles.length} submit={(d) => action(async () => {
              const work = await send<{ id: number }>("work-orders", {
                request_id: workKey.current(), vehicle_id: Number(d.get("vehicle_id")), complaint: text(d, "complaint"),
              });
              workKey.clear();
              await reload(work.id);
            })}>
              <Pick name="vehicle_id" label="Motor">
                {catalog.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.model} {vehicle.plate} · {catalog.customers.find((customer) => customer.id === vehicle.customer_id)?.name}
                </option>)}
              </Pick>
              <Field name="complaint" label="Keluhan" maxLength={1500} required />
              {!catalog.vehicles.length && <p>Tambahkan pelanggan dan motor di Data master.</p>}
            </Form>
            <section className="panel pilot-panel">
              <h2>Work order terakhir</h2>
              {works.map((work) => <div className="pilot-row" key={work.id}>
                <span>{work.number} · {work.model} · {work.status}</span>
                <Button variant="secondary" disabled={busy} onClick={() => action(() => reload(work.id))}>Buka</Button>
              </div>)}
            </section>
          </div> : <WorkPanel detail={detail} catalog={catalog} busy={busy} canReverse={session.user.role === "owner"}
            close={() => setDetail(undefined)} run={(path, data) => action(async () => {
              const response = await send<{ shortages?: string[] }>("work-orders/" + detail.id + "/" + path, data);
              await reload(detail.id);
              setNote(response.shortages?.length ? "Stok kurang: " + response.shortages.join(", ") : "WO diperbarui.");
            })}
            upload={(kind, file) => action(async () => {
              const form = new FormData();
              form.set("kind", kind);
              form.set("photo", await compress(file), "kondisi.jpg");
              await send("work-orders/" + detail.id + "/photos", form);
              await reload(detail.id);
              setNote("Foto kondisi tersimpan.");
            })} />}
        </>}
      </>}
    </main>
  );
}

function ReceiptForm({ catalog, busy, save }: {
  catalog: Catalog; busy: boolean;
  save: (supplierId: number, reference: string, lines: object[]) => void;
}) {
  const [rows, setRows] = useState(1);
  const parts = catalog.catalog.filter((item) => item.kind === "part");
  return <Form title="Draft penerimaan" label="Simpan draft" disabled={busy || !parts.length || !catalog.suppliers.length} submit={(d) =>
    save(Number(d.get("supplier_id")), text(d, "reference"), Array.from({ length: rows }, (_, i) => ({
      catalog_id: Number(d.get("item" + i)), quantity: Number(d.get("quantity" + i)),
      units_per_package: Number(d.get("ratio" + i)), package_cost: Number(d.get("cost" + i)),
    })))}>
    <Pick name="supplier_id" label="Pemasok"><Entries entries={catalog.suppliers} /></Pick>
    <Field name="reference" label="Referensi pemasok" maxLength={80} required />
    {Array.from({ length: rows }, (_, i) => <div className="pilot-line" key={i}>
      <Pick name={"item" + i} label={"Barang " + (i + 1)}><Entries entries={parts} /></Pick>
      <Field name={"quantity" + i} label="Jumlah kemasan" type="number" min="1" max="10000" required />
      <Field name={"ratio" + i} label="Unit per kemasan" type="number" min="1" max="10000" defaultValue="1" required />
      <Field name={"cost" + i} label="Modal per kemasan (Rp)" type="number" min="0" max="100000000" required />
    </div>)}
    <RowButtons rows={rows} limit={parts.length} setRows={setRows} />
  </Form>;
}

function RowButtons({ rows, limit, setRows }: { rows: number; limit: number; setRows: (rows: number) => void }) {
  return <div className="pilot-toolbar">
    {rows < Math.min(limit, 50) && <Button type="button" variant="secondary" onClick={() => setRows(rows + 1)}>Tambah baris</Button>}
    {rows > 1 && <Button type="button" variant="ghost" onClick={() => setRows(rows - 1)}>Hapus baris terakhir</Button>}
  </div>;
}

async function compress(file: File) {
  if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Gunakan foto JPEG, PNG, atau WebP berukuran maksimal 5 MB.");
  const image = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(ratio * image.width));
    canvas.height = Math.max(1, Math.round(ratio * image.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Foto gagal diproses.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) =>
      blob ? resolve(blob) : reject(new Error("Foto gagal dikompresi.")), "image/jpeg", 0.82));
  } finally {
    image.close();
  }
}

type WorkPanelProps = {
  detail: WorkDetail; catalog: Catalog; busy: boolean; canReverse: boolean; close: () => void;
  run: (path: string, data: object) => void; upload: (kind: string, file: File) => void;
};

function WorkPanel({ detail, catalog, busy, canReverse, run, upload, close }: WorkPanelProps) {
  const open = ["Inspeksi", "Menunggu Persetujuan", "Menunggu Barang", "Dikerjakan"].includes(detail.status);
  const approved = detail.approval?.decision === "disetujui";
  const version = { version: detail.version };
  return <>
    <div className="pilot-toolbar">
      <Button variant="secondary" disabled={busy} onClick={close}>Semua WO</Button>
      <strong>{detail.number} · {detail.model} · {detail.customer}</strong>
      <Badge>{detail.status}</Badge>
    </div>
    <p>{detail.complaint}</p>
    {detail.cancel_reason && <p>Alasan batal: {detail.cancel_reason}</p>}
    <div className="pilot-grid">
      {open && <>
        <EstimateForm key={detail.id + "/" + detail.version} detail={detail} catalog={catalog} busy={busy} run={run} />
        <section className="panel pilot-panel">
          <h2>Foto kondisi awal</h2>
          {["umum", "masalah"].map((kind) => {
            const photo = detail.photos.find((entry) => entry.kind === kind);
            return photo ? <p key={kind}><a href={api + "work-orders/" + detail.id + "/photos/" + photo.id}>Lihat foto {kind}</a></p> :
              <Field key={kind} label={"Unggah foto " + kind} type="file" accept="image/jpeg,image/png,image/webp"
                disabled={busy} onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) upload(kind, file);
                }} />;
          })}
        </section>
        {detail.version > 0 && !detail.approval && <Form title="Keputusan estimasi" label="Catat keputusan" disabled={busy}
          submit={(d) => run("approval", { ...version, name: text(d, "name"), decision: text(d, "decision"), method: text(d, "method") })}>
          <p>Estimasi v{detail.version} · {money(detail.total)}</p>
          <Field name="name" label="Nama pemberi persetujuan" required maxLength={120} />
          <Pick name="method" label="Metode konfirmasi">
            <option value="langsung">Langsung</option><option value="telepon">Telepon</option><option value="whatsapp">WhatsApp</option>
          </Pick>
          <Pick name="decision" label="Keputusan"><option value="disetujui">Disetujui</option><option value="ditolak">Ditolak</option></Pick>
        </Form>}
        {detail.approval && <section className="panel pilot-panel">
          <h2>Pengerjaan</h2>
          <p>Estimasi v{detail.version} {detail.approval.decision} oleh {detail.approval.name} · {money(detail.total)}</p>
          {approved && <Button disabled={busy || detail.photos.length < 2} onClick={() => run("issue", version)}>
            {detail.lines.some((line) => line.kind === "part") ? "Konfirmasi ambil barang dan kerjakan" : "Mulai pengerjaan"}
          </Button>}
          {detail.status === "Dikerjakan" && <Form label="Tandai Siap Diambil" disabled={busy} submit={() => run("finish", { ...version, actual_confirmed: true })}>
            <label><input type="checkbox" required /> Pekerjaan dan jumlah aktual sesuai estimasi terakhir yang disetujui.</label>
          </Form>}
        </section>}
        <Form title="Pembatalan WO" label="Batalkan WO" disabled={busy}
          submit={(d) => run("cancel", { reason: text(d, "reason"), returned: d.has("returned") })}>
          <Field name="reason" label="Alasan pembatalan" maxLength={1200} required />
          {canReverse && <label><input type="checkbox" name="returned" /> Semua barang yang sudah keluar telah dikembalikan.</label>}
        </Form>
      </>}
      {detail.status === "Siap Diambil" && !detail.invoice && <Form title="Pembayaran manual" label="Catat pelunasan" disabled={busy}
        submit={(d) => run("pay", { ...version, method: text(d, "method"), received: Number(d.get("received")), reference: text(d, "reference") })}>
        <p>Total {money(detail.total)}</p>
        <Pick name="method" label="Metode pembayaran"><option value="tunai">Tunai</option><option value="transfer">Transfer bank</option></Pick>
        <Field name="received" label="Jumlah diterima (Rp)" type="number" min="0" defaultValue={detail.total} required />
        <Field name="reference" label="Referensi (wajib untuk transfer)" maxLength={80} />
        <label><input type="checkbox" required /> Saya sudah memverifikasi uang diterima.</label>
      </Form>}
      {detail.invoice && <section className="panel pilot-panel pilot-print-card">
        <Invoice work={detail} />
        <div className="pilot-toolbar">
          <Button variant="secondary" onClick={() => {
            document.body.classList.add("pilot-print");
            try { window.print(); } finally { document.body.classList.remove("pilot-print"); }
          }}>Cetak / Simpan PDF</Button>
          {detail.status === "Siap Diambil" && <Button disabled={busy} onClick={() => run("handover", {})}>Catat serah terima</Button>}
        </div>
      </section>}
    </div>
  </>;
}

function EstimateForm({ detail, catalog, busy, run }: Pick<WorkPanelProps, "detail" | "catalog" | "busy" | "run">) {
  const [rows, setRows] = useState(Math.max(1, detail.lines.length));
  return <Form title={detail.version ? "Revisi estimasi" : "Inspeksi dan estimasi"} label="Simpan estimasi" disabled={busy || !catalog.catalog.length} submit={(d) => run("estimate", {
    version: detail.version, inspection: text(d, "inspection"), mechanic: text(d, "mechanic"),
    lines: Array.from({ length: rows }, (_, i) => ({ catalog_id: Number(d.get("item" + i)), quantity: Number(d.get("quantity" + i)) })),
  })}>
    <Field name="inspection" label="Hasil inspeksi" maxLength={1500} defaultValue={detail.inspection ?? ""} required />
    <Field name="mechanic" label="Mekanik" maxLength={120} defaultValue={detail.mechanic ?? ""} required />
    {Array.from({ length: rows }, (_, i) => <div className="pilot-line" key={i}>
      <Pick name={"item" + i} label={"Barang atau jasa " + (i + 1)} value={detail.lines[i]?.catalog_id}>
        {catalog.catalog.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price ?? 0)}</option>)}
      </Pick>
      <Field name={"quantity" + i} label="Jumlah" type="number" min="1" max="10000" defaultValue={detail.lines[i]?.quantity ?? 1} required />
    </div>)}
    <RowButtons rows={rows} limit={catalog.catalog.length} setRows={setRows} />
  </Form>;
}

function Invoice({ work }: { work: WorkDetail }) {
  const invoice = work.invoice;
  if (!invoice) return null;
  return <article className="pilot-invoice">
    <h2>Garasi Hobby · Nota servis</h2>
    <p>{invoice.number} · {invoice.paid_at} WIB</p>
    <p>{work.customer} · {work.model} {work.plate} · {work.number}</p>
    <table>
      <thead><tr><th>Uraian</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead>
      <tbody>{work.lines.map((line) => <tr key={line.id}>
        <td>{line.name}</td><td>{line.quantity}</td><td>{money(line.price)}</td><td>{money(line.price * line.quantity)}</td>
      </tr>)}</tbody>
    </table>
    <p>Total <strong>{money(invoice.total)}</strong></p>
    <p>{invoice.method === "tunai"
      ? "Tunai " + money(invoice.received) + " · Kembalian " + money(invoice.received - invoice.total)
      : "Transfer bank · " + invoice.reference}</p>
    <p>Petugas {invoice.cashier} · Data uji</p>
  </article>;
}
