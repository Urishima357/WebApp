<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

Artisan::command('pilot:account {email} {role} {name}', function () {
    $data = Validator::make([
        'email' => strtolower($this->argument('email')),
        'role' => $this->argument('role'),
        'name' => $this->argument('name'),
        'password' => $this->secret('Kata sandi akun baru (minimum 12 karakter)'),
    ], [
        'email' => 'required|email|max:255|unique:users,email',
        'role' => 'required|in:owner,bengkel,gudang',
        'name' => 'required|string|max:100',
        'password' => 'required|string|min:12|max:72',
    ])->validate();

    if (strlen($data['password']) > 72) {
        $this->error('Kata sandi maksimal 72 byte.');
        return 1;
    }

    $data['password'] = Hash::make($data['password']);
    User::create($data);
    $this->info('Akun dibuat.');
    return 0;
})->purpose('Buat akun baru untuk uji integrasi bengkel');
