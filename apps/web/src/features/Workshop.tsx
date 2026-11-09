import { useState } from "react";
import { useStore } from "../app/store.tsx";
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
  TextArea,
  go,
  href,
  useAction,
  useUnsaved,
} from "../components/ui.tsx";
import {
  CustomerSelect,
  DiscountEditor,
  LineEditor,
  PhotoUpload,
} from "../components/editors.tsx";
import {
  dateLabel,
  documentId,
  money,
  noDiscount,
  total,
  uid,
  woStatuses,
} from "../lib/domain.ts";
import type { Approval, WorkOrder, WOStatus } from "../lib/domain.ts";

export function Workshop({ path }: { path: string }) {
  const id = path.split("/")[2]?.split("?")[0];
  return id === "baru" ? (
    <WorkEditor />
  ) : id ? (
    <WorkDetail id={id} />
  ) : (
    <WorkList />
  );
}
function WorkList() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("active");
  const [status, setStatus] = useState(
    new URLSearchParams(location.hash.split("?")[1]).get("status") || "",
  );
  const [mechanic, setMechanic] = useState("");
  const active = state.workOrders.filter((w) => !["Selesai", "Dibatalkan"].includes(w.status));
  const rows = state.workOrders
    .filter(
      (w) =>
        (tab === "active"
          ? !["Selesai", "Dibatalkan"].includes(w.status)
          : ["Selesai", "Dibatalkan"].includes(w.status)) &&
        (!status || w.status === status) &&
        (!mechanic || w.mechanic === mechanic),
    )
    .filter((w) => {
      const v = state.vehicles.find((v) => v.id === w.vehicleId);
      const c = state.customers.find((c) => c.id === w.customerId);
      return `${w.id} ${v?.plate} ${v?.model} ${c?.name}`
        .toLowerCase()
        .includes(q.toLowerCase());
    });
  return (
    <Page
      title="Daftar servis"
      subtitle={`${dateLabel(new Date().toISOString())} · ${active.length} pekerjaan aktif`}
      action={
        <LinkButton to="/bengkel/baru" icon="plus">
          Terima motor
        </LinkButton>
      }
    >
      <div className="workshop-list">
        <Tabs
          options={[
            { id: "active", label: "Aktif", count: active.length },
            { id: "history", label: "Riwayat", count: state.workOrders.length - active.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="work-status-filters" aria-label="Ringkasan status servis">
          {[{ label: "Total aktif", value: "", count: active.length }, ...woStatuses.filter((s) => !["Draft", "Selesai", "Dibatalkan"].includes(s)).map((s) => ({ label: s, value: s, count: active.filter((w) => w.status === s).length }))].map((s) => (
            <button key={s.label} className={status === s.value ? "selected" : ""} aria-pressed={status === s.value} onClick={() => { setStatus(s.value); setTab("active"); }}>
              <span>{s.label}</span><strong>{s.count}</strong>
            </button>
          ))}
        </div>
        <Panel className="workshop-filters">
        <div className="toolbar">
          <Search
            value={q}
            onChange={setQ}
            placeholder="Cari pelat, pelanggan, atau WO"
          />
          <div className="toolbar-filters">
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua status</option>
              {woStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {(q || status || mechanic) && <Button variant="ghost" onClick={() => { setQ(""); setStatus(""); setMechanic(""); }}>Reset filter</Button>}
            <select
              aria-label="Filter mekanik"
              value={mechanic}
              onChange={(e) => setMechanic(e.target.value)}
            >
              <option value="">Semua mekanik</option>
              {state.mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        </Panel>
        <Panel className="workshop-table">
        <div className="table-wrap desktop-work-orders">
          <table>
            <thead>
              <tr>
                <th>No. WO</th>
                <th>Pelat & model motor</th>
                <th className="hide-mobile">Pelanggan</th>
                <th className="hide-mobile">Mekanik</th>
                <th>Status</th>
                <th scope="col">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const v = state.vehicles.find((v) => v.id === w.vehicleId)!;
                return (
                  <tr key={w.id}>
                    <td>
                      <a className="stack-link" href={href(`/bengkel/${w.id}`)}>
                        <strong className="document-link">{w.id}</strong>
                      </a>
                    </td>
                    <td><a className="vehicle-cell" href={href(`/bengkel/${w.id}`)}><span className="plate">{v.plate || "Tanpa pelat"}</span><span>{v.brand} {v.model}</span></a></td>
                    <td className="hide-mobile">
                      {state.customers.find((c) => c.id === w.customerId)?.name}
                    </td>
                    <td className="hide-mobile">
                      {state.mechanics.find((m) => m.id === w.mechanic)?.name}
                    </td>
                    <td>
                      <Badge>{w.status}</Badge>
                    </td>
                    <td>
                      <a
                        className="text-link"
                        href={href(`/bengkel/${w.id}`)}
                        aria-label={`Buka ${w.id}`}
                      >
                        {w.status === "Siap Diambil" ? "Serah terima" : "Rincian"}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mobile-work-orders">
          {rows.map((w) => {
            const v = state.vehicles.find((v) => v.id === w.vehicleId)!;
            const mechanicName = state.mechanics.find((m) => m.id === w.mechanic)?.name || "Belum ditugaskan";
            return <a key={w.id} href={href(`/bengkel/${w.id}`)} className="work-order-card">
              <div className="work-order-card-top"><strong className="document-link">{w.id}</strong><Badge>{w.status}</Badge></div>
              <h2>{v.brand} {v.model}</h2><span className="plate">{v.plate || "Tanpa pelat"}</span>
              <div className="work-order-card-bottom"><span>{state.customers.find((c) => c.id === w.customerId)?.name || "Pelanggan belum dicatat"}</span><span>Mekanik: {mechanicName}</span></div>
            </a>;
          })}
        </div>
        {!rows.length && (
          <Empty
            title="Belum ada pekerjaan"
            description="Terima motor baru atau sesuaikan filter."
          />
        )}
        </Panel>
      </div>
    </Page>
  );
}
function WorkEditor() {
  const { state, run, notify, user } = useStore();
  const { error, action } = useAction();
  const [dirty, setDirty] = useState(false);
  useUnsaved(dirty);
  const [value, setValue] = useState<WorkOrder>(() => ({
    id: documentId(
      "WO",
      state.workOrders.map((w) => w.id),
    ),
    vehicleId: "",
    customerId: "",
    date: new Date().toISOString(),
    status: "Draft",
    complaint: "",
    condition: "",
    inspection: "",
    recommendation: "",
    km: "",
    mechanic: state.mechanics.find((m) => m.active)?.id || "",
    photos: [],
    lines: [],
    discount: noDiscount(),
    approval: "Menunggu",
    approvedTotal: 0,
    confirmations: [],
    history: [],
    handover: "",
  }));
  const update = (patch: Partial<WorkOrder>) => {
    setValue({ ...value, ...patch });
    setDirty(true);
  };
  function save() {
    action(() => {
      run({ type: "wo", value });
      setDirty(false);
      notify("Draft work order tersimpan.");
      go(`/bengkel/${value.id}`);
    });
  }
  return (
    <Page title="Terima motor" back="/bengkel" subtitle={value.id}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="two-column">
          <Panel title="Pelanggan & motor">
            <div className="form-stack">
              <CustomerSelect
                value={value.customerId}
                onChange={(v) => update({ customerId: v, vehicleId: "" })}
              />
              <a className="text-link" href={href("/pelanggan")}>
                Tambah pelanggan atau motor
              </a>
              <Select
                label="Motor pelanggan"
                value={value.vehicleId}
                onChange={(v) => update({ vehicleId: v })}
                required
              >
                <option value="">Pilih motor</option>
                {state.vehicles
                  .filter((v) => v.customerId === value.customerId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} · {v.plate || "Tanpa pelat"}
                    </option>
                  ))}
              </Select>
              <TextArea
                label="Keluhan pelanggan"
                required
                value={value.complaint}
                onChange={(v) => update({ complaint: v })}
              />
              <div className="form-grid">
                <Field
                  label="Kilometer (opsional)"
                  type="number"
                  min={0}
                  value={value.km}
                  onChange={(e) => update({ km: e.target.value })}
                />
                <Select
                  label="Mekanik / PIC"
                  value={value.mechanic}
                  onChange={(v) => update({ mechanic: v })}
                  required
                >
                  {state.mechanics
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </Select>
              </div>
              <TextArea
                label="Kondisi awal"
                value={value.condition}
                onChange={(v) => update({ condition: v })}
              />
              <p className="field-hint">
                Penerima: {user?.name} · {dateLabel(value.date, true)}
              </p>
            </div>
          </Panel>
          <Panel title="Foto kondisi awal">
            <PhotoUpload
              labels={["Tampilan umum", "Bagian bermasalah"]}
              photos={value.photos}
              onChange={(p) => update({ photos: p })}
            />
            <p className="notice">
              Lengkapi kedua foto sebelum pengerjaan dimulai. Draft tetap dapat
              disimpan.
            </p>
          </Panel>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <LinkButton to="/bengkel" secondary>
            Batal
          </LinkButton>
          <Button type="submit" icon="check">
            Simpan draft WO
          </Button>
        </div>
      </form>
    </Page>
  );
}
function WorkDetail({ id }: { id: string }) {
  const { state, run, notify } = useStore();
  const w = state.workOrders.find((w) => w.id === id);
  const [tab, setTab] = useState("work");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<WorkOrder | null>(null);
  const [modal, setModal] = useState("");
  const [lineId, setLineId] = useState("");
  const { error, action } = useAction();
  useUnsaved(editing);
  if (!w) return <Empty title="Work order tidak ditemukan" />;
  const v = state.vehicles.find((v) => v.id === w.vehicleId)!;
  const c = state.customers.find((c) => c.id === w.customerId)!;
  const t = state.transactions.find(
    (t) => t.woId === w.id && t.status !== "Batal",
  );
  const d = form || w;
  const perform = (fn: () => void, message: string) =>
    action(() => {
      fn();
      notify(message);
    });
  const startEditing = () => {
    setForm(structuredClone(w));
    setEditing(true);
  };
  const readonly =
    ["Selesai", "Dibatalkan"].includes(w.status) || !!t;
  const changeStatus = (status: WOStatus) =>
    perform(
      () => run({ type: "woStatus", id, status, reason: "" }),
      `WO ${status.toLowerCase()}.`,
    );
  return (
    <Page
      title={v.plate || `${v.brand} ${v.model}`}
      subtitle={`${v.brand} ${v.model} · ${w.id}`}
      back="/bengkel"
      action={
        <>
          <Badge>{w.status}</Badge>
          {!readonly && !editing && (
            <Button variant="secondary" icon="edit" onClick={startEditing}>
              Ubah pekerjaan
            </Button>
          )}
          {editing && (
            <Button
              onClick={() =>
                perform(() => {
                  run({ type: "wo", value: d });
                  setForm(null);
                  setEditing(false);
                }, "Pekerjaan tersimpan.")
              }
            >
              Simpan perubahan
            </Button>
          )}
        </>
      }
    >
      <div className="detail-summary">
        <span>
          <Icon name="users" size={17} />
          {c.name}
        </span>
        <span>
          <Icon name="wrench" size={17} />
          {state.mechanics.find((m) => m.id === w.mechanic)?.name}
        </span>
        <span>
          <Icon name="clock" size={17} />
          {dateLabel(w.date, true)}
        </span>
        {w.km && <span>{Number(w.km).toLocaleString("id-ID")} km</span>}
      </div>
      <ErrorMessage error={error} />
      <Tabs
        options={[
          { id: "work", label: "Pekerjaan" },
          { id: "estimate", label: "Estimasi & persetujuan" },
          {
            id: "photos",
            label: "Foto",
            count: w.photos.filter(Boolean).length,
          },
          { id: "history", label: "Riwayat" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "work" && (
        <div className="detail-columns">
          <Panel
            title="Jasa & suku cadang"
            action={
              !readonly && !editing ? (
                <span className="subtle-label">Pekerjaan aktual</span>
              ) : undefined
            }
          >
            <LineEditor
              service
              lines={d.lines}
              readonly={!editing}
              onChange={(lines) => setForm({ ...d, lines })}
            />
            {editing && (
              <DiscountEditor
                value={d.discount}
                onChange={(discount) => setForm({ ...d, discount })}
              />
            )}
            <div className="total-row grand">
              <span>Total</span>
              <strong>{money(total(d))}</strong>
            </div>
            {!editing &&
              !readonly &&
              w.lines.some((l) => l.kind === "item") && (
                <div className="parts-use">
                  <h3>Pemakaian barang</h3>
                  {w.lines
                    .filter((l) => l.kind === "item")
                    .map((l) => (
                      <div className="list-row" key={l.id}>
                        <span>
                          <strong>{l.name}</strong>
                          <small>
                            {l.used
                              ? "Stok sudah dipotong saat dikonfirmasi"
                              : "Belum dikonfirmasi"}
                          </small>
                        </span>
                        <Button
                          variant="secondary"
                          disabled={!l.used && w.status !== "Dikerjakan"}
                          onClick={() => {
                            setLineId(l.id);
                            setModal(l.used ? "return" : "use");
                          }}
                        >
                          {l.used ? "Kembalikan" : "Konfirmasi"}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
          </Panel>
          <div className="side-stack">
            <Panel title="Catatan motor">
              <dl>
                <dt>Keluhan</dt>
                <dd>{w.complaint}</dd>
                <dt>Kondisi awal</dt>
                <dd>{w.condition || "Belum dicatat"}</dd>
              </dl>
            </Panel>
            <Panel title="Estimasi">
              <div className="approval-summary">
                <Badge>{w.approval}</Badge>
                <strong>{money(w.approvedTotal)}</strong>
                <button
                  className="text-link"
                  onClick={() => setTab("estimate")}
                >
                  Rincian persetujuan
                </button>
              </div>
            </Panel>
          </div>
        </div>
      )}
      {tab === "estimate" && (
        <Panel title="Pemeriksaan & estimasi">
          <div className="form-stack">
            {editing ? (
              <>
                <TextArea
                  label="Hasil inspeksi"
                  value={d.inspection}
                  onChange={(inspection) => setForm({ ...d, inspection })}
                />
                <TextArea
                  label="Rekomendasi"
                  value={d.recommendation}
                  onChange={(recommendation) =>
                    setForm({ ...d, recommendation })
                  }
                />
              </>
            ) : (
              <div className="form-grid">
                <dl>
                  <dt>Hasil inspeksi</dt>
                  <dd>{w.inspection || "Belum dicatat"}</dd>
                </dl>
                <dl>
                  <dt>Rekomendasi</dt>
                  <dd>{w.recommendation || "Belum dicatat"}</dd>
                </dl>
              </div>
            )}
            <div className="total-row">
              <span>Nilai estimasi saat ini</span>
              <strong>{money(total(d))}</strong>
            </div>
            <div className="inline">
              <Badge>{w.approval}</Badge>
              {!readonly && (
                <Button variant="secondary" onClick={() => setModal("approve")}>
                  Catat persetujuan
                </Button>
              )}
            </div>
            {w.confirmations.map((a, i) => (
              <div className="history-row" key={i}>
                <Icon name="check" size={17} />
                <div>
                  <strong>
                    {a.name} · {a.method}
                  </strong>
                  <p>
                    {money(a.amount)} · {dateLabel(a.date, true)} · dicatat{" "}
                    {a.actor}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {tab === "photos" && (
        <Panel title="Foto kondisi awal">
          {readonly ? (
            <div className="photo-upload-grid">
              {w.photos.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Kondisi awal ${i + 1}`}
                  className="readonly-photo"
                  width="640"
                  height="420"
                  loading="lazy"
                />
              ))}
            </div>
          ) : (
            <PhotoUpload
              labels={["Tampilan umum", "Bagian bermasalah"]}
              photos={d.photos}
              onChange={(photos) => {
                setForm({ ...d, photos });
                setEditing(true);
              }}
            />
          )}{" "}
          {editing && (
            <p className="field-hint">
              Simpan perubahan setelah mengganti foto.
            </p>
          )}
        </Panel>
      )}
      {tab === "history" && (
        <Panel title="Perjalanan pekerjaan">
          <div className="timeline">
            {w.history.map((h, i) => (
              <div className="history-row" key={i}>
                <span className="timeline-dot" />
                <div>
                  <strong>{h.status}</strong>
                  <p>
                    {dateLabel(h.date, true)} · {h.actor}
                  </p>
                  {h.reason && <small>{h.reason}</small>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {!editing && (
        <div className="form-actions">
          <div className="inline">
            {!readonly && (
              <Button variant="ghost" onClick={() => setModal("cancel")}>
                Batalkan WO
              </Button>
            )}
            {t && (
              <LinkButton
                secondary
                to={
                  t.status === "Final" ? `/nota/${t.id}` : `/pembayaran/${t.id}`
                }
              >
                {t.status === "Final" ? "Lihat nota" : "Lihat pembayaran"}
              </LinkButton>
            )}
          </div>
          <div className="inline">
            {w.status === "Draft" && (
              <Button onClick={() => changeStatus("Inspeksi")}>
                Mulai inspeksi
              </Button>
            )}
            {w.status === "Inspeksi" && (
              <Button onClick={() => changeStatus("Menunggu Persetujuan")}>
                Ajukan estimasi
              </Button>
            )}
            {["Menunggu Persetujuan", "Menunggu Barang"].includes(w.status) && (
              <Button onClick={() => changeStatus("Dikerjakan")}>
                Mulai pengerjaan
              </Button>
            )}
            {w.status === "Dikerjakan" && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => changeStatus("Menunggu Barang")}
                >
                  Menunggu barang
                </Button>
                <Button onClick={() => changeStatus("Siap Diambil")}>
                  Siap diambil
                </Button>
              </>
            )}
            {w.status === "Siap Diambil" && t?.status !== "Final" && (
              <Button
                onClick={() =>
                  perform(() => {
                    const next = t ? state : run({ type: "checkoutWO", id });
                    const transaction = next.transactions.find(
                      (x) => x.woId === id && x.status !== "Batal",
                    );
                    if (transaction) go(`/pembayaran/${transaction.id}`);
                  }, "Tagihan servis siap.")
                }
              >
                Lanjut pembayaran
              </Button>
            )}
            {w.status === "Siap Diambil" && t?.status === "Final" && (
              <Button onClick={() => setModal("handover")}>
                Serahkan motor
              </Button>
            )}
          </div>
        </div>
      )}
      {modal === "approve" && (
        <FormModal
          title="Catat persetujuan pelanggan"
          onClose={() => setModal("")}
          submit="Catat persetujuan"
          onSubmit={(data) => {
            run({
              type: "approveEstimate",
              id,
              name: String(data.get("name")),
              method: String(data.get("method")),
              decision: String(data.get("decision")) as Approval,
              date: new Date(String(data.get("date"))).toISOString(),
            });
            notify("Persetujuan pelanggan tercatat.");
          }}
        >
          <Field
            label="Pemberi persetujuan"
            name="name"
            defaultValue={c.name}
            required
          />
          <label className="field">
            <span>Metode konfirmasi</span>
            <select name="method">
              <option>Telepon</option>
              <option>Langsung</option>
              <option>WhatsApp (pencatatan manual)</option>
            </select>
          </label>
          <Field
            label="Waktu"
            name="date"
            type="datetime-local"
            defaultValue={new Date(
              Date.now() - new Date().getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
            required
          />
          <label className="field">
            <span>Keputusan</span>
            <select name="decision">
              <option>Disetujui</option>
              <option>Ditolak</option>
              <option>Direvisi</option>
              <option>Menunggu</option>
            </select>
          </label>
          <p className="total-row">
            <span>Nilai estimasi</span>
            <strong>{money(total(w))}</strong>
          </p>
        </FormModal>
      )}
      {["cancel", "return", "use", "handover"].includes(modal) && (
        <FormModal
          title={
            modal === "cancel"
              ? "Batalkan work order?"
              : modal === "return"
                ? "Kembalikan suku cadang"
                : modal === "use"
                  ? "Konfirmasi pemakaian"
                  : "Serah terima motor"
          }
          onClose={() => setModal("")}
          submit={
            modal === "cancel"
              ? "Batalkan WO"
              : modal === "handover"
                ? "Selesaikan WO"
                : "Konfirmasi"
          }
          danger={modal === "cancel"}
          onSubmit={(data) => {
            if (modal === "handover")
              run({ type: "handover", id, name: String(data.get("name")) });
            else if (modal === "cancel")
              run({
                type: "woStatus",
                id,
                status: "Dibatalkan",
                reason: String(data.get("reason")),
              });
            else
              run({
                type: modal === "use" ? "usePart" : "returnPart",
                id,
                lineId,
                reason: String(data.get("reason") || ""),
              });
            notify("Perubahan tercatat.");
          }}
        >
          <p>
            {modal === "use"
              ? `Stok ${w.lines.find((l) => l.id === lineId)?.name} akan berkurang ${w.lines.find((l) => l.id === lineId)?.qty} unit. Pembayaran tidak memotong stok lagi.`
              : modal === "cancel"
                ? "WO dibatalkan. Barang yang sudah keluar dikembalikan melalui movement pembalik; histori tetap tersedia."
                : modal === "return"
                  ? "Barang dikembalikan ke stok dengan referensi movement asli."
                  : "Pastikan pembayaran lunas dan motor telah diserahkan kepada penerima."}
          </p>
          {modal === "handover" ? (
            <Field
              label="Nama penerima"
              name="name"
              defaultValue={c.name}
              required
            />
          ) : (
            modal !== "use" && (
              <Field label="Alasan" name="reason" required maxLength={2000} />
            )
          )}
        </FormModal>
      )}
    </Page>
  );
}
