"""Fetch pinned public model artifacts into a build payload, verifying SHA-256."""
import hashlib
from pathlib import Path
import shutil
import tarfile
import urllib.request

BASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/'


def download(url, target, digest):
    if not target.exists():
        partial = target.with_suffix(target.suffix + '.partial')
        urllib.request.urlretrieve(url, partial)
        if hashlib.sha256(partial.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Speaker model download failed SHA-256 verification')
        partial.replace(target)
    if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
        raise RuntimeError(f'Invalid speaker model artifact: {target.name}')


def prepare(destination, cache):
    destination, cache = Path(destination), Path(cache)
    destination.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    archive = cache / 'segmentation.tar.bz2'
    download(BASE + 'speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2',
             archive, '24615ee884c897d9d2ba09bb4d30da6bb1b15e685065962db5b02e76e4996488')
    # Extract known regular members only; never expand arbitrary archive paths.
    with tarfile.open(archive) as bundle:
        for source, target in [('model.onnx', 'segmentation.onnx'), ('LICENSE', 'SEGMENTATION-LICENSE')]:
            member = bundle.getmember('sherpa-onnx-pyannote-segmentation-3-0/' + source)
            if not member.isfile():
                raise RuntimeError('Unexpected model archive member')
            with bundle.extractfile(member) as data, (destination / target).open('wb') as out:
                shutil.copyfileobj(data, out)
    embedding = cache / 'embedding.onnx'
    download(BASE + 'speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx',
             embedding, '1a331345f04805badbb495c775a6ddffcdd1a732567d5ec8b3d5749e3c7a5e4b')
    shutil.copy2(embedding, destination / 'embedding.onnx')
    license_file = Path(__file__).resolve().parents[1] / 'licenses' / '3D-Speaker-LICENSE'
    shutil.copy2(license_file, destination / license_file.name)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('destination', type=Path)
    parser.add_argument('--cache', type=Path, default=Path('build/speakers'))
    args = parser.parse_args()
    prepare(args.destination, args.cache)
