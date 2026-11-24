"""Makes the English audio files for every word and example sentence of the course.
Uses the Piper voice en_US-ljspeech-medium (LJ Speech is public domain). Run from the repo root:
  python3 -m venv pv && pv/bin/pip install piper-tts && pv/bin/python scripts/course/tts.py /path/to/en_US-ljspeech-medium.onnx
Files are written to public/audio/<id>.mp3, where id = first 12 hex of sha1(text.strip().lower()) (same rule as src/lib/audio-id.ts)."""
import hashlib, json, os, subprocess, sys, tempfile, wave
from piper import PiperVoice

def audio_id(t): return hashlib.sha1(t.strip().lower().encode()).hexdigest()[:12]

model = sys.argv[1]
data = json.load(open("src/lib/server/learn/data/lessons.json"))
texts = []
for l in data["lessons"]:
    for w in l["words"]:
        texts += [w["en"], w["ex"]]
texts = list(dict.fromkeys(t.strip() for t in texts))
os.makedirs("public/audio", exist_ok=True)
voice = PiperVoice.load(model)
made = 0
for t in texts:
    out = f"public/audio/{audio_id(t)}.mp3"
    if os.path.exists(out): continue
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: tmp = f.name
    with wave.open(tmp, "wb") as w: voice.synthesize_wav(t, w)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-ar", "22050", "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse", "-c:a", "libmp3lame", "-b:a", "40k", out], check=True)
    os.unlink(tmp); made += 1
print("texts", len(texts), "new files", made)
