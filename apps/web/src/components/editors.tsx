import { useState } from "react";
import { useStore } from "../app/store.tsx";
import {
  Button,
  ErrorMessage,
  Field,
  Icon,
  Modal,
  Photo,
  Select,
} from "./ui.tsx";
import { balance, catalogLine, money, subtotal } from "../lib/domain.ts";
import type { Discount, Line } from "../lib/domain.ts";

export function PhotoUpload({
  labels,
  photos,
  onChange,
}: {
  labels: string[];
  photos: string[];
  onChange: (p: string[]) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(-1);
  async function upload(file: File, index: number) {
    setError("");
    setBusy(index);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Gunakan JPEG, PNG, atau WebP maksimal 5 MB.");
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let quality = 0.8;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 1100000 && quality > 0.3) {
        quality -= 0.1;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 1400000)
        throw new Error(
          "Foto terlalu besar setelah kompresi. Gunakan gambar yang lebih kecil.",
        );
      const updated = [...photos];
      updated[index] = data;
      onChange(updated);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Foto gagal diproses. Pilih ulang file; formulir tetap tersimpan di halaman.",
      );
    } finally {
      setBusy(-1);
    }
  }
  return (
    <div>
      <div className="photo-upload-grid">
        {labels.map((label, i) => (
          <div
            className={`upload-tile ${photos[i] ? "filled" : ""}`}
            key={label}
          >
            {photos[i] && <Photo src={photos[i]} alt={label} />}
            <label className="upload-label">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy !== -1}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(e.target.files[0], i);
                  e.target.value = "";
                }}
              />
              <span className="upload-plus">
                <Icon name={photos[i] ? "edit" : "camera"} size={22} />
              </span>
              <span>{busy === i ? "Memproses…" : label}</span>
              <small>{photos[i] ? "Ganti foto" : "Tambahkan foto"}</small>
            </label>
            {photos[i] && (
              <button
                type="button"
                className="upload-remove icon-button"
                aria-label={`Hapus foto ${label}`}
                onClick={() => {
                  const updated = [...photos];
                  updated[i] = "";
                  onChange(updated);
                }}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="field-hint">
        JPEG, PNG, WebP · maksimal 5 MB. Foto demo disimpan di browser.
      </p>
      <ErrorMessage error={error} />
    </div>
  );
}
export function LineEditor({
  lines,
  onChange,
  service = false,
  readonly = false,
  correction = false,
}: {
  lines: Line[];
  onChange: (l: Line[]) => void;
  service?: boolean;
  readonly?: boolean;
  correction?: boolean;
}) {
  const { state } = useStore();
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const catalog = [
    ...(service
      ? state.services
          .filter((s) => s.active)
          .map((s) => ({ ...s, kind: "service" as const }))
      : []),
    ...state.items
      .filter((i) => i.active)
      .map((i) => ({ ...i, kind: "item" as const })),
  ].filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="line-list">
        {lines.map((l) => (
          <div className="line-row" key={l.id}>
            <div className="line-name">
              <strong>{l.name}</strong>
              <small>
                {l.kind === "item"
                  ? `Suku cadang${l.used ? " · Pemakaian dikonfirmasi" : ""}`
                  : "Jasa servis"}
              </small>
            </div>
            {readonly ? (
              <span>{l.qty} ×</span>
            ) : (
              <input
                type="number"
                min={1}
                max={100000}
                className="qty-input"
                aria-label={`Jumlah ${l.name}`}
                value={l.qty}
                disabled={l.used}
                onChange={(e) =>
                  onChange(
                    lines.map((x) =>
                      x.id === l.id ? { ...x, qty: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            )}
            {correction ? (
              <input
                className="correction-price"
                type="number"
                min={0}
                step={1}
                aria-label={`Harga koreksi ${l.name}`}
                value={l.price}
                onChange={(e) =>
                  onChange(
                    lines.map((x) =>
                      x.id === l.id
                        ? { ...x, price: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            ) : (
              <span className="money">{money(l.qty * l.price)}</span>
            )}
            {!readonly && !l.used && (
              <button
                className="icon-button"
                type="button"
                aria-label={`Hapus ${l.name}`}
                onClick={() => onChange(lines.filter((x) => x.id !== l.id))}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!readonly && (
        <Button
          type="button"
          variant="ghost"
          icon="plus"
          onClick={() => setPicker(true)}
        >
          Tambah item
        </Button>
      )}
      <div className="total-row">
        <span>Subtotal</span>
        <strong>{money(subtotal(lines))}</strong>
      </div>
      {picker && (
        <Modal title="Tambah jasa atau barang" onClose={() => setPicker(false)}>
          <input
            autoFocus
            className="full"
            placeholder="Cari nama item…"
            aria-label="Cari item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="picker-list">
            {catalog.map((record) => (
              <button
                type="button"
                key={`${record.kind}-${record.id}`}
                onClick={() => {
                  onChange([...lines, catalogLine(record, record.kind)]);
                  setPicker(false);
                }}
              >
                <span>
                  <strong>{record.name}</strong>
                  <small>
                    {record.kind === "item"
                      ? `Stok ${balance(state, record.id)} ${"unit" in record ? record.unit : ""}`
                      : record.type}
                  </small>
                </span>
                <span>
                  {money(record.price)}
                  <Icon name="plus" size={16} />
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
export function DiscountEditor({
  value,
  onChange,
}: {
  value: Discount;
  onChange: (v: Discount) => void;
}) {
  return (
    <details className="details">
      <summary>
        Diskon <span>{money(value.amount)}</span>
      </summary>
      <div className="form-grid">
        <Field
          label="Potongan (Rp)"
          type="number"
          min={0}
          step={1}
          value={value.amount}
          onChange={(e) =>
            onChange({ ...value, amount: Number(e.target.value) })
          }
        />
        <Field
          label="Alasan diskon"
          value={value.reason}
          required={value.amount > 0}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
        />
      </div>
      <small>Diskon di atas batas role memerlukan persetujuan owner.</small>
    </details>
  );
}
export function CustomerSelect({
  value,
  onChange,
  optional = false,
}: {
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  const { state } = useStore();
  return (
    <Select
      label="Pelanggan"
      value={value}
      onChange={onChange}
      required={!optional}
    >
      <option value="">
        {optional ? "Pelanggan umum" : "Pilih pelanggan"}
      </option>
      {state.customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} {c.contact ? `(${c.contact})` : ""}
        </option>
      ))}
    </Select>
  );
}
