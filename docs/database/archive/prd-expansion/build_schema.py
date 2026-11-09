"""Build reviewed MySQL DDL. No connection, credentials, or database mutation."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/api/database/sql'
TABLES = []
ID = 'BIGINT UNSIGNED'
DT = 'DATETIME(6)'


def constraint_name(table, kind, expression):
    return f'{kind}_{table[:30]}_{hashlib.sha256(expression.encode()).hexdigest()[:10]}'


def table(name, fields, *, timestamps=True, actors=False, checks=(), unique=(), indexes=(), generated=(), primary='id', extra=()):
    columns = [] if primary != 'id' else ['`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT']
    fks, all_checks = [], list(checks)
    if timestamps:
        fields += '\ncreated_at DT =CURRENT_TIMESTAMP(6)\nupdated_at DT =CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'
    if actors:
        fields += '\ncreated_by ID? ->users\nupdated_by ID? ->users'
    for line in fields.strip().splitlines():
        parts = line.strip().split()
        if not parts:
            continue
        col, typ, *opts = parts
        nullable = typ.endswith('?')
        typ = typ.rstrip('?')
        sqltype = {'ID': ID, 'DT': DT, 'MONEY': 'BIGINT', 'QTY': 'DECIMAL(19,4)', 'COST': 'DECIMAL(19,4)', 'BOOL': 'TINYINT', 'TEXT': 'TEXT', 'JSON': 'JSON'}.get(typ, typ)
        if typ.startswith('V('):
            sqltype = 'VARCHAR' + typ[1:]
        reference = next((x[2:] for x in opts if x.startswith('->')), None)
        default = next((x[1:] for x in opts if x.startswith('=')), None)
        tail = ' ON UPDATE CURRENT_TIMESTAMP(6)' if 'UPDATE' in opts else ''
        collation = ' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin' if 'BINARY' in opts else ''
        columns.append(f'`{col}` {sqltype}{collation} ' + ('NULL' if nullable else 'NOT NULL') + (f' DEFAULT {default}' if default is not None else (' DEFAULT NULL' if nullable else '')) + tail)
        if reference:
            fks.append((col, reference))
        if typ in ('MONEY', 'COST'):
            all_checks.append(f'`{col}` >= 0')
        if typ == 'BOOL':
            all_checks.append(f'`{col}` IN (0,1)')
    for col, typ, expression in generated:
        columns.append(f'`{col}` {typ} GENERATED ALWAYS AS ({expression}) VIRTUAL')
    columns.append('PRIMARY KEY (' + ','.join(f'`{x.strip()}`' for x in primary.split(',')) + ')')
    for col, target in fks:
        fk = constraint_name(name, 'fk', col)
        columns.append(f'CONSTRAINT `{fk}` FOREIGN KEY (`{col}`) REFERENCES `{target}` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT')
    for expr in all_checks:
        columns.append(f'CONSTRAINT `{constraint_name(name,"ck",expr)}` CHECK ({expr})')
    for kind, groups in [('uq', unique), ('ix', indexes)]:
        for cols in groups:
            columns.append(('UNIQUE KEY' if kind == 'uq' else 'KEY') + f' `{constraint_name(name,kind,cols)}` (' + ','.join(f'`{x.strip()}`' for x in cols.split(',')) + ')')
    columns.extend(extra)
    TABLES.append({'name': name, 'fields': [x.split('`')[1] for x in columns if x.startswith('`')], 'foreign_keys': fks, 'ddl': f'CREATE TABLE `{name}` (\n  ' + ',\n  '.join(columns) + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;\n'})


def statuses(column, values):
    return f"`{column}` IN (" + ','.join("'" + x + "'" for x in values.split()) + ')'


DISCOUNT = """
discount_type V(8) ='NONE'
discount_input DECIMAL(19,4) =0
discount_amount MONEY =0
discount_reason TEXT?
"""
DISCOUNT_CHECKS = [statuses('discount_type', 'NONE AMOUNT PERCENT'), 'discount_input >= 0', "discount_type <> 'PERCENT' OR discount_input <= 100", "discount_type <> 'NONE' OR (discount_input = 0 AND discount_amount = 0)", "discount_type <> 'AMOUNT' OR discount_input = FLOOR(discount_input)", 'discount_amount = 0 OR (discount_reason IS NOT NULL AND CHAR_LENGTH(TRIM(discount_reason)) > 0)']
LINE = """
line_type V(16)
item_id ID? ->items
service_id ID? ->service_catalog
description_snapshot V(255)
quantity QTY
unit_price MONEY
cost_snapshot COST
line_subtotal MONEY
line_total MONEY
"""
LINE_CHECKS = ["(line_type = 'ITEM' AND item_id IS NOT NULL AND service_id IS NULL) OR (line_type = 'SERVICE' AND service_id IS NOT NULL AND item_id IS NULL)", 'quantity > 0', 'line_subtotal = ROUND(quantity * unit_price,0)', 'discount_amount <= line_subtotal', 'line_total = line_subtotal - discount_amount'] + DISCOUNT_CHECKS


def build():
    table('roles', "code V(32)\nname V(100)\nis_active BOOL =1", unique=['code'])
    table('permissions', 'code V(100)\ndescription V(255)', unique=['code'])
    table('role_permissions', 'role_id ID ->roles\npermission_id ID ->permissions', timestamps=False, primary='role_id,permission_id')
    table('users', 'role_id ID ->roles\nname V(150)\nlogin V(191)\npassword V(255)\nis_active BOOL =1\nlast_login_at DT?', unique=['login'])
    table('user_permissions', 'user_id ID ->users\npermission_id ID ->permissions\ngranted_by ID ->users\ngranted_at DT', timestamps=False, primary='user_id,permission_id')
    table('sessions', 'id V(255)\nuser_id ID? ->users\nip_address V(45)?\nuser_agent TEXT?\npayload LONGTEXT\nlast_activity INT UNSIGNED', timestamps=False, primary='id_session', indexes=['user_id','last_activity'])
    # sessions has a string PK rather than auto-increment.
    TABLES[-1]['ddl'] = TABLES[-1]['ddl'].replace('`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,\n  ', '').replace('PRIMARY KEY (`id_session`)', 'PRIMARY KEY (`id`)')
    table('business_locations', 'code V(32)\nname V(150)\naddress TEXT\nphone V(50)?\nis_default BOOL =0\nis_active BOOL =1', actors=True, unique=['code','active_default'], generated=[('active_default','TINYINT', 'IF(is_default=1 AND is_active=1,1,NULL)')])
    table('business_settings', 'key V(100)\nvalue JSON\nvalue_type V(20)\nupdated_by ID? ->users\nupdated_at DT =CURRENT_TIMESTAMP(6)', timestamps=False, primary='key', checks=[statuses('value_type','STRING INTEGER DECIMAL BOOLEAN OBJECT')])
    table('discount_policies', 'role_id ID ->roles\ntransaction_type V(16)\nmax_discount_percent DECIMAL(7,4) =0\nupdated_by ID? ->users', unique=['role_id,transaction_type'], checks=[statuses('transaction_type','SERVICE POS MOTOR'),'max_discount_percent BETWEEN 0 AND 100'])
    table('document_sequences', 'document_type V(16)\nperiod_yymm CHAR(4)\nprefix V(16)\nlast_number INT UNSIGNED =0\nupdated_at DT =CURRENT_TIMESTAMP(6)', timestamps=False, primary='document_type,period_yymm', checks=['last_number <= 9999', "period_yymm REGEXP '^[0-9]{4}$'"])
    table('customers', 'name V(150)\ncontact V(100)?\naddress TEXT?\nnotes TEXT?\nis_active BOOL =1', actors=True, indexes=['name','contact'], checks=['CHAR_LENGTH(TRIM(name)) > 0'])
    table('vehicles', 'license_plate V(32)?\nbrand V(100)\nmodel V(100)\nyear SMALLINT? UNSIGNED\ncolor V(80)\nchassis_number V(100)?\nengine_number V(100)?\nnotes TEXT?\nis_active BOOL =1', actors=True, unique=['chassis_number','engine_number'], indexes=['license_plate','brand,model'], checks=["chassis_number IS NULL OR CHAR_LENGTH(TRIM(chassis_number)) > 0", "engine_number IS NULL OR CHAR_LENGTH(TRIM(engine_number)) > 0"])
    for name, fields, uq in [('item_categories','name V(100)\nis_active BOOL =1',['name']),('units','code V(20)\nname V(80)\nis_active BOOL =1',['code']),('suppliers','name V(150)\ncontact V(100)?\naddress TEXT?\nis_active BOOL =1',[])]:
        table(name, fields, actors=True, unique=uq)
    table('operational_staff', 'location_id ID ->business_locations\nname V(150)\nstaff_type V(16)\nis_active BOOL =1', actors=True, checks=[statuses('staff_type','MECHANIC PIC')])
    table('items', 'sku V(64)\nname V(150)\ncategory_id ID ->item_categories\nbrand V(100)?\nbase_unit_id ID ->units\npurchase_unit_id ID? ->units\npurchase_ratio QTY =1\nselling_price MONEY\nmin_stock QTY =0\nis_stock_tracked BOOL =1\nis_active BOOL =1', actors=True, unique=['sku'], indexes=['name'], checks=['purchase_ratio > 0','min_stock >= 0','purchase_unit_id IS NOT NULL OR purchase_ratio = 1'])
    table('inventory_balances', 'item_id ID ->items\nlocation_id ID ->business_locations\ncurrent_stock QTY =0\nweighted_average_cost COST =0\nupdated_at DT =CURRENT_TIMESTAMP(6)', timestamps=False, primary='item_id,location_id', checks=['current_stock >= 0'])
    table('service_catalog', 'name V(150)\nservice_type V(16)\nstandard_price MONEY\nvendor_cost MONEY?\nnotes TEXT?\nis_active BOOL =1', actors=True, checks=[statuses('service_type','INTERNAL EXTERNAL_VENDOR'), "service_type <> 'EXTERNAL_VENDOR' OR vendor_cost IS NOT NULL"])
    table('payment_methods', 'code V(32)\nname V(100)\nmode V(8)\nchannel V(32)\nprovider V(64)? BINARY\nis_active BOOL =0', actors=True, unique=['code'], checks=[statuses('mode','MANUAL GATEWAY'),"mode <> 'GATEWAY' OR is_active = 0 OR provider IS NOT NULL"])
    for name,fields in [('goods_receipts','supplier_id ID ->suppliers\nlocation_id ID ->business_locations\nsupplier_reference V(100)?\nreceived_at DT\ntotal MONEY =0'),('stock_adjustments','location_id ID ->business_locations\nreason TEXT')]:
        table(name, 'number V(40)\n'+fields+"\nstatus V(24) ='DRAFT'\nfinalized_by ID? ->users\ncancelled_by ID? ->users\nfinalized_at DT?\ncancelled_at DT?\ncancellation_reason TEXT?", actors=True, unique=['number'], checks=[statuses('status','DRAFT FINAL CANCELLED'),"status <> 'FINAL' OR (finalized_at IS NOT NULL AND finalized_by IS NOT NULL)","status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0 AND cancellation_reason IS NOT NULL)"])
    table('goods_receipt_lines', 'goods_receipt_id ID ->goods_receipts\nitem_id ID ->items\npurchase_unit_id ID ->units\nquantity_purchased QTY\nconversion_ratio QTY\nquantity_base QTY\npurchase_unit_price COST\nunit_cost_base COST\nline_total MONEY', checks=['quantity_purchased > 0','conversion_ratio > 0','quantity_base > 0','quantity_base = quantity_purchased * conversion_ratio'])
    table('stock_adjustment_lines', 'stock_adjustment_id ID ->stock_adjustments\nitem_id ID ->items\nquantity_delta QTY\nunit_cost COST\nnotes TEXT?', checks=['quantity_delta <> 0'])
    table('work_orders', "number V(40)\nvehicle_id ID ->vehicles\ncustomer_id ID ->customers\nlocation_id ID ->business_locations\noperational_staff_id ID? ->operational_staff\nreceived_at DT\ncomplaint TEXT?\nodometer_km INT? UNSIGNED\ninitial_condition TEXT?\ninspection_notes TEXT?\nrecommendations TEXT?\nstatus V(32) ='DRAFT'\ninspected_at DT?\nhanded_over_at DT?\ncancelled_at DT?\ncancellation_reason TEXT?", actors=True, unique=['number'], indexes=['location_id,status,received_at','vehicle_id,received_at','operational_staff_id,status'], checks=[statuses('status','DRAFT INSPECTION AWAITING_APPROVAL AWAITING_PARTS IN_PROGRESS READY_FOR_PICKUP COMPLETED CANCELLED'),"status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0)","status <> 'COMPLETED' OR handed_over_at IS NOT NULL"])
    table('work_order_status_history', 'work_order_id ID ->work_orders\nfrom_status V(32)?\nto_status V(32)\nreason TEXT?\nchanged_by ID ->users\nchanged_at DT', timestamps=False, indexes=['work_order_id,changed_at'])
    table('estimates', "work_order_id ID ->work_orders\nversion INT UNSIGNED\nstatus V(16) ='PENDING'\nsubtotal MONEY =0\ntotal MONEY =0\napproval_name V(150)?\napproval_method V(16)?\napproved_at DT?\napproved_total MONEY?\napproval_recorded_by ID? ->users\napproval_evidence_key V(255)? BINARY\ndecision_notes TEXT?\noverride_by ID? ->users\noverride_at DT?\noverride_reason TEXT?"+DISCOUNT, actors=True, unique=['work_order_id,version'], checks=DISCOUNT_CHECKS+['version >= 1',statuses('status','PENDING APPROVED REJECTED REVISED'),statuses('approval_method','IN_PERSON PHONE WHATSAPP'),"status <> 'APPROVED' OR (approval_name IS NOT NULL AND approval_method IS NOT NULL AND approved_at IS NOT NULL AND approved_total IS NOT NULL AND approval_recorded_by IS NOT NULL)",'override_by IS NULL OR (override_at IS NOT NULL AND override_reason IS NOT NULL AND CHAR_LENGTH(TRIM(override_reason)) > 0)'])
    table('estimate_lines', 'estimate_id ID ->estimates\n'+LINE+DISCOUNT, checks=LINE_CHECKS)
    table('work_order_items', "work_order_id ID ->work_orders\nsource_estimate_line_id ID? ->estimate_lines\nusage_status V(16) ='PLANNED'\nconfirmed_by ID? ->users\nconfirmed_at DT?\nchange_notes TEXT?\n"+LINE+DISCOUNT, actors=True, checks=LINE_CHECKS+[statuses('usage_status','PLANNED CONFIRMED REVERSED'),"usage_status = 'PLANNED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)"])
    table('showroom_inventories', "vehicle_id ID ->vehicles\nlocation_id ID ->business_locations\ninventory_code V(64)\npurchase_cost MONEY?\nselling_price MONEY?\nstatus V(16) ='DRAFT'\ncondition_notes TEXT?\nreserved_customer_id ID? ->customers\nreserved_at DT?\nreserved_until DT?\nreservation_notes TEXT?", actors=True, unique=['vehicle_id','inventory_code'], indexes=['location_id,status'], checks=[statuses('status','DRAFT AVAILABLE RESERVED SOLD ARCHIVED'),"status NOT IN ('AVAILABLE','RESERVED','SOLD') OR (purchase_cost IS NOT NULL AND selling_price IS NOT NULL)","status <> 'RESERVED' OR (reserved_customer_id IS NOT NULL AND reserved_at IS NOT NULL AND reserved_until IS NOT NULL AND reserved_until > reserved_at)"])
    table('vehicle_photos', 'vehicle_id ID ->vehicles\nwork_order_id ID? ->work_orders\nphoto_type V(24)\nobject_key V(255) BINARY\nmime_type V(64)\nsize_bytes INT UNSIGNED\nsort_order INT UNSIGNED =0\nis_primary BOOL =0\nuploaded_by ID ->users\nuploaded_at DT', timestamps=False, unique=['object_key','primary_showroom_vehicle_id'], generated=[('primary_showroom_vehicle_id',ID,'IF(work_order_id IS NULL AND is_primary=1,vehicle_id,NULL)')], checks=["mime_type IN ('image/jpeg','image/png','image/webp')",'size_bytes BETWEEN 1 AND 5242880',"(work_order_id IS NULL AND photo_type IN ('SHOWROOM_FRONT','SHOWROOM_RIGHT','SHOWROOM_LEFT','SHOWROOM_OTHER')) OR (work_order_id IS NOT NULL AND is_primary=0 AND photo_type IN ('WO_GENERAL','WO_ISSUE','WO_DAMAGE'))"])
    table('transactions', "number V(40)\ntransaction_type V(16)\ndocument_type V(8) ='NORMAL'\ncorrects_transaction_id ID? ->transactions\ncustomer_id ID? ->customers\nlocation_id ID ->business_locations\nwork_order_id ID? ->work_orders\nshowroom_inventory_id ID? ->showroom_inventories\ntransaction_at DT\nsubtotal MONEY =0\ntotal MONEY =0\nstatus V(24) ='DRAFT'\nreceipt_snapshot JSON?\nfinalized_by ID? ->users\ncancelled_by ID? ->users\nfinalized_at DT?\ncancelled_at DT?\ncancellation_reason TEXT?"+DISCOUNT, actors=True, unique=['number','final_work_order_id','final_showroom_inventory_id','active_corrects_transaction_id'], indexes=['location_id,status,transaction_at','transaction_type,status,transaction_at','created_by,transaction_at'], generated=[('final_work_order_id',ID,"IF(status='FINAL',work_order_id,NULL)"),('final_showroom_inventory_id',ID,"IF(status='FINAL',showroom_inventory_id,NULL)"),('active_corrects_transaction_id',ID,"IF(status<>'CANCELLED',corrects_transaction_id,NULL)")], checks=DISCOUNT_CHECKS+[statuses('status','DRAFT AWAITING_PAYMENT FINAL CANCELLED'),"(document_type='NORMAL' AND corrects_transaction_id IS NULL) OR (document_type='KOR' AND corrects_transaction_id IS NOT NULL)","(transaction_type='SERVICE' AND work_order_id IS NOT NULL AND customer_id IS NOT NULL AND showroom_inventory_id IS NULL) OR (transaction_type='POS' AND work_order_id IS NULL AND showroom_inventory_id IS NULL) OR (transaction_type='MOTOR' AND showroom_inventory_id IS NOT NULL AND customer_id IS NOT NULL AND work_order_id IS NULL)","status <> 'FINAL' OR (finalized_at IS NOT NULL AND receipt_snapshot IS NOT NULL)","status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0)"])
    table('transaction_lines', 'transaction_id ID ->transactions\nshowroom_inventory_id ID? ->showroom_inventories\nwork_order_item_id ID? ->work_order_items\n'+LINE+DISCOUNT, checks=DISCOUNT_CHECKS+["(line_type='ITEM' AND item_id IS NOT NULL AND service_id IS NULL AND showroom_inventory_id IS NULL) OR (line_type='SERVICE' AND service_id IS NOT NULL AND item_id IS NULL AND showroom_inventory_id IS NULL) OR (line_type='MOTOR' AND showroom_inventory_id IS NOT NULL AND item_id IS NULL AND service_id IS NULL AND quantity=1)",'quantity > 0','line_subtotal = ROUND(quantity * unit_price,0)','discount_amount <= line_subtotal','line_total = line_subtotal - discount_amount'])
    table('vehicle_ownerships', 'vehicle_id ID ->vehicles\nowner_type V(16)\ncustomer_id ID? ->customers\nlocation_id ID? ->business_locations\nvalid_from DT\nvalid_to DT?\nsource_transaction_id ID? ->transactions\ncreated_by ID ->users\ncreated_at DT =CURRENT_TIMESTAMP(6)', timestamps=False, unique=['active_vehicle_id'], indexes=['vehicle_id,valid_from','customer_id,valid_to'], generated=[('active_vehicle_id',ID,'IF(valid_to IS NULL,vehicle_id,NULL)')], checks=["(owner_type='CUSTOMER' AND customer_id IS NOT NULL AND location_id IS NULL) OR (owner_type='BUSINESS' AND location_id IS NOT NULL AND customer_id IS NULL)",'valid_to IS NULL OR valid_to > valid_from'])
    table('discount_approvals', "transaction_id ID? ->transactions\nestimate_id ID? ->estimates\nrequested_by ID ->users\ndecided_by ID? ->users\nsubtotal_before MONEY\ndiscount_amount MONEY\ntotal_after MONEY\npolicy_limit_percent DECIMAL(7,4)\ncontent_hash CHAR(64) BINARY\nreason TEXT\nstatus V(16) ='PENDING'\nrequested_at DT\ndecided_at DT?", timestamps=False, checks=['(transaction_id IS NOT NULL) + (estimate_id IS NOT NULL) = 1','policy_limit_percent BETWEEN 0 AND 100',statuses('status','PENDING APPROVED REJECTED'),"status='PENDING' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)"])
    table('payment_attempts', "transaction_id ID ->transactions\npayment_method_id ID ->payment_methods\nmode_snapshot V(8)\nchannel_snapshot V(32)\nprovider V(64)? BINARY\ninternal_reference V(100) BINARY\nexternal_reference V(191)? BINARY\namount_due MONEY\namount_received MONEY =0\nchange_amount MONEY =0\nstatus V(24) ='PENDING'\npayment_reference V(191)? BINARY\nconfirmed_by ID? ->users\nrequested_by ID ->users\nrequested_at DT\nexpires_at DT?\npaid_at DT?", unique=['internal_reference','provider,external_reference','funded_transaction_id'], indexes=['status,requested_at','transaction_id,status'], generated=[('funded_transaction_id',ID,"IF(status IN ('PAID','REFUND_PENDING','REFUNDED'),transaction_id,NULL)")], checks=[statuses('status','PENDING PAID FAILED EXPIRED CANCELLED REFUND_PENDING REFUNDED'),statuses('mode_snapshot','MANUAL GATEWAY'),'amount_received >= change_amount',"mode_snapshot <> 'GATEWAY' OR provider IS NOT NULL", "status NOT IN ('PAID','REFUND_PENDING','REFUNDED') OR (paid_at IS NOT NULL AND amount_received-change_amount=amount_due)","mode_snapshot <> 'MANUAL' OR paid_at IS NULL OR confirmed_by IS NOT NULL","mode_snapshot <> 'GATEWAY' OR change_amount=0"])
    table('payment_gateway_events', "provider V(64) BINARY\nexternal_event_id V(191) BINARY\nexternal_reference V(191) BINARY\npayment_attempt_id ID? ->payment_attempts\nevent_type V(64)\nsignature_valid BOOL =1\npayload_hash CHAR(64) BINARY\npayload_redacted JSON?\nprocessing_status V(24) ='RECEIVED'\nreceived_at DT\nprocessed_at DT?\nprocessing_error V(255)?", timestamps=False, unique=['provider,external_event_id'], indexes=['processing_status,received_at'], checks=['signature_valid=1',statuses('processing_status','RECEIVED PROCESSED RECONCILE REJECTED')])
    table('refunds', "number V(40)\ntransaction_id ID ->transactions\npayment_attempt_id ID ->payment_attempts\npayment_method_id ID ->payment_methods\namount MONEY\nrecipient V(150)?\nreason TEXT\nstatus V(24) ='REFUND_PENDING'\ninternal_reference V(100) BINARY\nexternal_reference V(191)? BINARY\nrequested_by ID ->users\nconfirmed_by ID? ->users\nrequested_at DT\nconfirmed_at DT?", unique=['number','internal_reference'], checks=['amount > 0',statuses('status','REFUND_PENDING REFUNDED'),"status <> 'REFUNDED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND recipient IS NOT NULL)"])
    table('audit_logs', 'actor_id ID? ->users\nrequester_id ID? ->users\napprover_id ID? ->users\nmodule V(64)\naction V(100)\nentity_type V(64)\nentity_id V(100)?\ndocument_number V(40)?\nbefore_data JSON?\nafter_data JSON?\nreason TEXT?\nprovider_reference V(191)? BINARY\ncorrelation_id CHAR(36)\noccurred_at DT', timestamps=False, indexes=['occurred_at,id','actor_id,occurred_at','module,action,occurred_at','document_number','correlation_id'])
    table('migration_batches', 'reference V(100)\ndataset_code V(32)\nlocation_id ID ->business_locations\nsource_filename V(255)\nsource_hash CHAR(64) BINARY\ncutover_at DT\nstatus V(16)\naccepted_rows INT UNSIGNED =0\nrejected_rows INT UNSIGNED =0\nvalidation_report JSON?\nexecuted_by ID ->users\nexecuted_at DT?', unique=['reference','dataset_code,location_id,source_hash'], checks=[statuses('status','VALIDATED IMPORTED FAILED')])
    table('stock_movements', 'item_id ID ->items\nlocation_id ID ->business_locations\nmovement_type V(24)\nquantity_in QTY =0\nquantity_out QTY =0\nunit_cost COST\ngoods_receipt_line_id ID? ->goods_receipt_lines\nwork_order_item_id ID? ->work_order_items\ntransaction_line_id ID? ->transaction_lines\nstock_adjustment_line_id ID? ->stock_adjustment_lines\nmigration_batch_id ID? ->migration_batches\nreversal_of_id ID? ->stock_movements\nposting_key V(191) BINARY\nreason TEXT?\ncreated_by ID ->users\noccurred_at DT', timestamps=False, unique=['posting_key','location_id,opening_item_id'], indexes=['item_id,location_id,occurred_at,id'], generated=[('opening_item_id',ID,"IF(movement_type='OPENING',item_id,NULL)")], checks=['(quantity_in > 0 AND quantity_out = 0) OR (quantity_out > 0 AND quantity_in = 0)', '(goods_receipt_line_id IS NOT NULL)+(work_order_item_id IS NOT NULL)+(transaction_line_id IS NOT NULL)+(stock_adjustment_line_id IS NOT NULL)+(migration_batch_id IS NOT NULL)+(reversal_of_id IS NOT NULL)=1', "(movement_type='RECEIPT' AND goods_receipt_line_id IS NOT NULL) OR (movement_type='WO_USAGE' AND work_order_item_id IS NOT NULL) OR (movement_type='POS_SALE' AND transaction_line_id IS NOT NULL) OR (movement_type='ADJUSTMENT' AND stock_adjustment_line_id IS NOT NULL) OR (movement_type='OPENING' AND migration_batch_id IS NOT NULL) OR (movement_type='REVERSAL' AND reversal_of_id IS NOT NULL)","movement_type NOT IN ('ADJUSTMENT','REVERSAL') OR (reason IS NOT NULL AND CHAR_LENGTH(TRIM(reason))>0)"])
    table('idempotency_keys', "user_id ID ->users\noperation V(64)\nidempotency_key V(128) BINARY\nrequest_hash CHAR(64) BINARY\nstatus V(16)\nresponse_status SMALLINT? UNSIGNED\nresponse_body JSON?\nresource_type V(64)?\nresource_id V(100)?\ncompleted_at DT?\nexpires_at DT?", unique=['user_id,operation,idempotency_key'], checks=[statuses('status','PROCESSING COMPLETED'),"status <> 'COMPLETED' OR (completed_at IS NOT NULL AND response_status IS NOT NULL)"])
    # Unsupported uint modifiers are attached explicitly by the builder after parsing.
    for t in TABLES:
        for field in ('year', 'odometer_km', 'response_status', 'last_activity', 'version', 'last_number', 'size_bytes', 'sort_order', 'accepted_rows', 'rejected_rows'):
            t['ddl'] = t['ddl'].replace(f'`{field}` SMALLINT ', f'`{field}` SMALLINT UNSIGNED ').replace(f'`{field}` INT ', f'`{field}` INT UNSIGNED ')
    OUT.mkdir(parents=True, exist_ok=True)
    ddl = '-- MySQL 8.4+, InnoDB. Apply only through scripts/database/manage.py.\n-- payment_allocations/KOR execution intentionally deferred.\nSET NAMES utf8mb4;\nSET time_zone = \'+00:00\';\n\n' + '\n'.join(t['ddl'] for t in TABLES)
    ddl += '\nDELIMITER $$\n'
    for name in ('stock_movements', 'audit_logs', 'work_order_status_history'):
        for action in ('UPDATE', 'DELETE'):
            ddl += f"CREATE TRIGGER `guard_{name}_{action.lower()}` BEFORE {action} ON `{name}` FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Append-only table'; END$$\n"
    ddl += "CREATE TRIGGER `guard_transaction_kor_insert` BEFORE INSERT ON `transactions` FOR EACH ROW BEGIN IF NEW.document_type = 'KOR' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'KOR requires owner decision'; END IF; END$$\n"
    ddl += "CREATE TRIGGER `guard_transaction_final_update` BEFORE UPDATE ON `transactions` FOR EACH ROW BEGIN IF NEW.document_type = 'KOR' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'KOR requires owner decision'; END IF; IF OLD.status IN ('FINAL','CANCELLED') AND NOT (OLD.number <=> NEW.number AND OLD.transaction_type <=> NEW.transaction_type AND OLD.document_type <=> NEW.document_type AND OLD.customer_id <=> NEW.customer_id AND OLD.location_id <=> NEW.location_id AND OLD.work_order_id <=> NEW.work_order_id AND OLD.showroom_inventory_id <=> NEW.showroom_inventory_id AND OLD.transaction_at <=> NEW.transaction_at AND OLD.subtotal <=> NEW.subtotal AND OLD.total <=> NEW.total AND OLD.discount_type <=> NEW.discount_type AND OLD.discount_input <=> NEW.discount_input AND OLD.discount_amount <=> NEW.discount_amount AND OLD.discount_reason <=> NEW.discount_reason AND OLD.receipt_snapshot <=> NEW.receipt_snapshot AND OLD.finalized_at <=> NEW.finalized_at) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Final financial snapshot is immutable'; END IF; IF OLD.status='CANCELLED' AND NEW.status<>'CANCELLED' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cancelled transaction is terminal'; END IF; END$$\n"
    ddl += "CREATE TRIGGER `guard_transaction_delete` BEFORE DELETE ON `transactions` FOR EACH ROW BEGIN IF OLD.status<>'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Financial document cannot be deleted'; END IF; END$$\n"
    for action in ('INSERT','UPDATE','DELETE'):
        reference = 'NEW' if action=='INSERT' else 'OLD'
        ddl += f"CREATE TRIGGER `guard_tx_lines_{action.lower()}` BEFORE {action} ON `transaction_lines` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM transactions WHERE id={reference}.transaction_id AND status IN ('FINAL','CANCELLED')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Final transaction lines are immutable'; END IF; "
        if action=='UPDATE':
            ddl += "IF EXISTS(SELECT 1 FROM transactions WHERE id=NEW.transaction_id AND status IN ('FINAL','CANCELLED')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot move lines into a final transaction'; END IF; "
        ddl += 'END$$\n'
    ddl += 'DELIMITER ;\n'
    (OUT/'001_initial.sql').write_text(ddl, encoding='utf-8', newline='\n')
    (OUT/'catalog.json').write_text(json.dumps([{k:v for k,v in t.items() if k!='ddl'} for t in TABLES],indent=2),encoding='utf-8')
    print(f'Generated {len(TABLES)} tables. Optional KOR allocation table not deployed.')


if __name__ == '__main__':
    build()
