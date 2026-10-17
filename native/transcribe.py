"""Offline only. Called with a validated, extracted local WAV by the host."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import json, sys
from faster_whisper import WhisperModel

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

try:
    model = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
    emit({'stage': 'recognizing'})
    segments, info = model.transcribe(sys.argv[1], beam_size=5, language=None, condition_on_previous_text=False, vad_filter=True)
    output = []
    for s in segments:
        if len(output) >= 600:
            raise ValueError('too many segments')
        text = s.text.strip()
        if not text:
            continue
        output.append({'start': round(s.start, 2), 'end': round(s.end, 2), 'text': text,
                       'uncertain': s.avg_logprob < -0.8 or s.no_speech_prob > 0.4 or s.compression_ratio > 2.4})
        emit({'stage': 'recognizing', 'seconds': round(s.end, 1)})
    if sum(len(s['text']) for s in output) > 30000:
        raise ValueError('too much text')
    emit({'result': {'engine': 'faster-whisper-small-local', 'language': info.language,
                     'languageProbability': info.language_probability, 'segments': output}})
except Exception:
    # Do not print system paths, source text, model logs or account details.
    emit({'error': '离线转写未完成，请检查本地模型和音轨，或补充文字后继续。'})
    sys.exit(1)
