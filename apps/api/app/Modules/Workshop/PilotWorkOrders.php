<?php

namespace App\Modules\Workshop;

use App\Modules\Inventory\PilotInventory;
use App\Support\PilotNumbers;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PilotWorkOrders
{
    private const OPEN = ['Inspeksi', 'Menunggu Persetujuan', 'Menunggu Barang', 'Dikerjakan'];

    public function index(Request $request)
    {
        abort_unless($request->user()->canWork(), 403);
        return $this->workQuery()->latest('work_orders.id')->limit(100)->get();
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->canWork(), 403);
        $input = $request->validate([
            'request_id' => 'required|uuid',
            'vehicle_id' => 'required|integer|exists:vehicles,id',
            'complaint' => 'required|string|max:1500',
        ]);
        $id = DB::transaction(function () use ($input, $request) {
            DB::table('users')->where('id', $request->user()->id)->lockForUpdate()->first();
            $existing = DB::table('work_orders')->where('request_id', $input['request_id'])->first();
            if ($existing) {
                abort_unless($existing->opened_by === $request->user()->id &&
                    $existing->vehicle_id === (int) $input['vehicle_id'] &&
                    $existing->complaint === $input['complaint'], 409, 'Referensi permintaan telah dipakai.');
                return $existing->id;
            }
            return DB::table('work_orders')->insertGetId([
                ...$input,
                'number' => PilotNumbers::next('WO'),
                'opened_by' => $request->user()->id,
                'status' => 'Inspeksi',
                'opened_at' => now(),
            ]);
        }, 3);
        return response()->json(['id' => $id], 201);
    }

    public function show(Request $request, int $work)
    {
        abort_unless($request->user()->canWork(), 403);
        $record = $this->workQuery()->where('work_orders.id', $work)->first();
        abort_unless($record, 404);
        $lines = $this->lines($record);
        $approval = DB::table('approvals')->where(['work_order_id' => $work, 'version' => $record->version])->first();
        return [
            ...((array) $record),
            'lines' => $lines,
            'total' => $this->total($lines),
            'photos' => DB::table('work_photos')->where('work_order_id', $work)->get(['id', 'kind']),
            'approval' => $approval,
            'invoice' => DB::table('invoices')->where('work_order_id', $work)
                ->join('users', 'users.id', '=', 'invoices.paid_by')
                ->first(['invoices.*', 'users.name as cashier']),
        ];
    }

    public function estimate(Request $request, int $work)
    {
        $data = $request->validate([
            'version' => 'required|integer|min:0',
            'inspection' => 'required|string|max:1500',
            'mechanic' => 'required|string|max:120',
            'lines' => 'required|array|min:1|max:50',
            'lines.*' => 'required|array:catalog_id,quantity',
            'lines.*.catalog_id' => 'required|integer|distinct|exists:catalog,id',
            'lines.*.quantity' => 'required|integer|min:1|max:10000',
        ]);

        return $this->change($request, $work, function ($record) use ($data) {
            $this->expectVersion($record, $data);
            abort_unless(in_array($record->status, self::OPEN, true), 409, 'Estimasi WO sudah ditutup.');
            $issued = $this->issued($record->id);
            $quantities = collect($data['lines'])->keyBy('catalog_id');
            foreach ($issued as $id => $quantity) {
                abort_if((int) ($quantities[$id]['quantity'] ?? 0) < $quantity, 409, 'Estimasi tidak boleh menghapus atau mengurangi barang yang sudah dipakai.');
            }
            $catalog = DB::table('catalog')->whereIn('id', $quantities->keys())->get()->keyBy('id');
            $version = $record->version + 1;
            DB::table('work_lines')->insert($quantities->map(function ($line) use ($record, $version, $catalog) {
                $item = $catalog[$line['catalog_id']];
                return [
                    ...$line,
                    'work_order_id' => $record->id,
                    'version' => $version,
                    'name' => $item->name,
                    'kind' => $item->kind,
                    'price' => $item->price,
                ];
            })->values()->all());
            $this->update($record, [
                'status' => 'Menunggu Persetujuan',
                'version' => $version,
                'inspection' => $data['inspection'],
                'mechanic' => $data['mechanic'],
            ]);
            return ['version' => $version];
        });
    }

    public function approve(Request $request, int $work)
    {
        $data = $request->validate([
            'version' => 'required|integer|min:1',
            'name' => 'required|string|max:120',
            'method' => 'required|in:langsung,telepon,whatsapp',
            'decision' => 'required|in:disetujui,ditolak',
        ]);
        return $this->change($request, $work, function ($record) use ($data, $request) {
            $this->expectVersion($record, $data);
            $existing = DB::table('approvals')->where(['work_order_id' => $record->id, 'version' => $record->version])->first();
            if ($existing) {
                abort_unless($existing->decision === $data['decision'] && $existing->name === $data['name'] &&
                    $existing->method === $data['method'], 409, 'Keputusan sudah tersimpan. Buat revisi estimasi untuk meminta keputusan baru.');
                return ['decision' => $existing->decision];
            }
            abort_unless($record->status === 'Menunggu Persetujuan', 409, 'WO tidak sedang menunggu persetujuan.');
            DB::table('approvals')->insert([
                ...$data,
                'work_order_id' => $record->id,
                'user_id' => $request->user()->id,
                'total' => $this->total($this->lines($record)),
                'created_at' => now(),
            ]);
            return ['decision' => $data['decision']];
        });
    }

    public function upload(Request $request, int $work)
    {
        abort_unless($request->user()->canWork(), 403);
        $data = $request->validate([
            'kind' => 'required|in:umum,masalah',
            'photo' => 'required|file|image|mimes:jpg,jpeg,png,webp|max:5120|dimensions:max_width=6000,max_height=6000',
        ]);
        $disk = Storage::disk('local');
        $path = $disk->putFile('pilot/wo/'.$work, $data['photo']);
        abort_unless($path, 500, 'Foto gagal disimpan.');
        try {
            return $this->change($request, $work, function ($record) use ($data, $path) {
                abort_unless(in_array($record->status, self::OPEN, true), 409, 'Foto WO sudah ditutup.');
                abort_if(DB::table('work_photos')->where(['work_order_id' => $record->id, 'kind' => $data['kind']])->exists(), 409, 'Foto untuk kategori ini sudah ada.');
                DB::table('work_photos')->insert(['work_order_id' => $record->id, 'kind' => $data['kind'], 'path' => $path]);
                return ['kind' => $data['kind']];
            });
        } catch (\Throwable $error) {
            $disk->delete($path);
            throw $error;
        }
    }

    public function photo(Request $request, int $work, int $photo)
    {
        abort_unless($request->user()->canWork(), 403);
        $row = DB::table('work_photos')->where(['work_order_id' => $work, 'id' => $photo])->first();
        abort_unless($row && Storage::disk('local')->exists($row->path), 404);
        return Storage::disk('local')->response($row->path, null, [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function issue(Request $request, int $work, PilotInventory $inventory)
    {
        $data = $request->validate(['version' => 'required|integer|min:1']);
        return $this->change($request, $work, function ($record) use ($data, $request, $inventory) {
            $this->expectVersion($record, $data);
            abort_unless(in_array($record->status, self::OPEN, true), 409, 'WO tidak dapat dikerjakan.');
            abort_unless(DB::table('approvals')->where([
                'work_order_id' => $record->id,
                'version' => $record->version,
                'decision' => 'disetujui',
            ])->exists(), 409, 'Estimasi ini belum disetujui.');
            abort_unless(DB::table('work_photos')->where('work_order_id', $record->id)->count() === 2, 409, 'Lengkapi dua foto kondisi.');
            $parts = $this->lines($record)->where('kind', 'part');
            $items = $inventory->lockItems($parts->pluck('catalog_id')->all());
            $issued = $this->issued($record->id);
            $shortages = [];
            foreach ($parts as $line) {
                $remaining = $line->quantity - ($issued[$line->catalog_id] ?? 0);
                if ($remaining > $items[$line->catalog_id]->balance) {
                    $shortages[] = $line->name;
                }
            }
            if ($shortages) {
                $this->update($record, ['status' => 'Menunggu Barang']);
                return ['status' => 'Menunggu Barang', 'shortages' => $shortages];
            }
            foreach ($parts as $line) {
                $item = $items[$line->catalog_id];
                $remaining = $line->quantity - ($issued[$line->catalog_id] ?? 0);
                if ($remaining > 0) {
                    $inventory->move($item, -$remaining, $item->average_cost, [
                        'kind' => 'issue',
                        'work_order_id' => $record->id,
                        'user_id' => $request->user()->id,
                        'movement_key' => 'issue:'.$line->id,
                    ]);
                }
            }
            $this->update($record, ['status' => 'Dikerjakan']);
            return ['status' => 'Dikerjakan', 'shortages' => []];
        });
    }

    public function finish(Request $request, int $work)
    {
        $data = $request->validate(['version' => 'required|integer|min:1', 'actual_confirmed' => 'required|accepted']);
        return $this->change($request, $work, function ($record) use ($data) {
            $this->expectVersion($record, $data);
            abort_unless(in_array($record->status, ['Dikerjakan', 'Siap Diambil'], true), 409, 'Konfirmasi pengerjaan terlebih dahulu.');
            $this->update($record, ['status' => 'Siap Diambil']);
            return ['status' => 'Siap Diambil'];
        });
    }

    public function pay(Request $request, int $work)
    {
        $data = $request->validate([
            'version' => 'required|integer|min:1',
            'method' => 'required|in:tunai,transfer',
            'received' => 'required|integer|min:0|max:50000000000000',
            'reference' => ['nullable', Rule::requiredIf($request->input('method') === 'transfer'), 'string', 'max:80'],
        ]);
        return $this->change($request, $work, function ($record) use ($data, $request) {
            $this->expectVersion($record, $data);
            $reference = $data['method'] === 'transfer' ? $data['reference'] : null;
            $invoice = DB::table('invoices')->where('work_order_id', $record->id)->first();
            if ($invoice) {
                abort_unless($invoice->method === $data['method'] && $invoice->received === (int) $data['received'] &&
                    $invoice->reference === $reference, 409, 'Pembayaran sudah tercatat.');
                return ['number' => $invoice->number];
            }
            abort_unless($record->status === 'Siap Diambil', 409, 'WO belum siap dibayar.');
            $total = $this->total($this->lines($record));
            abort_if(
                $data['received'] < $total || ($data['method'] === 'transfer' && (int) $data['received'] !== $total),
                422,
                'Nominal pembayaran tidak cocok dengan tagihan.'
            );
            $number = PilotNumbers::next('SRV');
            DB::table('invoices')->insert([
                'work_order_id' => $record->id,
                'paid_by' => $request->user()->id,
                'method' => $data['method'],
                'reference' => $reference,
                'received' => $data['received'],
                'total' => $total,
                'number' => $number,
                'paid_at' => now(),
            ]);
            return ['number' => $number];
        });
    }

    public function handover(Request $request, int $work)
    {
        return $this->change($request, $work, function ($record) {
            if ($record->status !== 'Selesai') {
                abort_unless($record->status === 'Siap Diambil' &&
                    DB::table('invoices')->where('work_order_id', $record->id)->exists(), 409, 'WO harus lunas sebelum serah terima.');
                $this->update($record, ['status' => 'Selesai', 'handed_over_at' => now()]);
            }
            return ['status' => 'Selesai'];
        });
    }

    public function cancel(Request $request, int $work, PilotInventory $inventory)
    {
        $data = $request->validate(['reason' => 'required|string|max:1200', 'returned' => 'sometimes|boolean']);
        return $this->change($request, $work, function ($record) use ($data, $request, $inventory) {
            if ($record->status === 'Dibatalkan') {
                abort_unless($record->cancel_reason === $data['reason'], 409, 'Alasan pembatalan sudah tercatat.');
                return ['status' => 'Dibatalkan'];
            }
            abort_unless(in_array($record->status, self::OPEN, true), 409, 'WO tidak dapat dibatalkan pada status ini.');
            $issues = DB::table('stock_movements')->where(['work_order_id' => $record->id, 'kind' => 'issue'])->get()->groupBy('catalog_id');
            if ($issues->isNotEmpty()) {
                abort_unless($request->user()->role === 'owner' && ($data['returned'] ?? false), 409, 'Owner perlu mengonfirmasi pengembalian semua barang.');
                $items = $inventory->lockItems($issues->keys()->all());
                foreach ($items as $id => $item) {
                    $quantity = -$issues[$id]->sum('quantity');
                    $cost = $issues[$id]->sum(fn ($row) => -$row->quantity * $row->unit_cost);
                    $inventory->move($item, $quantity, intdiv($cost + intdiv($quantity, 2), $quantity), [
                        'kind' => 'return',
                        'work_order_id' => $record->id,
                        'user_id' => $request->user()->id,
                        'movement_key' => 'return:'.$record->id.':'.$id,
                    ], $inventory->inboundCost($item, $quantity, $cost));
                }
            }
            $this->update($record, ['status' => 'Dibatalkan', 'cancel_reason' => $data['reason'], 'cancelled_at' => now()]);
            return ['status' => 'Dibatalkan'];
        });
    }

    private function workQuery()
    {
        return DB::table('work_orders')
            ->join('vehicles', 'vehicles.id', '=', 'work_orders.vehicle_id')
            ->join('customers', 'customers.id', '=', 'vehicles.customer_id')
            ->select('work_orders.id', 'work_orders.number', 'work_orders.status', 'work_orders.version',
                'work_orders.complaint', 'work_orders.inspection', 'work_orders.mechanic', 'work_orders.opened_at',
                'work_orders.cancel_reason', 'work_orders.handed_over_at', 'vehicles.model', 'vehicles.plate',
                'customers.name as customer');
    }

    private function change(Request $request, int $work, callable $action)
    {
        abort_unless($request->user()->canWork(), 403);
        return DB::transaction(function () use ($work, $action) {
            $record = DB::table('work_orders')->where('id', $work)->lockForUpdate()->first();
            abort_unless($record, 404);
            return $action($record);
        }, 3);
    }

    private function update(object $record, array $data): void
    {
        DB::table('work_orders')->where('id', $record->id)->update($data);
    }

    private function expectVersion(object $record, array $data): void
    {
        abort_unless($record->version === (int) $data['version'], 409, 'Estimasi telah berubah. Muat ulang WO sebelum melanjutkan.');
    }

    private function lines(object $record): Collection
    {
        return DB::table('work_lines')->where(['work_order_id' => $record->id, 'version' => $record->version])->orderBy('id')->get();
    }

    private function total(Collection $lines): int
    {
        return $lines->sum(fn ($line) => $line->price * $line->quantity);
    }

    private function issued(int $work): Collection
    {
        return DB::table('stock_movements')->where(['work_order_id' => $work, 'kind' => 'issue'])
            ->get(['catalog_id', 'quantity'])->groupBy('catalog_id')->map(fn ($lines) => -$lines->sum('quantity'));
    }
}
