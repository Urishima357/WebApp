import { useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  Photo,
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
  PhotoUpload,
} from "../components/editors.tsx";
import {
  catalogLine,
  dateLabel,
  money,
  newTransaction,
  noDiscount,
  uid,
  vehicleStatuses,
} from "../lib/domain.ts";
import type { Vehicle, VehicleStatus } from "../lib/domain.ts";

export function Showroom({ path }: { path: string }) {
  const id = path.split("/")[2]?.split("?")[0];
  return id ? <VehicleDetail id={id} /> : <VehicleList />;
}
function VehicleList() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(
    new URLSearchParams(location.hash.split("?")[1]).get("status") || "",
  );
  const [view, setView] = useState("grid");
  const [brand, setBrand] = useState("");
  const vehicles = state.vehicles.filter(
    (v) =>
      v.showroom &&
      (!status || v.status === status) &&
      (!brand || v.brand === brand) &&
      `${v.id} ${v.brand} ${v.model} ${v.year} ${v.color} ${v.price} ${v.plate}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <Page
      title="Inventaris motor"
      subtitle={`${state.vehicles.filter((v) => v.showroom && v.status === "Tersedia").length} tersedia · ${state.vehicles.filter((v) => v.showroom && v.status === "Reserved").length} reserved · inventaris demo`}
      action={
        <LinkButton to="/motor/baru" icon="plus">
          Tambah motor
        </LinkButton>
      }
    >
      <div className="inventory-toolbar">
        <Search
          value={q}
          onChange={setQ}
          placeholder="Cari merek, model, tahun, atau kode"
        />
        <div className="inline">
          <select
            aria-label="Filter merek"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">Semua merek</option>
            {[
              ...new Set(
                state.vehicles.filter((v) => v.showroom).map((v) => v.brand),
              ),
            ].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <div className="view-toggle">
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
              aria-label="Tampilan kartu"
              aria-pressed={view === "grid"}
            >
              <Icon name="grid" size={18} />
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              aria-label="Tampilan daftar"
              aria-pressed={view === "list"}
            >
              <Icon name="list" size={18} />
            </button>
          </div>
        </div>
      </div>
      <Tabs
        options={[
          {
            id: "",
            label: "Semua",
            count: state.vehicles.filter((v) => v.showroom).length,
          },
          ...vehicleStatuses.map((s) => ({
            id: s,
            label: s,
            count: state.vehicles.filter((v) => v.showroom && v.status === s)
              .length,
          })),
        ]}
        value={status}
        onChange={setStatus}
      />
      {view === "grid" ? (
        <div className="motor-grid">
          {vehicles.map((v) => (
            <a key={v.id} href={href(`/motor/${v.id}`)} className="motor-card">
              <div className="motor-image" style={{ viewTransitionName: `motor-${v.id}` } as CSSProperties}>
                <Photo
                  src={v.photos[0]}
                  alt={`${v.brand} ${v.model}, foto contoh`}
                />
                <div className="motor-badge">
                  <Badge>{v.status}</Badge>
                </div>
              </div>
              <div className="motor-card-body">
                <div>
                  <h2>
                    {v.brand} {v.model}
                  </h2>
                  <span>
                    {v.year || "Tahun belum dicatat"} · {v.color}
                  </span>
                </div>
                <div className="motor-card-price">
                  <span className="motor-year">{v.year || "Tahun belum dicatat"}</span>
                  <strong>{money(v.price)}</strong>
                </div>
                {v.status === "Draft" &&
                  v.photos.filter(Boolean).length < 3 && (
                    <small className="amber-text">Foto belum lengkap</small>
                  )}
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Panel>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Motor</th>
                  <th>Tahun</th>
                  <th>Harga jual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <a className="stack-link" href={href(`/motor/${v.id}`)}>
                        <strong>
                          {v.brand} {v.model}
                        </strong>
                        <small>{v.id}</small>
                      </a>
                    </td>
                    <td>{v.year || "Belum dicatat"}</td>
                    <td>{money(v.price)}</td>
                    <td>
                      <Badge>{v.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {!vehicles.length && (
        <Empty
          title="Motor belum ditemukan"
          description="Ubah pencarian atau tambahkan motor baru."
        />
      )}
    </Page>
  );
}
function VehicleDetail({ id }: { id: string }) {
  const { state, run, notify } = useStore();
  const owner = useCan("settings");
  const sell = useCan("motor.finalize");
  const v = state.vehicles.find((v) => v.id === id);
  const [photo, setPhoto] = useState(0);
  const photoFrame = useRef<HTMLDivElement>(null);
  const photoAnimation = useRef<Animation | null>(null);
  const [modal, setModal] = useState("");
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(noDiscount());
  const { error, action } = useAction();
  if (!v) return <Empty title="Motor tidak ditemukan" />;
  function makeSale(data: FormData) {
    if (!v) return;
    const t = newTransaction("Motor", state);
    t.vehicleId = v.id;
    t.customerId = String(data.get("customer"));
    t.lines = [catalogLine(v, "vehicle")];
    t.discount = discount;
    run({ type: "transaction", value: t });
    go(`/pembayaran/${t.id}`);
  }
  return (
    <Page
      title={`${v.brand} ${v.model}`}
      subtitle={`${v.id} · ${v.year || "Tahun belum dicatat"}`}
      back="/motor"
      action={
        <LinkButton secondary to={`/motor/${v.id}/edit`} icon="edit">
          Ubah motor
        </LinkButton>
      }
    >
      <ErrorMessage error={error} />
      <div className="vehicle-detail-grid">
        <div>
          <div className="detail-motor-photo" ref={photoFrame} style={{ viewTransitionName: `motor-${v.id}` } as CSSProperties}>
            <Photo
              src={v.photos[photo]}
              alt={`${v.model}, foto ${photo + 1}`}
              priority
            />
            <div className="motor-badge">
              <Badge>{v.status}</Badge>
            </div>
          </div>
          <div className="photo-thumbnails">
            {["Depan", "Kanan", "Kiri"].map((label, i) => (
              <button
                key={label}
                className={photo === i ? "active" : ""}
                aria-label={`Lihat foto ${label}`}
                aria-pressed={photo === i}
                onClick={() => {
                  if (i === photo) return;
                  setPhoto(i);
                  photoAnimation.current?.cancel();
                  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
                    photoAnimation.current = photoFrame.current?.animate(
                      [{ opacity: 0.3, transform: "scale(1.012)" }, { opacity: 1, transform: "scale(1)" }],
                      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
                    ) || null;
                  }
                }}
              >
                <Photo src={v.photos[i]} alt={label} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="side-stack">
          <Panel>
            <span className="muted">Harga jual</span>
            <div className="vehicle-price">{money(v.price)}</div>
            <dl className="spec-list">
              <dt>Merek / tahun</dt>
              <dd>
                {v.brand} / {v.year || "Belum dicatat"}
              </dd>
              <dt>Warna</dt>
              <dd>{v.color || "Belum dicatat"}</dd>
              <dt>Nomor polisi</dt>
              <dd>{v.plate || "Belum dicatat"}</dd>
              <dt>Pemilik</dt>
              <dd>
                {v.customerId
                  ? state.customers.find((c) => c.id === v.customerId)?.name
                  : state.settings.name}
              </dd>
              {owner && (
                <>
                  <dt>Harga modal</dt>
                  <dd>{money(v.cost)}</dd>
                </>
              )}
            </dl>
            {v.status === "Reserved" && (
              <p className="notice">
                Reserved untuk{" "}
                {state.customers.find((c) => c.id === v.reservedFor)?.name}
                <br />
                <small>{dateLabel(v.reservedAt, true)} · tanpa deposit</small>
              </p>
            )}
            <div className="form-stack">
              {sell && ["Tersedia", "Reserved"].includes(v.status) && (
                <Button
                  icon="receipt"
                  className="full"
                  onClick={() => {
                    setCustomer(v.reservedFor);
                    setModal("sale");
                  }}
                >
                  Catat penjualan
                </Button>
              )}
              {v.status === "Tersedia" && (
                <Button variant="secondary" onClick={() => setModal("reserve")}>
                  Reservasi motor
                </Button>
              )}
              {v.status === "Reserved" && (
                <Button
                  variant="secondary"
                  onClick={() => setModal("unreserve")}
                >
                  Lepas reservasi
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Kondisi motor">
            <p className="muted">{v.notes || "Belum ada catatan kondisi."}</p>
            <details className="details">
              <summary>Identitas kendaraan</summary>
              <dl>
                <dt>Nomor rangka</dt>
                <dd>{v.chassis || "Belum dicatat"}</dd>
                <dt>Nomor mesin</dt>
                <dd>{v.engine || "Belum dicatat"}</dd>
              </dl>
            </details>
          </Panel>
        </div>
      </div>
      {modal === "reserve" && (
        <FormModal
          title="Reservasi motor"
          onClose={() => setModal("")}
          submit="Catat reservasi"
          onSubmit={() => {
            run({ type: "reserve", id, customerId: customer });
            notify("Reservasi tercatat tanpa deposit.");
          }}
        >
          <CustomerSelect value={customer} onChange={setCustomer} />
          <p className="muted">
            Motor disimpan untuk pelanggan terpilih. Tidak ada pembayaran
            deposit.
          </p>
        </FormModal>
      )}
      {modal === "unreserve" && (
        <FormModal
          title="Lepas reservasi?"
          onClose={() => setModal("")}
          submit="Lepas reservasi"
          onSubmit={() => {
            run({ type: "unreserve", id });
            notify("Motor tersedia kembali.");
          }}
        >
          <p>
            Reservasi pelanggan dilepas; status kembali Tersedia. Histori tetap
            tercatat.
          </p>
        </FormModal>
      )}
      {modal === "sale" && (
        <FormModal
          title="Catat penjualan motor"
          onClose={() => setModal("")}
          submit="Lanjut pembayaran"
          onSubmit={makeSale}
        >
          <div className="total-row">
            <span>
              {v.brand} {v.model}
            </span>
            <strong>{money(v.price)}</strong>
          </div>
          <label className="field">
            <span>Pelanggan *</span>
            <select
              name="customer"
              value={customer}
              required
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Pilih pelanggan</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <DiscountEditor value={discount} onChange={setDiscount} />
          <p className="muted">
            Penjualan dan perpindahan kepemilikan hanya final setelah pembayaran
            penuh terverifikasi.
          </p>
        </FormModal>
      )}
    </Page>
  );
}
export function VehicleEditor({
  id,
  customerId,
}: {
  id?: string;
  customerId?: string;
}) {
  const { state, run, notify } = useStore();
  const owner = useCan("settings");
  const original = state.vehicles.find((v) => v.id === id);
  const [value, setValue] = useState<Vehicle>(() =>
    original
      ? structuredClone(original)
      : {
          id: `MTR-${uid().slice(0, 8).toUpperCase()}`,
          brand: "",
          model: "",
          year: "",
          color: "",
          plate: "",
          chassis: "",
          engine: "",
          customerId: customerId || "",
          showroom: !customerId,
          status: "Draft",
          price: 0,
          cost: 0,
          notes: "",
          photos: [],
          reservedFor: "",
          reservedAt: "",
        },
  );
  const [dirty, setDirty] = useState(false);
  const { error, action } = useAction();
  useUnsaved(dirty);
  const update = (v: Partial<Vehicle>) => {
    setValue({ ...value, ...v });
    setDirty(true);
  };
  const duplicates = state.vehicles.filter(
    (v) =>
      v.id !== value.id &&
      value.plate &&
      v.plate.replace(/\s/g, "").toUpperCase() ===
        value.plate.replace(/\s/g, "").toUpperCase(),
  );
  return (
    <Page
      title={id ? "Data motor" : "Tambah motor"}
      back={id ? `/motor/${id}` : "/motor"}
      subtitle="Satu identitas motor, dari showroom sampai servis."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action(() => {
            run({ type: "vehicle", value });
            setDirty(false);
            notify("Motor tersimpan.");
            go(`/motor/${value.id}`);
          });
        }}
      >
        <div className="two-column">
          <Panel title="Identitas motor">
            <div className="form-stack">
              <div className="form-grid">
                <Field
                  label="Merek"
                  value={value.brand}
                  onChange={(e) => update({ brand: e.target.value })}
                  required
                  maxLength={80}
                />
                <Field
                  label="Model / tipe"
                  value={value.model}
                  onChange={(e) => update({ model: e.target.value })}
                  required
                  maxLength={100}
                />
                <Field
                  label="Tahun (opsional)"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={value.year}
                  onChange={(e) => update({ year: e.target.value })}
                />
                <Field
                  label="Warna"
                  value={value.color}
                  onChange={(e) => update({ color: e.target.value })}
                  maxLength={60}
                />
              </div>
              <Field
                label="Nomor polisi (opsional)"
                value={value.plate}
                onChange={(e) =>
                  update({ plate: e.target.value.toUpperCase() })
                }
                maxLength={20}
              />
              {duplicates.length > 0 && (
                <p className="notice">
                  Pelat serupa ditemukan:{" "}
                  {duplicates.map((v) => `${v.brand} ${v.model}`).join(", ")}.
                  Pastikan bukan motor yang sama.
                </p>
              )}
              <details className="details">
                <summary>Nomor rangka & mesin</summary>
                <div className="form-stack">
                  <Field
                    label="Nomor rangka (jika tersedia)"
                    value={value.chassis}
                    onChange={(e) =>
                      update({ chassis: e.target.value.toUpperCase() })
                    }
                    maxLength={60}
                  />
                  <Field
                    label="Nomor mesin (jika tersedia)"
                    value={value.engine}
                    onChange={(e) =>
                      update({ engine: e.target.value.toUpperCase() })
                    }
                    maxLength={60}
                  />
                </div>
              </details>
              <TextArea
                label="Catatan kondisi"
                value={value.notes}
                onChange={(notes) => update({ notes })}
              />
              <div className="form-grid">
                {owner && (
                  <Field
                    label="Harga modal (Rp)"
                    type="number"
                    min={0}
                    step={1}
                    value={value.cost}
                    onChange={(e) => update({ cost: Number(e.target.value) })}
                  />
                )}
                <Field
                  label="Harga jual (Rp)"
                  type="number"
                  min={0}
                  step={1}
                  value={value.price}
                  onChange={(e) => update({ price: Number(e.target.value) })}
                  required
                />
              </div>
              <Select
                label="Status inventaris"
                value={value.status}
                onChange={(status) =>
                  update({ status: status as VehicleStatus })
                }
                disabled={original?.status === "Terjual"}
              >
                {vehicleStatuses
                  .filter(
                    (s) =>
                      !["Reserved", "Terjual"].includes(s) ||
                      s === original?.status,
                  )
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </Select>
            </div>
          </Panel>
          <Panel title="Foto motor">
            <PhotoUpload
              labels={["Depan", "Samping kanan", "Samping kiri"]}
              photos={value.photos}
              onChange={(photos) => update({ photos })}
            />
            <p className="notice">
              Tiga foto wajib sebelum status Tersedia. Foto pertama menjadi foto
              utama.
            </p>
          </Panel>
        </div>
        <ErrorMessage error={error} />
        <div className="form-actions">
          <LinkButton secondary to={id ? `/motor/${id}` : "/motor"}>
            Batal
          </LinkButton>
          <Button type="submit">Simpan motor</Button>
        </div>
      </form>
    </Page>
  );
}
