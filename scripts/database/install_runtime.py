"""Fetch pinned official MySQL, verify SHA-256 and Oracle GPG signature, then extract."""
from pathlib import Path
import hashlib
import os
import shutil
import subprocess
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[2]
TOOLS=ROOT/'.tools'
DOWNLOADS=TOOLS/'downloads'
VERSION='8.4.13'
ARCHIVE=f'mysql-{VERSION}-winx64.zip'
SHA256='e9cd98b1d23f122987b1afca26ad942efec5891481103d48ae3cde237fa3ea54'
FINGERPRINT='BCA43417C3B485DD128EC6D4B7B3B788A8D3785C'


def fetch(url,path):
    if path.exists():
        return
    partial=path.with_suffix(path.suffix+'.partial')
    with urllib.request.urlopen(url,timeout=60) as response, partial.open('wb') as output:
        shutil.copyfileobj(response,output)
    partial.replace(path)


def main():
    DOWNLOADS.mkdir(parents=True,exist_ok=True)
    fetch(f'https://cdn.mysql.com/Downloads/MySQL-8.4/{ARCHIVE}',DOWNLOADS/ARCHIVE)
    fetch(f'https://dev.mysql.com/downloads/gpg/?file={ARCHIVE}&p=23',DOWNLOADS/'mysql.zip.asc')
    fetch('https://repo.mysql.com/RPM-GPG-KEY-mysql-2025',DOWNLOADS/'mysql-build-key.asc')
    with (DOWNLOADS/ARCHIVE).open('rb') as package:
        digest=hashlib.file_digest(package,'sha256').hexdigest()
    if digest!=SHA256:
        raise RuntimeError('Unexpected archive hash; refusing to run or extract it')
    gpg=shutil.which('gpg') or r'C:\Program Files\Git\usr\bin\gpg.exe'
    if not Path(gpg).is_file():
        raise RuntimeError('GnuPG from Git for Windows is required for signature verification')
    home=TOOLS/'gnupg'
    home.mkdir(exist_ok=True)
    def gpg_path(path):
        # Git for Windows ships an MSYS GPG, which expects /d/... rather than D:\...
        value=path.resolve().as_posix()
        if os.name=='nt' and '/git/' in Path(gpg).as_posix().lower():
            value='/'+value[0].lower()+value[2:]
        return value
    common=[gpg,'--homedir',gpg_path(home),'--batch']
    subprocess.run(common+['--import',gpg_path(DOWNLOADS/'mysql-build-key.asc')],check=True,capture_output=True)
    result=subprocess.run(common+['--status-fd','1','--verify',gpg_path(DOWNLOADS/'mysql.zip.asc'),gpg_path(DOWNLOADS/ARCHIVE)],check=True,capture_output=True,text=True)
    if f'[GNUPG:] VALIDSIG {FINGERPRINT} ' not in result.stdout:
        raise RuntimeError('Signature is not from the pinned Oracle signing key')
    destination=TOOLS/f'mysql-{VERSION}-winx64'
    if not destination.exists():
        with zipfile.ZipFile(DOWNLOADS/ARCHIVE) as archive:
            for entry in archive.infolist():
                if not (TOOLS/entry.filename).resolve().is_relative_to(TOOLS.resolve()):
                    raise RuntimeError('Unsafe archive entry')
            archive.extractall(TOOLS)
    print(f'Official MySQL {VERSION} verified: pinned SHA-256 and Oracle GPG signature.')
    print('No system service, global PATH, XAMPP or firewall settings changed.')


if __name__=='__main__':
    main()
