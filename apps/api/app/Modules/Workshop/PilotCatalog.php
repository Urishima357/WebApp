<?php

namespace App\Modules\Workshop;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PilotCatalog
{
    public function index(Request $request)
    {
        $user = $request->user();
        $columns = ['id', 'name', 'code', 'kind', 'unit', 'balance'];
        if ($user->canWork()) {
            $columns[] = 'price';
        }
        if ($user->role === 'owner') {
            $columns[] = 'average_cost';
        }

        return [
            'catalog' => DB::table('catalog')->orderBy('name')->get($columns),
            'customers' => $user->canWork() ? DB::table('customers')->orderBy('name')->get(['id', 'name']) : [],
            'vehicles' => $user->canWork() ? DB::table('vehicles')->orderBy('model')->get(['id', 'customer_id', 'model', 'plate']) : [],
            'suppliers' => $user->canReceive() ? DB::table('suppliers')->orderBy('name')->get() : [],
        ];
    }

    public function customer(Request $request)
    {
        abort_unless($request->user()->canWork(), 403);
        $data = $request->validate(['name' => 'required|string|max:120', 'phone' => 'nullable|string|max:32']);
        return response()->json(['id' => DB::table('customers')->insertGetId($data)], 201);
    }

    public function vehicle(Request $request)
    {
        abort_unless($request->user()->canWork(), 403);
        foreach (['plate', 'frame', 'engine'] as $field) {
            if (is_string($request->input($field))) {
                $request->merge([$field => strtoupper($request->input($field))]);
            }
        }
        $data = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'model' => 'required|string|max:120',
            'plate' => 'nullable|string|max:20',
            'frame' => 'nullable|string|max:40|unique:vehicles,frame',
            'engine' => 'nullable|string|max:40|unique:vehicles,engine',
        ]);
        return response()->json(['id' => DB::table('vehicles')->insertGetId($data)], 201);
    }

    public function supplier(Request $request)
    {
        abort_unless($request->user()->role === 'owner', 403);
        $data = $request->validate(['name' => 'required|string|max:120|unique:suppliers,name']);
        return response()->json(['id' => DB::table('suppliers')->insertGetId($data)], 201);
    }

    public function item(Request $request)
    {
        abort_unless($request->user()->role === 'owner', 403);
        $data = $request->validate([
            'code' => 'required|string|max:32|unique:catalog,code',
            'kind' => ['required', Rule::in(['part', 'service'])],
            'name' => 'required|string|max:120',
            'unit' => 'required|string|max:24',
            'price' => 'required|integer|min:0|max:100000000',
        ]);
        return response()->json(['id' => DB::table('catalog')->insertGetId($data)], 201);
    }
}
