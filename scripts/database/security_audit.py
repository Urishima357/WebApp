"""Bounded local security audit of the two ERD databases and phpMyAdmin.

Writes use isolated schemas/accounts. No scanning outside this machine, no active
business-row writes, no schema expansion, no passwords in results/arguments.
"""
import concurrent.futures
import hashlib
import http.client
import http.cookiejar
import json
import os
from pathlib import Path
import re
import secrets
import socket
import string
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

import manage as db
import erd_databases as erd
import phpmyadmin as pma

REPORT_DIR=db.ROOT/'docs/database'
PRIVATE=db.ROOT/'.local/security-audit'
ACCOUNTS={'admin':'root','app':'gh_app','backup':'gh_backup','migrate':'gh_migrate','viewer':'gh_viewer'}
REPAIRS=[
    {'id':'DBSEC-01','severity':'MEDIUM','before':'Application, backup and migration accounts retained privileges on the obsolete PRD database.','repair':'Removed legacy schema/table/column grants and scoped service accounts to the two ERD databases.','status':'FIXED'},
    {'id':'DBSEC-02','severity':'MEDIUM','before':'phpMyAdmin viewer had no failed-login lock policy.','repair':'Configured five failed attempts, one-day account lock, TLS and five concurrent connections; persisted in setup code.','status':'FIXED'},
]


def literal(value):
    return "CONVERT(0x"+str(value).encode('utf-8').hex()+" USING utf8mb4)"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None


