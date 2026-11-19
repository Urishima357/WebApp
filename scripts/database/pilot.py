"""Provision the isolated Laravel workshop pilot using the project's local MySQL runtime."""
import argparse
from base64 import b64encode
import json
import os
from pathlib import Path
import secrets
import subprocess

import manage as mysql

API = mysql.ROOT / 'apps/api'
PHP = mysql.ROOT / '.tools/php-8.3.36-1/php.exe'
PHP_INI = mysql.ROOT / '.local/pilot-php.ini'


def php_command():
    if not PHP.exists():
        return ['php']
    extensions = PHP.parent / 'ext'
    config = [
        f'extension_dir="{extensions.as_posix()}"',
        *(f'extension={module}' for module in ('curl', 'fileinfo', 'mbstring', 'openssl', 'pdo_mysql', 'pdo_sqlite', 'zip')),
        'upload_max_filesize=5M',
        'post_max_size=12M',
    ]
    PHP_INI.write_text('\n'.join(config) + '\n', encoding='ascii')
    return [str(PHP), '-c', str(PHP_INI)]


def setup(test=False):
    database = 'garasi_hobby_pilot_test' if test else 'garasi_hobby_pilot'
    stem = 'gh_pilot_test' if test else 'gh_pilot'
    credentials_path = mysql.PRIVATE / f'{stem}-credentials.json'
    mysql.start()

    if credentials_path.exists():
        credentials = json.loads(credentials_path.read_text(encoding='utf-8'))
    else:
        # Record generated credentials before creating the accounts so setup can be retried.
        credentials = {key: secrets.token_hex(24) for key in ('app', 'migrate')}
        credentials['key'] = 'base64:' + b64encode(secrets.token_bytes(32)).decode('ascii')
        with credentials_path.open('x', encoding='utf-8') as stream:
            json.dump(credentials, stream)
        mysql.restrict(credentials_path)

    mysql.query(f'CREATE DATABASE IF NOT EXISTS {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
    for role, permissions in (
        ('app', 'SELECT, INSERT, UPDATE'),
        ('migrate', 'SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES'),
    ):
        account = f"'{stem}_{role}'@'127.0.0.1'"
        result = mysql.sql(
            f"CREATE USER IF NOT EXISTS {account} IDENTIFIED BY '{credentials[role]}' REQUIRE SSL;\n"
            f'GRANT {permissions} ON {database}.* TO {account};'
        )
        if result.returncode:
            raise RuntimeError(f'Could not provision pilot {role} account.')

    settings = {
        'APP_NAME': 'Garasi Hobby',
        'APP_ENV': 'testing' if test else 'local',
        'APP_KEY': credentials['key'],
        'APP_DEBUG': 'false',
        'APP_URL': 'http://127.0.0.1:8000',
        'APP_TIMEZONE': 'Asia/Jakarta',
        'APP_LOCALE': 'id',
        'DB_CONNECTION': 'mysql',
        'DB_HOST': '127.0.0.1',
        'DB_PORT': str(mysql.PORT),
        'DB_DATABASE': database,
        'DB_USERNAME': f'{stem}_app',
        'DB_PASSWORD': credentials['app'],
        'MYSQL_ATTR_SSL_CA': (mysql.DATA / 'ca.pem').as_posix(),
        'SESSION_DRIVER': 'file',
        'SESSION_COOKIE': f'{stem}_session',
        'SESSION_LIFETIME': '30',
        'SESSION_SECURE_COOKIE': 'false',
        'CACHE_STORE': 'array' if test else 'file',
        'LOG_CHANNEL': 'single',
    }
    if not test:
        env_file = API / '.env'
        if not env_file.exists():
            with env_file.open('x', encoding='utf-8') as stream:
                stream.write(''.join(f'{key}="{value}"\n' for key, value in settings.items()))
            mysql.restrict(env_file)

    migration_env = os.environ | settings | {'DB_USERNAME': f'{stem}_migrate', 'DB_PASSWORD': credentials['migrate']}
    subprocess.run([*php_command(), 'artisan', 'migrate', '--force'], cwd=API, env=migration_env, check=True)
    print('MySQL pilot ready:', database)
    return settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['setup', 'serve', 'account'])
    parser.add_argument('args', nargs='*')
    options = parser.parse_args()
    if options.action == 'setup':
        setup()
        return
    command = ['artisan', 'pilot:account', *options.args] if options.action == 'account' else [
        '-S', '127.0.0.1:8000', '-t', 'public', 'public/index.php',
    ]
    subprocess.run([*php_command(), *command], cwd=API, check=True)


if __name__ == '__main__':
    main()
