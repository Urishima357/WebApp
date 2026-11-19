<?php

use App\Modules\Identity\PilotSession;
use App\Modules\Purchasing\PilotReceipts;
use App\Modules\Workshop\PilotCatalog;
use App\Modules\Workshop\PilotWorkOrders;
use Illuminate\Support\Facades\Route;

Route::prefix('pilot/api')->middleware('cache.headers:private;no_store')->group(function () {
    Route::get('session', [PilotSession::class, 'show']);
    Route::post('session', [PilotSession::class, 'login'])->middleware('throttle:6,1');
    Route::delete('session', [PilotSession::class, 'logout'])->middleware('auth');

    Route::middleware('auth')->group(function () {
        Route::get('catalog', [PilotCatalog::class, 'index']);
        Route::post('customers', [PilotCatalog::class, 'customer']);
        Route::post('vehicles', [PilotCatalog::class, 'vehicle']);
        Route::post('suppliers', [PilotCatalog::class, 'supplier']);
        Route::post('items', [PilotCatalog::class, 'item']);
        Route::get('receipts', [PilotReceipts::class, 'index']);
        Route::post('receipts', [PilotReceipts::class, 'store']);
        Route::post('receipts/{receipt}/finalize', [PilotReceipts::class, 'finalize'])->whereNumber('receipt');
        Route::get('work-orders', [PilotWorkOrders::class, 'index']);
        Route::post('work-orders', [PilotWorkOrders::class, 'store']);
        Route::prefix('work-orders/{work}')->where(['work' => '[0-9]+'])->group(function () {
            Route::get('', [PilotWorkOrders::class, 'show']);
            Route::post('estimate', [PilotWorkOrders::class, 'estimate']);
            Route::post('approval', [PilotWorkOrders::class, 'approve']);
            Route::post('photos', [PilotWorkOrders::class, 'upload']);
            Route::get('photos/{photo}', [PilotWorkOrders::class, 'photo'])->whereNumber('photo');
            Route::post('issue', [PilotWorkOrders::class, 'issue']);
            Route::post('finish', [PilotWorkOrders::class, 'finish']);
            Route::post('pay', [PilotWorkOrders::class, 'pay']);
            Route::post('handover', [PilotWorkOrders::class, 'handover']);
            Route::post('cancel', [PilotWorkOrders::class, 'cancel']);
        });
    });
});
