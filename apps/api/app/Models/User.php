<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    protected $fillable = ['name', 'email', 'password', 'role'];
    protected $hidden = ['password', 'remember_token'];

    public function canWork(): bool
    {
        return in_array($this->role, ['owner', 'bengkel'], true);
    }

    public function canReceive(): bool
    {
        return in_array($this->role, ['owner', 'gudang'], true);
    }
}
