<?php

namespace App\Modules\Purchasing;

use App\Modules\Inventory\PilotInventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PilotReceipts
{
    public function index(Request $request)
    {
        abort_unless($request->user()->canReceive(), 403);
        return DB::table('receipts')->join('suppliers', 'suppliers.id', '=', 'receipts.supplier_id')
            ->latest('receipts.id')->limit(100)->get(['receipts.id', 'reference', 'finalized_at', 'suppliers.name as supplier']);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->canReceive(), 403);
        $input = $request->validate([
            'request_id' => 'required|uuid',
            'supplier_id' => 'required|integer|exists:suppliers,id',
            'reference' => 'required|string|max:80',
            'lines' => 'required|array|min:1|max:50',
            'lines.*' => 'required|array:catalog_id,quantity,units_per_package,package_cost',
            'lines.*.catalog_id' => ['required', 'integer', 'distinct', Rule::exists('catalog', 'id')->where('kind', 'part')],
            'lines.*.quantity' => 'required|integer|min:1|max:10000',
            'lines.*.units_per_package' => 'required|integer|min:1|max:10000',
            'lines.*.package_cost' => 'required|integer|min:0|max:100000000',
        ]);
        $id = DB::transaction(function () use ($input, $request) {
            DB::table('users')->where('id', $request->user()->id)->lockForUpdate()->first();
            $receipt = DB::table('receipts')->where('request_id', $input['request_id'])->first();
            if ($receipt) {
                abort_unless(
                    $receipt->user_id === $request->user()->id &&
                    $receipt->supplier_id === (int) $input['supplier_id'] &&
                    $receipt->reference === $input['reference'] &&
                    $this->sameLines($receipt->id, $input['lines']),
                    409,
                    'Referensi permintaan telah dipakai untuk draft berbeda.'
                );
                return $receipt->id;
            }
            $id = DB::table('receipts')->insertGetId([
                'request_id' => $input['request_id'],
                'supplier_id' => $input['supplier_id'],
                'reference' => $input['reference'],
                'user_id' => $request->user()->id,
                'created_at' => now(),
            ]);
            DB::table('receipt_lines')->insert(array_map(fn ($line) => [...$line, 'receipt_id' => $id], $input['lines']));
            return $id;
        }, 3);
        return response()->json(['id' => $id], 201);
    }

    private function sameLines(int $receipt, array $input): bool
    {
        $fields = ['catalog_id', 'quantity', 'units_per_package', 'package_cost'];
        $expected = collect($input)->sortBy('catalog_id')->map(
            fn (array $line) => array_map(fn (string $field) => (int) $line[$field], $fields)
        )->values()->all();
        $stored = DB::table('receipt_lines')->where('receipt_id', $receipt)->orderBy('catalog_id')->get($fields)->map(
            fn (object $line) => array_map(fn (string $field) => $line->$field, $fields)
        )->all();
        return $stored === $expected;
    }

    public function finalize(Request $request, int $receipt, PilotInventory $inventory)
    {
        abort_unless($request->user()->canReceive(), 403);
        return DB::transaction(function () use ($request, $receipt, $inventory) {
            $record = DB::table('receipts')->where('id', $receipt)->lockForUpdate()->first();
            abort_unless($record, 404);
            if (!$record->finalized_at) {
                $lines = DB::table('receipt_lines')->where('receipt_id', $receipt)->orderBy('catalog_id')->get();
                $items = $inventory->lockItems($lines->pluck('catalog_id')->all());
                foreach ($lines as $line) {
                    $item = $items[$line->catalog_id];
                    $quantity = $line->quantity * $line->units_per_package;
                    $cost = $line->package_cost * $line->quantity;
                    $inventory->move($item, $quantity, intdiv($cost + intdiv($quantity, 2), $quantity), [
                        'kind' => 'receive',
                        'receipt_id' => $receipt,
                        'user_id' => $request->user()->id,
                        'movement_key' => 'receive:'.$line->id,
                    ], $inventory->inboundCost($item, $quantity, $cost));
                }
                DB::table('receipts')->where('id', $receipt)->update(['finalized_at' => now(), 'finalized_by' => $request->user()->id]);
            }
            return ['id' => $receipt, 'status' => 'final'];
        }, 3);
    }
}
