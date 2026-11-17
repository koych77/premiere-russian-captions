"""Offline Russian subtitles for Premiere, using faster-whisper."""
import argparse
from dataclasses import asdict
import json
import os
from pathlib import Path
import re
import sys
import textwrap
import time

BASE = Path(__file__).resolve().parent
MODEL = BASE / 'models' / 'large-v3-turbo'
DLL_HANDLES = []


def emit(kind, **data):
    print(json.dumps({'type': kind, **data}, ensure_ascii=False), flush=True)


def configure_runtime():
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    portable = BASE / 'runtime' / 'Lib' / 'site-packages' / 'nvidia'
    nvidia = portable if portable.exists() else BASE / 'venv' / 'Lib' / 'site-packages' / 'nvidia'
    for directory in sorted(nvidia.glob('*/bin')):
        os.environ['PATH'] = str(directory) + os.pathsep + os.environ['PATH']
        DLL_HANDLES.append(os.add_dll_directory(str(directory)))


def timestamp(seconds):
    milliseconds = max(0, round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}'


def wrap_caption(text, width):
    return '\n'.join(textwrap.wrap(text, width=width, break_long_words=False,
                                   break_on_hyphens=False))


def captions_for_segment(segment, width):
    words = segment.words or []
    if not words:
        return [(segment.start, segment.end, segment.text.strip())]
    captions = []
    group = []
    for word in words:
        proposed = ''.join(w.word for w in group) + word.word
        if group and (len(wrap_caption(proposed.strip(), width).splitlines()) > 2
                      or word.end - group[0].start > 4.5
                      or word.start - group[-1].end > 0.65):
            captions.append((group[0].start, group[-1].end,
                             wrap_caption(''.join(w.word for w in group).strip(), width)))
            group = []
        group.append(word)
        if re.search(r'[.!?…]$', word.word.strip()):
            captions.append((group[0].start, group[-1].end,
                             wrap_caption(''.join(w.word for w in group).strip(), width)))
            group = []
    if group:
        captions.append((group[0].start, group[-1].end,
                         wrap_caption(''.join(w.word for w in group).strip(), width)))
    return captions


def transcribe(source, output_dir, device='auto', width=32):
    configure_runtime()
    import ctranslate2
    from faster_whisper import WhisperModel
    source = Path(source).resolve()
    output_dir = Path(output_dir).resolve()
    if not source.is_file():
        raise FileNotFoundError(f'Файл не найден: {source}')
    if not (MODEL / 'model.bin').is_file():
        raise FileNotFoundError(f'Не найдена локальная модель: {MODEL}')
    output_dir.mkdir(parents=True, exist_ok=True)
    actual_device = ('cuda' if ctranslate2.get_cuda_device_count() else 'cpu') if device == 'auto' else device
    emit('status', message=f'Загрузка модели — {"видеокарта NVIDIA" if actual_device == "cuda" else "процессор"}…')
    def load_model(target):
        return WhisperModel(str(MODEL), device=target,
                            compute_type='int8_float16' if target == 'cuda' else 'int8',
                            cpu_threads=max(1, min(8, (os.cpu_count() or 4) // 2)),
                            local_files_only=True)
    try:
        model = load_model(actual_device)
    except (RuntimeError, OSError):
        if device != 'auto' or actual_device != 'cuda':
            raise
        emit('status', message='Видеокарта недоступна. Продолжаю на процессоре…')
        actual_device = 'cpu'
        model = load_model(actual_device)
    started = time.monotonic()
    segments, info = model.transcribe(str(source), language='ru', task='transcribe',
        beam_size=5, word_timestamps=True, vad_filter=True,
        vad_parameters={'min_silence_duration_ms': 500},
        condition_on_previous_text=False)
    emit('status', message=f'Распознавание русской речи: {info.duration:.1f} сек.')
    captions, transcript, raw = [], [], []
    for segment in segments:
        captions.extend(captions_for_segment(segment, width))
        transcript.append(segment.text.strip())
        raw.append(asdict(segment))
        emit('progress', percent=min(99, int(segment.end / max(info.duration, 0.001) * 100)),
             message=segment.text.strip())
    if not captions:
        raise RuntimeError('Речь не обнаружена. Проверьте звуковую дорожку выбранного файла.')
    stem = source.stem + '.ru'
    suffix = 0
    while any((output_dir / (stem + extension)).exists() for extension in ('.srt', '.txt', '.json')):
        suffix += 1
        stem = source.stem + f'.ru-{suffix}'
    srt = output_dir / (stem + '.srt')
    txt = output_dir / (stem + '.txt')
    details = output_dir / (stem + '.json')
    entries = []
    last_end = 0.0
    for start, end, text in captions:
        if not text:
            continue
        start = max(start, last_end)
        end = max(end, start + 0.04)
        entries.append(f'{len(entries)+1}\n{timestamp(start)} --> {timestamp(end)}\n{text}\n')
        last_end = end
    srt.write_text('\n'.join(entries), encoding='utf-8-sig')
    txt.write_text('\n'.join(transcript) + '\n', encoding='utf-8-sig')
    details.write_text(json.dumps({'source': str(source), 'language': 'ru',
        'model': 'large-v3-turbo', 'device': actual_device, 'duration': info.duration,
        'segments': raw}, ensure_ascii=False, indent=2), encoding='utf-8')
    emit('done', srt=str(srt), txt=str(txt), captions=len(entries), device=actual_device,
         elapsed=round(time.monotonic() - started, 1))


if __name__ == '__main__':
    if sys.stdout:
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('--output-dir')
    parser.add_argument('--device', choices=['auto', 'cuda', 'cpu'], default='auto')
    parser.add_argument('--width', type=int, default=32)
    args = parser.parse_args()
    try:
        transcribe(args.source, args.output_dir or str(Path(args.source).parent), args.device, args.width)
    except Exception as error:
        emit('error', message=str(error))
        sys.exit(1)
