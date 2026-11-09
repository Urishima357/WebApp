"""Integration/security checks against real MySQL, in disposable schemas only."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import time

import manage as db

TEST_DB = 'garasi_hobby_verification'
RESTORE_DB = 'garasi_hobby_restorecheck'
RESULTS = []


def check(label, assertion):
    if not assertion:
        raise AssertionError(label)
    RESULTS.append(label)
    print('PASS:', label)


def execute(statement, role='admin'):
    return db.query(statement,role,TEST_DB)


def denied(label, statement, role='app', expected=()):
    result = db.sql(statement,role,TEST_DB)
    error=result.stderr.decode(errors='replace')
    check(label,result.returncode != 0 and (not expected or any(str(code) in error for code in expected)))


def grant_runtime():
    return db.apply_runtime_grants(TEST_DB)


def run():
    started=time.monotonic()
    # Never adopt or drop an existing schema; cleanup only schemas this invocation creates.
    existing=db.query('SHOW DATABASES;').splitlines()
    if TEST_DB in existing or RESTORE_DB in existing:
        raise RuntimeError('Disposable schema already exists; inspect manually before retrying')
    created=[]
    granted=[]
    try:
        db.query(f'CREATE DATABASE `{TEST_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
        created.append(TEST_DB)
        for path in sorted(db.MIGRATIONS.glob('[0-9]*.sql')):
            db.require(db.sql(path.read_text(encoding='utf-8'),'admin',TEST_DB),'Create isolated verification schema')
        granted=grant_runtime()
        check('42 implemented business/support tables',execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();")=='42')
        check('InnoDB for every business table',execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND engine<>'InnoDB';")=='0')
        check('Required CHECK constraints installed',int(execute("SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND constraint_type='CHECK';"))>=100)
        check('TLS enforced and loopback bind',db.query("SELECT CONCAT(@@bind_address,'|',@@require_secure_transport,'|',@@local_infile,'|',IF(@@secure_file_priv IS NULL,'NULL',@@secure_file_priv));")=='127.0.0.1|1|0|NULL')
        tls=execute("SHOW SESSION STATUS LIKE 'Ssl_cipher';",'app')
        check('Application connection uses TLS with CA verification',bool(tls.split('\t')[-1]))
        args=[db.BIN/'mysql.exe',f'--defaults-extra-file={db.PRIVATE/"client-app.cnf"}','--ssl-mode=DISABLED','--batch','--execute=SELECT 1;']
        clear=db.run(args)
        check('Unencrypted connection rejected',clear.returncode != 0 and (b'3159' in clear.stderr or b'1045' in clear.stderr))
        check('No anonymous or remote SQL accounts',db.query("SELECT COUNT(*) FROM mysql.user WHERE User='' OR Host NOT IN ('localhost','127.0.0.1');")=='0')
        check('Application uses caching_sha2_password and requires SSL',db.query("SELECT CONCAT(plugin,'|',ssl_type) FROM mysql.user WHERE User='gh_app' AND Host='127.0.0.1';")=='caching_sha2_password|ANY')
        denied('App cannot read MySQL privilege tables','SELECT * FROM mysql.user;',expected=(1142,))
        denied('App cannot create tables','CREATE TABLE unauthorized_table(id INT);',expected=(1142,))
        denied('App cannot create users',"CREATE USER 'unauthorized_probe'@'127.0.0.1';",expected=(1227,))
        denied('App cannot update audit','UPDATE audit_logs SET action=action;',expected=(1142,))
        denied('App cannot delete ledger','DELETE FROM stock_movements WHERE id=0;',expected=(1142,))
        denied('App cannot delete received payments','DELETE FROM payment_attempts WHERE id=0;',expected=(1142,))
        denied('App cannot delete refund history','DELETE FROM refunds WHERE id=0;',expected=(1142,))
        backup_write=db.sql('UPDATE business_locations SET name=name WHERE id=0;','backup',db.DB)
        check('Backup account cannot write',backup_write.returncode != 0 and b'1142' in backup_write.stderr)
        check('Backup account has no trigger-DDL privilege','TRIGGER' not in db.query("SHOW GRANTS FOR 'gh_backup'@'127.0.0.1';"))
        execute("INSERT INTO users(id,role_id,name,login,password,is_active) VALUES(1,1,'Verification fixture','verify-fixture','not-a-real-login-hash',0);")
        execute("INSERT INTO customers(id,name) VALUES(1,'Verification customer');")
        execute("INSERT INTO vehicles(id,license_plate,brand,model,color,chassis_number) VALUES(1,'B SAME','Test','A','Black','FRAME-ONE'),(2,'B SAME','Test','B','Black','FRAME-TWO');")
        check('Duplicate plate allowed',execute("SELECT COUNT(*) FROM vehicles WHERE license_plate='B SAME';")=='2')
        denied('Duplicate chassis rejected',"INSERT INTO vehicles(brand,model,color,chassis_number) VALUES('Test','C','Black','FRAME-ONE');",expected=(1062,))
        denied('Foreign key enforced',"INSERT INTO vehicle_ownerships(vehicle_id,owner_type,customer_id,valid_from,created_by) VALUES(999,'CUSTOMER',1,NOW(6),1);",expected=(1452,))
        execute("INSERT INTO vehicle_ownerships(vehicle_id,owner_type,location_id,valid_from,created_by) VALUES(1,'BUSINESS',1,NOW(6),1);")
        denied('Second active ownership rejected',"INSERT INTO vehicle_ownerships(vehicle_id,owner_type,customer_id,valid_from,created_by) VALUES(1,'CUSTOMER',1,NOW(6),1);",expected=(1062,))
        denied('Owner type/FK mismatch rejected',"INSERT INTO vehicle_ownerships(vehicle_id,owner_type,valid_from,created_by) VALUES(2,'CUSTOMER',NOW(6),1);",expected=(3819,))
        execute("INSERT INTO item_categories(id,name) VALUES(1,'Test'); INSERT INTO units(id,code,name) VALUES(1,'PCS','Piece'); INSERT INTO items(id,sku,name,category_id,base_unit_id,selling_price) VALUES(1,'TEST-ONE','Verification item',1,1,150); INSERT INTO inventory_balances(item_id,location_id,current_stock,weighted_average_cost) VALUES(1,1,1,100);")
        denied('Negative balance rejected','UPDATE inventory_balances SET current_stock=-1 WHERE item_id=1 AND location_id=1;',expected=(3819,))
        denied('Zero conversion ratio rejected','UPDATE items SET purchase_ratio=0 WHERE id=1;',expected=(3819,))
        execute("INSERT INTO work_orders(id,number,vehicle_id,customer_id,location_id,received_at) VALUES(1,'WO-TEST-1',1,1,1,NOW(6));")
        execute("INSERT INTO work_order_items(id,work_order_id,line_type,item_id,description_snapshot,quantity,unit_price,cost_snapshot,line_subtotal,line_total) VALUES(1,1,'ITEM',1,'Test item',1,150,100,150,150),(2,1,'ITEM',1,'Test item',1,150,100,150,150);")
        execute("INSERT INTO migration_batches(id,reference,dataset_code,location_id,source_filename,source_hash,cutover_at,status,executed_by) VALUES(1,'TEST-OPEN','OPENING_ITEMS',1,'fixture',REPEAT('a',64),NOW(6),'IMPORTED',1); INSERT INTO stock_movements(item_id,location_id,movement_type,quantity_in,unit_cost,migration_batch_id,posting_key,created_by,occurred_at) VALUES(1,1,'OPENING',1,100,1,'opening:test',1,NOW(6));")
        denied('Opening cannot be posted twice',"INSERT INTO stock_movements(item_id,location_id,movement_type,quantity_in,unit_cost,migration_batch_id,posting_key,created_by,occurred_at) VALUES(1,1,'OPENING',1,100,1,'opening:test:second',1,NOW(6));",expected=(1062,))
        def consume(n):
            statement=f"START TRANSACTION; SELECT current_stock FROM inventory_balances WHERE item_id=1 AND location_id=1 FOR UPDATE; DO SLEEP(0.3); UPDATE inventory_balances SET current_stock=current_stock-1 WHERE item_id=1 AND location_id=1; INSERT INTO stock_movements(item_id,location_id,movement_type,quantity_out,unit_cost,work_order_item_id,posting_key,created_by,occurred_at) VALUES(1,1,'WO_USAGE',1,100,{n},'usage:test:{n}',1,NOW(6)); COMMIT;"
            return db.sql(statement,'app',TEST_DB)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes=list(pool.map(consume,[1,2]))
        check('Two concurrent consumers: only one commits',sum(r.returncode==0 for r in outcomes)==1)
        check('Balance and ledger remain consistent',execute('SELECT current_stock FROM inventory_balances WHERE item_id=1 AND location_id=1;')=='0.0000' and execute('SELECT SUM(quantity_in-quantity_out) FROM stock_movements WHERE item_id=1 AND location_id=1;')=='0.0000')
        denied('Ledger immutable even for schema admin','UPDATE stock_movements SET unit_cost=200 WHERE id=1;',role='admin',expected=(1644,))
        execute("INSERT INTO units(id,code,name) VALUES(2,'BOX','Box');")
        denied('Base unit locked after movement','UPDATE items SET base_unit_id=2 WHERE id=1;',expected=(1644,))
        execute("INSERT INTO audit_logs(module,action,entity_type,correlation_id,occurred_at) VALUES('test','test.created','fixture','00000000-0000-0000-0000-000000000001',NOW(6));")
        denied('Audit immutable even for schema admin','DELETE FROM audit_logs;',role='admin',expected=(1644,))
        execute("INSERT INTO transactions(id,number,transaction_type,location_id,transaction_at,subtotal,total) VALUES(1,'POS-TEST-1','POS',1,NOW(6),150,150); INSERT INTO transaction_lines(transaction_id,line_type,item_id,description_snapshot,quantity,unit_price,cost_snapshot,line_subtotal,line_total) VALUES(1,'ITEM',1,'Test',1,150,100,150,150);")
        execute("UPDATE transactions SET status='FINAL',finalized_at=NOW(6),receipt_snapshot=JSON_OBJECT('test',true) WHERE id=1;")
        denied('Final snapshot cannot be rewritten','UPDATE transactions SET total=1 WHERE id=1;',expected=(1644,))
        denied('Final status cannot be downgraded','UPDATE transactions SET status=\'DRAFT\' WHERE id=1;',expected=(1644,))
        denied('Final identity cannot be changed','UPDATE transactions SET id=99 WHERE id=1;',expected=(1644,))
        denied('Final lines cannot be rewritten','UPDATE transaction_lines SET quantity=2,line_subtotal=300,line_total=300 WHERE transaction_id=1;',expected=(1644,))
        denied('Final document cannot be deleted','DELETE FROM transactions WHERE id=1;',expected=(1142,1644))
        denied('KOR blocked pending owner decision',"INSERT INTO transactions(number,transaction_type,document_type,corrects_transaction_id,location_id,transaction_at) VALUES('KOR-TEST','POS','KOR',1,1,NOW(6));",expected=(1644,))
        execute("INSERT INTO payment_attempts(id,transaction_id,payment_method_id,mode_snapshot,channel_snapshot,internal_reference,amount_due,amount_received,status,confirmed_by,requested_by,requested_at,paid_at) VALUES(1,1,1,'MANUAL','CASH','paid:test:1',150,150,'PAID',1,1,NOW(6),NOW(6));")
        denied('Second funded payment rejected',"INSERT INTO payment_attempts(transaction_id,payment_method_id,mode_snapshot,channel_snapshot,internal_reference,amount_due,amount_received,status,confirmed_by,requested_by,requested_at,paid_at) VALUES(1,1,'MANUAL','CASH','paid:test:2',150,150,'PAID',1,1,NOW(6),NOW(6));",expected=(1062,))
        execute("INSERT INTO payment_gateway_events(provider,external_event_id,external_reference,event_type,payload_hash,received_at) VALUES('test','event-1','ref-1','paid',REPEAT('a',64),NOW(6));")
        denied('Duplicate provider event rejected',"INSERT INTO payment_gateway_events(provider,external_event_id,external_reference,event_type,payload_hash,received_at) VALUES('test','event-1','ref-1','paid',REPEAT('a',64),NOW(6));",expected=(1062,))
        denied('Invalid signature cannot claim event ID',"INSERT INTO payment_gateway_events(provider,external_event_id,external_reference,event_type,signature_valid,payload_hash,received_at) VALUES('test','event-2','ref-1','paid',0,REPEAT('a',64),NOW(6));",expected=(3819,))
        execute("INSERT INTO showroom_inventories(id,vehicle_id,location_id,inventory_code) VALUES(1,1,1,'TEST-MOTOR');")
        for n in [2,3]:
            execute(f"INSERT INTO transactions(id,number,transaction_type,customer_id,location_id,showroom_inventory_id,transaction_at,subtotal,total) VALUES({n},'MTR-TEST-{n}','MOTOR',1,1,1,NOW(6),1000000,1000000);")
        def finalize(n):
            return db.sql(f"UPDATE transactions SET status='FINAL',finalized_at=NOW(6),receipt_snapshot=JSON_OBJECT('test',true) WHERE id={n};",'app',TEST_DB)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes=list(pool.map(finalize,[2,3]))
        check('Concurrent final motor sales: one active final',sum(r.returncode==0 for r in outcomes)==1)
        execute("INSERT INTO transactions(id,number,transaction_type,location_id,transaction_at,subtotal,total) VALUES(4,'POS-TEST-WAIT','POS',1,NOW(6),150,150); INSERT INTO transaction_lines(transaction_id,line_type,item_id,description_snapshot,quantity,unit_price,cost_snapshot,line_subtotal,line_total) VALUES(4,'ITEM',1,'Test',1,150,100,150,150); UPDATE transactions SET status='AWAITING_PAYMENT' WHERE id=4;")
        denied('Pending payment amount cannot change','UPDATE transactions SET total=1 WHERE id=4;',expected=(1644,))
        denied('Pending payment lines cannot change','UPDATE transaction_lines SET quantity=2,line_subtotal=300,line_total=300 WHERE transaction_id=4;',expected=(1644,))
        # Restore an actual production-schema backup into a new empty schema; never overwrite application data.
        path=db.backup()
        db.query(f'CREATE DATABASE `{RESTORE_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;')
        created.append(RESTORE_DB)
        db.require(db.sql(path.read_text(encoding='utf-8'),'admin',RESTORE_DB),'Restore into isolated schema')
        real_tables=db.query('SHOW TABLES;','admin',db.DB).splitlines()
        check('Backup restores every table',real_tables==db.query('SHOW TABLES;','admin',RESTORE_DB).splitlines())
        trigger_query="SELECT TRIGGER_NAME,ACTION_TIMING,EVENT_MANIPULATION,ACTION_STATEMENT FROM information_schema.triggers WHERE trigger_schema=DATABASE() ORDER BY TRIGGER_NAME;"
        check('Restored financial and audit triggers match',db.query(trigger_query,'admin',db.DB)==db.query(trigger_query,'admin',RESTORE_DB))
        for name in real_tables:
            keys=db.query(f"SELECT COLUMN_NAME FROM information_schema.statistics WHERE table_schema='{db.DB}' AND table_name='{name}' AND index_name='PRIMARY' ORDER BY SEQ_IN_INDEX;").splitlines()
            order=','.join('`'+x+'`' for x in keys)
            statement=f'SELECT * FROM `{name}` ORDER BY {order};'
            check('Restore data matches: '+name,db.query(statement,'admin',db.DB)==db.query(statement,'admin',RESTORE_DB))
        report={'server':db.query('SELECT VERSION();'),'checks':RESULTS,'duration_seconds':round(time.monotonic()-started,2),'limitations':['Local development database only; no absolute security guarantee.','Business actions, payment signatures, aggregate refunds/WAC/reversal rules require backend implementation.','KOR allocation table and production gateway integration are not deployed.','Backups here are local and access-controlled, not encrypted or off-device.']}
        target=db.ROOT/'docs/database/verification-results.json'
        target.write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(f'Completed {len(RESULTS)} checks. No test customer data was inserted into garasi_hobby.')
    finally:
        for name in granted:
            db.query(f"REVOKE ALL PRIVILEGES ON `{TEST_DB}`.`{name}` FROM 'gh_app'@'127.0.0.1';")
        for name in reversed(created):
            db.query(f'DROP DATABASE `{name}`;')


if __name__=='__main__':
    try:
        run()
    except Exception as error:
        print('FAIL:',str(error),file=sys.stderr)
        sys.exit(1)
