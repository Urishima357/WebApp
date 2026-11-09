export type Role = "Owner" | "Staf Bengkel" | "Staf Showroom" | "Staf Gudang";
export type WOStatus =
  | "Draft"
  | "Inspeksi"
  | "Menunggu Persetujuan"
  | "Menunggu Barang"
  | "Dikerjakan"
  | "Siap Diambil"
  | "Selesai"
  | "Dibatalkan";
export type VehicleStatus =
  "Draft" | "Tersedia" | "Reserved" | "Terjual" | "Diarsipkan";
export type PaymentStatus =
  "Pending" | "Paid" | "Failed" | "Expired" | "Cancelled";
export type Method = "Tunai" | "Transfer bank" | "QRIS" | "E-wallet";
export type Approval = "Menunggu" | "Disetujui" | "Ditolak" | "Direvisi";
export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  permissions: string[];
}
export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
}
export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  plate: string;
  chassis: string;
  engine: string;
  customerId: string;
  showroom: boolean;
  status: VehicleStatus;
  price: number;
  cost: number;
  notes: string;
  photos: string[];
  reservedFor: string;
  reservedAt: string;
}
export interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  buyUnit: string;
  ratio: number;
  price: number;
  cost: number;
  minimum: number;
  rack: string;
  tracked: boolean;
  active: boolean;
}
export interface Service {
  id: string;
  name: string;
  type: "Internal" | "Vendor Luar";
  price: number;
  cost: number;
  active: boolean;
}
export interface NamedRecord {
  id: string;
  name: string;
  active: boolean;
}
export interface Supplier extends NamedRecord {
  contact: string;
  address: string;
}
export interface Line {
  id: string;
  kind: "item" | "service" | "vehicle";
  ref: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
  used: boolean;
}
export interface Discount {
  amount: number;
  reason: string;
  status: Approval;
}
export interface WorkOrder {
  id: string;
  vehicleId: string;
  customerId: string;
  date: string;
  status: WOStatus;
  complaint: string;
  condition: string;
  inspection: string;
  recommendation: string;
  km: string;
  mechanic: string;
  photos: string[];
  lines: Line[];
  discount: Discount;
  approval: Approval;
  approvedTotal: number;
  confirmations: {
    name: string;
    method: string;
    date: string;
    amount: number;
    actor: string;
  }[];
  history: { date: string; status: string; actor: string; reason: string }[];
  handover: string;
}
export interface Transaction {
  id: string;
  kind: "Servis" | "Barang" | "Motor";
  woId: string;
  vehicleId: string;
  customerId: string;
  lines: Line[];
  discount: Discount;
  status: "Draft" | "Menunggu Pembayaran" | "Final" | "Batal";
  paymentStatus: PaymentStatus;
  method: Method | "";
  received: number;
  change: number;
  date: string;
  paidAt: string;
  verifier: string;
  reference: string;
  expires: string;
  corrects: string;
  credit: number;
}
export interface Movement {
  id: string;
  itemId: string;
  qty: number;
  cost: number;
  date: string;
  ref: string;
  reason: string;
  actor: string;
  reverses: string;
}
export interface ReceiptLine {
  itemId: string;
  qty: number;
  unit: string;
  ratio: number;
  cost: number;
}
export interface Receipt {
  id: string;
  supplierId: string;
  date: string;
  reference: string;
  status: "Draft" | "Final";
  lines: ReceiptLine[];
}
export interface Refund {
  id: string;
  txId: string;
  amount: number;
  method: Method | "";
  status: "Refund Pending" | "Refunded";
  reason: string;
  recipient: string;
  reference: string;
  date: string;
}
export interface Audit {
  id: string;
  date: string;
  actor: string;
  module: string;
  action: string;
  ref: string;
  detail: string;
}
export interface Settings {
  name: string;
  address: string;
  contact: string;
  note: string;
  discountLimit: number;
  estimateAmount: number;
  estimatePercent: number;
  sessionMinutes: number;
  methods: Method[];
}
export interface State {
  version: 1;
  revision: number;
  users: User[];
  customers: Customer[];
  vehicles: Vehicle[];
  items: Item[];
  services: Service[];
  mechanics: NamedRecord[];
  suppliers: Supplier[];
  categories: string[];
  units: string[];
  workOrders: WorkOrder[];
  transactions: Transaction[];
  movements: Movement[];
  receipts: Receipt[];
  refunds: Refund[];
  audit: Audit[];
  settings: Settings;
}

export const woStatuses: WOStatus[] = [
  "Draft",
  "Inspeksi",
  "Menunggu Persetujuan",
  "Menunggu Barang",
  "Dikerjakan",
  "Siap Diambil",
  "Selesai",
  "Dibatalkan",
];
export const vehicleStatuses: VehicleStatus[] = [
  "Draft",
  "Tersedia",
  "Reserved",
  "Terjual",
  "Diarsipkan",
];
export const methods: Method[] = ["Tunai", "Transfer bank", "QRIS", "E-wallet"];
export const roles: Role[] = [
  "Owner",
  "Staf Bengkel",
  "Staf Showroom",
  "Staf Gudang",
];
export const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
export const localDay = (date = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(date);
export const dateLabel = (s: string, time = false) =>
  s
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Asia/Jakarta",
      }).format(new Date(s))
    : "Belum dicatat";
export const uid = () => crypto.randomUUID();
export const balance = (s: State, id: string) =>
  s.movements.filter((m) => m.itemId === id).reduce((n, m) => n + m.qty, 0);
export const subtotal = (lines: Line[]) =>
  lines.reduce((n, l) => n + Math.round(l.price * l.qty), 0);
export const total = (doc: { lines: Line[]; discount: Discount }) =>
  subtotal(doc.lines) - doc.discount.amount;
