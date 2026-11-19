<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

$base = dirname(__DIR__);
foreach (['bootstrap/cache', 'storage/app/private', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs'] as $folder) {
    $path = $base.'/'.$folder;
    if (!is_dir($path) && !@mkdir($path, 0775, true) && !is_dir($path)) {
        throw new RuntimeException('Cannot create '.$folder);
    }
}

return Application::configure(basePath: $base)
    ->withRouting(web: $base.'/routes/web.php', commands: $base.'/routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->redirectGuestsTo(fn () => '/pilot/api/session');
        $middleware->preventRequestForgery(originOnly: false);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $error) => $request->is('pilot/api/*') || $request->expectsJson());
    })
    ->create();
