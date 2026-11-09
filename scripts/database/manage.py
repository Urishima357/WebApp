"""Local MySQL lifecycle. Secrets stay in ignored, ACL-restricted .local/mysql.

Requires the official signed mysql-8.4.13-winx64 ZIP verified before extraction.
No credentials are accepted in command-line arguments or printed to stdout.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / '.local/mysql'
BIN = ROOT / '.tools/mysql-8.4.13-winx64/bin'
DATA = PRIVATE / 'data'
DB = 'garasi_hobby_servis'
DATABASES = ('garasi_hobby_servis','garasi_hobby_showroom')
PORT = 3307
MIGRATIONS = ROOT / 'apps/api/database/erd'


def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], capture_output=True, **kwargs)


def require(result, label):
    if result.returncode:
        # MySQL errors normally contain no passwords, but redact every known secret.
        message = result.stderr.decode(errors='replace') if isinstance(result.stderr, bytes) else result.stderr
        if (PRIVATE/'secrets.json').exists():
            for value in json.loads((PRIVATE/'secrets.json').read_text()).values():
                message = message.replace(value, '[REDACTED]')
        raise RuntimeError(f'{label}: {message[:1600]}')
    return result


def ps(code):
    return require(run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', code], text=True), 'PowerShell').stdout.strip()


def quote_ps(s):
    return "'" + str(s).replace("'", "''") + "'"


def restrict(path, directory=False):
    # Keep both the execution account and the workspace owner's account able to use it.
    owner_path = Path('C:/Users/USER')
    code = "$cur=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $o=(Get-Acl -LiteralPath " + quote_ps(ROOT) + ").Owner; $sid=([Security.Principal.NTAccount]$o).Translate([Security.Principal.SecurityIdentifier]).Value; $human=([Security.Principal.NTAccount]::new($env:COMPUTERNAME,'" + owner_path.name + "')).Translate([Security.Principal.SecurityIdentifier]).Value; Write-Output $cur; Write-Output $sid; Write-Output $human"
    sids = set(ps(code).splitlines()) | {'S-1-5-18', 'S-1-5-32-544'}
    inheritance = '(OI)(CI)' if directory else ''
    args = ['icacls.exe', str(path), '/inheritance:r', '/grant:r'] + [f'*{sid}:{inheritance}F' for sid in sorted(sids)]
    require(run(args, text=True), 'Restrict local file ACL')


def config(role, password, user=None, verify_identity=False):
    user = user or {'admin':'root', 'migrate':'gh_migrate', 'app':'gh_app', 'backup':'gh_backup'}[role]
    ca = (DATA/'ca.pem').as_posix()
    mode = 'VERIFY_IDENTITY' if verify_identity else 'VERIFY_CA'
    result = f'[client]\nuser={user}\npassword={password}\nhost=127.0.0.1\nport={PORT}\nprotocol=TCP\nssl-mode={mode}\nssl-ca="{ca}"\ndefault-character-set=utf8mb4\n[mysql]\nlocal-infile=0\n'
    path = PRIVATE/f'client-{role}.cnf'
    path.write_text(result, encoding='utf-8')
    restrict(path)
    return path


def sql(statement, role='admin', database=None, expired=False):
    args = [BIN/'mysql.exe', f'--defaults-extra-file={PRIVATE / ("client-"+role+".cnf")}', '--batch', '--raw', '--skip-column-names']
    if expired:
        args.append('--connect-expired-password')
    if database:
        if not re.fullmatch('[a-z_]+', database):
            raise ValueError('Unsafe database identifier')
        args.append(database)
    return run(args, input=statement.encode('utf-8'))


def query(statement, role='admin', database=None):
    return require(sql(statement, role, database), 'MySQL request').stdout.decode('utf-8').strip()


def start():
    pidfile = PRIVATE/'mysql.pid'
    if pidfile.exists():
        # A reachable instance must also belong to this project's data directory.
        result = sql('SELECT @@datadir;') if (PRIVATE/'client-admin.cnf').exists() else None
        if result and result.returncode == 0:
            actual = result.stdout.decode().strip().replace('\\','/').rstrip('/').lower()
            if actual != DATA.as_posix().lower():
                raise RuntimeError('Port belongs to another MySQL instance')
            return
    args = '--defaults-file="' + (PRIVATE/'my.ini').as_posix() + '"'
    code = '$p=Start-Process -FilePath ' + quote_ps(BIN/'mysqld.exe') + ' -ArgumentList ' + quote_ps(args) + ' -WindowStyle Hidden -PassThru; Write-Output $p.Id'
    pid = ps(code)
    (PRIVATE/'launcher-pid.txt').write_text(pid)
    for _ in range(60):
        if pidfile.exists() and (DATA/'ca.pem').exists():
            result=sql('SELECT @@datadir;')
            if result.returncode==0:
                actual=result.stdout.decode().strip().replace('\\','/').rstrip('/').lower()
                if actual!=DATA.as_posix().lower():
                    raise RuntimeError('Unexpected MySQL data directory on local port')
                return
        time.sleep(.5)
    raise RuntimeError('MySQL startup did not complete; inspect private error log')


def setup():
    if not (BIN/'mysqld.exe').exists():
        raise RuntimeError('Verified portable MySQL archive must be extracted first')
    if (PRIVATE/'secrets.json').exists():
        raise RuntimeError('Existing initialized setup: use start/migrate/verify; passwords are not overwritten')
    PRIVATE.mkdir(parents=True, exist_ok=True)
    restrict(PRIVATE.parent, True)
    restrict(PRIVATE, True)
    DATA.mkdir(exist_ok=True)
    if any(DATA.iterdir()):
        raise RuntimeError('Refusing to initialize a nonempty data directory')
    for d in ('logs','backups'):
        (PRIVATE/d).mkdir(exist_ok=True)
    credentials = {role: secrets.token_urlsafe(36) for role in ('admin','migrate','app','backup')}
    (PRIVATE/'secrets.json').write_text(json.dumps(credentials, indent=2))
    restrict(PRIVATE/'secrets.json')
    ini = f'''[mysqld]
basedir="{BIN.parent.as_posix()}"
datadir="{DATA.as_posix()}"
port={PORT}
bind-address=127.0.0.1
mysqlx=0
skip-name-resolve=ON
require-secure-transport=ON
tls-version=TLSv1.2,TLSv1.3
local-infile=0
secure-file-priv=NULL
default-time-zone=+00:00
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
sql-mode=ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
max-connections=30
innodb-flush-log-at-trx-commit=1
skip-log-bin
log-error="{(PRIVATE/'logs/mysql-error.log').as_posix()}"
pid-file="{(PRIVATE/'mysql.pid').as_posix()}"
'''
    (PRIVATE/'my.ini').write_text(ini,encoding='utf-8')
    init = run([BIN/'mysqld.exe', f'--defaults-file={PRIVATE/"my.ini"}', '--initialize'])
    require(init, 'MySQL secure initialization')
    bootstrap_admin(credentials)
    provision(credentials)


def bootstrap_admin(credentials):
    # One-time init-file is executed by the newly initialized server before clients.
    # Authentication remains enabled. Match the root host to loopback with name resolution disabled.
    initfile = PRIVATE/'bootstrap-admin.sql'
    initfile.write_text("ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '" + credentials['admin'] + "' REQUIRE SSL;\nRENAME USER 'root'@'localhost' TO 'root'@'127.0.0.1';\n",encoding='utf-8')
    restrict(initfile)
    ini = PRIVATE/'my.ini'
    original = ini.read_text()
    ini.write_text(original + f'init-file="{initfile.as_posix()}"\n')
    config('admin',credentials['admin'])
    start()
    for _ in range(60):
        result=sql('SELECT 1;')
        if result.returncode==0:
            break
        time.sleep(.5)
    require(result,'Initialize loopback-only admin account')
    ini.write_text(original)
    initfile.unlink()


def provision(credentials):
    query(f'CREATE DATABASE `{DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
    for role,user in [('migrate','gh_migrate'),('app','gh_app'),('backup','gh_backup')]:
        query(f"CREATE USER '{user}'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '{credentials[role]}' REQUIRE SSL WITH MAX_USER_CONNECTIONS 10;")
        query(f"ALTER USER '{user}'@'127.0.0.1' FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1;")
        config(role, credentials[role])
    query(f"GRANT ALL PRIVILEGES ON `{DB}`.* TO 'gh_migrate'@'127.0.0.1';")
    # Runtime privileges are granted per table only after the schema exists.
    envpath = ROOT/'apps/api/.env.database.local'
    if envpath.exists():
        raise RuntimeError('Refusing to overwrite existing backend database environment file')
    envpath.write_text(f'DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT={PORT}\nDB_DATABASE={DB}\nDB_SHOWROOM_DATABASE=garasi_hobby_showroom\nDB_USERNAME=gh_app\nDB_PASSWORD={credentials["app"]}\nMYSQL_ATTR_SSL_CA="{(DATA/"ca.pem").as_posix()}"\n',encoding='utf-8')
    restrict(envpath)
    print('MySQL initialized on 127.0.0.1:3307 with TLS. Passwords are stored privately, never printed.')


def migrate():
    # The user's draw.io LRS is now the schema authority. Do not reapply the PRD expansion.
    from erd_databases import apply
    apply()


def backup(database=None):
    database=database or DB
    if database not in DATABASES:raise ValueError('Only the two active ERD databases may be backed up by this command')
    stamp = time.strftime('%Y%m%d-%H%M%S',time.gmtime())
    path = PRIVATE/'backups'/f'{database}-{stamp}.sql'
    args = [BIN/'mysqldump.exe',f'--defaults-extra-file={PRIVATE/"client-backup.cnf"}','--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-triggers','--hex-blob',database]
    result = require(run(args), 'Backup')
    if query(f"SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='{database}';")!='0':
        raise RuntimeError('Unexpected trigger outside ERD; review backup policy first')
    content=result.stdout
    with path.open('xb') as f:
        f.write(content)
    restrict(path)
    path.with_suffix('.sql.sha256').write_text(hashlib.sha256(content).hexdigest()+'\n')
    print('Backup created in ACL-restricted .local/mysql/backups; no off-device copy or encryption is implied.')
    return path


def stop():
    result = run([BIN/'mysqladmin.exe',f'--defaults-extra-file={PRIVATE/"client-admin.cnf"}','shutdown'])
    require(result,'MySQL shutdown')
    print('Local MySQL stopped.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['setup','start','stop','migrate','backup','status'])
    command=parser.parse_args().command
    if command=='status':
        print(query("SELECT VERSION(),@@port,@@bind_address,@@require_secure_transport,@@local_infile,@@secure_file_priv;"))
        for name in DATABASES:print(name,query(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='{name}';"),'tables')
    elif command=='backup':
        for name in DATABASES:backup(name)
    else:
        globals()[command]()


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        print('ERROR:',str(error),file=sys.stderr)
        sys.exit(1)
