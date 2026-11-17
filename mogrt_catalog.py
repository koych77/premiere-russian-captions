"""Read only the public definition and thumbnail from locally selected MOGRTs."""
import base64
import json
from pathlib import Path
import sys
import zipfile

def localized(value):
    entries = value.get('strDB', []) if isinstance(value, dict) else []
    return next((x['str'] for x in entries if x.get('localeString') == 'ru_RU'), entries[0].get('str', '') if entries else '')

def read(path):
    with zipfile.ZipFile(path) as archive:
        entry = archive.getinfo('definition.json')
        if entry.file_size > 8_000_000:
            raise ValueError('Слишком большое описание шаблона')
        data = json.loads(archive.read(entry))
        fields = [{'id': c['id'], 'index': i, 'name': localized(c.get('uiName')), 'sample': localized(c.get('value')), 'font': c.get('fonteditinfo', {}).get('fontEditValue', '')} for i, c in enumerate(data.get('clientControls', [])) if c.get('type') == 6]
        thumb = ''
        if 'thumb.png' in archive.namelist() and archive.getinfo('thumb.png').file_size < 3_000_000:
            thumb = 'data:image/png;base64,' + base64.b64encode(archive.read('thumb.png')).decode('ascii')
        return {'path': str(path), 'name': path.stem, 'fields': fields, 'thumbnail': thumb}

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    paths = []
    for arg in sys.argv[1:]:
        p = Path(arg)
        paths.extend(p.rglob('*.mogrt') if p.is_dir() else [p])
    results = []
    for p in dict.fromkeys(paths):
        try:
            results.append(read(p))
        except Exception as exc:
            results.append({'path': str(p), 'name': p.stem, 'fields': [], 'error': str(exc)})
    print(json.dumps(results, ensure_ascii=False))