class Audit:
    def __init__(self):
        self.run_id=''.join(secrets.choice(string.ascii_lowercase) for _ in range(8))
        self.private=PRIVATE/self.run_id;self.private.mkdir(parents=True)
        db.restrict(PRIVATE,True)
        self.cases=[];self.findings=list(REPAIRS);self.schemas=[];self.temporary_users=[];self.temp_grants=[]
        self.started=time.monotonic();self.models=erd.read_models()
        self.passwords=json.loads((db.PRIVATE/'secrets.json').read_text())
        self.passwords['viewer']=json.loads((pma.PRIVATE/'viewer.json').read_text())['password']
        self.options={role:self.option_file(role,ACCOUNTS[role],password) for role,password in self.passwords.items()}
        self.original=self.snapshot()
        self.source_hash=hashlib.sha256(erd.SOURCE.read_bytes()).hexdigest()

    def option_file(self,name,user,password):
        path=self.private/(name+'.cnf')
        path.write_text(f'[client]\nuser={user}\npassword={password}\nhost=127.0.0.1\nport=3307\nprotocol=TCP\nssl-mode=VERIFY_IDENTITY\nssl-ca="{(db.DATA/"ca.pem").as_posix()}"\ndefault-character-set=utf8mb4\n',encoding='utf-8')
        return path

    def sql(self,statement,role='admin',database=None,extra=(),option=None,timeout=20):
        args=[str(db.BIN/'mysql.exe'),'--defaults-extra-file='+str(option or self.options[role]),'--connect-timeout=5','--batch','--raw','--skip-column-names',*extra]
        if database:
            if not re.fullmatch('[a-z_]+',database):raise ValueError('Unsafe schema')
            args.append(database)
        return subprocess.run(args,input=statement.encode('utf-8'),capture_output=True,timeout=timeout)

    def query(self,statement,role='admin',database=None,**kwargs):
        result=self.sql(statement,role,database,**kwargs)
        if result.returncode:
            raise RuntimeError(self.redact(result.stderr.decode(errors='replace'))[:700])
        return result.stdout.decode('utf-8').strip().replace('\r','')

    def redact(self,value):
        for password in self.passwords.values():value=value.replace(password,'[REDACTED]')
        return value

    def check(self,category,label,condition,detail='',status=None):
        outcome=status or ('PASS' if condition else 'FAIL')
        case={'id':f'AUD-{len(self.cases)+1:04d}','category':category,'case':label,'status':outcome}
        if detail:case['detail']=self.redact(str(detail))[:800]
        self.cases.append(case)
        if outcome=='FAIL':print('FAIL:',category,label,flush=True)
        return outcome=='PASS'

    def denied(self,category,label,statement,role,database=None,codes=(),**kwargs):
        result=self.sql(statement,role,database,**kwargs)
        code=re.search(rb'ERROR (\d+)',result.stderr)
        number=int(code[1]) if code else None
        return self.check(category,label,result.returncode!=0 and (not codes or number in codes),f'MySQL error {number}')

    def finding(self,identifier,severity,summary,evidence,remediation):
        self.findings.append({'id':identifier,'severity':severity,'summary':summary,'evidence':evidence,'remediation':remediation,'status':'OPEN'})

    def snapshot(self):
        result={}
        for database,tables in self.models.items():
            result[database]={}
            actual=self.query('SHOW TABLES;',database=database).splitlines()
            for name in actual:
                if not re.fullmatch('[a-z_]+',name):raise ValueError('Unexpected active table')
                pk=self.query(f"SELECT COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema='{database}' AND table_name='{name}' AND constraint_name='PRIMARY' ORDER BY ORDINAL_POSITION;").splitlines()
                order=','.join('`'+col+'`' for col in pk)
                content=self.sql(f'SELECT * FROM `{name}` ORDER BY {order};',database=database).stdout
                ddl=self.query(f'SHOW CREATE TABLE `{name}`;',database=database)
                result[database][name]={'data_sha256':hashlib.sha256(content).hexdigest(),'ddl_sha256':hashlib.sha256(ddl.encode()).hexdigest(),'rows':int(self.query(f'SELECT COUNT(*) FROM `{name}`;',database=database))}
        return result

    def clone(self,suffix,source):
        name='sec_'+self.run_id+'_'+suffix
        if self.query(f"SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='{name}';")!='0':raise RuntimeError('Audit schema already exists')
        self.query(f'CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
        self.schemas.append(name)
        ddl=(erd.OUTPUT/(source+'.sql')).read_text(encoding='utf-8')
        self.query(ddl.replace('`'+source+'`','`'+name+'`'))
        for role,rights in [('app','SELECT,INSERT,UPDATE,DELETE'),('backup','SELECT,SHOW VIEW'),('viewer','SELECT,SHOW VIEW'),('migrate','ALL PRIVILEGES')]:
            user=ACCOUNTS[role]
            self.query(f"GRANT {rights} ON `{name}`.* TO '{user}'@'127.0.0.1';")
            self.temp_grants.append((name,user))
        return name

    def seed(self,name,kind):
        if kind=='servis':
            for n in (1,2):
                self.query(f"INSERT INTO pelanggan VALUES({n},'Fixture {n}','Contact {n}'); INSERT INTO pegawai VALUES({n},'Employee {n}','Kasir'); INSERT INTO mekanik VALUES({n},'Mechanic {n}'); INSERT INTO kendaraan VALUES({n},{n},'TEST {n}','Test','Test',2020,'Black'); INSERT INTO nota_servis VALUES({n},{n},{n},{n},'WO-{n}',NOW(),100,'Fixture',100,0,100); INSERT INTO detail_servis VALUES({n},{n},'Jasa','Fixture',1,100,0,100); INSERT INTO pembayaran VALUES({n},{n},'Tunai',100,0,NOW());",database=name)
        else:
            for n in (1,2):
                self.query(f"INSERT INTO pembeli VALUES({n},'Fixture {n}','Contact {n}','Address'); INSERT INTO pegawai VALUES({n},'Employee {n}','Kasir'); INSERT INTO motor VALUES({n},'INV-{n}','TEST {n}','Test','Test',2020,'Black','FRAME-{n}','ENGINE-{n}',100,'Tersedia'); INSERT INTO penjualan VALUES({n},{n},{n},{n},NOW(),100,0,'None',100,'Terjual'); INSERT INTO pembayaran VALUES({n},{n},{n},'Transfer',100,'REF-{n}',NOW());",database=name)

    def server(self):
        flags=[('Loopback only','SELECT @@bind_address;','127.0.0.1'),('TLS mandatory','SELECT @@require_secure_transport;','1'),('LOCAL INFILE disabled','SELECT @@local_infile;','0'),('Server file export/import disabled',"SELECT IF(@@secure_file_priv IS NULL,'NULL',@@secure_file_priv);",'NULL'),('Name resolution disabled','SELECT @@skip_name_resolve;','1'),('UTC server timezone','SELECT @@global.time_zone;','+00:00'),('InnoDB default','SELECT @@default_storage_engine;','InnoDB'),('No anonymous SQL user',"SELECT COUNT(*) FROM mysql.user WHERE User='';",'0'),('No wildcard/remote SQL accounts',"SELECT COUNT(*) FROM mysql.user WHERE Host NOT IN ('127.0.0.1','localhost');",'0'),('System SQL users locked',"SELECT COUNT(*) FROM mysql.user WHERE User LIKE 'mysql.%' AND account_locked<>'Y';",'0'),('No empty auth hash for interactive users',"SELECT COUNT(*) FROM mysql.user WHERE User NOT LIKE 'mysql.%' AND authentication_string='';",'0'),('X Plugin inactive',"SELECT COUNT(*) FROM information_schema.plugins WHERE PLUGIN_NAME='mysqlx' AND PLUGIN_STATUS='ACTIVE';",'0')]
        for label,statement,want in flags:self.check('server',label,self.query(statement)==want)
        mode=self.query('SELECT @@sql_mode;').split(',')
        for flag in ('STRICT_TRANS_TABLES','NO_ZERO_DATE','NO_ZERO_IN_DATE','ERROR_FOR_DIVISION_BY_ZERO','NO_ENGINE_SUBSTITUTION'):
            self.check('server','SQL mode '+flag,flag in mode)
        self.check('server','TLS 1.2/1.3 allowed only',set(self.query('SELECT @@tls_version;').split(','))=={'TLSv1.2','TLSv1.3'})

    def accounts(self):
        expected=set(db.DATABASES)
        for role,user in ACCOUNTS.items():
            if role=='admin':continue
            grantee=f"\"'{user}'@'127.0.0.1'\""
            scope=set(self.query(f"SELECT TABLE_SCHEMA FROM information_schema.schema_privileges WHERE GRANTEE={grantee} UNION SELECT TABLE_SCHEMA FROM information_schema.table_privileges WHERE GRANTEE={grantee} UNION SELECT TABLE_SCHEMA FROM information_schema.column_privileges WHERE GRANTEE={grantee};").splitlines())
            self.check('accounts',role+' database scope is exactly the two ERD databases',scope==expected)
            self.check('accounts',role+' has no global admin privilege',self.query(f"SELECT COUNT(*) FROM information_schema.user_privileges WHERE GRANTEE={grantee} AND PRIVILEGE_TYPE<>'USAGE';")=='0')
            grants=self.query(f"SHOW GRANTS FOR '{user}'@'127.0.0.1';")
            self.check('accounts',role+' cannot delegate grants','WITH GRANT OPTION' not in grants)
            info=self.query(f"SELECT plugin,ssl_type,max_user_connections,COALESCE(JSON_EXTRACT(User_attributes,'$.Password_locking.failed_login_attempts'),0) FROM mysql.user WHERE User='{user}' AND Host='127.0.0.1';").split('\t')
            self.check('accounts',role+' uses caching_sha2_password',info[0]=='caching_sha2_password')
            self.check('accounts',role+' requires encrypted transport',info[1]=='ANY')
            self.check('accounts',role+' connection limit',int(info[2])==(5 if role=='viewer' else 10))
            self.check('accounts',role+' failed-login policy',int(info[3])==5)
            self.denied('privileges',role+' cannot read MySQL auth tables','SELECT authentication_string FROM mysql.user;',role,codes=(1142,))
            self.denied('privileges',role+' cannot access archived PRD data','SELECT COUNT(*) FROM garasi_hobby.users;',role,codes=(1142,1044))
            for database,tables in self.models.items():
                self.check('privileges',role+' can read '+database,self.sql('SHOW TABLES;',role,database).returncode==0)
                if role in ('viewer','backup'):
                    for name in tables:
                        pk=next(f['name'] for f in tables[name]['fields'] if f['key']=='PK')
                        for verb,statement in [('UPDATE',f'UPDATE `{name}` SET `{pk}`=`{pk}` WHERE 1=0;'),('DELETE',f'DELETE FROM `{name}` WHERE 1=0;'),('INSERT',f'INSERT INTO `{name}` SELECT * FROM `{name}` WHERE 1=0;')]:
                            self.denied('privileges',f'{role} cannot {verb} {database}.{name}',statement,role,database,codes=(1142,))

    def tls(self):
        for role in ('admin','app','backup','migrate','viewer'):
            tls=self.query("SHOW SESSION STATUS LIKE 'Ssl_version';",role).split('\t')[-1]
            self.check('tls',role+' verifies certificate hostname and CA',tls in ('TLSv1.2','TLSv1.3'))
            # A rejected insecure connection is followed by a correct TLS login so failure counters do not accumulate.
            self.denied('tls',role+' rejects plaintext','SELECT 1;',role,codes=(1045,3159),extra=('--ssl-mode=DISABLED',))
            self.query('SELECT 1;',role)
        for version in ('TLSv1.2','TLSv1.3'):
            self.check('tls','Negotiation '+version,self.query("SHOW SESSION STATUS LIKE 'Ssl_version';",'app',extra=('--tls-version='+version,)).split('\t')[-1]==version)
        self.check('tls','localhost hostname verified',self.sql('SELECT 1;','app',extra=('--host=localhost',)).returncode==0)
        wrong=self.private/'wrong-ca.pem';key=self.private/'wrong-ca-key.pem';cfg=self.private/'wrong-ca.cnf'
        cfg.write_text('[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=Untrusted audit CA\n[ca]\nbasicConstraints=critical,CA:TRUE\n')
        pma.openssl('req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',cfg,'-keyout',key,'-out',wrong)
        result=self.sql('SELECT 1;','app',extra=('--ssl-ca='+str(wrong),))
        self.check('tls','Untrusted CA rejected',result.returncode!=0 and b'2026' in result.stderr)
        certificate=pma.openssl('verify','-CAfile',db.DATA/'ca.pem','-verify_ip','127.0.0.1',db.DATA/'server-cert.pem')
        self.check('tls','Server chain and loopback SAN valid',certificate.returncode==0)
        remaining=pma.openssl('x509','-in',db.DATA/'server-cert.pem','-noout','-checkend','2592000')
        self.check('tls','Certificate remains valid beyond 30 days',remaining.returncode==0)

    def schema(self,clones):
        for source,tables in self.models.items():
            kind='servis' if source.endswith('servis') else 'showroom'
            clone=self.clone(kind,source);clones[kind]=clone;self.seed(clone,kind)
            self.check('schema',source+' exact ERD schema',bool(erd.verify_database(source,erd.build()[source])))
            for name,table in tables.items():
                pk=next(f['name'] for f in table['fields'] if f['key']=='PK')
                # Insert an existing row: changing a referenced PK can be rejected
                # by RESTRICT before MySQL reaches the duplicate-key check.
                self.denied('constraints',kind+'.'+name+' duplicate primary key',f'INSERT INTO `{name}` SELECT * FROM `{name}` WHERE `{pk}`=1;','admin',clone,codes=(1062,))
                for col,(_,targetpk) in table['foreign_keys'].items():
                    self.denied('constraints',kind+'.'+name+'.'+col+' missing parent',f'UPDATE `{name}` SET `{col}`=2147483000 WHERE `{pk}`=2;','admin',clone,codes=(1452,))
                    self.denied('constraints',kind+'.'+name+'.'+col+' NULL parent',f'UPDATE `{name}` SET `{col}`=NULL WHERE `{pk}`=2;','admin',clone,codes=(1048,))
                for col in set(table['unique']):
                    self.denied('constraints',kind+'.'+name+'.'+col+' unique',f'UPDATE `{name}` a JOIN (SELECT `{col}` AS v FROM `{name}` WHERE `{pk}`=1) b SET a.`{col}`=b.v WHERE a.`{pk}`=2;','admin',clone,codes=(1062,))
                for field in table['fields']:
                    col=field['name'];typ=field['source_type']
                    if field['key'] in ('PK','FK'):continue
                    self.denied('input-bounds',kind+'.'+name+'.'+col+' NOT NULL',f'UPDATE `{name}` SET `{col}`=NULL WHERE `{pk}`=2;','admin',clone,codes=(1048,))
                    if typ=='string':
                        value="REPEAT('X',256)";errors=(1406,)
                    elif typ=='datetime':value="'2026-13-40 25:99:00'";errors=(1292,)
                    else:value='1e60';errors=(1264,)
                    self.denied('input-bounds',kind+'.'+name+'.'+col+' rejects type overflow',f'UPDATE `{name}` SET `{col}`={value} WHERE `{pk}`=2;','admin',clone,codes=errors)
                for role in ('app','backup','viewer'):
                    self.denied('ddl',role+' cannot ALTER '+kind+'.'+name,f'ALTER TABLE `{name}` ADD COLUMN audit_unauthorized INT;',role,clone,codes=(1142,))
            # All parent references must restrict deletion/update while children still exist.
            parents={(parent,key) for t in tables.values() for parent,key in t['foreign_keys'].values()}
            for parent,key in parents:
                self.denied('constraints',kind+'.'+parent+' parent delete restricted',f'DELETE FROM `{parent}` WHERE `{key}`=1;','admin',clone,codes=(1451,))
                self.denied('constraints',kind+'.'+parent+' parent key update restricted',f'UPDATE `{parent}` SET `{key}`=999 WHERE `{key}`=1;','admin',clone,codes=(1451,))

    def business_limits(self,clones):
        tests=[('servis','Negative service total accepted by ERD-only schema',"START TRANSACTION; UPDATE nota_servis SET total=-1 WHERE id_nota=1; SELECT total FROM nota_servis WHERE id_nota=1; ROLLBACK;",'-1.00'),('servis','Zero service quantity accepted',"START TRANSACTION; UPDATE detail_servis SET qty=0 WHERE id_detail=1; SELECT qty FROM detail_servis WHERE id_detail=1; ROLLBACK;",'0.00'),('showroom','Negative sale price accepted by ERD-only schema',"START TRANSACTION; UPDATE motor SET harga_jual=-1 WHERE id_motor=1; SELECT harga_jual FROM motor WHERE id_motor=1; ROLLBACK;",'-1.00'),('showroom','Sale total can differ from subtotal and discount',"START TRANSACTION; UPDATE penjualan SET total=999 WHERE id_penjualan=1; SELECT total FROM penjualan WHERE id_penjualan=1; ROLLBACK;",'999.00')]
        evidence=[]
        for kind,label,statement,expected in tests:
            accepted=self.query(statement,database=clones[kind])==expected
            self.check('business-boundary',label,False,'Observed in disposable schema; no constraint was added to the user ERD.',status='WARN' if accepted else 'PASS')
            if accepted:evidence.append(label)
        if evidence:self.finding('DBSEC-03','MEDIUM','ERD-only schema does not validate financial arithmetic/sign/quantity.',evidence,'Add approved column CHECKs and backend validation/transaction rules after business review; keep the 7+5 table model unchanged.')
        # Demonstrate a MySQL privilege boundary: DML credentials can disable their own FK checks.
        r=self.sql("START TRANSACTION; SET SESSION foreign_key_checks=0; UPDATE kendaraan SET id_pelanggan=999999 WHERE id_kendaraan=1; SELECT id_pelanggan FROM kendaraan WHERE id_kendaraan=1; ROLLBACK; SET SESSION foreign_key_checks=1;",'app',clones['servis'])
        bypass=r.returncode==0 and b'999999' in r.stdout
        self.check('business-boundary','Session FK bypass with compromised writer credentials',False,'This is a native MySQL session capability, not a remote authentication bypass.',status='WARN' if bypass else 'PASS')
        if bypass:self.finding('DBSEC-04','MEDIUM','A compromised application SQL credential can bypass session FK checks.', 'Confirmed on a clone with the actual runtime principal, then rolled back.','Keep SQL credentials in backend only; parameterize queries, forbid arbitrary SQL APIs, protect the OS and rotate credentials if exposed. Full mitigation requires a reviewed write API/stored-procedure privilege model.')

    def transactions(self,clones):
        for kind,name in clones.items():
            table='pelanggan' if kind=='servis' else 'pembeli';pk='id_'+table
            original=self.query(f'SELECT nama FROM `{table}` WHERE `{pk}`=1;',database=name)
            self.query(f"START TRANSACTION; UPDATE `{table}` SET nama='ROLLBACK-PROBE' WHERE `{pk}`=1; ROLLBACK;",'app',name)
            self.check('transactions',kind+' explicit rollback restores value',self.query(f'SELECT nama FROM `{table}` WHERE `{pk}`=1;',database=name)==original)
            failed=self.sql(f"START TRANSACTION; UPDATE `{table}` SET nama='MUST-ROLL-BACK' WHERE `{pk}`=1; INSERT INTO `{table}` SELECT * FROM `{table}` WHERE `{pk}`=1; COMMIT;",'app',name)
            self.check('transactions',kind+' disconnect after duplicate error rolls back',failed.returncode!=0 and self.query(f'SELECT nama FROM `{table}` WHERE `{pk}`=1;',database=name)==original)
            def lock(order):
                a,b=order
                return self.sql(f"SET SESSION innodb_lock_wait_timeout=3; START TRANSACTION; UPDATE `{table}` SET nama=CONCAT(nama,'X') WHERE `{pk}`={a}; DO SLEEP(0.3); UPDATE `{table}` SET nama=CONCAT(nama,'X') WHERE `{pk}`={b}; COMMIT;",'app',name)
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:outcomes=list(pool.map(lock,[(1,2),(2,1)]))
            self.check('concurrency',kind+' deadlock has one victim and one commit',sum(r.returncode==0 for r in outcomes)==1 and any(b'1213' in r.stderr for r in outcomes))
        svc=clones['servis'];shw=clones['showroom']
        self.query("INSERT INTO nota_servis VALUES(3,1,1,1,'WO-RACE',NOW(),100,'Race',100,0,100);",database=svc)
        def pay(n):return self.sql(f"INSERT INTO pembayaran VALUES({100+n},3,'Tunai',100,0,NOW());",'app',svc)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:outcomes=list(pool.map(pay,range(8)))
        self.check('concurrency','Eight service payments: one commit, seven duplicate rejections',sum(r.returncode==0 for r in outcomes)==1 and sum(b'1062' in r.stderr for r in outcomes)==7)
        self.query("INSERT INTO motor VALUES(3,'RACE','RACE','Test','Test',2020,'Black','RACEFRAME','RACEENGINE',100,'Tersedia');",database=shw)
        def sale(n):return self.sql(f"INSERT INTO penjualan VALUES({100+n},1,3,1,NOW(),100,0,'None',100,'Terjual');",'app',shw)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:outcomes=list(pool.map(sale,range(8)))
        self.check('concurrency','Eight motor sales: one commit, seven duplicate rejections',sum(r.returncode==0 for r in outcomes)==1 and sum(b'1062' in r.stderr for r in outcomes)==7)

    def auth(self):
        user='sec_auth_'+self.run_id;password=secrets.token_urlsafe(32);self.passwords['auth-probe']=password
        self.query(f"CREATE USER '{user}'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '{password}' REQUIRE SSL WITH MAX_USER_CONNECTIONS 2 FAILED_LOGIN_ATTEMPTS 3 PASSWORD_LOCK_TIME 1;")
        self.temporary_users.append(user)
        good=self.option_file('auth-correct',user,password);wrong=self.option_file('auth-wrong',user,secrets.token_urlsafe(32))
        self.check('authentication','Disposable auth account correct password works',self.sql('SELECT 1;',option=good).returncode==0)
        for n in range(3):self.check('authentication',f'Disposable bad password attempt {n+1} rejected',self.sql('SELECT 1;',option=wrong).returncode!=0)
        blocked=self.sql('SELECT 1;',option=good)
        self.check('authentication','Failed-login threshold blocks correct password until unlock',blocked.returncode!=0 and any(word in blocked.stderr.lower() for word in (b'blocked',b'locked')))
        self.query(f"ALTER USER '{user}'@'127.0.0.1' ACCOUNT UNLOCK;")
        self.check('authentication','Administrative unlock restores account',self.sql('SELECT 1;',option=good).returncode==0)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            held=[pool.submit(self.sql,'DO SLEEP(2);',option=good) for _ in range(2)]
            for _ in range(25):
                connections=int(self.query(f"SELECT COUNT(*) FROM information_schema.processlist WHERE USER='{user}';"))
                if connections==2:break
                time.sleep(.04)
            excess=self.sql('SELECT 1;',option=good)
            self.check('authentication','SQL connection cap enforced',excess.returncode!=0 and b'1226' in excess.stderr)
            for future in held:future.result()
        self.check('authentication','Connection capacity restored after clients close',self.sql('SELECT 1;',option=good).returncode==0)

    def cleanup(self):
        for schema,user in reversed(self.temp_grants):
            self.query(f"REVOKE ALL PRIVILEGES ON `{schema}`.* FROM '{user}'@'127.0.0.1';")
        self.temp_grants=[]
        for name in reversed(self.schemas):self.query(f'DROP DATABASE `{name}`;')
        self.schemas=[]
        for user in self.temporary_users:self.query(f"DROP USER '{user}'@'127.0.0.1';")
        self.temporary_users=[]

    def cleanup_credentials(self):
        # Results do not need extra copies of live SQL passwords after testing.
        for path in self.private.glob('*.cnf'):
            if not path.resolve().is_relative_to(self.private.resolve()):
                raise RuntimeError('Audit credential path escaped scratch directory')
            path.unlink()


def main():
    audit=Audit();clones={}
    try:
        for name in ('server','accounts','tls','auth'):
            print('Running',name,flush=True);getattr(audit,name)()
        print('Running ERD constraints and bounds',flush=True);audit.schema(clones)
        print('Running transaction/concurrency checks',flush=True);audit.transactions(clones)
        audit.business_limits(clones)
    except Exception as error:
        audit.check('execution','Requested audit sections completed',False,type(error).__name__)
        raise
    finally:
        audit.cleanup()
        audit.check('preservation','Active ERD tables and row contents unchanged',audit.snapshot()==audit.original)
        audit.check('preservation','draw.io file unchanged',hashlib.sha256(erd.SOURCE.read_bytes()).hexdigest()==audit.source_hash)
        report={'date':time.strftime('%Y-%m-%d',time.gmtime()),'scope':list(db.DATABASES),'run_id':audit.run_id,'duration_seconds':round(time.monotonic()-audit.started,2),'summary':{s:sum(x['status']==s for x in audit.cases) for s in ('PASS','FAIL','WARN','SKIP')},'findings':audit.findings,'cases':audit.cases,'limits':['No guarantee of absolute security.','Backend/API login/authorization and production deployment are outside this database-only execution.','Only isolated schemas/accounts received test writes.']}
        (REPORT_DIR/'security-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        audit.cleanup_credentials()
        print('Audit summary:',report['summary'],flush=True)
    return int(any(x['status']=='FAIL' for x in audit.cases))


if __name__=='__main__':sys.exit(main())
