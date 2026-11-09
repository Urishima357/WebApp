import assert from "node:assert/strict";
import {
  applyCommand,
  balance,
  catalogLine,
  documentId,
  newTransaction,
  total,
} from "../src/lib/domain.ts";
import { seedState } from "../src/lib/seed.ts";

let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`OK ${name}`);
}
const exec = (s, command, user = "u1") => applyCommand(s, command, user);
function serviceReady() {
  let s = seedState();
  const w = s.workOrders[0];
  for (const l of w.lines.filter(l => l.kind === 'item')) s = exec(s, { type: 'returnPart', id: w.id, lineId: l.id, reason: 'Persiapan skenario test' });
  s = exec(s, { type: "usePart", id: w.id, lineId: w.lines[2].id, reason: "" });
  s = exec(s, { type: "usePart", id: w.id, lineId: w.lines[3].id, reason: "" });
  s = exec(s, {
    type: "woStatus",
    id: w.id,
    status: "Siap Diambil",
    reason: "",
  });
  s = exec(s, { type: "checkoutWO", id: w.id });
  return { s, id: w.id, tx: s.transactions.at(-1).id };
}
test("pendapatan awal tepat Rp34.850.000", () => {
  const s = seedState();
  assert.equal(
    s.transactions
      .filter((t) => t.status === "Final")
      .reduce((n, t) => n + total(t), 0),
    34850000,
  );
});
test("pemakaian menolak stok negatif tanpa mengubah state asal", () => {
  const s = seedState();
  const w = s.workOrders[0];
  w.lines[2].used = false;
  w.lines[2].qty = 5;
  w.approvedTotal = total(w);
  assert.throws(
    () =>
      exec(s, { type: "usePart", id: w.id, lineId: w.lines[2].id, reason: "" }),
    /tidak cukup/,
  );
  assert.equal(balance(s, "i1"), 4);
});
test("WO wajib persetujuan dan dua foto sebelum mulai", () => {
  const s = seedState();
  const w = s.workOrders[8];
  w.photos = [];
  assert.throws(
    () =>
      exec(s, { type: "woStatus", id: w.id, status: "Dikerjakan", reason: "" }),
    /persetujuan/,
  );
  w.approval = "Disetujui";
  assert.throws(
    () =>
      exec(s, { type: "woStatus", id: w.id, status: "Dikerjakan", reason: "" }),
    /foto/,
  );
});
test("pemakaian idempotent; final pembayaran tidak memotong ulang", () => {
  let { s, id, tx } = serviceReady();
  const before = balance(s, "i1");
  const line = s.workOrders.find((w) => w.id === id).lines[2];
  assert.throws(
    () => exec(s, { type: "usePart", id, lineId: line.id, reason: "" }),
    /sudah dikonfirmasi|hanya saat/,
  );
  s = exec(s, {
    type: "pay",
    id: tx,
    method: "Tunai",
    received: 350000,
    reference: "",
  });
  assert.equal(balance(s, "i1"), before);
  assert.equal(s.transactions.at(-1).change, 20000);
  assert.throws(
    () =>
      exec(s, {
        type: "pay",
        id: tx,
        method: "Tunai",
        received: 350000,
        reference: "",
      }),
    /sudah final/,
  );
  assert.throws(() => exec(s, { type: "checkoutWO", id }), /sudah memiliki/);
});
test("serah terima menunggu lunas", () => {
  let { s, id, tx } = serviceReady();
  assert.throws(() => exec(s, { type: "handover", id, name: "Budi" }), /lunas/);
  s = exec(s, {
    type: "pay",
    id: tx,
    method: "Transfer bank",
    received: 330000,
    reference: "TEST",
  });
  s = exec(s, { type: "handover", id, name: "Budi" });
  assert.equal(s.workOrders.find((w) => w.id === id).status, "Selesai");
});
test("transfer wajib tepat; tunai tidak boleh kurang", () => {
  const { s, tx } = serviceReady();
  assert.throws(
    () =>
      exec(s, {
        type: "pay",
        id: tx,
        method: "Transfer bank",
        received: 350000,
        reference: "",
      }),
    /persis/,
  );
  assert.throws(
    () =>
      exec(s, {
        type: "pay",
        id: tx,
        method: "Tunai",
        received: 320000,
        reference: "",
      }),
    /kurang/,
  );
});
test("gateway tetap pending; tidak ada konfirmasi manual oleh staf", () => {
  let { s, tx } = serviceReady();
  s = exec(s, {
    type: "pay",
    id: tx,
    method: "QRIS",
    received: 330000,
    reference: "",
  });
  assert.equal(s.transactions.at(-1).paymentStatus, "Pending");
  assert.notEqual(s.transactions.at(-1).status, "Final");
  assert.throws(
    () => exec(s, { type: "gateway", id: tx, status: "Paid" }, "u2"),
    /Akses/,
  );
  assert.throws(
    () =>
      exec(s, {
        type: "pay",
        id: tx,
        method: "Tunai",
        received: 330000,
        reference: "",
      }),
    /masih Pending/,
  );
  s = exec(s, { type: "gateway", id: tx, status: "Paid" });
  assert.equal(s.transactions.at(-1).status, "Final");
  assert.throws(
    () => exec(s, { type: "gateway", id: tx, status: "Paid" }),
    /aktif|diproses/,
  );
});
test("penjualan motor memindahkan pemilik sekali", () => {
  let s = seedState();
  const v = s.vehicles.find((v) => v.id === "v2");
  const t = newTransaction("Motor", s);
  Object.assign(t, {
    customerId: "c1",
    vehicleId: v.id,
    lines: [catalogLine(v, "vehicle")],
  });
  s = exec(s, { type: "transaction", value: t });
  s = exec(s, {
    type: "pay",
    id: t.id,
    method: "Transfer bank",
    received: v.price,
    reference: "TEST",
  });
  const sold = s.vehicles.find((x) => x.id === v.id);
  assert.equal(sold.status, "Terjual");
  assert.equal(sold.customerId, "c1");
  const second = { ...t, id: "MTR-TEST-9999" };
  assert.throws(
    () => exec(s, { type: "transaction", value: second }),
    /tidak tersedia/,
  );
});
test("penerimaan draft tak mengubah stok; konversi final dan WAC benar", () => {
  let s = seedState();
  const receipt = {
    id: "GR-2611-0013",
    supplierId: "sup1",
    date: new Date().toISOString(),
    reference: "TEST",
    status: "Draft",
    lines: [{ itemId: "i1", qty: 1, unit: "dus", ratio: 24, cost: 1392000 }],
  };
  s = exec(s, { type: "receipt", value: receipt, finalize: false });
  assert.equal(balance(s, "i1"), 4);
  s = exec(s, { type: "receipt", value: receipt, finalize: true });
  assert.equal(balance(s, "i1"), 28);
  assert.equal(s.items[0].cost, 58000);
  assert.throws(
    () => exec(s, { type: "receipt", value: receipt, finalize: true }),
    /final/,
  );
});
test("adjustment wajib owner dan alasan", () => {
  const s = seedState();
  assert.throws(
    () => exec(s, { type: "adjust", itemId: "i1", counted: 3, reason: "" }),
    /Alasan/,
  );
  assert.throws(
    () =>
      exec(
        s,
        { type: "adjust", itemId: "i1", counted: 3, reason: "Selisih" },
        "u2",
      ),
    /Akses/,
  );
  const next = exec(s, {
    type: "adjust",
    itemId: "i1",
    counted: 3,
    reason: "Selisih hitung",
  });
  assert.equal(balance(next, "i1"), 3);
  assert.equal(balance(s, "i1"), 4);
});
test("koreksi pembayaran dialihkan; refund hanya selisih", () => {
  let { s, tx } = serviceReady();
  s = exec(s, {
    type: "pay",
    id: tx,
    method: "Tunai",
    received: 350000,
    reference: "",
  });
  const old = s.transactions.find((t) => t.id === tx);
  const lines = structuredClone(old.lines);
  lines[0].price -= 10000;
  const refunds = s.refunds.length;
  s = exec(s, { type: "correct", id: tx, lines, reason: "Koreksi harga demo" });
  assert.equal(s.transactions.find((t) => t.id === tx).status, "Batal");
  assert.equal(s.transactions.at(-1).corrects, tx);
  assert.equal(s.transactions.at(-1).status, "Final");
  assert.equal(s.refunds.length, refunds + 1);
  assert.equal(s.refunds.at(-1).amount, 10000);
});
test("ID dokumen bulan Jakarta; reset urutan bulanan", () => {
  assert.equal(
    documentId("WO", ["WO-2611-0009"], new Date("2026-10-31T18:00:00Z")),
    "WO-2611-0010",
  );
  assert.equal(
    documentId("WO", ["WO-2611-0009"], new Date("2026-12-01T00:00:00Z")),
    "WO-2612-0001",
  );
});
test('pembatalan final menjaga pembayaran dan membuat refund, tidak memotong ganda', () => {
  let { s, tx } = serviceReady();
  s = exec(s, { type: 'pay', id: tx, method: 'Tunai', received: 350000, reference: '' });
  const before = balance(s, 'i1');
  s = exec(s, { type: 'cancelTransaction', id: tx, reason: 'Salah transaksi' });
  assert.equal(s.transactions.find(t => t.id === tx).paymentStatus, 'Paid');
  assert.equal(s.transactions.find(t => t.id === tx).status, 'Batal');
  assert.equal(s.refunds.at(-1).amount, 330000);
  assert.equal(balance(s, 'i1'), before + 1);
});
test('reversal barang sekali; status final tidak dapat diubah langsung', () => {
  let s = seedState(); const w = s.workOrders[0];
  s = exec(s, { type: 'returnPart', id: w.id, lineId: w.lines[2].id, reason: 'Tidak dipakai' });
  assert.equal(balance(s, 'i1'), 5);
  assert.throws(() => exec(s, { type: 'returnPart', id: w.id, lineId: w.lines[2].id, reason: 'Lagi' }), /belum dipakai/);
  const ready = s.workOrders[11];
  assert.throws(() => exec(s, { type: 'woStatus', id: ready.id, status: 'Dikerjakan', reason: '' }), /final/);
});
test('diskon di atas batas menunggu owner dan menghalangi pembayaran', () => {
  let s = seedState(); const t = newTransaction('Barang', s);
  t.lines = [catalogLine(s.items[0], 'item')]; t.discount = { amount: 5000, reason: 'Penyesuaian layanan', status: 'Disetujui' };
  s = exec(s, { type: 'transaction', value: t }, 'u2');
  assert.equal(s.transactions.at(-1).discount.status, 'Menunggu');
  assert.throws(() => exec(s, { type: 'pay', id: t.id, method: 'Tunai', received: 70000, reference: '' }, 'u2'), /Diskon/);
  s = exec(s, { type: 'discountDecision', id: t.id, kind: 'transaction', approve: true, reason: 'Sesuai kebijakan' });
  s = exec(s, { type: 'pay', id: t.id, method: 'Tunai', received: 70000, reference: '' }, 'u2');
  assert.equal(s.transactions.at(-1).status, 'Final');
});
console.log(`${checks} pemeriksaan domain lulus.`);
