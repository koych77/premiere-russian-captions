import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import av
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'engine'))
from render_video import png_frames


class RendererTest(unittest.TestCase):
    def test_png_to_alpha_movie(self):
        pixels = np.zeros((48, 64, 4), dtype=np.uint8)
        pixels[10:30, 10:30] = [40, 120, 200, 180]
        codec = av.CodecContext.create('png', 'w')
        codec.width, codec.height, codec.pix_fmt = 64, 48, 'rgba'
        png = b''.join(bytes(p) for p in codec.encode(av.VideoFrame.from_ndarray(pixels, format='rgba')))
        with tempfile.TemporaryDirectory() as tmp:
            movie = Path(tmp) / 'тест с пробелом.mov'
            subprocess.run([sys.executable, str(ROOT / 'engine' / 'render_video.py'), str(movie), '25', '64', '48'], input=png * 3, check=True)
            with av.open(str(movie)) as result:
                frames = list(result.decode(video=0))
                self.assertEqual(len(frames), 3)
                self.assertEqual(result.streams.video[0].average_rate, 25)
                np.testing.assert_array_equal(frames[0].to_ndarray(format='rgba'), pixels)

    def test_truncated_input_fails(self):
        with self.assertRaises(ValueError):
            list(png_frames(io.BytesIO(b'\x89PNG')))


if __name__ == '__main__':
    unittest.main()