export const stockStatus = (s: State, item: Item) =>
  !item.tracked
    ? "Non-stok"
    : balance(s, item.id) === 0
      ? "Habis"
      : balance(s, item.id) <= item.minimum
        ? "Menipis"
        : "Normal";
export const noDiscount = (): Discount => ({
  amount: 0,
  reason: "",
  status: "Disetujui",
});
export function documentId(prefix: string, ids: string[], date = new Date()) {
  const month = localDay(date).slice(2, 7).replace("-", "");
  const base = `${prefix}-${month}-`;
  const max = Math.max(
    0,
    ...ids
      .filter((x) => x.startsWith(base))
      .map((x) => Number(x.slice(base.length)) || 0),
  );
  return base + String(max + 1).padStart(4, "0");
}
export function permitted(u: User, permission: string) {
  if (u.role === "Owner") return true;
  const defaults: Record<Role, string[]> = {
    Owner: [],
    "Staf Bengkel": [
      "workshop",
      "customers",
      "inventory.read",
      "transactions.service",
      "payment.manual",
      "stock.reverse",
    ],
    "Staf Showroom": [
      "showroom",
      "customers",
      "transactions.motor",
      "payment.manual",
    ],
    "Staf Gudang": [
      "inventory.read",
      "inventory.limited",
      "receipt.create",
      "suppliers",
    ],
  };
  return (
    defaults[u.role].includes(permission) || u.permissions.includes(permission)
  );
}
export function maySeeTransaction(u: User, t: Transaction) {
  return permitted(
    u,
    t.kind === "Motor" ? "transactions.motor" : "transactions.service",
  );
}
function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function amount(n: number, label = "Nominal") {
  requireValue(
    Number.isSafeInteger(n) && n >= 0,
    `${label} harus Rupiah bulat, minimal 0.`,
  );
}
function text(v: string, label: string) {
  requireValue(
    typeof v === "string" && v.trim().length > 0 && v.length <= 2000,
    `${label} wajib diisi (maksimal 2.000 karakter).`,
  );
}
function find<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((x) => x.id === id);
  requireValue(row, "Data tidak ditemukan. Muat ulang halaman.");
  return row;
}
function save<T extends { id: string }>(rows: T[], value: T) {
  const i = rows.findIndex((x) => x.id === value.id);
  if (i < 0) rows.push(value);
  else rows[i] = value;
}
function guard(u: User, p: string) {
  requireValue(permitted(u, p), "Akses tidak diizinkan untuk akun demo ini.");
}
function validateLines(lines: Line[]) {
  requireValue(lines.length > 0, "Tambahkan minimal satu item.");
  for (const l of lines) {
    text(l.name, "Nama item");
    amount(l.price, "Harga");
    requireValue(
      Number.isSafeInteger(l.qty) && l.qty > 0 && l.qty <= 100000,
      "Jumlah harus bilangan bulat positif.",
    );
  }
  amount(subtotal(lines), "Subtotal");
}
function discountCheck(d: Discount, lines: Line[], s: State) {
  amount(d.amount, "Diskon");
  requireValue(
    d.amount <= subtotal(lines),
    "Diskon tidak boleh melebihi subtotal.",
  );
  if (d.amount) {
    text(d.reason, "Alasan diskon");
    d.status =
      (d.amount / subtotal(lines)) * 100 > s.settings.discountLimit
        ? "Menunggu"
        : "Disetujui";
  } else d.status = "Disetujui";
}
function move(
  s: State,
  itemId: string,
  qty: number,
  ref: string,
  reason: string,
  actor: string,
  cost?: number,
  reverses = "",
) {
  const item = find(s.items, itemId);
  if (!item.tracked) return;
  requireValue(
    Number.isSafeInteger(qty) && qty !== 0,
    "Pergerakan stok tidak valid.",
  );
  requireValue(
    balance(s, itemId) + qty >= 0,
    `Stok ${item.name} tidak cukup. Tersedia ${balance(s, itemId)} ${item.unit}.`,
  );
  s.movements.push({
    id: uid(),
    itemId,
    qty,
    ref,
    reason,
    actor,
    cost: cost ?? item.cost,
    date: new Date().toISOString(),
    reverses,
  });
}
function reverseReference(
  s: State,
  ref: string,
  actor: string,
  reason: string,
) {
  const originals = s.movements.filter(
    (m) => m.ref === ref && m.qty < 0 && !m.reverses,
  );
  for (const m of originals)
    if (!s.movements.some((r) => r.reverses === m.id))
      move(s, m.itemId, -m.qty, ref, reason, actor, m.cost, m.id);
}
function assertApproval(s: State, wo: WorkOrder) {
  requireValue(
    wo.approval === "Disetujui",
    "Catat persetujuan estimasi pelanggan terlebih dahulu.",
  );
  requireValue(
    wo.photos.filter(Boolean).length >= 2,
    "Lengkapi foto tampilan umum dan bagian bermasalah.",
  );
  requireValue(
    wo.discount.status === "Disetujui",
    "Diskon masih memerlukan persetujuan owner.",
  );
  const increase = total(wo) - wo.approvedTotal;
  requireValue(
    increase <= s.settings.estimateAmount &&
      (wo.approvedTotal === 0
        ? increase <= 0
        : (increase / wo.approvedTotal) * 100 <= s.settings.estimatePercent),
    "Estimasi bertambah melewati ambang. Catat persetujuan ulang.",
  );
}
export type Command =
  | { type: "customer"; value: Customer }
  | { type: "vehicle"; value: Vehicle }
  | { type: "reserve"; id: string; customerId: string }
  | { type: "unreserve"; id: string }
  | { type: "item"; value: Item }
  | { type: "supplier"; value: Supplier }
  | { type: "service"; value: Service }
  | { type: "mechanic"; value: NamedRecord }
  | { type: "master"; kind: "categories" | "units"; value: string }
  | { type: "user"; value: User }
  | { type: "settings"; value: Settings }
  | { type: "wo"; value: WorkOrder }
  | {
      type: "approveEstimate";
      id: string;
      name: string;
      method: string;
      decision: Approval;
      date: string;
    }
  | { type: "woStatus"; id: string; status: WOStatus; reason: string }
  | {
      type: "usePart" | "returnPart";
      id: string;
      lineId: string;
      reason: string;
    }
  | { type: "handover"; id: string; name: string }
  | { type: "adjust"; itemId: string; counted: number; reason: string }
  | { type: "receipt"; value: Receipt; finalize: boolean }
  | { type: "checkoutWO"; id: string }
  | { type: "transaction"; value: Transaction }
  | {
      type: "pay";
      id: string;
      method: Method;
      received: number;
      reference: string;
    }
  | { type: "gateway"; id: string; status: PaymentStatus }
  | {
      type: "discountDecision";
      id: string;
      kind: "wo" | "transaction";
      approve: boolean;
      reason: string;
    }
  | { type: "cancelTransaction"; id: string; reason: string }
  | { type: "correct"; id: string; lines: Line[]; reason: string }
  | { type: "refund"; id: string; recipient: string; reference: string };

