"""Start a local, authenticated read-only phpMyAdmin viewer for Garasi Hobby."""
from pathlib import Path
import argparse
import hashlib
import http.cookiejar
import json
import secrets
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.error

import manage as db

PRIVATE=db.ROOT/'.local/phpmyadmin'
PHP=db.ROOT/'.tools/php-8.3.36-1/php.exe'
PMA=db.ROOT/'.tools/phpMyAdmin-5.2.3-all-languages'
URL='http://127.0.0.1:8081'


def openssl(*args):
    binary=Path('C:/Program Files/Git/usr/bin/openssl.exe')
    values=[str(a.relative_to(db.ROOT)).replace('\\','/') if isinstance(a,Path) else str(a) for a in args]
    return db.require(db.run([binary,*values],cwd=db.ROOT),'OpenSSL')


def certificate():
    # Preserve CA trust and verify the loopback host as well as the certificate chain.
    cert=db.DATA/'server-cert.pem'
    current=openssl('x509','-in',cert,'-noout','-ext','subjectAltName').stdout
    if b'IP Address:127.0.0.1' in current and b'DNS:localhost' in current:
        return
    conf=PRIVATE/'tls.cnf'
    conf.write_text('[req]\nprompt=no\ndistinguished_name=dn\n[dn]\nCN=localhost\n[server_cert]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n',encoding='utf-8')
    key=PRIVATE/'server-key-new.pem';csr=PRIVATE/'server.csr';newcert=PRIVATE/'server-cert-new.pem'
    openssl('req','-new','-newkey','rsa:3072','-nodes','-config',conf,'-keyout',key,'-out',csr)
    openssl('x509','-req','-in',csr,'-CA',db.DATA/'ca.pem','-CAkey',db.DATA/'ca-key.pem','-set_serial','0x'+secrets.token_hex(16),'-days','365','-sha256','-extfile',conf,'-extensions','server_cert','-out',newcert)
    openssl('verify','-CAfile',db.DATA/'ca.pem','-verify_ip','127.0.0.1',newcert)
    for new,old in [(key,db.DATA/'server-key.pem'),(newcert,cert)]:
        assert old.resolve().is_relative_to(db.PRIVATE.resolve())
        backup=old.with_suffix(old.suffix+'.before-phpmyadmin')
        if not backup.exists():shutil.copy2(old,backup)
        shutil.copyfile(new,old)
    db.query('ALTER INSTANCE RELOAD TLS;')


