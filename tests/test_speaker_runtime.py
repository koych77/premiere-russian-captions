"""Exercise the installed/bundled speaker runtime without network or user audio."""
import argparse
import sys
import tempfile
import wave
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('engine', type=Path)
args = parser.parse_args()
sys.path.insert(0, str(args.engine.resolve()))
from speakers import detect_turns

with tempfile.TemporaryDirectory() as temporary:
    source = Path(temporary) / 'silence.wav'
    with wave.open(str(source), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(bytes(16000 * 2 * 2))
    turns = detect_turns(source, args.engine / 'models' / 'speakers')
    assert not turns, f'Silence must not produce speaker turns: {turns}'
print('PASS: bundled speaker models load; silence produces no turns.')