// ponytail: transaksi demo satu browser; ganti dengan transaksi API atomik sebelum produksi.
export function applyCommand(
  input: State,
  command: Command,
  actorId: string,
): State {
  const s = structuredClone(input);
  const u = find(s.users, actorId);
  requireValue(u.active, "Akun demo tidak aktif.");
  const now = new Date().toISOString();
  const audit = (module: string, action: string, ref: string, detail = "") =>
    s.audit.unshift({
      id: uid(),
      date: now,
      actor: u.name,
      module,
      action,
      ref,
      detail,
    });
  switch (command.type) {
    case "customer": {
      guard(u, "customers");
      const c = command.value;
      text(c.name, "Nama pelanggan");
      requireValue(
        c.contact.length < 80 && c.address.length < 1000,
        "Kontak atau alamat terlalu panjang.",
      );
      save(s.customers, c);
      audit("Pelanggan", "Simpan pelanggan", c.id, c.name);
      break;
    }
    case "vehicle": {
      const v = command.value;
      guard(u, v.showroom ? "showroom" : "customers");
      text(v.brand, "Merek");
      text(v.model, "Model");
      requireValue(
        !v.year ||
          (/^\d{4}$/.test(v.year) &&
            Number(v.year) >= 1900 &&
            Number(v.year) <= new Date().getFullYear() + 1),
        "Tahun motor tidak valid.",
      );
      amount(v.price, "Harga jual");
      const old = s.vehicles.find((x) => x.id === v.id);
      if (v.showroom && v.status === 'Terjual') requireValue(old?.status === 'Terjual', 'Status Terjual hanya melalui pembayaran final.');
      if (v.status === 'Reserved') requireValue(old?.status === 'Reserved' && v.reservedFor === old.reservedFor, 'Reservasi dibuat melalui aksi Reservasi motor.');
      if (old?.status === "Terjual")
        requireValue(
          v.status === "Terjual" && v.customerId === old.customerId,
          "Kepemilikan motor terjual hanya dapat dikoreksi melalui transaksi.",
        );
      if (u.role !== "Owner") v.cost = old?.cost ?? 0;
      amount(v.cost, "Modal");
      requireValue(
        vehicleStatuses.includes(v.status),
        "Status motor tidak valid.",
      );
      for (const key of ["chassis", "engine"] as const)
        if (v[key].trim())
          requireValue(
            !s.vehicles.some(
              (x) =>
                x.id !== v.id && x[key].toUpperCase() === v[key].toUpperCase(),
            ),
            `${key === "chassis" ? "Nomor rangka" : "Nomor mesin"} sudah terdaftar.`,
          );
      if (v.showroom && ["Tersedia", "Reserved"].includes(v.status))
        requireValue(
          v.photos.filter(Boolean).length >= 3,
          "Lengkapi foto depan, kanan, dan kiri sebelum motor tersedia.",
        );
      requireValue(
        !v.customerId || s.customers.some((c) => c.id === v.customerId),
        "Pelanggan tidak ditemukan.",
      );
      save(s.vehicles, v);
      audit("Motor", "Simpan motor", v.id, v.model);
      break;
    }
    case "reserve": {
      guard(u, "showroom");
      const v = find(s.vehicles, command.id);
      find(s.customers, command.customerId);
      requireValue(
        v.status === "Tersedia",
        "Motor tidak tersedia untuk reservasi.",
      );
      v.status = "Reserved";
      v.reservedFor = command.customerId;
      v.reservedAt = now;
      audit("Motor", "Reservasi", v.id);
      break;
    }
    case "unreserve": {
      guard(u, "showroom");
      const v = find(s.vehicles, command.id);
      requireValue(v.status === "Reserved", "Motor tidak sedang direservasi.");
      v.status = "Tersedia";
      v.reservedFor = "";
      v.reservedAt = "";
      audit("Motor", "Lepas reservasi", v.id);
      break;
    }
    case "item": {
      const i = command.value;
      const limited = u.role !== "Owner" && !permitted(u, "inventory.manage");
      requireValue(
        permitted(u, "inventory.manage") || permitted(u, "inventory.limited"),
        "Tidak memiliki izin mengubah barang.",
      );
      text(i.sku, "SKU");
      text(i.name, "Nama barang");
      text(i.unit, "Satuan");
      amount(i.price, "Harga jual");
      amount(i.minimum, "Stok minimum");
      requireValue(
        Number.isSafeInteger(i.ratio) && i.ratio > 0,
        "Konversi satuan harus bilangan bulat positif.",
      );
      requireValue(
        !s.items.some(
          (x) => x.id !== i.id && x.sku.toLowerCase() === i.sku.toLowerCase(),
        ),
        "SKU sudah dipakai.",
      );
      const old = s.items.find((x) => x.id === i.id);
      if (old && s.movements.some((m) => m.itemId === i.id))
        requireValue(
          i.unit === old.unit && i.tracked === old.tracked,
          "Satuan dasar dan pengelolaan stok terkunci setelah movement.",
        );
      i.cost = old?.cost ?? 0;
      if (limited) {
        i.price = old?.price ?? 0;
        i.minimum = old?.minimum ?? 0;
        i.active = old?.active ?? true;
        i.tracked = old?.tracked ?? true;
        if (old) i.unit = old.unit;
      }
      save(s.items, i);
      audit("Stok", "Simpan barang", i.sku);
      break;
    }
    case "supplier": {
      guard(u, "suppliers");
      text(command.value.name, "Nama supplier");
      save(s.suppliers, command.value);
      audit("Supplier", "Simpan supplier", command.value.id);
      break;
    }
    case "service": {
      guard(u, "settings");
      text(command.value.name, "Nama jasa");
      amount(command.value.price);
      amount(command.value.cost);
      save(s.services, command.value);
      audit("Master", "Simpan jasa", command.value.id);
      break;
    }
    case "mechanic": {
      guard(u, "settings");
      text(command.value.name, "Nama mekanik");
      save(s.mechanics, command.value);
      audit("Master", "Simpan mekanik", command.value.id);
      break;
    }
    case "master": {
      guard(u, "settings");
      text(command.value, "Nama");
      requireValue(
        !s[command.kind].includes(command.value.trim()),
        "Data sudah ada.",
      );
      s[command.kind].push(command.value.trim());
      audit("Master", "Tambah data", command.kind, command.value);
      break;
    }
    case "user": {
      guard(u, "settings");
      const v = command.value;
      text(v.name, "Nama");
      requireValue(
        /^[a-z0-9._-]{3,40}$/i.test(v.username),
        "Nama pengguna 3–40 karakter: huruf, angka, titik, _ atau -.",
      );
      requireValue(roles.includes(v.role), "Role tidak valid.");
      requireValue(
        !s.users.some(
          (x) =>
            x.id !== v.id &&
            x.username.toLowerCase() === v.username.toLowerCase(),
        ),
        "Nama pengguna sudah dipakai.",
      );
      requireValue(
        v.id !== u.id || (v.active && v.role === "Owner"),
        "Akun owner yang sedang dipakai tidak dapat dinonaktifkan atau diturunkan.",
      );
      save(s.users, v);
      audit(
        "Akses",
        "Simpan pengguna",
        v.username,
        `${v.role}; ${v.active ? "Aktif" : "Nonaktif"}`,
      );
      break;
    }
    case "settings": {
      guard(u, "settings");
      const v = command.value;
      text(v.name, "Nama usaha");
      requireValue(
        v.discountLimit >= 0 &&
          v.discountLimit <= 100 &&
          v.estimatePercent >= 0 &&
          v.estimatePercent <= 100 &&
          v.sessionMinutes >= 1 &&
          v.sessionMinutes <= 1440,
        "Kebijakan persentase atau sesi tidak valid.",
      );
      amount(v.estimateAmount);
      requireValue(
        v.methods.length > 0 && v.methods.every((m) => methods.includes(m)),
        "Aktifkan minimal satu metode pembayaran.",
      );
      requireValue(
        v.methods.some((m) => ["Tunai", "Transfer bank"].includes(m)),
        "Demo memerlukan minimal satu metode manual; gateway belum terhubung.",
      );
      s.settings = v;
      audit("Pengaturan", "Simpan pengaturan", "Usaha");
      break;
    }
    case "wo": {
      guard(u, "workshop");
      const w = command.value;
      find(s.customers, w.customerId);
      const vehicle = find(s.vehicles, w.vehicleId);
      requireValue(
        vehicle.customerId === w.customerId,
        "Motor tidak dimiliki pelanggan terpilih.",
      );
      text(w.complaint, "Keluhan");
      find(s.mechanics, w.mechanic);
      const old = s.workOrders.find((x) => x.id === w.id);
      requireValue(
        !old || !["Selesai", "Dibatalkan"].includes(old.status),
        "WO sudah ditutup.",
      );
      requireValue(
        !s.transactions.some((t) => t.woId === w.id && t.status !== "Batal"),
        "WO sudah memiliki tagihan. Batalkan tagihan terlebih dahulu sebelum mengubah pekerjaan.",
      );
      if (w.lines.length) validateLines(w.lines);
      for (const line of w.lines) {
        const master =
          line.kind === "item"
            ? find(s.items, line.ref)
            : find(s.services, line.ref);
        const existing = old?.lines.find((l) => l.id === line.id);
        requireValue(
          line.price === (existing?.price ?? master.price),
          "Harga mengikuti master; gunakan pengajuan diskon.",
        );
        if (existing?.used)
          requireValue(
            line.qty === existing.qty && line.ref === existing.ref && line.used,
            "Kembalikan barang sebelum mengubah jumlah pemakaian.",
          );
        else line.used = false;
      }
      if (old)
        for (const l of old.lines.filter((l) => l.used))
          requireValue(
            w.lines.some((x) => x.id === l.id),
            "Kembalikan barang yang telah dipakai sebelum menghapus baris.",
          );
      const discountChanged =
        !old ||
        old.discount.amount !== w.discount.amount ||
        old.discount.reason !== w.discount.reason;
      if (discountChanged) discountCheck(w.discount, w.lines, s);
      else w.discount = old.discount;
      if (old) {
        w.status = old.status;
        w.history = old.history;
        w.approval = old.approval;
        w.approvedTotal = old.approvedTotal;
        w.confirmations = old.confirmations;
      } else {
        w.status = "Draft";
        w.approval = "Menunggu";
        w.approvedTotal = 0;
        w.history = [{ date: now, status: "Draft", actor: u.name, reason: "" }];
      }
      if (old?.approval === "Disetujui") {
        const inc = total(w) - old.approvedTotal;
        if (
          inc > s.settings.estimateAmount ||
          (old.approvedTotal > 0 &&
            (inc / old.approvedTotal) * 100 > s.settings.estimatePercent)
        ) {
          w.approval = "Direvisi";
          w.status = "Menunggu Persetujuan";
        }
      }
      save(s.workOrders, w);
      audit("Bengkel", "Simpan WO", w.id);
      break;
    }
    case "approveEstimate": {
      guard(u, "workshop");
      const w = find(s.workOrders, command.id);
      requireValue(
        !["Selesai", "Dibatalkan"].includes(w.status),
        "WO sudah ditutup.",
      );
      requireValue(
        !s.transactions.some((t) => t.woId === w.id && t.status === "Final"),
        "Transaksi WO sudah final.",
      );
      validateLines(w.lines);
      text(command.name, "Pemberi persetujuan");
      text(command.method, "Metode konfirmasi");
      requireValue(
        Number.isFinite(Date.parse(command.date)),
        "Waktu persetujuan tidak valid.",
      );
      w.approval = command.decision;
      if (command.decision === "Disetujui") w.approvedTotal = total(w);
      w.confirmations.push({
        name: command.name,
        method: command.method,
        date: command.date,
        amount: total(w),
        actor: u.name,
      });
      audit("Bengkel", `Estimasi ${command.decision}`, w.id, command.name);
      break;
    }
    case "woStatus": {
      guard(u, "workshop");
      const w = find(s.workOrders, command.id);
      requireValue(!s.transactions.some(t => t.woId === w.id && t.status === 'Final'), 'Status WO final hanya dapat berubah melalui serah terima atau koreksi owner.');
      const next = command.status;
      const transitions: Record<WOStatus, WOStatus[]> = {
        Draft: ["Inspeksi", "Dibatalkan"],
        Inspeksi: ["Menunggu Persetujuan", "Dibatalkan"],
        "Menunggu Persetujuan": ["Dikerjakan", "Menunggu Barang", "Dibatalkan"],
        "Menunggu Barang": ["Dikerjakan", "Menunggu Persetujuan", "Dibatalkan"],
        Dikerjakan: [
          "Siap Diambil",
          "Menunggu Persetujuan",
          "Menunggu Barang",
          "Dibatalkan",
        ],
        "Siap Diambil": ["Dikerjakan", "Dibatalkan"],
        Selesai: [],
        Dibatalkan: [],
      };
      requireValue(
        transitions[w.status].includes(next),
        "Perpindahan status tidak diizinkan.",
      );
      if (next === "Dikerjakan" || next === "Siap Diambil") {
        assertApproval(s, w);
        validateLines(w.lines);
      }
      if (next === "Siap Diambil")
        requireValue(
          w.lines.filter((l) => l.kind === "item").every((l) => l.used),
          "Konfirmasi semua suku cadang yang dipakai.",
        );
      if (next === "Dibatalkan") {
        text(command.reason, "Alasan pembatalan");
        requireValue(
          !s.transactions.some((t) => t.woId === w.id && t.status === "Final"),
          "Batalkan transaksi final melalui owner terlebih dahulu.",
        );
        reverseReference(s, w.id, u.name, command.reason);
        w.lines.forEach((l) => {
          l.used = false;
        });
      }
      w.status = next;
      w.history.push({
        date: now,
        status: next,
        actor: u.name,
        reason: command.reason,
      });
      audit("Bengkel", `Status ${next}`, w.id, command.reason);
      break;
    }
    case "usePart": {
      guard(u, "workshop");
      const w = find(s.workOrders, command.id);
      requireValue(
        w.status === "Dikerjakan",
        "Pemakaian hanya saat WO dikerjakan.",
      );
      assertApproval(s, w);
      const l = find(w.lines, command.lineId);
      requireValue(
        l.kind === "item" && !l.used,
        "Pemakaian sudah dikonfirmasi atau bukan barang.",
      );
      l.cost = find(s.items, l.ref).cost;
      move(s, l.ref, -l.qty, w.id, "Pemakaian WO", u.name);
      l.used = true;
      audit("Stok", "Pemakaian barang", w.id, l.name);
      break;
    }
    case "returnPart": {
      guard(u, "stock.reverse");
      text(command.reason, "Alasan pengembalian");
      const w = find(s.workOrders, command.id);
      requireValue(
        !s.transactions.some((t) => t.woId === w.id && t.status === "Final"),
        "Koreksi transaksi final melalui owner.",
      );
      const l = find(w.lines, command.lineId);
      requireValue(l.used, "Barang belum dipakai.");
      const original = [...s.movements]
        .reverse()
        .find(
          (m) =>
            m.ref === w.id &&
            m.itemId === l.ref &&
            m.qty === -l.qty &&
            !s.movements.some((r) => r.reverses === m.id),
        );
      requireValue(
        original,
        "Movement asal tidak ditemukan. Data tidak diubah; periksa kartu stok.",
      );
      move(
        s,
        l.ref,
        l.qty,
        w.id,
        command.reason,
        u.name,
        original.cost,
        original.id,
      );
      l.used = false;
      audit("Stok", "Pengembalian WO", w.id, command.reason);
      break;
    }
    case "handover": {
      guard(u, "workshop");
      text(command.name, "Nama penerima");
      const w = find(s.workOrders, command.id);
      requireValue(w.status === "Siap Diambil", "Motor belum siap diambil.");
      requireValue(
        s.transactions.some(
          (t) =>
            t.woId === w.id &&
            t.status === "Final" &&
            t.paymentStatus === "Paid",
        ),
        "Pembayaran harus lunas terlebih dahulu.",
      );
      w.handover = command.name;
      w.status = "Selesai";
      w.history.push({
        date: now,
        status: "Selesai",
        actor: u.name,
        reason: `Diserahkan kepada ${command.name}`,
      });
      audit("Bengkel", "Serah terima", w.id, command.name);
      break;
    }
    case "adjust": {
      guard(u, "stock.adjust");
      amount(command.counted, "Hasil hitung");
      text(command.reason, "Alasan penyesuaian");
      const diff = command.counted - balance(s, command.itemId);
      requireValue(diff !== 0, "Tidak ada selisih stok.");
      const ref = documentId(
        "ADJ",
        s.movements.map((m) => m.ref),
      );
      move(s, command.itemId, diff, ref, command.reason, u.name);
      audit(
        "Stok",
        "Penyesuaian",
        ref,
        `${diff > 0 ? "+" : ""}${diff}: ${command.reason}`,
      );
      break;
    }
    case "receipt": {
      guard(u, command.finalize ? "receipt.finalize" : "receipt.create");
      const r = command.value;
      const old = s.receipts.find((x) => x.id === r.id);
      requireValue(
        old?.status !== "Final",
        "Penerimaan final tidak dapat diedit.",
      );
      requireValue(
        find(s.suppliers, r.supplierId).active,
        "Supplier tidak aktif.",
      );
      requireValue(r.lines.length > 0, "Tambahkan barang yang diterima.");
      for (const l of r.lines) {
        const item = find(s.items, l.itemId);
        requireValue(
          item.active &&
            Number.isSafeInteger(l.qty) &&
            l.qty > 0 &&
            Number.isSafeInteger(l.ratio) &&
            l.ratio > 0,
          "Jumlah atau konversi tidak valid.",
        );
        amount(l.cost, "Harga beli");
        requireValue(
          l.ratio === (l.unit === item.unit ? 1 : item.ratio) &&
            [item.unit, item.buyUnit].includes(l.unit),
          "Konversi harus mengikuti master barang.",
        );
      }
      r.status = command.finalize ? "Final" : "Draft";
      if (command.finalize)
        for (const l of r.lines) {
          const item = find(s.items, l.itemId);
          const qty = l.qty * l.ratio;
          const unitCost = l.cost / l.ratio;
          const current = balance(s, item.id);
          item.cost =
            Math.round(
              ((current * item.cost + qty * unitCost) / (current + qty)) *
                10000,
            ) / 10000;
          move(s, item.id, qty, r.id, "Penerimaan supplier", u.name, unitCost);
        }
      save(s.receipts, r);
      audit(
        "Pembelian",
        command.finalize ? "Finalisasi penerimaan" : "Simpan draft",
        r.id,
      );
      break;
    }
    case "checkoutWO": {
      guard(u, "transactions.service");
      const w = find(s.workOrders, command.id);
      requireValue(
        w.status === "Siap Diambil",
        "Tandai motor siap diambil sebelum pembayaran.",
      );
      assertApproval(s, w);
      requireValue(
        !s.transactions.some((t) => t.woId === w.id && t.status !== "Batal"),
        "WO sudah memiliki transaksi aktif.",
      );
      const t = newTransaction("Servis", s);
      Object.assign(t, {
        woId: w.id,
        vehicleId: w.vehicleId,
        customerId: w.customerId,
        lines: structuredClone(w.lines),
        discount: structuredClone(w.discount),
      });
      s.transactions.push(t);
      audit("Transaksi", "Buat tagihan servis", t.id, w.id);
      break;
    }
    case "transaction": {
      const t = command.value;
      guard(
        u,
        t.kind === "Motor" ? "transactions.motor" : "transactions.service",
      );
      requireValue(t.kind !== "Servis", "Tagihan servis dibuat dari WO.");
      const old = s.transactions.find((x) => x.id === t.id);
      requireValue(
        !old || old.status === "Draft",
        "Transaksi ini tidak dapat diedit.",
      );
      validateLines(t.lines);
      discountCheck(t.discount, t.lines, s);
      requireValue(
        !t.customerId || s.customers.some((c) => c.id === t.customerId),
        "Pelanggan tidak ditemukan.",
      );
      if (t.kind === "Motor") {
        guard(u, "motor.finalize");
        const v = find(s.vehicles, t.vehicleId);
        requireValue(
          ["Tersedia", "Reserved"].includes(v.status),
          "Motor tidak tersedia.",
        );
        text(t.customerId, "Pelanggan");
        requireValue(
          v.status !== "Reserved" || v.reservedFor === t.customerId,
          "Motor direservasi untuk pelanggan lain. Lepas reservasi dengan izin terlebih dahulu.",
        );
        requireValue(
          t.lines.length === 1 &&
            t.lines[0].ref === v.id &&
            t.lines[0].price === v.price &&
            t.lines[0].qty === 1,
          "Harga dan identitas motor mengikuti master.",
        );
      } else
        for (const l of t.lines) {
          const item = find(s.items, l.ref);
          requireValue(
            l.kind === "item" && l.price === item.price && item.active,
            "Barang atau harga tidak sesuai master.",
          );
        }
      t.status = "Draft";
      t.paymentStatus = "Pending";
      t.credit = 0;
      t.corrects = "";
      save(s.transactions, t);
      audit("Transaksi", "Simpan draft", t.id);
      break;
    }
    case "pay": {
      const t = find(s.transactions, command.id);
      requireValue(maySeeTransaction(u, t), "Akses transaksi ditolak.");
      requireValue(
        t.status !== "Final" && t.status !== "Batal",
        "Transaksi sudah final atau batal.",
      );
      requireValue(
        s.settings.methods.includes(command.method),
        "Metode pembayaran tidak aktif.",
      );
      if (t.kind === "Motor") guard(u, "motor.finalize");
      requireValue(
        t.discount.status === "Disetujui",
        "Diskon belum disetujui owner.",
      );
      if (
        t.method &&
        ["QRIS", "E-wallet"].includes(t.method) &&
        t.status === "Menunggu Pembayaran" &&
        t.paymentStatus === "Pending"
      )
        throw new Error(
          "Permintaan gateway masih Pending. Pastikan status akhir sebelum membuat pembayaran baru.",
        );
      const due = Math.max(0, total(t) - t.credit);
      amount(command.received, "Uang diterima");
      if (["QRIS", "E-wallet"].includes(command.method)) {
        requireValue(due > 0, "Tidak ada sisa pembayaran.");
        t.method = command.method;
        t.status = "Menunggu Pembayaran";
        t.paymentStatus = "Pending";
        t.reference = `DEMO-${uid().slice(0, 8)}`;
        t.expires = new Date(Date.now() + 15 * 60000).toISOString();
        audit("Pembayaran", "Permintaan gateway demo", t.id, command.method);
        break;
      }
      guard(u, "payment.manual");
      requireValue(
        command.received >= due &&
          (command.method === "Tunai" || command.received === due),
        command.method === "Tunai"
          ? "Uang diterima kurang dari tagihan."
          : "Transfer harus sama persis dengan tagihan.",
      );
      t.method = command.method;
      t.received = command.received;
      t.change = command.received - due;
      t.reference = command.reference;
      finalize(s, t, u.name, now);
      audit(
        "Pembayaran",
        "Pembayaran manual demo",
        t.id,
        `${command.method}: ${money(due)}`,
      );
      break;
    }
    case "gateway": {
      guard(u, "settings");
      const t = find(s.transactions, command.id);
      requireValue(
        ["QRIS", "E-wallet"].includes(t.method) &&
          t.status === "Menunggu Pembayaran",
        "Bukan permintaan gateway aktif.",
      );
      requireValue(
        t.paymentStatus === "Pending",
        "Status gateway sudah diproses.",
      );
      t.paymentStatus = command.status;
      if (command.status === "Paid") {
        t.received = Math.max(0, total(t) - t.credit);
        t.change = 0;
        finalize(s, t, "Simulator gateway (bukan pembayaran nyata)", now);
      }
      audit("Pembayaran", `Simulasi gateway ${command.status}`, t.id);
      break;
    }
    case "discountDecision": {
      guard(u, "settings");
      const d =
        command.kind === "wo"
          ? find(s.workOrders, command.id)
          : find(s.transactions, command.id);
      requireValue(
        d.discount.status === "Menunggu",
        "Pengajuan sudah diproses.",
      );
      d.discount.status = command.approve ? "Disetujui" : "Ditolak";
      audit(
        "Kontrol",
        command.approve ? "Setujui diskon" : "Tolak diskon",
        command.id,
        command.reason,
      );
      break;
    }
    case "cancelTransaction": {
      guard(u, "transaction.cancel");
      text(command.reason, "Alasan pembatalan");
      const t = find(s.transactions, command.id);
      requireValue(t.status !== "Batal", "Transaksi sudah dibatalkan.");
      requireValue(
        !t.corrects || t.status === "Final",
        "Selesaikan koreksi yang menggunakan pembayaran asal sebelum pembatalan.",
      );
      requireValue(
        !(
          t.status === "Menunggu Pembayaran" &&
          ["QRIS", "E-wallet"].includes(t.method) &&
          t.paymentStatus === "Pending"
        ),
        "Pastikan status akhir gateway sebelum membatalkan transaksi.",
      );
      const paid = t.paymentStatus === "Paid";
      cancelEffects(s, t, u.name, command.reason);
      if (paid) createRefund(s, t, total(t), command.reason);
      t.status = "Batal";
      if (!paid) t.paymentStatus = "Cancelled";
      audit("Transaksi", "Batalkan transaksi", t.id, command.reason);
      break;
    }
    case "correct": {
      guard(u, "transaction.cancel");
      text(command.reason, "Alasan koreksi");
      const old = find(s.transactions, command.id);
      requireValue(
        old.status === "Final",
        "Hanya transaksi final dapat dikoreksi.",
      );
      requireValue(
        !old.corrects,
        "Koreksi bertingkat belum didukung demo. Buat refund melalui owner.",
      );
      validateLines(command.lines);
      for (const l of command.lines) {
        if (old.kind === "Motor")
          requireValue(
            l.kind === "vehicle" && l.ref === old.vehicleId,
            "Koreksi harus tetap mengacu motor yang sama.",
          );
        else if (l.kind === "item") find(s.items, l.ref);
        else
          requireValue(
            old.kind === "Servis" && l.kind === "service",
            "Jenis item koreksi tidak sesuai domain transaksi.",
          );
      }
      const t: Transaction = {
        ...structuredClone(old),
        id: documentId(
          "KOR",
          s.transactions.map((x) => x.id),
        ),
        lines: command.lines,
        discount: noDiscount(),
        corrects: old.id,
        credit: total(old),
        status: "Draft",
        paymentStatus: "Pending",
        date: now,
        paidAt: "",
        verifier: "",
        reference: "",
        received: 0,
        change: 0,
      };
      if (old.kind === "Motor")
        requireValue(
          t.lines.length === 1 && t.lines[0].qty === 1,
          "Koreksi motor harus tetap satu unit.",
        );
      // The original effects are reversed before posting the replacement; service parts must be reconfirmed.
      cancelEffects(s, old, u.name, command.reason);
      old.status = "Batal";
      s.transactions.push(t);
      t.lines.forEach((l) => {
        l.used = false;
      });
      if (t.kind === "Servis") {
        const w = find(s.workOrders, t.woId);
        w.lines = structuredClone(t.lines);
        w.discount = noDiscount();
        const increase = total(t) - w.approvedTotal;
        if (
          increase > s.settings.estimateAmount ||
          (w.approvedTotal > 0 &&
            (increase / w.approvedTotal) * 100 > s.settings.estimatePercent)
        )
          w.approval = "Direvisi";
      }
      if (total(t) <= t.credit) {
        finalize(s, t, u.name, now);
        if (t.credit > total(t))
          createRefund(s, old, t.credit - total(t), `Selisih koreksi ${t.id}`);
      }
      audit("Transaksi", "Buat koreksi", t.id, `${old.id}: ${command.reason}`);
      break;
    }
    case "refund": {
      guard(u, "refund.manage");
      text(command.recipient, "Penerima refund");
      const r = find(s.refunds, command.id);
      requireValue(r.status === "Refund Pending", "Refund sudah diselesaikan.");
      if (r.method !== "Tunai")
        text(command.reference, "Referensi pengembalian");
      r.status = "Refunded";
      r.recipient = command.recipient;
      r.reference = command.reference;
      r.date = now;
      audit("Pembayaran", "Catat refund demo", r.id, money(r.amount));
      break;
    }
  }
  s.revision++;
  return s;
}
function finalize(s: State, t: Transaction, actor: string, now: string) {
  validateLines(t.lines);
  requireValue(t.discount.status === "Disetujui", "Diskon belum disetujui.");
  if (t.kind === "Motor") {
    const v = find(s.vehicles, t.vehicleId);
    requireValue(
      ["Tersedia", "Reserved"].includes(v.status),
      "Motor sudah terjual atau tidak tersedia.",
    );
    find(s.customers, t.customerId);
    requireValue(
      v.status !== "Reserved" || v.reservedFor === t.customerId,
      "Pelanggan berbeda dari reservasi.",
    );
    requireValue(
      v.photos.filter(Boolean).length >= 3,
      "Foto motor belum lengkap.",
    );
    v.status = "Terjual";
    v.customerId = t.customerId;
    v.reservedFor = "";
  }
  if (t.kind === "Barang")
    for (const l of t.lines)
      move(s, l.ref, -l.qty, t.id, "Penjualan barang", actor);
  if (t.kind === "Servis") {
    const w = find(s.workOrders, t.woId);
    requireValue(
      !s.transactions.some(
        (x) => x.id !== t.id && x.woId === w.id && x.status === "Final",
      ),
      "WO sudah memiliki transaksi final.",
    );
    requireValue(
      ["Siap Diambil", ...(t.corrects ? ["Dikerjakan"] : [])].includes(
        w.status,
      ),
      "WO tidak siap untuk finalisasi pembayaran.",
    );
    assertApproval(s, w);
    if (!t.corrects)
      requireValue(
        total(w) === total(t) &&
          JSON.stringify(w.lines) === JSON.stringify(t.lines),
        "Pekerjaan berubah setelah tagihan dibuat. Buat ulang tagihan dari WO.",
      );
    if (t.corrects) {
      for (const l of t.lines.filter((l) => l.kind === "item" && !l.used)) {
        const current = w.lines.find((x) => x.id === l.id);
        if (!current?.used)
          move(s, l.ref, -l.qty, w.id, "Pemakaian koreksi", actor);
        l.used = true;
      }
      w.lines = structuredClone(t.lines);
      w.status = "Siap Diambil";
    }
    requireValue(
      t.lines.filter((l) => l.kind === "item").every((l) => l.used),
      "Pemakaian suku cadang belum dikonfirmasi.",
    );
  }
  t.status = "Final";
  t.paymentStatus = "Paid";
  t.paidAt = now;
  t.verifier = actor;
}
function cancelEffects(
  s: State,
  t: Transaction,
  actor: string,
  reason: string,
) {
  if (t.kind === "Motor" && t.status === "Final") {
    const v = find(s.vehicles, t.vehicleId);
    v.status = "Tersedia";
    v.customerId = "";
  }
  if (t.status === "Final") reverseReference(s, t.woId || t.id, actor, reason);
  if (t.woId) {
    const w = find(s.workOrders, t.woId);
    if (t.status === "Final") {
      w.status = "Dikerjakan";
      w.lines.forEach((l) => {
        l.used = false;
      });
      w.handover = "";
    }
  }
}
function createRefund(s: State, t: Transaction, value: number, reason: string) {
  requireValue(value <= total(t), "Refund melebihi pembayaran awal.");
  s.refunds.push({
    id: documentId(
      "RFD",
      s.refunds.map((r) => r.id),
    ),
    txId: t.id,
    amount: value,
    method: t.method,
    status: "Refund Pending",
    reason,
    recipient: "",
    reference: "",
    date: new Date().toISOString(),
  });
}
export function newTransaction(
  kind: Transaction["kind"],
  s: State,
): Transaction {
  return {
    id: documentId(
      kind === "Servis" ? "SRV" : kind === "Motor" ? "MTR" : "POS",
      s.transactions.map((x) => x.id),
    ),
    kind,
    woId: "",
    vehicleId: "",
    customerId: "",
    lines: [],
    discount: noDiscount(),
    status: "Draft",
    paymentStatus: "Pending",
    method: "",
    received: 0,
    change: 0,
    date: new Date().toISOString(),
    paidAt: "",
    verifier: "",
    reference: "",
    expires: "",
    corrects: "",
    credit: 0,
  };
}
export function catalogLine(
  record: Item | Service | Vehicle,
  kind: Line["kind"],
): Line {
  return {
    id: uid(),
    kind,
    ref: record.id,
    name: "model" in record ? `${record.brand} ${record.model}` : record.name,
    qty: 1,
    price: record.price,
    cost: record.cost,
    used: false,
  };
}
