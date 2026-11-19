"""Exercise the Laravel pilot through two HTTP workers and an isolated MySQL test database."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from http.cookiejar import CookieJar
import base64
import json
import os
import secrets
import socket
import subprocess
from threading import Barrier
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from uuid import uuid4

import manage as mysql
import pilot

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==')


class Client:
    def __init__(self, port):
        self.base = f'http://127.0.0.1:{port}/pilot/api/'
        self.open = build_opener(HTTPCookieProcessor(CookieJar())).open
        self.csrf = None

    def request(self, path, data=None, *, status=200, method=None, content_type='application/json'):
        headers = {'Accept': 'application/json'}
        if self.csrf:
            headers['X-CSRF-TOKEN'] = self.csrf
        if data is not None:
            headers['Content-Type'] = content_type
            if not isinstance(data, bytes):
                data = json.dumps(data).encode()
        request = Request(self.base + path, data=data, headers=headers, method=method)
        try:
            response = self.open(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            assert response.status == status, (path, response.status, raw[:350])
            if 'application/json' in response.headers.get('Content-Type', ''):
                return json.loads(raw)
            return raw

    def login(self, email, password):
        session = self.request('session')
        assert session['user'] is None
        self.csrf = session['csrf']
        active = self.request('session', {'email': email, 'password': password})
        self.csrf = active['csrf']
        return active['user']

    def photo(self, path, kind):
        boundary = uuid4().hex
        body = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n{kind}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="photo.png"\r\n'
            'Content-Type: image/png\r\n\r\n'
        ).encode() + PNG + f'\r\n--{boundary}--\r\n'.encode()
        self.request(path + '/photos', body, content_type='multipart/form-data; boundary=' + boundary)


def start_server(stack, settings):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    command = [*pilot.php_command(), '-S', f'127.0.0.1:{port}', '-t', 'public', 'public/index.php']
    process = subprocess.Popen(
        command, cwd=pilot.API, env=os.environ | settings | {'APP_ENV': 'local'},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    def stop():
        process.terminate()
        process.wait(timeout=10)

    stack.callback(stop)
    for _ in range(40):
        try:
            Client(port).request('session')
            return port
        except URLError:
            time.sleep(.125)
    raise RuntimeError('Pilot HTTP server did not start')


def account(tag, role, schema):
    email = f'{role}-{tag}@example.test'
    password = secrets.token_hex(16)
    result = subprocess.run(
        [*pilot.php_command(), '-r', '$password = stream_get_contents(STDIN); echo password_hash($password, PASSWORD_BCRYPT);'],
        input=password, text=True, capture_output=True, check=True,
    )
    password_hash = result.stdout.strip()
    assert password_hash.startswith('$2y$') and len(password_hash) == 60
    mysql.query(
        'INSERT INTO users (name, email, password, role, created_at, updated_at) '
        f"VALUES ('Uji {role}', '{email}', '{password_hash}', '{role}', NOW(), NOW());",
        database=schema,
    )
    return email, password


def run_test():
    settings = pilot.setup(test=True)
    schema = settings['DB_DATABASE']
    assert schema == 'garasi_hobby_pilot_test'
    tag = uuid4().hex[:14]
    owner_account = account(tag, 'owner', schema)
    staff_account = account(tag, 'bengkel', schema)
    stock_account = account(tag, 'gudang', schema)

    with ExitStack() as stack:
        first = start_server(stack, settings)
        second = start_server(stack, settings)
        guest = Client(first)
        guest.request('catalog', status=401)
        guest.request('session', {'email': owner_account[0], 'password': owner_account[1]}, status=419)

        owner, staff, warehouse = Client(first), Client(second), Client(second)
        assert owner.login(*owner_account)['role'] == 'owner'
        assert staff.login(*staff_account)['canReceive'] is False
        assert warehouse.login(*stock_account)['canWork'] is False
        warehouse.request('work-orders', status=403)
        staff.request('receipts', status=403)

        supplier = owner.request('suppliers', {'name': 'Pemasok '+tag}, status=201)['id']

        def item(kind, code, price):
            return owner.request('items', {
                'kind': kind, 'code': code+'-'+tag, 'name': code+' '+tag,
                'unit': 'unit', 'price': price,
            }, status=201)['id']

        part = item('part', 'Oli', 9000)
        service = item('service', 'Jasa', 32000)
        customer = staff.request('customers', {'name': 'Pelanggan '+tag}, status=201)['id']
        vehicle = staff.request('vehicles', {
            'customer_id': customer, 'model': 'Motor uji', 'frame': 'RANGKA'+tag,
        }, status=201)['id']

        def load_item(client, kind=part):
            return next(row for row in client.request('catalog')['catalog'] if row['id'] == kind)

        assert 'average_cost' not in load_item(staff)
        assert 'average_cost' not in load_item(warehouse) and 'price' not in load_item(warehouse)

        def receive(quantity, units, cost, expected_before, expected_after, average):
            draft = {'request_id': str(uuid4()), 'supplier_id': supplier, 'reference': 'Uji '+tag,
                     'lines': [{'catalog_id': part, 'quantity': quantity, 'units_per_package': units, 'package_cost': cost}]}
            receipt = warehouse.request('receipts', draft, status=201)['id']
            assert warehouse.request('receipts', draft, status=201)['id'] == receipt
            assert load_item(owner)['balance'] == expected_before
            for _ in range(2):
                warehouse.request(f'receipts/{receipt}/finalize', {})
            entry = load_item(owner)
            assert entry['balance'] == expected_after and entry['average_cost'] == average

        def make_work(client):
            data = {'request_id': str(uuid4()), 'vehicle_id': vehicle, 'complaint': 'Ganti oli'}
            work_id = client.request('work-orders', data, status=201)['id']
            assert client.request('work-orders', data, status=201)['id'] == work_id
            work = f'work-orders/{work_id}'
            lines = [{'catalog_id': key, 'quantity': 1} for key in (part, service)]
            data = {'version': 0, 'inspection': 'Oli perlu diganti', 'mechanic': 'Mekanik uji', 'lines': lines}
            estimate = client.request(work+'/estimate', data)
            client.request(work+'/estimate', data, status=409)
            return work, estimate['version']

        def approve(client, work, version):
            client.request(work+'/approval', {'version': version, 'name': 'Pelanggan uji', 'decision': 'disetujui', 'method': 'telepon'})

        receive(2, 2, 8000, 0, 4, 4000)
        receive(1, 1, 7000, 4, 5, 4600)
        work, version = make_work(staff)
        staff.request(work+'/issue', {'version': version}, status=409)
        approve(staff, work, version)
        staff.request(work+'/issue', {'version': version}, status=409)
        staff.photo(work, 'umum')
        staff.photo(work, 'masalah')
        photo_id = staff.request(work)['photos'][0]['id']
        guest.request(f'{work}/photos/{photo_id}', status=401)
        warehouse.request(f'{work}/photos/{photo_id}', status=403)
        assert staff.request(f'{work}/photos/{photo_id}') == PNG

        for _ in range(2):
            assert staff.request(work+'/issue', {'version': version})['status'] == 'Dikerjakan'
        assert load_item(owner)['balance'] == 4
        staff.request(work+'/finish', {'version': version, 'actual_confirmed': True})
        staff.request(work+'/handover', {}, status=409)
        payment = {'version': version, 'method': 'transfer', 'received': 41000, 'reference': f'UJI-{tag}'}
        staff.request(work+'/pay', dict(payment, received=40999), status=422)
        note = staff.request(work+'/pay', payment)['number']
        assert staff.request(work+'/pay', payment)['number'] == note
        assert owner.request(work)['invoice']['number'] == note
        assert staff.request(work+'/handover', {})['status'] == 'Selesai'
        assert owner.request(work)['status'] == 'Selesai' and load_item(owner)['balance'] == 4

        first_work, first_version = make_work(owner)
        second_work, second_version = make_work(staff)
        for client, key, revision in [(owner, first_work, first_version), (staff, second_work, second_version)]:
            detail = client.request(key)
            request = {'version': revision, 'inspection': 'Sesuaikan jumlah', 'mechanic': 'Mekanik uji', 'lines': [
                {'catalog_id': part, 'quantity': 4},
                {'catalog_id': service, 'quantity': 1},
            ]}
            revision = client.request(key+'/estimate', request)['version']
            assert detail['version'] + 1 == revision
            approve(client, key, revision)
            client.photo(key, 'umum')
            client.photo(key, 'masalah')

        barrier = Barrier(2)

        def issue(client, key, revision):
            barrier.wait(timeout=10)
            return client.request(key+'/issue', {'version': revision + 1})['status']

        with ThreadPoolExecutor(max_workers=2) as threads:
            a = threads.submit(issue, owner, first_work, first_version)
            b = threads.submit(issue, staff, second_work, second_version)
            outcomes = [a.result(), b.result()]
        assert Counter(outcomes) == {'Dikerjakan': 1, 'Menunggu Barang': 1}
        assert load_item(owner)['balance'] == 0
        winner = first_work if outcomes[0] == 'Dikerjakan' else second_work
        loser = second_work if winner == first_work else first_work
        owner.request(winner+'/cancel', {'reason': 'Barang kembali'}, status=409)
        for _ in range(2):
            assert owner.request(winner+'/cancel', {'reason': 'Barang kembali', 'returned': True})['status'] == 'Dibatalkan'
        assert load_item(owner)['balance'] == 4
        assert staff.request(loser+'/issue', {'version': 2})['status'] == 'Dikerjakan'
        assert load_item(owner)['balance'] == 0

        assert owner.request('session', method='DELETE')['user'] is None
        owner.request('catalog', status=401)

    print('PASS login, CSRF, roles, private photos, receipt conversion/WAC, revisions, idempotent stock/payment, invoice, handover, concurrent stock, waiting, reversal.')


if __name__ == '__main__':
    run_test()
