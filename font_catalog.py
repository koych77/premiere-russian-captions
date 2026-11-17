"""Read installed Windows OpenType/TrueType families, including user fonts."""
import json
import os
from pathlib import Path
import struct
import winreg


def installed_files():
    system = Path(os.environ.get('WINDIR', r'C:\Windows')) / 'Fonts'
    user = Path(os.environ['LOCALAPPDATA']) / 'Microsoft' / 'Windows' / 'Fonts'
    files = set()
    for folder in (system, user):
        if folder.exists():
            files.update(p.resolve() for p in folder.iterdir() if p.suffix.lower() in ('.ttf', '.otf', '.ttc', '.otc'))
    for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        try:
            with winreg.OpenKey(hive, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts') as key:
                for i in range(winreg.QueryInfoKey(key)[1]):
                    _, value, _ = winreg.EnumValue(key, i)
                    if not isinstance(value, str):
                        continue
                    p = Path(os.path.expandvars(value))
                    candidates = [p] if p.is_absolute() else [system / p, user / p]
                    files.update(p.resolve() for p in candidates if p.is_file())
        except OSError:
            pass
    return sorted(files)


def font_faces(p):
    with p.open('rb') as f:
        header = f.read(12)
        if len(header) != 12:
            return []
        offsets = [0]
        if header[:4] == b'ttcf':
            count = struct.unpack('>I', header[8:12])[0]
            if count > 256:
                return []
            offsets = struct.unpack('>' + 'I' * count, f.read(count * 4))
        result = []
        for offset in offsets:
            f.seek(offset)
            sfnt = f.read(12)
            if sfnt[:4] not in (b'\0\1\0\0', b'OTTO', b'true'):
                continue
            count = struct.unpack('>H', sfnt[4:6])[0]
            if count > 256:
                continue
            tables = {}
            for _ in range(count):
                tag, _, pos, size = struct.unpack('>4sIII', f.read(16))
                tables[tag] = (pos, size)
            if b'name' not in tables:
                continue
            pos, size = tables[b'name']
            if size > 2_000_000:
                continue
            f.seek(pos)
            data = f.read(size)
            _, records, strings = struct.unpack('>HHH', data[:6])
            names = {}
            for i in range(records):
                platform, encoding, lang, name_id, length, start = struct.unpack('>HHHHHH', data[6+i*12:18+i*12])
                if name_id not in (1, 2, 4, 16, 17):
                    continue
                raw = data[strings+start:strings+start+length]
                try:
                    text = raw.decode('utf-16-be' if platform in (0, 3) else 'mac_roman').strip('\0 ').strip()
                except UnicodeError:
                    continue
                priority = (4 if platform == 3 else 2 if platform == 0 else 0) + (2 if lang in (0, 0x409) else 0)
                if text and (name_id not in names or priority > names[name_id][0]):
                    names[name_id] = (priority, text)
            family = names.get(16, names.get(1, (0, '')))[1]
            if not family or family.startswith('@'):
                continue
            style = names.get(17, names.get(2, (0, 'Regular')))[1]
            weight = 700 if 'bold' in style.lower() else 400
            if b'OS/2' in tables:
                f.seek(tables[b'OS/2'][0] + 4)
                weight = struct.unpack('>H', f.read(2))[0]
            result.append({'family': family, 'fullName': names.get(4, (0, family))[1], 'style': style,
                           'weight': max(100, min(900, weight)), 'italic': any(x in style.lower() for x in ('italic', 'oblique')),
                           'path': str(p), 'collection': header[:4] == b'ttcf', 'modified': p.stat().st_mtime_ns})
        return result


def catalog():
    families = {}
    errors = 0
    for p in installed_files():
        try:
            for face in font_faces(p):
                families.setdefault(face['family'], []).append(face)
        except (OSError, ValueError, struct.error):
            errors += 1
    return {'families': [{'name': name, 'faces': faces} for name, faces in sorted(families.items(), key=lambda item: item[0].casefold())], 'unreadable': errors}


if __name__ == '__main__':
    print(json.dumps(catalog(), ensure_ascii=False))
