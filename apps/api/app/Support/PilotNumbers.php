<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class PilotNumbers
{
    public static function next(string $type): string
    {
        $key = $type.'-'.now('Asia/Jakarta')->format('ym');
        DB::table('document_counters')->insertOrIgnore(['key' => $key, 'sequence' => 0]);
        $row = DB::table('document_counters')->where('key', $key)->lockForUpdate()->first();
        $sequence = $row->sequence + 1;
        DB::table('document_counters')->where('key', $key)->update(['sequence' => $sequence]);
        return sprintf('%s-%04d', $key, $sequence);
    }
}
