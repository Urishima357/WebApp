"""Additional bounded security checks: local admin UI, files and recovery.

Run after security_audit.py, while the local MySQL/phpMyAdmin servers are running.
Never prints credentials or launches a browser. Only this run's scratch schemas
and canary files are removed. No existing user session is reused or logged out.
"""
import hashlib
import argparse
import http.client
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.request
import zipfile

from security_audit import Audit, NoRedirect, REPORT_DIR, literal
import manage as db
import phpmyadmin as pma
import erd_databases as erd
import install_runtime as installer


class Surfaces(Audit):
    def request(self,path='/',headers=None,method='GET',body=None,client=None):
        request=urllib.request.Request(pma.URL+path,headers=headers or {},method=method,data=body)
        opener=client or urllib.request.build_opener(NoRedirect)
        try:response=opener.open(request,timeout=15)
        except urllib.error.HTTPError as error:response=error
        with response:return response.status,response.headers,response.read().decode('utf-8',errors='replace')

    def files(self):
        paths=[db.PRIVATE/'secrets.json',db.PRIVATE/'my.ini',db.DATA/'ca-key.pem',db.DATA/'server-key.pem',pma.PRIVATE/'viewer.json',pma.PRIVATE/'config.php',pma.PRIVATE/'sessions',db.ROOT/'apps/api/.env.database.local',self.private]
        paths += list(db.PRIVATE.glob('client-*.cnf'))
        paths += list((db.PRIVATE/'backups').glob('*.sql'))
        # Return only aggregate ACL verdicts, never file contents or personal SIDs.
        for path in paths:
            command="$a=Get-Acl -LiteralPath "+db.quote_ps(path)+"; @($a.Access | ForEach-Object { [pscustomobject]@{sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; type=$_.AccessControlType.ToString()} }) | ConvertTo-Json -Compress"
            values=json.loads(db.ps(command));values=values if isinstance(values,list) else [values]
            broad=[x for x in values if x['sid'] in ('S-1-1-0','S-1-5-11','S-1-5-32-545') and x['type']=='Allow']
            self.check('filesystem','No broad user ACL: '+path.relative_to(db.ROOT).as_posix(),not broad)
        git=['git','-c','safe.directory='+db.ROOT.as_posix(),'-C',str(db.ROOT)]
        tracked=db.run(git+['ls-files','-z'])
        if tracked.returncode:raise RuntimeError('Cannot inspect repository tracked paths')
        tracked_paths=tracked.stdout.decode().split('\0')
        self.check('secret-hygiene','Private runtime/credentials are not tracked',not any(p.startswith(('.local/','.tools/')) or p.endswith('.env.database.local') for p in tracked_paths))
        samples=['.local/mysql/secrets.json','.local/phpmyadmin/viewer.json','.tools/php-8.3.36-1/php.exe','apps/api/.env.database.local']
        for path in samples:
            self.check('secret-hygiene','Git ignores '+path,db.run(git+['check-ignore','--quiet',path]).returncode==0)
        exposed=[];scanned=0
        excluded={'.local','.tools','.git','node_modules','dist','__pycache__'}
        needles=[value.encode() for value in self.passwords.values()]
        for root,dirs,files in os.walk(db.ROOT):
            dirs[:]=[d for d in dirs if d not in excluded]
            for name in files:
                path=Path(root)/name
                if path.name.startswith('.env') and path.name!='.env.example':continue
                if path.stat().st_size>8_000_000:continue
                content=path.read_bytes();scanned+=1
                if any(value in content for value in needles):exposed.append(path.relative_to(db.ROOT).as_posix())
        self.check('secret-hygiene','Known generated SQL passwords absent from public project files',not exposed,f'{scanned} files scanned; matching paths: {exposed}')
        self.check('secret-hygiene','Credential storage is outside PHP document root',not (db.ROOT/'.local').resolve().is_relative_to(pma.PMA.resolve()))
        for role in ('admin','app','backup','migrate'):
            self.check('tls','Managed '+role+' helper uses VERIFY_IDENTITY','ssl-mode=VERIFY_IDENTITY' in (db.PRIVATE/f'client-{role}.cnf').read_text())
            self.check('tls','Managed '+role+' helper TLS connection works',db.sql('SELECT 1;',role).returncode==0)

    def packages(self):
        archives=[('MySQL',installer.DOWNLOADS/installer.ARCHIVE,installer.SHA256,db.BIN.parent),('PHP',installer.DOWNLOADS/'php-8.3.36-1-nts-Win32-vs16-x64.zip','1a097d52b7a68622cdc723073b61cc70caf79c941218ff65b2d8441dbc6b10d4',pma.PHP.parent),('phpMyAdmin',installer.DOWNLOADS/'phpMyAdmin-5.2.3-all-languages.zip','2d2e13c735366d318425c78e4ee2cc8fc648d77faba3ddea2cd516e43885733f',pma.PMA)]
        for label,path,expected,root in archives:
            with path.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
            self.check('supply-chain',label+' archive SHA-256 matches pinned official package',digest==expected)
            count=0;mismatches=[]
            with zipfile.ZipFile(path) as archive:
                for entry in archive.infolist():
                    if entry.is_dir():continue
                    parts=Path(entry.filename).parts
                    relative=Path(*parts[1:]) if label in ('MySQL','phpMyAdmin') else Path(*parts)
                    # Verify installed executable/library/source content, not mutable config.
                    if relative.suffix.lower() not in ('.exe','.dll','.php','.js','.css'):continue
                    target=root/relative
                    if not target.resolve().is_relative_to(root.resolve()):raise RuntimeError('Unsafe archive path')
                    count+=1
                    if not target.is_file() or hashlib.sha256(target.read_bytes()).digest()!=hashlib.sha256(archive.read(entry)).digest():mismatches.append(relative.as_posix())
            self.check('supply-chain',label+' installed code matches verified archive',not mismatches,f'{count} code/binary files checked; mismatches: {mismatches[:8]}')
        gpg=Path('C:/Program Files/Git/usr/bin/gpg.exe')
        def msys(path):
            value=path.resolve().as_posix();return '/'+value[0].lower()+value[2:]
        result=db.run([gpg,'--homedir',msys(db.ROOT/'.tools/gnupg'),'--batch','--status-fd','1','--verify',msys(installer.DOWNLOADS/'mysql.zip.asc'),msys(installer.DOWNLOADS/installer.ARCHIVE)])
        self.check('supply-chain','MySQL archive Oracle GPG signature and pinned signer',result.returncode==0 and ('[GNUPG:] VALIDSIG '+installer.FINGERPRINT+' ').encode() in result.stdout)
        version=db.run([pma.PHP,'-c',pma.PRIVATE/'php.ini','-r','echo PHP_VERSION;']).stdout.decode()
        self.check('supply-chain','PHP runtime pinned version',version=='8.3.36')
        flags=db.run([pma.PHP,'-c',pma.PRIVATE/'php.ini','-r',"echo json_encode([ini_get('session.use_strict_mode'),ini_get('session.upload_progress.enabled'),ini_get('allow_url_include'),ini_get('display_errors'),ini_get('mysqli.allow_local_infile')]);"])
        self.check('php-hardening','Session strict mode on; upload progress, URL include, display errors and local infile off',json.loads(flags.stdout)==['1','0','','','0'])

    def web(self):
        # No traffic is sent to the domains below; only local Host/Origin headers.
        for host in ('untrusted.example','127.0.0.1:8081.untrusted.example','localhost','localhost:8081@untrusted.example','127.0.0.1:8081,untrusted.example'):
            status,_,_=self.request('/index.php',{'Host':host})
            self.check('http-boundary','Reject untrusted Host '+host,status==403)
        for origin in ('http://untrusted.example','null','http://127.0.0.1:8082','https://127.0.0.1:8081'):
            for method in ('GET','POST','OPTIONS'):
                status,_,_=self.request('/index.php',{'Origin':origin},method,b'' if method=='POST' else None)
                self.check('http-boundary',method+' rejects Origin '+origin,status==403)
        paths=['/config.inc.php','/config.inc.php/extra','/CONFIG.INC.PHP','/setup/','/vendor/autoload.php','/libraries/classes/Config.php','/templates/base.twig','/.env','/.git/config','/%2eenv','/%2e%2e/.local/mysql/secrets.json','/../.local/mysql/secrets.json','/..%5c.local%5cmysql%5csecrets.json','/%252e%252e/.local/mysql/secrets.json']
        paths+=['/config.inc.php.','/config.inc.php%20','/config.inc.php::$DATA','/config.inc.php%3a%3a%24DATA','//config.inc.php','/%2fconfig.inc.php','/config.inc.php;extra']
        for path in paths:
            status,headers,body=self.request(path)
            self.check('http-boundary','Block protected/path traversal '+path,status in (400,403,404) and '<?php' not in body)
        status,headers,body=self.request('/index.php?route=%2Fdatabase%2Fstructure&db=garasi_hobby_servis')
        self.check('http-auth','Unauthenticated database request redirects to signon',status in (302,303) and headers.get('Location','').startswith('/signin'))
        for query in ('','?token=invalid','?token=0','?token[]=invalid','?token=%00','?token='+('a'*2048)):
            status,headers,body=self.request('/signin'+query)
            self.check('http-auth','Reject invalid launch token variant '+str(len(query)),status==403 and 'password' not in body.lower() and 'Fatal error' not in body)
        launch=pma.PRIVATE/'launch.json'
        if launch.exists() and json.loads(launch.read_text()).get('expires',0)>=time.time():
            self.check('http-auth','One-time token/session tests deferred for existing pending user link',False,status='SKIP');return
        token=secrets.token_urlsafe(32)
        launch.write_text(json.dumps({'hash':hashlib.sha256(token.encode()).hexdigest(),'expires':int(time.time())-1}))
        self.check('http-auth','Expired launch token rejected',self.request('/signin?token='+token)[0]==403)
        launch.unlink(missing_ok=True)
        jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        url=pma.launch_url()
        # Check session fixation without borrowing the user's browser cookies.
        initial=urllib.request.build_opener(NoRedirect,urllib.request.HTTPCookieProcessor(jar))
        status,first_headers,_=self.request(url.removeprefix(pma.URL),{'Cookie':'GHPMASignon=attackercontrolledsessionid'},client=initial)
        self.check('http-auth','Successful signon returns local 303 redirect',status==303 and first_headers.get('Location','').startswith('/index.php'))
        with client.open(pma.URL+first_headers['Location'],timeout=20) as response:page=response.read().decode();headers=response.headers
        self.check('http-auth','Fresh one-time signon displays actual service tables','nota_servis' in page and 'pelanggan' in page and 'mysqli::real_connect' not in page)
        signon=next((c for c in jar if c.name=='GHPMASignon'),None)
        self.check('http-auth','Session ID regenerated after signon',signon is not None and signon.value!='attackercontrolledsessionid')
        self.check('http-auth','Session cookie is HttpOnly and SameSite Strict',signon is not None and 'HttpOnly' in signon._rest and signon._rest.get('SameSite')=='Strict')
        self.check('http-auth','Launch token cannot be replayed',self.request(url.removeprefix(pma.URL))[0]==403)
        for name,want in [('X-Content-Type-Options','nosniff'),('Referrer-Policy','no-referrer'),('Cache-Control','no-store')]:
            self.check('http-headers',name,want in headers.get(name,''),headers.get(name,''))
        self.check('http-headers','Frame embedding restricted',headers.get('X-Frame-Options','').lower() in ('deny','sameorigin') or 'frame-ancestors' in headers.get('Content-Security-Policy',''))
        for database,required in [('garasi_hobby_showroom',('pembeli','penjualan','motor')),('garasi_hobby_servis',('pelanggan','nota_servis','kendaraan'))]:
            status,_,body=self.request('/index.php?route=%2Fdatabase%2Fstructure&db='+database,client=client)
            self.check('http-auth','Authorized read-only structure '+database,status==200 and all(x in body for x in required))
        # A harmless SELECT exercises phpMyAdmin's CSRF rejection, no data write.
        body=urllib.parse.urlencode({'db':'garasi_hobby_servis','sql_query':'SELECT 1','token':'invalid-csrf-token','ajax_request':'1'}).encode()
        status,_,page=self.request('/index.php?route=%2Fimport',{'Origin':pma.URL,'Content-Type':'application/x-www-form-urlencoded'},'POST',body,client)
        self.check('http-csrf','Invalid CSRF token rejected before SELECT',status in (200,400,403) and any(s in page.lower() for s in ('token mismatch','incorrect csrf','token tidak','mismatch')))

    def recovery(self):
        for source in db.DATABASES:
            path=db.backup(source);content=path.read_bytes()
            self.check('backup','Backup SHA-256 sidecar '+source,hashlib.sha256(content).hexdigest()==path.with_suffix('.sql.sha256').read_text().strip())
            name='sec_'+self.run_id+'_restore_'+('servis' if source.endswith('servis') else 'showroom')
            self.query(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');self.schemas.append(name)
            result=self.sql(content.decode('utf-8'),database=name)
            self.check('recovery','Restore real backup '+source+' into disposable target',result.returncode==0)
            actual=self.query('SHOW TABLES;',database=name).splitlines()
            self.check('recovery','Restored table set '+source,set(actual)==set(self.models[source]))
            for table in actual:
                pk=next(f['name'] for f in self.models[source][table]['fields'] if f['key']=='PK')
                rows=self.sql(f'SELECT * FROM `{table}` ORDER BY `{pk}`;',database=name).stdout
                ddl=self.query(f'SHOW CREATE TABLE `{table}`;',database=name)
                original=self.original[source][table]
                self.check('recovery','Identical restored data and DDL '+source+'.'+table,hashlib.sha256(rows).hexdigest()==original['data_sha256'] and hashlib.sha256(ddl.encode()).hexdigest()==original['ddl_sha256'])
        # Active tables are empty at audit time. Also prove recovery of non-empty
        # data using complete service/showroom fixtures, never active row writes.
        for source in db.DATABASES:
            kind='servis' if source.endswith('servis') else 'showroom';name=self.clone('fixture_'+kind,source);self.seed(name,kind)
            target='sec_'+self.run_id+'_recovered_'+kind
            self.query(f'CREATE DATABASE `{target}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;');self.schemas.append(target)
            result=db.run([db.BIN/'mysqldump.exe','--defaults-extra-file='+str(self.options['backup']),'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-triggers','--hex-blob',name])
            self.check('recovery','Readonly backup user exports populated '+kind+' fixture',result.returncode==0)
            self.query(result.stdout.decode('utf-8'),database=target)
            for table in self.models[source]:
                pk=next(f['name'] for f in self.models[source][table]['fields'] if f['key']=='PK')
                sql=f'SELECT * FROM `{table}` ORDER BY `{pk}`;'
                self.check('recovery','Nonempty fixture round-trip '+kind+'.'+table,self.query(f'SELECT COUNT(*) FROM `{table}`;',database=target)=='2' and self.sql(sql,database=name).stdout==self.sql(sql,database=target).stdout)
            # FILE privilege and secure_file_priv both prevent exporting server files.
            for role in ('app','viewer','backup','migrate'):
                destination=(self.private/(kind+'-'+role+'-forbidden.txt')).as_posix()
                self.denied('file-privileges',role+' cannot SELECT INTO OUTFILE '+kind,"SELECT 'harmless canary' INTO OUTFILE '"+destination.replace("'","''")+"';",role,name,codes=(1290,1227,1045))
            canary=self.private/'load-file-canary.txt';canary.write_text('nonsecret audit marker')
            for role in ('app','viewer','backup','migrate'):
                self.check('file-privileges',role+' cannot LOAD_FILE '+kind,self.query('SELECT LOAD_FILE('+literal(canary.as_posix())+') IS NULL;',role,name)=='1')
        self.check('backup','Backups are local plaintext: off-device encrypted recovery not configured',False,status='WARN')
        self.finding('DBSEC-05','MEDIUM','Backup recovery works, but backups share the local disk and are not encrypted.','SQL backups restored and compared successfully; ACL protection does not protect against disk theft or disk failure.','Before real customer data: encrypt backups, keep a separate off-device copy, define retention/scheduling and repeat restore drills. Store encryption keys separately.')

    def boundaries(self):
        for source in db.DATABASES:
            kind='servis' if source.endswith('servis') else 'showroom';name=self.clone('minimum_'+kind,source);self.seed(name,kind)
            if kind=='servis':
                sql="START TRANSACTION; INSERT INTO nota_servis VALUES(50,1,1,1,'WO-MINIMUM',NOW(),0,'Minimum probe',0,0,0); SELECT (SELECT COUNT(*) FROM detail_servis WHERE id_nota=50),(SELECT COUNT(*) FROM pembayaran WHERE id_nota=50); ROLLBACK;"
                expected='0\t0'
            else:
                sql="START TRANSACTION; DELETE FROM pembayaran WHERE id_penjualan=1; SELECT COUNT(*) FROM pembayaran WHERE id_penjualan=1; ROLLBACK;";expected='0'
            accepted=self.query(sql,'app',name)==expected
            self.check('business-boundary','Minimum child/payment participation is not enforced: '+kind,not accepted,'Observed then rolled back on disposable data.',status='WARN' if accepted else 'PASS')
        self.finding('DBSEC-08','MEDIUM','Foreign keys do not enforce mandatory child/payment presence.', 'A service note with no details or payment and a sale with its payment deleted were accepted on test clones.','Enforce creation/deletion through backend transactions and authorization; approve any further SQL enforcement before modifying the ERD implementation.')

    def network(self):
        import socket
        for port in (3307,8081):
            with socket.create_connection(('127.0.0.1',port),timeout=3):pass
            self.check('network','Expected local listener responds on '+str(port),True)
        result=db.run(['netstat.exe','-ano','-p','tcp'],text=True)
        lines=[line.split() for line in result.stdout.splitlines() if 'LISTENING' in line and any(':'+str(port)+' ' in line for port in (3307,8081,33060))]
        if lines:
            self.check('network','OS listener inventory confirms local-only MySQL/phpMyAdmin and no X port',all(x[1] in ('127.0.0.1:3307','127.0.0.1:8081') for x in lines) and len(lines)==2)
        else:self.check('network','OS-wide listener inventory unavailable in execution sandbox',False,'SQL bind_address and local HTTP behavior verified; no independent remote host connectivity test.',status='SKIP')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sections',nargs='+',choices=('files','packages','web','recovery','boundaries','network'),default=['files','packages','web','recovery','boundaries','network'])
    parser.add_argument('--retest',action='store_true')
    args=parser.parse_args()
    audit=Surfaces()
    try:
        for name in args.sections:
            print('Running',name,flush=True);getattr(audit,name)()
    except Exception as error:
        audit.check('execution','Requested audit sections completed',False,type(error).__name__)
        raise
    finally:
        audit.cleanup()
        audit.check('preservation','Active ERD tables and row contents unchanged',audit.snapshot()==audit.original)
        audit.check('preservation','draw.io unchanged',hashlib.sha256(erd.SOURCE.read_bytes()).hexdigest()==audit.source_hash)
        report={'date':time.strftime('%Y-%m-%d',time.gmtime()),'run_id':audit.run_id,'sections':args.sections,'duration_seconds':round(time.monotonic()-audit.started,2),'summary':{s:sum(x['status']==s for x in audit.cases) for s in ('PASS','FAIL','WARN','SKIP')},'findings':audit.findings[2:],'cases':audit.cases}
        filename='security-surfaces-retest.json' if args.retest else 'security-surfaces.json'
        (REPORT_DIR/filename).write_text(json.dumps(report,indent=2),encoding='utf-8')
        audit.cleanup_credentials()
        print('Extended audit summary:',report['summary'],flush=True)
    return int(any(x['status']=='FAIL' for x in audit.cases))


if __name__=='__main__':sys.exit(main())
