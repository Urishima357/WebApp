import { localDay, noDiscount } from "./domain.ts";
import type { Line, State, Transaction, Vehicle, WorkOrder } from "./domain.ts";

export function seedState(): State {
  const date = `${localDay()}T02:15:00.000Z`;
  const line = (
    id: string,
    name: string,
    price: number,
    kind: Line["kind"] = "service",
    used = false,
  ): Line => ({
    id: `line-${id}`,
    ref: id,
    name,
    price,
    cost: 0,
    qty: 1,
    kind,
    used,
  });
  const vehicles: Vehicle[] = [
    [
      "v1",
      "Kawasaki",
      "W175 Cafe",
      "2021",
      "Hijau",
      24000000,
      "Tersedia",
      "/images/w175.jpg",
    ],
    [
      "v2",
      "Yamaha",
      "XSR 155",
      "2022",
      "Hitam",
      31500000,
      "Tersedia",
      "/images/xsr.jpg",
    ],
    ["v3", "Honda", "PCX 160", "2023", "Putih", 29000000, "Tersedia", ""],
    ["v4", "Yamaha", "NMAX 155", "2022", "Abu-abu", 25500000, "Reserved", ""],
    ["v5", "Honda", "Vario 125", "2021", "Merah", 18500000, "Terjual", ""],
    [
      "v6",
      "Kawasaki",
      "Ninja 250 SL",
      "2020",
      "Hijau",
      48000000,
      "Draft",
      "/images/ninja.jpg",
    ],
  ].map(([id, brand, model, year, color, price, status, image]) => ({
    id: String(id),
    brand: String(brand),
    model: String(model),
    year: String(year),
    color: String(color),
    price: Number(price),
    cost: Math.round(Number(price) * 0.83),
    status: status as Vehicle["status"],
    photos: image
      ? [String(image), String(image), String(image)]
      : ["", "", ""],
    plate: "",
    chassis: "",
    engine: "",
    customerId: status === "Terjual" ? "c3" : "",
    showroom: true,
    notes:
      "Foto dan kondisi merupakan data contoh desain, bukan inventaris asli.",
    reservedFor: status === "Reserved" ? "c2" : "",
    reservedAt: status === "Reserved" ? date : "",
  }));
  const owned = [
    ["v7", "Yamaha", "NMAX 155", "B 4382 UJK", "c1"],
    ["v8", "Honda", "Vario 125", "B 6217 PRT", "c2"],
    ["v9", "Kawasaki", "W175", "B 3921 TKR", "c3"],
  ].map(([id, brand, model, plate, customerId]) => ({
    id,
    brand,
    model,
    plate,
    customerId,
    year: "2022",
    color: "Hitam",
    chassis: "",
    engine: "",
    showroom: false,
    status: "Terjual" as const,
    price: 0,
    cost: 0,
    notes: "",
    photos: [],
    reservedFor: "",
    reservedAt: "",
  }));
  vehicles.push(...owned, {
    ...structuredClone(vehicles[1]),
    id: "v10",
    status: "Terjual",
    customerId: "c1",
    plate: "B 7112 UJK",
  });
  const workOrders: WorkOrder[] = Array.from({ length: 13 }, (_, i) => {
    const status =
      i < 5
        ? "Dikerjakan"
        : i < 8
          ? "Inspeksi"
          : i < 10
            ? "Menunggu Persetujuan"
            : i < 11
              ? "Menunggu Barang"
              : "Siap Diambil";
    const used = status === "Dikerjakan" || status === "Siap Diambil";
    return {
      id: `WO-2611-${String(42 - i).padStart(4, "0")}`,
      vehicleId: owned[i % 3].id,
      customerId: owned[i % 3].customerId,
      date,
      status,
      complaint:
        i % 2
          ? "Servis rutin dan pemeriksaan rem."
          : "Tarikan berat dan rem depan berbunyi.",
      condition: "Motor dapat dinyalakan. Goresan ringan pada bodi.",
      inspection: "Kampas rem aus. CVT perlu dibersihkan.",
      recommendation: "Servis CVT dan ganti kampas rem depan.",
      km: "34820",
      mechanic: i % 2 ? "m2" : "m1",
      photos: ["/images/w175.jpg", "/images/workshop.jpg"],
      lines: [
        line("s1", "Servis CVT", 120000),
        line("s2", "Ganti kampas rem", 50000),
        line("i1", "Oli mesin 10W-40", 75000, "item", used),
        line("i2", "Kampas rem depan", 85000, "item", used),
      ],
      discount: noDiscount(),
      approval: used ? "Disetujui" : "Menunggu",
      approvedTotal: 330000,
      confirmations: used
        ? [
            {
              name:
                owned[i % 3].customerId === "c1"
                  ? "Budi Santoso"
                  : "Pelanggan contoh",
              method: "Telepon",
              date,
              amount: 330000,
              actor: "Rina",
            },
          ]
        : [],
      history: [{ date, status, actor: "Rina", reason: "Data awal demo" }],
      handover: "",
    };
  });
  const transaction = (
    id: string,
    kind: Transaction["kind"],
    value: number,
    method: Transaction["method"],
    status: Transaction["paymentStatus"] = "Paid",
  ): Transaction => ({
    id,
    kind,
    lines: [
      line(
        `seed-${id}`,
        kind === "Motor"
          ? "Yamaha XSR 155 (transaksi contoh)"
          : kind === "Servis"
            ? "Rekap servis contoh"
            : "Rekap barang contoh",
        value,
        kind === "Motor" ? "vehicle" : "service",
      ),
    ],
    woId: "",
    vehicleId: "",
    customerId: "c1",
    discount: noDiscount(),
    status: status === "Paid" ? "Final" : "Menunggu Pembayaran",
    paymentStatus: status,
    method,
    received: status === "Paid" ? value : 0,
    change: 0,
    date,
    paidAt: status === "Paid" ? date : "",
    verifier: status === "Paid" ? "Rina" : "",
    reference: "CONTOH",
    expires: new Date(Date.now() + 900000).toISOString(),
    corrects: "",
    credit: 0,
  });
  const ready = workOrders[11];
  const paidWO = {
    ...transaction("SRV-2611-0038", "Servis", 330000, "Tunai"),
    woId: ready.id,
    vehicleId: ready.vehicleId,
    customerId: ready.customerId,
    lines: structuredClone(ready.lines),
    received: 350000,
    change: 20000,
  };
  const motorPaid = {
    ...transaction("MTR-2611-0006", "Motor", 31500000, "Transfer bank"),
    vehicleId: "v10",
    customerId: "c1",
  };
  const motorPending = {
    ...transaction(
      "MTR-2611-0007",
      "Motor",
      31500000,
      "Transfer bank",
      "Pending",
    ),
    vehicleId: "v2",
    customerId: "c1",
  };
  const posFailed = {
    ...transaction("POS-2611-0021", "Barang", 130000, "E-wallet", "Failed"),
    lines: [
      line("i1", "Oli mesin 10W-40", 75000, "item"),
      line("i4", "Filter udara", 55000, "item"),
    ],
  };
  const gatewayWO = workOrders[12];
  const srvExpired = {
    ...transaction("SRV-2611-0025", "Servis", 330000, "QRIS", "Expired"),
    woId: gatewayWO.id,
    vehicleId: gatewayWO.vehicleId,
    customerId: gatewayWO.customerId,
    lines: structuredClone(gatewayWO.lines),
  };
  const cancelledPOS: Transaction = {
    ...transaction("POS-2611-0018", "Barang", 85000, "Tunai"),
    status: "Batal",
    lines: [line("i2", "Kampas rem depan", 85000, "item")],
  };
  return {
    version: 1,
    revision: 0,
    users: [
      {
        id: "u1",
        name: "Pak Arif",
        username: "arif",
        role: "Owner",
        active: true,
        permissions: [],
      },
      {
        id: "u2",
        name: "Rina",
        username: "rina",
        role: "Staf Bengkel",
        active: true,
        permissions: [],
      },
      {
        id: "u3",
        name: "Sari",
        username: "sari",
        role: "Staf Showroom",
        active: true,
        permissions: ["motor.finalize"],
      },
      {
        id: "u4",
        name: "Dani",
        username: "dani",
        role: "Staf Gudang",
        active: true,
        permissions: ["receipt.finalize"],
      },
    ],
    customers: [
      {
        id: "c1",
        name: "Budi Santoso",
        contact: "0812-0000-0001",
        address: "Jakarta Utara (contoh)",
      },
      {
        id: "c2",
        name: "Siti Rahma",
        contact: "0812-0000-0002",
        address: "Sunter (contoh)",
      },
      {
        id: "c3",
        name: "Andi Pratama",
        contact: "0812-0000-0003",
        address: "Tanjung Priok (contoh)",
      },
    ],
    vehicles,
    items: [
      {
        id: "i1",
        sku: "OLI-004",
        name: "Oli mesin 10W-40",
        brand: "Motul",
        category: "Pelumas",
        unit: "botol",
        buyUnit: "dus",
        ratio: 24,
        price: 75000,
        cost: 58000,
        minimum: 6,
        rack: "A-01",
        tracked: true,
        active: true,
      },
      {
        id: "i2",
        sku: "REM-012",
        name: "Kampas rem depan",
        brand: "Nissin",
        category: "Pengereman",
        unit: "pcs",
        buyUnit: "box",
        ratio: 10,
        price: 85000,
        cost: 62000,
        minimum: 5,
        rack: "B-02",
        tracked: true,
        active: true,
      },
      {
        id: "i3",
        sku: "BUS-003",
        name: "Busi NGK CPR9EA",
        brand: "NGK",
        category: "Kelistrikan",
        unit: "pcs",
        buyUnit: "box",
        ratio: 10,
        price: 35000,
        cost: 22000,
        minimum: 4,
        rack: "B-04",
        tracked: true,
        active: true,
      },
      {
        id: "i4",
        sku: "FIL-008",
        name: "Filter udara",
        brand: "Yamaha",
        category: "Filter",
        unit: "pcs",
        buyUnit: "box",
        ratio: 6,
        price: 55000,
        cost: 38000,
        minimum: 4,
        rack: "C-01",
        tracked: true,
        active: true,
      },
    ],
    services: [
      {
        id: "s1",
        name: "Servis CVT",
        type: "Internal",
        price: 120000,
        cost: 0,
        active: true,
      },
      {
        id: "s2",
        name: "Ganti kampas rem",
        type: "Internal",
        price: 50000,
        cost: 0,
        active: true,
      },
      {
        id: "s3",
        name: "Bubut cakram",
        type: "Vendor Luar",
        price: 150000,
        cost: 100000,
        active: true,
      },
    ],
    mechanics: [
      { id: "m1", name: "Dedi", active: true },
      { id: "m2", name: "Agus", active: true },
    ],
    suppliers: [
      {
        id: "sup1",
        name: "Sinar Motor Parts",
        contact: "021-0000-0101",
        address: "Jakarta (contoh)",
        active: true,
      },
      {
        id: "sup2",
        name: "Prima Pelumas",
        contact: "021-0000-0102",
        address: "Bekasi (contoh)",
        active: true,
      },
    ],
    categories: ["Pelumas", "Pengereman", "Kelistrikan", "Filter"],
    units: ["pcs", "botol", "set", "liter"],
    workOrders,
    transactions: [
      paidWO,
      transaction("SRV-2611-0037", "Servis", 2120000, "Transfer bank"),
      transaction("POS-2611-0020", "Barang", 900000, "Tunai"),
      motorPaid,
      motorPending,
      posFailed,
      srvExpired,
      cancelledPOS,
    ],
    movements: [
      ...[10, 6, -5].map((qty, i) => ({
        id: `mov-${i}`,
        itemId: "i1",
        qty,
        cost: 58000,
        date,
        ref: ["SALDO-AWAL", "GR-2611-0012", "WO-2611-0015"][i],
        reason: "Data awal demo",
        actor: "Pak Arif",
        reverses: "",
      })),
      {
        id: "mov-rem",
        itemId: "i2",
        qty: 9,
        cost: 62000,
        date,
        ref: "SALDO-AWAL",
        reason: "Data awal demo",
        actor: "Pak Arif",
        reverses: "",
      },
      {
        id: "mov-fil",
        itemId: "i4",
        qty: 12,
        cost: 38000,
        date,
        ref: "SALDO-AWAL",
        reason: "Data awal demo",
        actor: "Pak Arif",
        reverses: "",
      },
      ...workOrders.flatMap((w) =>
        w.lines
          .filter((l) => l.kind === "item" && l.used)
          .map((l) => ({
            id: `mov-${w.id}-${l.ref}`,
            itemId: l.ref,
            qty: -l.qty,
            cost: l.ref === "i1" ? 58000 : 62000,
            date,
            ref: w.id,
            reason: "Pemakaian awal demo",
            actor: "Rina",
            reverses: "",
          })),
      ),
    ],
    receipts: [],
    refunds: [
      {
        id: "RFD-2611-0001",
        txId: "POS-2611-0018",
        amount: 85000,
        method: "Tunai",
        status: "Refund Pending",
        reason: "Pembatalan transaksi contoh",
        recipient: "",
        reference: "",
        date,
      },
    ],
    audit: [
      {
        id: "audit-seed",
        date,
        actor: "Sistem demo",
        module: "Sistem",
        action: "Data contoh dimuat",
        ref: "DEMO",
        detail: "Tidak ada data pelanggan atau pembayaran nyata.",
      },
    ],
    settings: {
      name: "Garasi Hobby",
      address: "Tanjung Priok, Jakarta Utara (alamat contoh)",
      contact: "021-0000-0000",
      note: "Terima kasih sudah merawat motor bersama kami.",
      discountLimit: 0,
      estimateAmount: 50000,
      estimatePercent: 10,
      sessionMinutes: 30,
      methods: ["Tunai", "Transfer bank", "QRIS", "E-wallet"],
    },
  };
}
