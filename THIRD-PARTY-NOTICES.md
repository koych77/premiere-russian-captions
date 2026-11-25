# Third-party components

The project MIT license covers original plugin code, not third-party components.
The installer retains package metadata, copyright notices and license files in
`runtime/Lib/site-packages/*.dist-info` and the embedded Python LICENSE.txt.

- Adobe CSInterface: Adobe CEP SDK license, retained in `lib/Adobe-CEP-LICENSE.pdf`.
  Source: https://github.com/Adobe-CEP/CEP-Resources
- Tabler icons: MIT, `assets/icons/LICENSE`.
- Python 3.11.9: PSF license; https://www.python.org/downloads/release/python-3119/
- faster-whisper: MIT; https://github.com/SYSTRAN/faster-whisper
- CTranslate2: MIT; https://github.com/OpenNMT/CTranslate2
- Whisper large-v3-turbo: MIT model, downloaded directly from
  https://huggingface.co/mobiuslabsgmbh/faster-whisper-large-v3-turbo
  at the commit in `release.json`; original https://github.com/openai/whisper
- PyAV: BSD; https://github.com/PyAV-Org/PyAV
  FFmpeg libraries and other linked codecs retain their respective licenses.
  Wheel sources/build definitions: https://github.com/PyAV-Org/pyav-wheels
  FFmpeg source: https://ffmpeg.org/download.html
- NVIDIA cuBLAS, CUDA NVRTC and cuDNN: NVIDIA software license terms, retained
  in the respective installed distribution metadata and package directories.
  https://docs.nvidia.com/cuda/eula/index.html
  https://docs.nvidia.com/deeplearning/cudnn/backend/latest/reference/eula.html
- Microsoft Visual C++ runtime: redistributable runtime component;
  https://visualstudio.microsoft.com/license-terms/
- NumPy (BSD), ONNX Runtime (MIT), Hugging Face Hub and Tokenizers (Apache-2.0),
  and transitive dependencies: see the bundled distribution license files.

Exact Python package versions are recorded in `installer/requirements.lock`.
No fonts, user MOGRT templates, Adobe application binaries, project files,
recordings, transcripts or user settings are distributed with this repository.


## Local speaker diarization (3.4.0)

- sherpa-onnx and sherpa-onnx-core 1.12.40: Apache-2.0, https://github.com/k2-fsa/sherpa-onnx . Package license notices remain in the installed runtime.
- pyannote segmentation 3.0, ONNX conversion distributed by sherpa-onnx: MIT, copyright CNRS. Model license is included at models/speakers/SEGMENTATION-LICENSE.
- 3D-Speaker ERes2Net base model, ONNX conversion distributed by sherpa-onnx: Apache-2.0. Source: https://github.com/modelscope/3D-Speaker . License included at models/speakers/3D-Speaker-LICENSE.
- Model artifact URLs and SHA-256 digests: scripts/speaker_models.py. Models run locally and do not transmit audio.
