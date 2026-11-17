"""Encode concatenated PNG frames without an external FFmpeg executable."""
import argparse
from fractions import Fraction
import io
import struct
import sys
import av


def read_exact(stream, size):
    data = bytearray()
    while len(data) < size:
        chunk = stream.read(size - len(data))
        if not chunk:
            raise ValueError('Incomplete PNG frame')
        data.extend(chunk)
    return bytes(data)


def png_frames(stream):
    while True:
        first = stream.read(1)
        if not first:
            return
        data = bytearray(first + read_exact(stream, 7))
        if data != b'\x89PNG\r\n\x1a\n':
            raise ValueError('Invalid PNG signature')
        while True:
            header = read_exact(stream, 8)
            size = struct.unpack('>I', header[:4])[0]
            if size > 256 * 1024 * 1024:
                raise ValueError('PNG chunk too large')
            data.extend(header)
            data.extend(read_exact(stream, size + 4))
            if header[4:] == b'IEND':
                break
        yield bytes(data)


def render(source, output, fps, width, height):
    rate = Fraction(str(fps)).limit_denominator(1001000)
    count = 0
    with av.open(output, 'w', format='mov') as movie:
        video = movie.add_stream('qtrle', rate=rate)
        video.width, video.height, video.pix_fmt = width, height, 'argb'
        for count, png in enumerate(png_frames(source), 1):
            with av.open(io.BytesIO(png), format='png_pipe') as image:
                frame = next(image.decode(video=0))
            if frame.width != width or frame.height != height:
                raise ValueError('Unexpected frame dimensions')
            frame = frame.reformat(format='argb')
            frame.pts, frame.time_base = count - 1, 1 / rate
            for packet in video.encode(frame):
                movie.mux(packet)
        for packet in video.encode():
            movie.mux(packet)
    if not count:
        raise ValueError('No frames received')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output')
    parser.add_argument('fps')
    parser.add_argument('width', type=int)
    parser.add_argument('height', type=int)
    args = parser.parse_args()
    render(sys.stdin.buffer, args.output, args.fps, args.width, args.height)
