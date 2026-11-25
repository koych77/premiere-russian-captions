import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'engine'))
from speakers import assign_words


class SpeakerAssignment(unittest.TestCase):
    def test_max_overlap_and_no_guess_across_silence(self):
        words = [{'word': 'Один', 'start': 0.1, 'end': 0.4},
                 {'word': 'Другой', 'start': 0.8, 'end': 1.2},
                 {'word': 'тишина', 'start': 5., 'end': 6.}]
        turns = [{'start': 0., 'end': .9, 'speaker': 0},
                 {'start': .9, 'end': 2., 'speaker': 1}]
        assign_words([{'words': words}], turns)
        self.assertEqual([w.get('speaker') for w in words], [0, 1, None])
        self.assertEqual(words[1]['start'], .8)

    def test_empty_turns_and_segments(self):
        self.assertEqual(assign_words([], []), [])
        self.assertEqual(assign_words([{'text': 'нет слов'}], []), [{'text': 'нет слов'}])


if __name__ == '__main__':
    unittest.main()
