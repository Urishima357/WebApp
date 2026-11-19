<?php

use Pdo\Mysql;

$ca = env('MYSQL_ATTR_SSL_CA');
$connection = env('DB_CONNECTION', 'mysql');
$database = env('DB_DATABASE', 'garasi_hobby_pilot');

if ($connection === 'mysql' && !in_array($database, ['garasi_hobby_pilot', 'garasi_hobby_pilot_test'], true)) {
    throw new RuntimeException('Konfigurasi database pilot menunjuk ke schema di luar pilot.');
}

return [
    'default' => $connection,
    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', 3307),
            'database' => $database,
            'username' => env('DB_USERNAME', 'gh_pilot_app'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_0900_ai_ci',
            'strict' => true,
            'engine' => 'InnoDB',
            'options' => $ca ? [
                PHP_VERSION_ID >= 80400 ? Mysql::ATTR_SSL_CA : PDO::MYSQL_ATTR_SSL_CA => $ca,
                PHP_VERSION_ID >= 80400 ? Mysql::ATTR_SSL_VERIFY_SERVER_CERT : PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => true,
            ] : [],
        ],
        'sqlite' => [
            'driver' => 'sqlite',
            'database' => env('DB_DATABASE', ':memory:'),
            'foreign_key_constraints' => true,
        ],
    ],
];
