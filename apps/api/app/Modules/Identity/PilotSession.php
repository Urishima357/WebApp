<?php

namespace App\Modules\Identity;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class PilotSession
{
    public function show(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'csrf' => $request->session()->token(),
            'user' => $user ? [
                'name' => $user->name,
                'role' => $user->role,
                'canWork' => $user->canWork(),
                'canReceive' => $user->canReceive(),
            ] : null,
        ])->header('Cache-Control', 'no-store');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate(['email' => 'required|email|max:255', 'password' => 'required|string|max:72']);
        $credentials['email'] = strtolower($credentials['email']);
        if (strlen($credentials['password']) > 72 || !Auth::attempt($credentials)) {
            throw ValidationException::withMessages(['email' => 'Email atau kata sandi salah.']);
        }

        $request->session()->regenerate();
        return $this->show($request);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return $this->show($request);
    }
}