def prepare():
    if not PHP.is_file() or not (PMA/'index.php').is_file():
        raise RuntimeError('Verified PHP and phpMyAdmin archives must be extracted first')
    PRIVATE.mkdir(parents=True,exist_ok=True)
    db.restrict(PRIVATE,True)
    for name in ('sessions','tmp'):(PRIVATE/name).mkdir(exist_ok=True)
    certificate()
    # Initialization uses MySQL's generated CA before a hostname certificate
    # exists. Once installed, require hostname verification in every CLI helper.
    for role,password in json.loads((db.PRIVATE/'secrets.json').read_text()).items():
        db.config(role,password,verify_identity=True)
    credential_file=PRIVATE/'viewer.json'
    if not credential_file.exists():
        if db.query("SELECT COUNT(*) FROM mysql.user WHERE User='gh_viewer';")!='0':
            raise RuntimeError('Existing viewer account has no managed credentials; refusing to overwrite it')
        credentials={'username':'gh_viewer','password':secrets.token_urlsafe(36),'cookie_secret':secrets.token_hex(16)}
        db.query("CREATE USER 'gh_viewer'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '"+credentials['password']+"' REQUIRE SSL WITH MAX_USER_CONNECTIONS 5;")
        for database in db.DATABASES:
            db.query(f"GRANT SELECT,SHOW VIEW ON `{database}`.* TO 'gh_viewer'@'127.0.0.1';")
        credential_file.write_text(json.dumps(credentials),encoding='utf-8')
        db.restrict(credential_file)
    db.query("ALTER USER 'gh_viewer'@'127.0.0.1' REQUIRE SSL WITH MAX_USER_CONNECTIONS 5 FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1;")
    ini=f'''[PHP]
extension_dir="{(PHP.parent/'ext').as_posix()}"
extension=mysqli
extension=mbstring
extension=openssl
extension=sodium
extension=fileinfo
date.timezone=Asia/Jakarta
expose_php=Off
display_errors=Off
log_errors=On
error_log="{(PRIVATE/'php-error.log').as_posix()}"
memory_limit=256M
max_execution_time=60
allow_url_include=Off
allow_url_fopen=Off
session.save_path="{(PRIVATE/'sessions').as_posix()}"
session.use_strict_mode=1
session.use_only_cookies=1
session.cookie_httponly=1
session.cookie_samesite=Strict
session.upload_progress.enabled=0
mysqli.allow_local_infile=0
'''
    (PRIVATE/'php.ini').write_text(ini,encoding='utf-8')
    settings="<?php\n$viewer = json_decode(file_get_contents("+json.dumps(credential_file.as_posix())+"), true);\n"
    settings+="$cfg['blowfish_secret']=$viewer['cookie_secret'];\n$cfg['Servers'][1]=[\n'auth_type'=>'signon',\n'SignonSession'=>'GHPMASignon',\n'SignonURL'=>'/signin',\n'host'=>'127.0.0.1',\n'port'=>'3307',\n'connect_type'=>'tcp',\n'ssl'=>true,\n'ssl_verify'=>true,\n'ssl_ca'=>"+json.dumps((db.DATA/'ca.pem').as_posix())+",\n'AllowNoPassword'=>false,\n'AllowRoot'=>false,\n'only_db'=>['garasi_hobby_servis','garasi_hobby_showroom'],\n'verbose'=>'Garasi Hobby — hanya lihat',\n];\n"
    settings+="$cfg['Servers'][1]['SignonCookieParams']=['lifetime'=>0,'path'=>'/','httponly'=>true,'samesite'=>'Strict'];\n"
    settings+="$cfg['ServerDefault']=1;\n$cfg['AllowArbitraryServer']=false;\n$cfg['VersionCheck']=false;\n$cfg['SendErrorReports']='never';\n$cfg['ZeroConf']=false;\n$cfg['PmaNoRelation_DisableWarning']=true;\n$cfg['ShowPhpInfo']=false;\n$cfg['DefaultTabDatabase']='structure';\n$cfg['TempDir']="+json.dumps((PRIVATE/'tmp').as_posix())+";\n"
    (PRIVATE/'config.php').write_text(settings,encoding='utf-8')
    (PMA/'config.inc.php').write_text('<?php\nrequire '+json.dumps((PRIVATE/'config.php').as_posix())+';\n',encoding='utf-8')
    gate=r'''<?php
$launchPath=__DIR__.'/launch.json';
$launch=is_file($launchPath)?json_decode(file_get_contents($launchPath),true):null;
$token=$_GET['token']??'';
if (!$launch || $launch['expires']<time() || !is_string($token) || !hash_equals($launch['hash'],hash('sha256',$token))) {
    http_response_code(403); echo 'Akses tidak aktif. Jalankan kembali scripts/database/phpmyadmin.py open.'; exit;
}
unlink($launchPath);
$viewer=json_decode(file_get_contents(__DIR__.'/viewer.json'),true);
session_name('GHPMASignon');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','httponly'=>true,'samesite'=>'Strict']);
session_start(); session_regenerate_id(true);
$_SESSION['PMA_single_signon_user']=$viewer['username'];
$_SESSION['PMA_single_signon_password']=$viewer['password'];
$_SESSION['PMA_single_signon_host']='127.0.0.1';
$_SESSION['PMA_single_signon_port']='3307';
session_write_close();
header('Location: /index.php?route=%2Fdatabase%2Fstructure&db=garasi_hobby_servis',true,303);
'''
    (PRIVATE/'signin.php').write_text(gate,encoding='utf-8')
    router=r'''<?php
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
// Apply the local privacy policy after phpMyAdmin builds its own headers.
header_register_callback(static function () {
    header('Referrer-Policy: no-referrer');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
});
if (!in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true) || !in_array($_SERVER['HTTP_HOST']??'', ['127.0.0.1:8081','localhost:8081'],true)) {
    http_response_code(403);exit;
}
if (isset($_SERVER['HTTP_ORIGIN']) && !in_array($_SERVER['HTTP_ORIGIN'], ['http://127.0.0.1:8081','http://localhost:8081'],true)) {
    http_response_code(403);exit;
}
$path=rawurldecode(explode('?',$_SERVER['REQUEST_URI']??'/',2)[0]);
if ($path==='/signin') {require __DIR__.'/signin.php';exit;}
// Block Windows path aliases (including NTFS alternate data streams) before
// the built-in server resolves a filename or chooses a PHP/static handler.
if (!str_starts_with($path,'/') || str_starts_with($path,'//') || str_contains($path, '\\') || str_contains($path, ':') || str_contains($path, '%') || preg_match('~[\x00-\x1f\x7f]|(^|/)\.|^/(setup|examples|libraries|vendor|templates|test|tests)(/|$)|^/config\.inc\.php~i',$path)) {
    http_response_code(404);exit;
}
return false;
'''
    (PRIVATE/'router.php').write_text(router,encoding='utf-8')
    print('Prepared local phpMyAdmin with patched PHP, verified MySQL TLS identity, and a dedicated read-only account.')


