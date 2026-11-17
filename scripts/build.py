"""Build an isolated, relocatable Windows runtime and explicit release payload."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PANEL_FILES = ['index.html', 'style.css', 'core.js', 'renderer.js', 'panel.js',
               'fonts.js', 'font_catalog.py', 'mogrt_catalog.py', 'host.jsx',
               'runtime.js', 'updater.js', 'updates-ui.js', 'release.json']


def build(existing_packages=None):
    if sys.version_info[:2] != (3, 11) or sys.platform != 'win32':
        raise RuntimeError('Build with 64-bit Python 3.11 on Windows')
    stage = ROOT / 'build' / 'payload'
    if stage.exists():
        raise RuntimeError('Use a fresh build/payload directory')
    stage.mkdir(parents=True)
    panel = stage / 'panel'
    panel.mkdir()
    for name in PANEL_FILES:
        shutil.copy2(ROOT / name, panel / name)
    for name in ['lib', 'presets', 'CSXS', 'assets/icons']:
        shutil.copytree(ROOT / name, panel / name)
    for name in ['transcribe.py', 'render_video.py']:
        shutil.copy2(ROOT / 'engine' / name, stage / name)
    for name in ['README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md']:
        shutil.copy2(ROOT / name, stage / name)
    runtime = stage / 'runtime'
    runtime.mkdir()
    archive = ROOT / 'build' / 'python-3.11.9-embed-amd64.zip'
    url = 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip'
    if not archive.exists():
        urllib.request.urlretrieve(url, archive)
    expected = '009d6bf7e3b2ddca3d784fa09f90fe54336d5b60f0e0f305c37f400bf83cfd3b'
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Embedded Python download failed SHA-256 verification')
    with zipfile.ZipFile(archive) as z:
        z.extractall(runtime)
    (runtime / 'python311._pth').write_text('python311.zip\n.\nLib/site-packages\nimport site\n')
    packages = runtime / 'Lib' / 'site-packages'
    if existing_packages:
        shutil.copytree(existing_packages, packages, ignore=shutil.ignore_patterns('__pycache__', 'pip', 'pip-*', 'setuptools', 'setuptools-*', '_distutils_hack', 'pkg_resources', 'distutils-precedence.pth'))
    else:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--only-binary=:all:', '--no-compile',
                        '--target', str(packages), '-r', str(ROOT / 'installer' / 'requirements.lock')], check=True)
    # App-local MSVC runtime; Python ships vcruntime, CTranslate2 needs msvcp.
    msvc = Path(os.environ['WINDIR']) / 'System32' / 'msvcp140.dll'
    shutil.copy2(msvc, runtime / msvc.name)
    subprocess.run([str(runtime / 'python.exe'), '-I', '-c',
                    'import av,ctranslate2,faster_whisper,numpy;print("Portable runtime OK")'], check=True)
    config = json.loads((ROOT / 'release.json').read_text(encoding='utf-8-sig'))
    files = json.loads((ROOT / 'installer' / 'model-files.json').read_text(encoding='utf-8-sig'))
    statements = []
    for item in files:
        url = f"https://huggingface.co/{config['modelRepository']}/resolve/{config['modelRevision']}/{item['name']}"
        statements.append(f"  EnsureModelFile('{item['name']}', '{url}', '{item['sha256']}');")
    (ROOT / 'build' / 'model-downloads.iss').write_text('\n'.join(statements), encoding='utf-8')
    print('Payload ready:', stage)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--existing-packages', type=Path)
    args = parser.parse_args()
    build(args.existing_packages)
