"""Create and verify the two databases directly from the current draw.io LRS.

No PRD tables, seed data, migration journal, extra columns, or schema reset.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import html
import xml.etree.ElementTree as ET

import manage as mysql

SOURCE=mysql.ROOT/'ERD Garasi Hobby Priok.drawio'
OUTPUT=mysql.ROOT/'apps/api/database/erd'
DATABASES={'LRS Servis':'garasi_hobby_servis','LRS Penjualan':'garasi_hobby_showroom'}


def text(value):
    return html.unescape(re.sub('<[^>]+>','',value or '')).strip()


def read_models():
    root=ET.parse(SOURCE).getroot();result={}
    for page,database in DATABASES.items():
        diagram=next(d for d in root.findall('diagram') if d.get('name')==page)
        cells=diagram.findall('.//mxCell');tables={};ids={}
        for cell in cells:
            if 'shape=table;' not in cell.get('style',''):continue
            name=text(cell.get('value')).lower()
            if not re.fullmatch('[a-z_]+',name):raise ValueError('Unsafe diagram table name')
            fields=[]
            for row in cells:
                if row.get('parent')!=cell.get('id'):continue
                values=[text(c.get('value')) for c in cells if c.get('parent')==row.get('id')]
                if not values:continue
                typ,col,key=values
                if not re.fullmatch('[a-z_]+',col):raise ValueError('Unsafe diagram column name')
                fields.append({'name':col,'source_type':typ,'key':key})
            tables[name]={'fields':fields,'foreign_keys':{},'unique':[]}
            ids[cell.get('id')]=name
        for name,table in tables.items():
            for field in table['fields']:
                if field['key']=='FK':
                    candidates=[(other, f['name']) for other,t in tables.items() for f in t['fields'] if f['key']=='PK' and f['name']==field['name']]
                    if len(candidates)!=1:raise ValueError(f'Ambiguous foreign key {name}.{field["name"]}')
                    table['foreign_keys'][field['name']]=candidates[0]
                elif field['key']=='UK':table['unique'].append(field['name'])
        for cell in cells:
            if cell.get('edge')!='1':continue
            source,target=ids[cell.get('source')],ids[cell.get('target')]
            style=dict(p.split('=',1) for p in cell.get('style','').split(';') if '=' in p)
            # At most one child requires a unique FK in that child: 1:1 and 1:0..1.
            if style.get('endArrow') in {'ERmandOne','ERzeroToOne'}:
                refs=[col for col,(table,pk) in tables[target]['foreign_keys'].items() if table==source]
                if len(refs)!=1:raise ValueError('Cannot identify one-to-one foreign key')
                tables[target]['unique'].append(refs[0])
        result[database]=tables
    return result


def order_tables(tables):
    pending=set(tables);ordered=[]
    while pending:
        ready=sorted(name for name in pending if all(ref[0] in ordered for ref in tables[name]['foreign_keys'].values()))
        if not ready:raise ValueError('Diagram contains circular foreign keys')
        ordered+=ready;pending-=set(ready)
    return ordered


def build():
    models=read_models();OUTPUT.mkdir(parents=True,exist_ok=True)
    for database,tables in models.items():
        lines=['-- Generated strictly from '+SOURCE.name+' / '+next(k for k,v in DATABASES.items() if v==database),
               '-- No DROP, seed data, PRD extensions or migration journal.',
               '-- String width and DECIMAL precision are physical choices; source LRS does not specify them.',
               '-- Each child FK is mandatory. Non-key attributes are required in this initial translation.',
               'SET NAMES utf8mb4;',f'CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;',f'USE `{database}`;','']
        for name in order_tables(tables):
            table=tables[name];defs=[]
            for field in table['fields']:
                typ=field['source_type'];col=field['name'];key=field['key']
                sqltype={'int':'INT','string':'VARCHAR(255)','datetime':'DATETIME','decimal':'DECIMAL(18,2)'}[typ]
                if key in {'PK','FK'}:sqltype='INT UNSIGNED'
                field['sql_type']=sqltype
                defs.append(f'`{col}` {sqltype} NOT NULL'+(' AUTO_INCREMENT' if key=='PK' else ''))
                if key=='PK':defs.append(f'PRIMARY KEY (`{col}`)')
            for col in sorted(set(table['unique'])):defs.append(f'UNIQUE KEY `uq_{name}_{col}` (`{col}`)')
            for col,(target,targetcol) in table['foreign_keys'].items():
                defs.append(f'CONSTRAINT `fk_{name}_{col}` FOREIGN KEY (`{col}`) REFERENCES `{target}` (`{targetcol}`) ON DELETE RESTRICT ON UPDATE RESTRICT')
            lines.append(f'CREATE TABLE `{name}` (\n  '+',\n  '.join(defs)+'\n) ENGINE=InnoDB;\n')
        (OUTPUT/(database+'.sql')).write_text('\n'.join(lines),encoding='utf-8')
    manifest={'source':SOURCE.name,'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'databases':models}
    (OUTPUT/'catalog.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    return models


def verify_database(database,tables):
    actual=set(mysql.query('SHOW TABLES;','admin',database).splitlines())
    if actual!=set(tables):raise RuntimeError(f'{database}: table set differs from ERD')
    for name,table in tables.items():
        cols=mysql.query(f"SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE FROM information_schema.columns WHERE table_schema='{database}' AND table_name='{name}' ORDER BY ORDINAL_POSITION;").splitlines()
        if [row.split('\t')[0] for row in cols]!=[f['name'] for f in table['fields']]:raise RuntimeError(f'{database}.{name}: columns differ from ERD')
        for row,field in zip(cols,table['fields']):
            _,actual_type,nullable=row.split('\t')
            if actual_type.lower()!=field['sql_type'].lower() or nullable!='NO':raise RuntimeError(f'{database}.{name}: column type/nullability differs from generated LRS schema')
        expected_pk=[f['name'] for f in table['fields'] if f['key']=='PK']
        pk=mysql.query(f"SELECT COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema='{database}' AND table_name='{name}' AND constraint_name='PRIMARY' ORDER BY ORDINAL_POSITION;").splitlines()
        if pk!=expected_pk:raise RuntimeError('Primary key differs from ERD')
        refs=mysql.query(f"SELECT COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage WHERE table_schema='{database}' AND table_name='{name}' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY COLUMN_NAME;").splitlines()
        expected={f'{col}\t{ref[0]}\t{ref[1]}' for col,ref in table['foreign_keys'].items()}
        if set(refs)!=expected:raise RuntimeError('Foreign key differs from ERD')
        unique=set(mysql.query(f"SELECT COLUMN_NAME FROM information_schema.statistics WHERE table_schema='{database}' AND table_name='{name}' AND NON_UNIQUE=0 AND INDEX_NAME<>'PRIMARY';").splitlines())
        if unique!=set(table['unique']):raise RuntimeError('Unique keys differ from ERD/cardinality')
        engine=mysql.query(f"SELECT ENGINE FROM information_schema.tables WHERE table_schema='{database}' AND table_name='{name}';")
        if engine!='InnoDB':raise RuntimeError('Unexpected storage engine')
    return {'database':database,'table_count':len(actual),'tables':sorted(actual),'columns_pk_fk_unique_engine':'PASS'}


def apply():
    models=build();report=[]
    for database,tables in models.items():
        existing=mysql.query(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='{database}';")
        if existing!='0':
            # Never reset an existing database; allow an exact already-applied model only.
            report.append(verify_database(database,tables));continue
        mysql.query((OUTPUT/(database+'.sql')).read_text(encoding='utf-8'))
        report.append(verify_database(database,tables))
        print(f'Created {database}: {len(tables)} tables, exactly from draw.io LRS.')
    configure_accounts()
    (OUTPUT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('No old database or existing data was deleted. No extra technical table was added.')


def configure_accounts():
    """Keep service accounts scoped to the two ERD databases, including old grants."""
    allowed=set(DATABASES.values())
    roles={'gh_app':'SELECT,INSERT,UPDATE,DELETE','gh_migrate':'ALL PRIVILEGES','gh_backup':'SELECT,SHOW VIEW','gh_viewer':'SELECT,SHOW VIEW'}
    for user,rights in roles.items():
        if mysql.query(f"SELECT COUNT(*) FROM mysql.user WHERE User='{user}' AND Host='127.0.0.1';")!='1':continue
        grantee=f"\"'{user}'@'127.0.0.1'\""
        scope=set(mysql.query(f"SELECT TABLE_SCHEMA FROM information_schema.schema_privileges WHERE GRANTEE={grantee} UNION SELECT TABLE_SCHEMA FROM information_schema.table_privileges WHERE GRANTEE={grantee} UNION SELECT TABLE_SCHEMA FROM information_schema.column_privileges WHERE GRANTEE={grantee};").splitlines())
        global_count=mysql.query(f"SELECT COUNT(*) FROM information_schema.user_privileges WHERE GRANTEE={grantee} AND PRIVILEGE_TYPE<>'USAGE';")
        grants=mysql.query(f"SHOW GRANTS FOR '{user}'@'127.0.0.1';")
        if scope-allowed or global_count!='0' or 'WITH GRANT OPTION' in grants:
            mysql.query(f"REVOKE ALL PRIVILEGES, GRANT OPTION FROM '{user}'@'127.0.0.1';")
        for database in allowed:mysql.query(f"GRANT {rights} ON `{database}`.* TO '{user}'@'127.0.0.1';")
        limit=5 if user=='gh_viewer' else 10
        mysql.query(f"ALTER USER '{user}'@'127.0.0.1' REQUIRE SSL WITH MAX_USER_CONNECTIONS {limit} FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1;")


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['build','apply','verify'])
    command=parser.parse_args().command
    if command=='build':build()
    elif command=='apply':apply()
    else:
        models=build()
        for database,tables in models.items():print(json.dumps(verify_database(database,tables)))