def start():
    prepare()
    try:
        with urllib.request.urlopen(URL+'/favicon.ico',timeout=3):
            print('Local phpMyAdmin is already responding.');return
    except urllib.error.HTTPError:
        return
    except (urllib.error.URLError,TimeoutError):pass
    args=['-c',str(PRIVATE/'php.ini'),'-S','127.0.0.1:8081','-t',str(PMA),str(PRIVATE/'router.php')]
    argstring=' '.join('"'+x+'"' for x in args)
    command='$p=Start-Process -FilePath '+db.quote_ps(PHP)+' -ArgumentList '+db.quote_ps(argstring)+' -WindowStyle Hidden -RedirectStandardError '+db.quote_ps(PRIVATE/'http-error.log')+' -RedirectStandardOutput '+db.quote_ps(PRIVATE/'http-output.log')+' -PassThru; Write-Output $p.Id'
    (PRIVATE/'server.pid').write_text(db.ps(command))
    for _ in range(40):
        try:
            urllib.request.urlopen(URL+'/favicon.ico',timeout=3).close();return
        except urllib.error.HTTPError:return
        except (urllib.error.URLError,TimeoutError):time.sleep(.25)
    raise RuntimeError('phpMyAdmin did not start; inspect private logs')


def launch_url():
    token=secrets.token_urlsafe(32)
    (PRIVATE/'launch.json').write_text(json.dumps({'hash':hashlib.sha256(token.encode()).hexdigest(),'expires':int(time.time())+120}))
    return URL+'/signin?token='+token


def verify():
    jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    with client.open(launch_url(),timeout=30) as response:
        page=response.read().decode('utf-8')
    (PRIVATE/'verified-page.html').write_text(page,encoding='utf-8')
    if 'garasi_hobby_servis' not in page or 'pelanggan' not in page or 'nota_servis' not in page or 'mysqli::real_connect()' in page:
        raise RuntimeError('Database structure page not confirmed; inspect private HTML/PHP logs')
    with client.open(URL+'/index.php?route=%2Fdatabase%2Fstructure&db=garasi_hobby_showroom',timeout=30) as response:
        showroom=response.read().decode('utf-8')
    if 'pembeli' not in showroom or 'penjualan' not in showroom or 'motor' not in showroom:
        raise RuntimeError('Showroom database structure page not confirmed')
    # Reject DNS rebinding / cross-origin host requests before processing phpMyAdmin.
    for headers in [{'Host':'untrusted.example'},{'Origin':'http://untrusted.example'}]:
        try:
            urllib.request.urlopen(urllib.request.Request(URL+'/index.php',headers=headers),timeout=3)
            raise RuntimeError('Local web boundary check failed')
        except urllib.error.HTTPError as e:
            if e.code!=403:raise
    print('phpMyAdmin verified: Servis (7) and Showroom (5) tables visible; untrusted Host/Origin rejected.')


def open_browser():
    start()
    link=launch_url()
    (PRIVATE/'open-url.txt').write_text(link)
    # URL is one-time and expires; no SQL password is put in a browser argument.
    db.ps('Start-Process '+db.quote_ps(link))
    print('Requested browser opening for authenticated local read-only database view.')


if __name__=='__main__':
    command=argparse.ArgumentParser(description=__doc__)
    command.add_argument('action',choices=['prepare','start','verify','open'])
    action=command.parse_args().action
    try:
        {'prepare':prepare,'start':start,'verify':verify,'open':open_browser}[action]()
    except Exception as error:
        print('ERROR:',str(error),file=sys.stderr);sys.exit(1)
