"""Local speaker turns; no account, audio upload or network requests."""
from pathlib import Path


def detect_turns(source, model_dir=None, progress=None):
    import sherpa_onnx
    from faster_whisper.audio import decode_audio
    folder = Path(model_dir or Path(__file__).resolve().parent / 'models' / 'speakers')
    segmentation = folder / 'segmentation.onnx'
    embedding = folder / 'embedding.onnx'
    if not segmentation.is_file() or not embedding.is_file():
        raise RuntimeError('Не установлены модели разделения говорящих. Обновите установку плагина.')
    config = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=str(segmentation)), num_threads=2),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(
            model=str(embedding), num_threads=2),
        clustering=sherpa_onnx.FastClusteringConfig(num_clusters=-1, threshold=0.5),
        min_duration_on=0.2, min_duration_off=0.3)
    if not config.validate():
        raise RuntimeError('Не удалось загрузить модели разделения говорящих.')
    diarizer = sherpa_onnx.OfflineSpeakerDiarization(config)
    samples = decode_audio(str(source), sampling_rate=diarizer.sample_rate)
    if not len(samples):
        return []

    def callback(done, total):
        if progress:
            progress(done / max(1, total))
        return 0

    result = diarizer.process(samples, callback=callback).sort_by_start_time()
    return [{'start': float(t.start), 'end': float(t.end), 'speaker': int(t.speaker)}
            for t in result]


def assign_words(segments, turns):
    """Use maximum temporal overlap, not segment or punctuation guesses."""
    turns = sorted(turns, key=lambda t: t['start'])
    cursor = 0
    for segment in segments:
        for word in segment.get('words') or []:
            start, end = float(word['start']), float(word['end'])
            while cursor < len(turns) and turns[cursor]['end'] < start - 0.25:
                cursor += 1
            candidates = []
            for turn in turns[cursor:]:
                if turn['start'] > end + 0.25:
                    break
                overlap = max(0., min(end, turn['end']) - max(start, turn['start']))
                distance = max(turn['start'] - end, start - turn['end'], 0.)
                candidates.append((overlap, -distance, turn))
            if candidates:
                best = max(candidates, key=lambda entry: (entry[0], entry[1]))
                word['speaker'] = best[2]['speaker']
    return segments
