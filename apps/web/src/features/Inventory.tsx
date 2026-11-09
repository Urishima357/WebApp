import { useState } from "react";
import { useCan, useStore } from "../app/store.tsx";
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
  go,
  href,
  useAction,
  useUnsaved,
} from "../components/ui.tsx";
import {
  balance,
  dateLabel,
  documentId,
  localDay,
  money,
  stockStatus,
  uid,
} from "../lib/domain.ts";
import type { Item, Receipt, ReceiptLine, Supplier } from "../lib/domain.ts";

export function Inventory({ path }: { path: string }) {
  const { state, run, notify } = useStore();
  const manage = useCan("inventory.manage");
  const limited = useCan("inventory.limited");
  const receive = useCan("receipt.create");
  const adjust = useCan("stock.adjust");
  const cost = useCan("settings");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [modal, setModal] = useState(false);
  const id = path.split("/")[2]?.split("?")[0];
  const item = state.items.find((i) => i.id === id);
  if (id && !item) return <Empty title="Barang tidak ditemukan" />;
  const rows = state.items.filter(
    (i) =>
      (!status || stockStatus(state, i) === status) &&
      (!category || i.category === category) &&
      `${i.name} ${i.sku} ${i.brand}`.toLowerCase().includes(q.toLowerCase()),
  );
  let running = 0;
  return (
    <Page
      title={item ? item.name : "Suku cadang"}
      subtitle={
        item ? `${item.sku} · ${item.brand}` : "Barang kecil. Peran besar."
      }
      back={item ? "/stok" : undefined}
      action={
        item ? (
          (manage || limited) && (
            <LinkButton secondary to={`/stok/${item.id}/edit`} icon="edit">
              Ubah barang
            </LinkButton>
          )
        ) : (
          <>
            {(manage || limited) && (
              <LinkButton secondary to="/stok/baru" icon="plus">
                Tambah barang
              </LinkButton>
            )}
            {receive && (
              <LinkButton to="/penerimaan/baru" icon="plus">
                Barang masuk
              </LinkButton>
            )}
          </>
        )
      }
    >
      {item ? (
        <>
          <div className="stock-detail-strip">
            <Panel>
              <span>Saldo saat ini</span>
              <strong className="stat-number">
                {balance(state, item.id)} <small>{item.unit}</small>
              </strong>
              <Badge>{stockStatus(state, item)}</Badge>
            </Panel>
            <Panel>
              <span>Stok minimum</span>
              <strong className="stat-number">
                {item.minimum} <small>{item.unit}</small>
              </strong>
              <small>Rak {item.rack || "belum dicatat"}</small>
            </Panel>
            <Panel>
              <span>Harga jual</span>
              <strong className="stat-money">{money(item.price)}</strong>
              {cost && <small>Modal rata-rata {money(item.cost)}</small>}
            </Panel>
          </div>
          <Panel
            title="Kartu stok"
            action={
              adjust && (
                <Button variant="secondary" onClick={() => setModal(true)}>
                  Sesuaikan stok
                </Button>
              )
            }
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Referensi</th>
                    <th>Masuk</th>
                    <th>Keluar</th>
                    <th>Saldo</th>
                    <th>Petugas</th>
                  </tr>
                </thead>
                <tbody>
                  {state.movements
                    .filter((m) => m.itemId === item.id)
                    .map((m) => {
                      running += m.qty;
                      return (
                        <tr key={m.id}>
                          <td>{dateLabel(m.date, true)}</td>
                          <td>
                            <strong>{m.ref}</strong>
                            <small className="block muted">
                              {m.reason}
                              {m.reverses ? " · Reversal" : ""}
                            </small>
                          </td>
                          <td className="success-text">
                            {m.qty > 0 ? `+${m.qty}` : ""}
                          </td>
                          <td className="danger-text">
                            {m.qty < 0 ? m.qty : ""}
                          </td>
                          <td>{running}</td>
                          <td>{m.actor}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!state.movements.some((m) => m.itemId === item.id) && (
              <Empty title="Belum ada pergerakan" />
            )}
            <p className="field-hint panel-footnote">
              Saldo berasal dari pergerakan barang dan tidak dapat diedit
              langsung.
            </p>
          </Panel>
        </>
      ) : (
        <Panel>
          <div className="toolbar">
            <Search
              value={q}
              onChange={setQ}
              placeholder="Cari nama barang, SKU, atau merek"
            />
            <div className="toolbar-filters">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter kategori"
              >
                <option value="">Semua kategori</option>
                {state.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter saldo"
              >
                <option value="">Semua status</option>
                <option>Normal</option>
                <option>Menipis</option>
                <option>Habis</option>
                <option>Non-stok</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Barang</th>
                  <th>Stok</th>
                  <th className="hide-mobile">Minimum</th>
                  <th>Status</th>
                  <th className="hide-mobile">Harga jual</th>
                  <th scope="col">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <a className="stack-link" href={href(`/stok/${i.id}`)}>
                        <strong>{i.name}</strong>
                        <small>
                          {i.sku} · {i.brand}
                          {!i.active ? " · Nonaktif" : ""}
                        </small>
                      </a>
                    </td>
                    <td>
                      <strong>{i.tracked ? balance(state, i.id) : "Tidak dilacak"}</strong>{" "}
                      <small>{i.unit}</small>
                    </td>
                    <td className="hide-mobile">{i.minimum}</td>
                    <td>
                      <Badge>{stockStatus(state, i)}</Badge>
                    </td>
                    <td className="hide-mobile">{money(i.price)}</td>
                    <td>
                      <a
                        className="icon-button"
                        href={href(`/stok/${i.id}`)}
                        aria-label={`Kartu stok ${i.name}`}
                      >
                        <Icon name="chevron" size={17} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <Empty />}
        </Panel>
      )}
      {modal && item && (
        <FormModal
          title="Sesuaikan stok"
          onClose={() => setModal(false)}
          submit="Konfirmasi penyesuaian"
          onSubmit={(data) => {
            run({
              type: "adjust",
              itemId: item.id,
              counted: Number(data.get("counted")),
              reason: String(data.get("reason")),
            });
            notify("Movement penyesuaian tercatat.");
          }}
        >
          <p>
            Saldo tercatat:{" "}
            <strong>
              {balance(state, item.id)} {item.unit}
            </strong>
            . Selisih hasil hitung membuat movement baru; histori tidak dihapus.
          </p>
          <Field
            label="Hasil hitung fisik"
            name="counted"
            type="number"
            min={0}
            step={1}
            required
          />
          <Field
            label="Alasan penyesuaian"
            name="reason"
            required
            maxLength={2000}
          />
        </FormModal>
      )}
    </Page>
  );
}
export function ItemEditor({ id }: { id?: string }) {
  const { state, run, notify } = useStore();
  const manage = useCan("inventory.manage");
  const limited = useCan("inventory.limited");
  const old = state.items.find((i) => i.id === id);
  const [value, setValue] = useState<Item>(() =>
    old
      ? structuredClone(old)
      : {
          id: uid(),
          sku: "",
          name: "",
          brand: "",
          category: state.categories[0],
          unit: state.units[0],
          buyUnit: "",
          ratio: 1,
          price: 0,
          cost: 0,
          minimum: 0,
          rack: "",
          tracked: true,
          active: true,
        },
  );
  const { error, action } = useAction();
  const [dirty, setDirty] = useState(false);
  useUnsaved(dirty);
  if (!manage && !limited)
    return <Empty title="Tidak memiliki izin mengubah barang" />;
  const locked = state.movements.some((m) => m.itemId === id);
  const update = (patch: Partial<Item>) => {
    setValue({ ...value, ...patch });
    setDirty(true);
  };
  return (
    <Page
      title={id ? "Data barang" : "Tambah barang"}
      back={id ? `/stok/${id}` : "/stok"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action(() => {
            run({ type: "item", value });
            setDirty(false);
            notify("Barang tersimpan.");
            go(`/stok/${value.id}`);
          });
        }}
      >
        <Panel title="Informasi suku cadang">
          <div className="form-grid">
            <Field
              label="SKU / kode"
              value={value.sku}
              onChange={(e) => update({ sku: e.target.value })}
              required
              maxLength={50}
            />
            <Field
              label="Nama barang"
              value={value.name}
              onChange={(e) => update({ name: e.target.value })}
              required
              maxLength={150}
            />
            <Field
              label="Merek"
              value={value.brand}
              onChange={(e) => update({ brand: e.target.value })}
            />
            <Select
              label="Kategori"
              value={value.category}
              onChange={(category) => update({ category })}
            >
              {state.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Satuan dasar"
              disabled={locked}
              value={value.unit}
              onChange={(unit) => update({ unit })}
            >
              {state.units.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Field
              label="Rak (opsional)"
              value={value.rack}
              onChange={(e) => update({ rack: e.target.value })}
            />
            {manage && (
              <>
                <Field
                  label="Harga jual (Rp)"
                  type="number"
                  min={0}
                  step={1}
                  value={value.price}
                  onChange={(e) => update({ price: Number(e.target.value) })}
                />
                <Field
                  label="Stok minimum"
                  type="number"
                  min={0}
                  step={1}
                  value={value.minimum}
                  onChange={(e) => update({ minimum: Number(e.target.value) })}
                />
              </>
            )}
          </div>
          {locked && (
            <p className="field-hint">
              Satuan dasar terkunci karena barang sudah memiliki movement.
            </p>
          )}
          <details className="details" open={!!value.buyUnit}>
            <summary>Satuan pembelian</summary>
            <div className="form-grid">
              <Field
                label="Satuan beli (opsional)"
                value={value.buyUnit}
                onChange={(e) => update({ buyUnit: e.target.value })}
              />
              <Field
                label={`1 satuan beli = … ${value.unit}`}
                type="number"
                min={1}
                step={1}
                value={value.ratio}
                onChange={(e) => update({ ratio: Number(e.target.value) })}
              />
            </div>
          </details>
          {manage && (
            <div className="checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={value.tracked}
                  disabled={locked}
                  onChange={(e) => update({ tracked: e.target.checked })}
                />
                Kelola stok barang
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={value.active}
                  onChange={(e) => update({ active: e.target.checked })}
                />
                Barang aktif
              </label>
            </div>
          )}
        </Panel>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <LinkButton secondary to="/stok">
            Batal
          </LinkButton>
          <Button type="submit">Simpan barang</Button>
        </div>
      </form>
    </Page>
  );
}
export function Suppliers() {
  const { state, run, notify } = useStore();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const rows = state.suppliers.filter((s) =>
    `${s.name} ${s.contact}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Page
      title="Supplier"
      subtitle="Rekan di balik setiap pekerjaan."
      action={
        <Button
          icon="plus"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Tambah supplier
        </Button>
      }
    >
      <Panel>
        <div className="toolbar">
          <Search
            value={q}
            onChange={setQ}
            placeholder="Cari supplier atau kontak"
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Kontak</th>
                <th>Status</th>
                <th scope="col">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small className="block muted">{s.address}</small>
                  </td>
                  <td>{s.contact || "Belum dicatat"}</td>
                  <td>
                    <Badge>{s.active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                      aria-label={`Ubah ${s.name}`}
                    >
                      <Icon name="edit" size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
      </Panel>
      {open && (
        <FormModal
          title={editing ? "Ubah supplier" : "Tambah supplier"}
          onClose={() => setOpen(false)}
          onSubmit={(data) => {
            run({
              type: "supplier",
              value: {
                id: editing?.id || uid(),
                name: String(data.get("name")),
                contact: String(data.get("contact")),
                address: String(data.get("address")),
                active: data.get("active") === "on",
              },
            });
            notify("Supplier tersimpan.");
          }}
        >
          <Field
            label="Nama supplier"
            name="name"
            defaultValue={editing?.name}
            required
            maxLength={150}
          />
          <Field
            label="Kontak"
            name="contact"
            defaultValue={editing?.contact}
            maxLength={80}
          />
          <Field
            label="Alamat"
            name="address"
            defaultValue={editing?.address}
            maxLength={1000}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />
            Supplier aktif
          </label>
        </FormModal>
      )}
    </Page>
  );
}
export function Purchasing({ path }: { path: string }) {
  const { state } = useStore();
  const create = useCan("receipt.create");
  const id = path.split("/")[2];
  if (id) return <ReceiptEditor key={id} id={id === "baru" ? undefined : id} />;
  return (
    <Page
      title="Barang masuk"
      subtitle="Penerimaan tercatat. Stok terjaga."
      action={
        create && (
          <LinkButton to="/penerimaan/baru" icon="plus">
            Catat penerimaan
          </LinkButton>
        )
      }
    >
      <Panel title="Penerimaan supplier">
        {state.receipts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Supplier</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.receipts.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a
                        className="stack-link"
                        href={href(`/penerimaan/${r.id}`)}
                      >
                        <strong>{r.id}</strong>
                        <small>{dateLabel(r.date)}</small>
                      </a>
                    </td>
                    <td>
                      {state.suppliers.find((s) => s.id === r.supplierId)?.name}
                    </td>
                    <td>
                      {money(r.lines.reduce((n, l) => n + l.cost * l.qty, 0))}
                    </td>
                    <td>
                      <Badge>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Belum ada penerimaan"
            description="Stok bertambah setelah penerimaan difinalisasi."
            action={
              create && (
                <LinkButton to="/penerimaan/baru">
                  Catat barang masuk
                </LinkButton>
              )
            }
          />
        )}
      </Panel>
    </Page>
  );
}
function ReceiptEditor({ id }: { id?: string }) {
  const { state, run, notify } = useStore();
  const finalize = useCan("receipt.finalize");
  const existing = state.receipts.find((r) => r.id === id);
  const [value, setValue] = useState<Receipt>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: documentId("GR", [
            ...state.receipts.map((r) => r.id),
            ...state.movements.map((m) => m.ref),
          ]),
          supplierId: "",
          date: localDay(),
          reference: "",
          status: "Draft",
          lines: [],
        },
  );
  const [dirty, setDirty] = useState(false);
  useUnsaved(dirty);
  const [confirm, setConfirm] = useState(false);
  const { error, action } = useAction();
  const update = (patch: Partial<Receipt>) => {
    setValue({ ...value, ...patch });
    setDirty(true);
  };
  const closed = value.status === "Final";
  function save(final: boolean) {
    run({ type: "receipt", value, finalize: final });
    setDirty(false);
    notify(
      final
        ? "Penerimaan final. Stok bertambah."
        : "Draft penerimaan tersimpan.",
    );
    go("/penerimaan");
  }
  const add = (itemId: string) => {
    if (itemId)
      update({
        lines: [
          ...value.lines,
          {
            itemId,
            qty: 1,
            unit: state.items.find((i) => i.id === itemId)!.unit,
            ratio: 1,
            cost: 0,
          },
        ],
      });
  };
  const lineUpdate = (index: number, patch: Partial<ReceiptLine>) =>
    update({
      lines: value.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    });
  return (
    <Page
      title="Penerimaan barang"
      subtitle={value.id}
      back="/penerimaan"
      action={<Badge>{value.status}</Badge>}
    >
      <div className="two-column">
        <Panel title="Informasi penerimaan">
          <div className="form-stack">
            <Select
              label="Supplier"
              value={value.supplierId}
              onChange={(supplierId) => update({ supplierId })}
              disabled={closed}
              required
            >
              <option value="">Pilih supplier</option>
              {state.suppliers
                .filter((s) => s.active || s.id === value.supplierId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Field
              label="Tanggal penerimaan"
              type="date"
              required
              value={value.date.slice(0, 10)}
              disabled={closed}
              onChange={(e) => update({ date: e.target.value })}
            />
            <Field
              label="Referensi nota supplier"
              value={value.reference}
              disabled={closed}
              onChange={(e) => update({ reference: e.target.value })}
            />
            <a className="text-link" href={href("/supplier")}>
              Kelola supplier
            </a>
          </div>
        </Panel>
        <Panel title="Ringkasan">
          <dl>
            <dt>Jumlah baris</dt>
            <dd>{value.lines.length} barang</dd>
            <dt>Total penerimaan</dt>
            <dd>
              <strong>
                {money(value.lines.reduce((n, l) => n + l.qty * l.cost, 0))}
              </strong>
            </dd>
          </dl>
          <p className="notice">
            Draft tidak mengubah stok. Finalisasi menambah saldo dan menghitung
            ulang modal rata-rata.
          </p>
        </Panel>
      </div>
      <Panel title="Barang diterima">
        <div className="receipt-lines">
          {value.lines.map((l, i) => {
            const item = state.items.find((x) => x.id === l.itemId)!;
            return (
              <div className="receipt-line" key={i}>
                <div className="line-name">
                  <strong>{item.name}</strong>
                  <small>{item.sku}</small>
                </div>
                <Field
                  label="Jumlah"
                  type="number"
                  min={1}
                  step={1}
                  disabled={closed}
                  value={l.qty}
                  onChange={(e) =>
                    lineUpdate(i, { qty: Number(e.target.value) })
                  }
                />
                <Select
                  label="Satuan beli"
                  value={l.unit}
                  disabled={closed}
                  onChange={(unit) =>
                    lineUpdate(i, {
                      unit,
                      ratio: unit === item.unit ? 1 : item.ratio,
                    })
                  }
                >
                  <option>{item.unit}</option>
                  {item.buyUnit && item.buyUnit !== item.unit && (
                    <option>{item.buyUnit}</option>
                  )}
                </Select>
                <Field
                  label="Harga / satuan beli (Rp)"
                  type="number"
                  min={0}
                  step={1}
                  disabled={closed}
                  value={l.cost}
                  onChange={(e) =>
                    lineUpdate(i, { cost: Number(e.target.value) })
                  }
                />
                <div className="conversion-preview">
                  <strong>
                    {l.qty * l.ratio} {item.unit}
                  </strong>
                  <small>
                    {money(l.cost / l.ratio)} / {item.unit}
                  </small>
                  {!closed && (
                    <small>
                      Saldo {balance(state, item.id)} →{" "}
                      {balance(state, item.id) + l.qty * l.ratio}
                    </small>
                  )}
                </div>
                {!closed && (
                  <button
                    className="icon-button"
                    aria-label={`Hapus ${item.name}`}
                    onClick={() =>
                      update({ lines: value.lines.filter((_, j) => j !== i) })
                    }
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!closed && (
          <Select label="Tambahkan barang" value="" onChange={add}>
            <option value="">Pilih suku cadang</option>
            {state.items
              .filter((i) => i.active)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku}: {i.name}
                </option>
              ))}
          </Select>
        )}
      </Panel>
      <ErrorMessage error={error} />
      {!closed && (
        <div className="form-actions">
          <Button variant="secondary" onClick={() => action(() => save(false))}>
            Simpan draft
          </Button>
          {finalize && (
            <Button onClick={() => setConfirm(true)}>
              Finalisasi penerimaan
            </Button>
          )}
        </div>
      )}
      {confirm && (
        <FormModal
          title="Finalisasi penerimaan?"
          onClose={() => setConfirm(false)}
          submit="Konfirmasi finalisasi"
          onSubmit={() => save(true)}
        >
          <p>
            <strong>{value.id}</strong> menambahkan{" "}
            {value.lines.reduce((n, l) => n + l.qty * l.ratio, 0)} satuan dasar
            barang.
          </p>
          <p className="total-row">
            <span>Nilai penerimaan</span>
            <strong>
              {money(value.lines.reduce((n, l) => n + l.qty * l.cost, 0))}
            </strong>
          </p>
          <p className="muted">
            Dokumen final tidak dapat diedit atau dihapus langsung.
          </p>
        </FormModal>
      )}
    </Page>
  );
}
