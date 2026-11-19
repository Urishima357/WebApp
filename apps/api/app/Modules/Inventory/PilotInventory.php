<?php

namespace App\Modules\Inventory;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PilotInventory
{
    public function lockItems(array $ids): Collection
    {
        return DB::table('catalog')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
    }

    public function inboundCost(object $item, int $quantity, int $cost): int
    {
        $value = $item->balance * $item->average_cost + $cost;
        $balance = $item->balance + $quantity;
        return intdiv($value + intdiv($balance, 2), $balance);
    }

    public function move(object $item, int $quantity, int $cost, array $reference, ?int $average = null): void
    {
        $newBalance = $item->balance + $quantity;
        abort_if($newBalance < 0 || $newBalance > 100000000, 409, 'Perubahan melebihi batas saldo stok.');
        DB::table('catalog')->where('id', $item->id)->update([
            'balance' => $newBalance,
            'average_cost' => $average ?? $item->average_cost,
        ]);

        DB::table('stock_movements')->insert([
            'catalog_id' => $item->id,
            'quantity' => $quantity,
            'unit_cost' => $cost,
            'created_at' => now(),
            ...$reference,
        ]);

        $item->balance = $newBalance;
        $item->average_cost = $average ?? $item->average_cost;
    }
}
