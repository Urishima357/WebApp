<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql' && !in_array(DB::getDatabaseName(), ['garasi_hobby_pilot', 'garasi_hobby_pilot_test'], true)) {
            throw new RuntimeException('Pilot hanya dapat dimigrasi ke database pengembangan pilot.');
        }

        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name', 100);
            $t->string('email')->unique();
            $t->string('password');
            $t->string('role', 16);
            $t->rememberToken();
            $t->timestamps();
        });
        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->string('name', 120);
            $t->string('phone', 32)->nullable();
        });
        Schema::create('vehicles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->string('model', 120);
            $t->string('plate', 20)->nullable();
            $t->string('frame', 40)->nullable()->unique();
            $t->string('engine', 40)->nullable()->unique();
        });
        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->string('name', 120)->unique();
        });
        Schema::create('catalog', function (Blueprint $t) {
            $t->id();
            $t->string('code', 32)->unique();
            $t->string('kind', 8);
            $t->string('name', 120);
            $t->string('unit', 24);
            $t->unsignedInteger('price');
            $t->unsignedInteger('balance')->default(0);
            $t->unsignedInteger('average_cost')->default(0);
        });
        Schema::create('receipts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->string('reference', 80);
            $t->uuid('request_id')->unique();
            $t->timestamp('created_at');
            $t->timestamp('finalized_at')->nullable();
            $t->foreignId('finalized_by')->nullable()->constrained('users')->restrictOnDelete();
        });
        Schema::create('receipt_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('receipt_id')->constrained()->restrictOnDelete();
            $t->foreignId('catalog_id')->constrained('catalog')->restrictOnDelete();
            $t->unsignedInteger('quantity');
            $t->unsignedInteger('units_per_package');
            $t->unsignedInteger('package_cost');
            $t->unique(['receipt_id', 'catalog_id']);
        });
        Schema::create('document_counters', function (Blueprint $t) {
            $t->string('key', 16)->primary();
            $t->unsignedInteger('sequence');
        });
        Schema::create('work_orders', function (Blueprint $t) {
            $t->id();
            $t->string('number', 30)->unique();
            $t->uuid('request_id')->unique();
            $t->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $t->foreignId('opened_by')->constrained('users')->restrictOnDelete();
            $t->string('status', 30);
            $t->text('complaint');
            $t->text('inspection')->nullable();
            $t->string('mechanic', 120)->nullable();
            $t->unsignedInteger('version')->default(0);
            $t->timestamp('opened_at');
            $t->timestamp('handed_over_at')->nullable();
            $t->timestamp('cancelled_at')->nullable();
            $t->text('cancel_reason')->nullable();
        });
        Schema::create('work_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('version');
            $t->foreignId('catalog_id')->constrained('catalog')->restrictOnDelete();
            $t->string('name', 120);
            $t->string('kind', 8);
            $t->unsignedInteger('quantity');
            $t->unsignedInteger('price');
            $t->unique(['work_order_id', 'version', 'catalog_id']);
        });
        Schema::create('approvals', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->restrictOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('version');
            $t->string('decision', 15);
            $t->string('name', 120);
            $t->string('method', 16);
            $t->unsignedBigInteger('total');
            $t->timestamp('created_at');
            $t->unique(['work_order_id', 'version']);
        });
        Schema::create('work_photos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->constrained()->restrictOnDelete();
            $t->string('kind', 16);
            $t->string('path');
            $t->unique(['work_order_id', 'kind']);
        });
        Schema::create('stock_movements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('catalog_id')->constrained('catalog')->restrictOnDelete();
            $t->foreignId('work_order_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('receipt_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->string('kind', 12);
            $t->string('movement_key', 100)->unique();
            $t->integer('quantity');
            $t->unsignedInteger('unit_cost');
            $t->timestamp('created_at');
        });
        Schema::create('invoices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('work_order_id')->unique()->constrained()->restrictOnDelete();
            $t->foreignId('paid_by')->constrained('users')->restrictOnDelete();
            $t->string('number', 30)->unique();
            $t->string('method', 12);
            $t->string('reference', 80)->nullable();
            $t->unsignedBigInteger('total');
            $t->unsignedBigInteger('received');
            $t->timestamp('paid_at');
        });
    }

    public function down(): void
    {
        foreach (['invoices', 'stock_movements', 'work_photos', 'approvals', 'work_lines', 'work_orders', 'document_counters', 'receipt_lines', 'receipts', 'catalog', 'suppliers', 'vehicles', 'customers', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
