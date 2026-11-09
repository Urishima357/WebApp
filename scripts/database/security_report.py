"""Summarize completed local audit evidence without credentials or data rows."""
import hashlib
import json
import time
from pathlib import Path
import sys

import manage as db

REPORT=db.ROOT/'docs/database'


def main():
    core=json.loads((REPORT/'security-audit.json').read_text())
    surfaces=json.loads((REPORT/'security-surfaces.json').read_text())
    required={'files','packages','web','recovery','boundaries','network'}
    if set(surfaces.get('sections',[]))!=required:
        raise RuntimeError('Full surface audit required before publishing the combined report')
    cases=[]
    for suite,source in [('core',core),('surfaces',surfaces)]:
        for item in source['cases']:
            cases.append(dict(item,id=f'SEC-{len(cases)+1:04d}',source_id=item['id'],suite=suite))
    sources=[('security-audit.json',core),('security-surfaces.json',surfaces)]
    # A focused regression may replace matching surface cases after a fix,
    # without repeating unrelated package verification or recovery exercises.
    retest_file=REPORT/'security-surfaces-retest.json'
    if retest_file.exists() and retest_file.stat().st_mtime>(REPORT/'security-surfaces.json').stat().st_mtime:
        retest=json.loads(retest_file.read_text())
        if retest['date']!=surfaces['date']:raise RuntimeError('Stale surface regression report')
        sources.append((retest_file.name,retest))
        for item in retest['cases']:
            key=(item['category'],item['case'])
            previous=next((i for i,c in enumerate(cases) if c['suite'].startswith('surfaces') and (c['category'],c['case'])==key),None)
            value=dict(item,source_id=item['id'],suite='surfaces-regression')
            if previous is None:cases.append(value)
            else:cases[previous]=value
    for i,item in enumerate(cases):item['id']=f'SEC-{i+1:04d}'
    summary={s:sum(c['status']==s for c in cases) for s in ('PASS','FAIL','WARN','SKIP')}
    findings=core['findings']+surfaces['findings']
    verified={(c['category'],c['case']):c['status'] for c in cases}
    repairs=[
        ('DBSEC-06','LOW','Configuration path suffixes, repeated slashes and Windows NTFS ADS bypassed the deny rule. The ADS alias served the small config wrapper source, exposing a local include path.','Reject Windows path aliases, repeated leading slashes, double encodings and every config.inc.php suffix before PHP/static routing. The wrapper contains no SQL password; no SQL credential disclosure was observed.',[('http-boundary','Block protected/path traversal '+path) for path in ('/config.inc.php/extra','/config.inc.php::$DATA','//config.inc.php','/%2fconfig.inc.php')]),
        ('DBSEC-07','LOW','Managed CLI helpers verified the CA but did not require the certificate hostname.','Persist VERIFY_IDENTITY after the loopback SAN certificate has been installed.',[('tls',f'Managed {role} helper uses VERIFY_IDENTITY') for role in ('admin','app','backup','migrate')]),
        ('DBSEC-09','MEDIUM','phpMyAdmin signon defaults removed HttpOnly from the signon session cookie.','Explicit SignonCookieParams preserve HttpOnly and SameSite Strict after phpMyAdmin opens the signon session.',[('http-auth','Session cookie is HttpOnly and SameSite Strict')]),
        ('DBSEC-10','LOW','phpMyAdmin overwrote the local no-referrer policy with same-origin.','Apply the local privacy headers through header_register_callback after phpMyAdmin builds its headers.',[('http-headers','Referrer-Policy')]),
    ]
    for identifier,severity,before,repair,checks in repairs:
        findings.append({'id':identifier,'severity':severity,'before':before,'repair':repair,'status':'FIXED' if all(verified.get(k)=='PASS' for k in checks) else 'UNVERIFIED','verified_by':[label for _,label in checks]})
    category={}
    for case in cases:
        item=category.setdefault(case['category'],{s:0 for s in summary})
        item[case['status']]+=1
    state=[]
    for name in db.DATABASES:
        rows=db.query(f"SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='{name}' ORDER BY TABLE_NAME;").splitlines()
        state.append({'database':name,'tables':rows,'table_count':len(rows),'row_count':sum(int(db.query(f'SELECT COUNT(*) FROM `{table}`;',database=name)) for table in rows)})
    residue=int(db.query("SELECT COUNT(*) FROM information_schema.schemata WHERE LEFT(SCHEMA_NAME,4)='sec_';"))
    users=int(db.query("SELECT COUNT(*) FROM mysql.user WHERE LEFT(User,9)='sec_auth_';"))
    result={
        'generated_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
        'status':'OPEN_FINDINGS' if any(f['status']=='OPEN' for f in findings) else 'REVIEW_RESULTS',
        'scope':'Local MySQL ERD databases and local read-only phpMyAdmin; no application API or production infrastructure',
        'summary':summary,'total_cases':len(cases),'category_summary':category,
        'sources':[{'file':file,'run_id':source['run_id'],'date':source['date'],'sha256':hashlib.sha256((REPORT/file).read_bytes()).hexdigest()} for file,source in sources],
        'active_databases':state,'leftover_audit_schemas':residue,'leftover_audit_sql_users':users,
        'findings':sorted(findings,key=lambda f:f['id']),'cases':cases,
        'limits':[
            'Case counts include parameterized checks for individual columns/tables; they are not independent exploit families.',
            'Active tables were empty. Recovery was tested for actual empty backups and populated disposable fixtures.',
            'All test writes used scratch schemas/accounts. Production schemas, existing data, draw.io and frontend were preserved.',
            'No whole-application SQL injection, XSS, business authorization, payment gateway or production penetration test: the API is not implemented.',
            'OS-wide listener visibility was incomplete in this execution environment. MySQL reports loopback binding and expected local connections succeed; remote reachability was not independently tested.',
            'No stress/availability attack, exhaustive fuzzing, binary exploit attempt, external scanning or proof of absence of vulnerabilities.',
            'No absolute security guarantee or approval for production use.',
        ]}
    (REPORT/'security-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'total':len(cases),'summary':summary,'fixed_findings':sum(f['status']=='FIXED' for f in findings),'open_findings':sum(f['status']=='OPEN' for f in findings),'leftover_audit_schemas':residue,'leftover_audit_sql_users':users}))
    return int(summary['FAIL']>0 or residue>0 or users>0)


if __name__=='__main__':sys.exit(main())
