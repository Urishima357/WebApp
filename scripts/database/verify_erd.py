"""Check exact draw.io correspondence and ERD constraints in disposable schemas."""
import json
from pathlib import Path
import manage as db
import erd_databases as erd


def run():
    models=erd.build();results=[]
    for database,tables in models.items():
        result=erd.verify_database(database,tables)
        print(f'PASS: {database}: {len(tables)} tables; exact columns, PK, FK, UK, relation uniqueness and InnoDB.')
        testdb='erd_verify_servis' if database.endswith('servis') else 'erd_verify_showroom'
        if db.query(f"SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='{testdb}';")!='0':
            raise RuntimeError('Refusing to overwrite existing verification schema')
        source=(erd.OUTPUT/(database+'.sql')).read_text(encoding='utf-8').replace('`'+database+'`','`'+testdb+'`')
        try:
            db.query(source)
            def query(sql):return db.query(sql,'admin',testdb)
            def reject(name,sql,code):
                r=db.sql(sql,'admin',testdb)
                if r.returncode==0 or str(code).encode() not in r.stderr:raise AssertionError(name)
                result.setdefault('constraint_checks',[]).append(name)
                print('PASS:',name)
            if database.endswith('servis'):
                query("INSERT INTO pelanggan VALUES(1,'Uji','Kontak'); INSERT INTO pegawai VALUES(1,'Uji','Kasir'); INSERT INTO mekanik VALUES(1,'Uji'); INSERT INTO kendaraan VALUES(1,1,'B UJI','Uji','Uji',2020,'Hitam'); INSERT INTO nota_servis VALUES(1,1,1,1,'WO-UJI',NOW(),100,'Uji',100,0,100); INSERT INTO detail_servis VALUES(1,1,'Jasa','Uji',1,100,0,100); INSERT INTO pembayaran VALUES(1,1,'Tunai',100,0,NOW());")
                reject('Servis: FK pelanggan ditegakkan',"INSERT INTO kendaraan VALUES(2,999,'B UJI2','Uji','Uji',2020,'Hitam');",1452)
                reject('Servis: UK nomor polisi ditegakkan',"INSERT INTO kendaraan VALUES(2,1,'B UJI','Uji','Uji',2020,'Hitam');",1062)
                reject('Servis: satu pembayaran per nota',"INSERT INTO pembayaran VALUES(2,1,'Tunai',100,0,NOW());",1062)
                reject('Servis: FK detail ke nota ditegakkan',"INSERT INTO detail_servis VALUES(2,999,'Jasa','Uji',1,100,0,100);",1452)
            else:
                query("INSERT INTO pembeli VALUES(1,'Uji','Kontak','Alamat'); INSERT INTO pegawai VALUES(1,'Uji','Kasir'); INSERT INTO motor VALUES(1,'M-UJI','B UJI','Uji','Uji',2020,'Hitam','RANGKA-UJI','MESIN-UJI',100,'Tersedia'); INSERT INTO penjualan VALUES(1,1,1,1,NOW(),100,0,'Tidak ada',100,'Terjual'); INSERT INTO pembayaran VALUES(1,1,1,'Transfer',100,'REF-UJI',NOW());")
                reject('Showroom: satu penjualan per motor sesuai 0..1',"INSERT INTO penjualan VALUES(2,1,1,1,NOW(),100,0,'Tidak ada',100,'Terjual');",1062)
                reject('Showroom: satu pembayaran per penjualan',"INSERT INTO pembayaran VALUES(2,1,1,'Transfer',100,'REF-UJI2',NOW());",1062)
                reject('Showroom: UK nomor rangka ditegakkan',"INSERT INTO motor VALUES(2,'M-UJI2','B UJI2','Uji','Uji',2020,'Hitam','RANGKA-UJI','MESIN-UJI2',100,'Tersedia');",1062)
                query("INSERT INTO motor VALUES(2,'M-UJI2','B UJI2','Uji','Uji',2020,'Hitam','RANGKA-UJI2','MESIN-UJI2',100,'Tersedia');")
                reject('Showroom: FK pembeli ditegakkan',"INSERT INTO penjualan VALUES(2,999,2,1,NOW(),100,0,'Tidak ada',100,'Terjual');",1452)
            results.append(result)
        finally:
            # Drop only the dedicated schema created by this invocation.
            db.query(f'DROP DATABASE `{testdb}`;')
    report={'source':erd.SOURCE.name,'source_sha256':__import__('hashlib').sha256(erd.SOURCE.read_bytes()).hexdigest(),'databases':results,'extra_tables':0,'note':'No data inserted into either active database. Minimum child participation still requires application transactions.'}
    (erd.OUTPUT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    (db.ROOT/'docs/database/verification-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Both active ERD databases verified; no additional table or active test record.')


if __name__=='__main__':run()
