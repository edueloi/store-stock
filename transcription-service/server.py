"""Transcrição local de áudios do WhatsApp. Não usa APIs pagas nem grava os áudios."""
from __future__ import annotations

import hmac
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BYTES = 10 * 1024 * 1024
MAX_SECONDS = 300
SAMPLE_RATE = 16000
MAX_TRANSCRIPT = 12000
MODEL_PATH = os.environ.get("WHISPER_MODEL_PATH", "/var/www/store-boxsys-transcription/models/small")
MODEL_LOCK = threading.Lock()
REQUEST_SLOTS = threading.BoundedSemaphore(4)


class AudioError(Exception):
    def __init__(self, code: str, status: int = 422):
        self.code, self.status = code, status


def decode_audio_limited(data: bytes):
    """Decodifica em memória e interrompe áudios que excedam cinco minutos reais."""
    import av
    import numpy as np

    try:
        chunks, samples = [], 0
        with av.open(io.BytesIO(data), mode="r") as container:
            if not container.streams.audio:
                raise AudioError("invalid_audio")
            resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
            for frame in container.decode(audio=0):
                for converted in resampler.resample(frame):
                    chunk = converted.to_ndarray().reshape(-1)
                    samples += len(chunk)
                    if samples > MAX_SECONDS * SAMPLE_RATE:
                        raise AudioError("too_long", 413)
                    chunks.append(chunk)
            for converted in resampler.resample(None):
                chunk = converted.to_ndarray().reshape(-1)
                samples += len(chunk)
                if samples > MAX_SECONDS * SAMPLE_RATE:
                    raise AudioError("too_long", 413)
                chunks.append(chunk)
        if not chunks or not samples:
            raise AudioError("no_speech")
        return np.concatenate(chunks).astype(np.float32) / 32768.0
    except AudioError:
        raise
    except Exception:
        raise AudioError("invalid_audio") from None


def transcribe_audio(data: bytes, model) -> dict:
    audio = decode_audio_limited(data)
    segments, _ = model.transcribe(
        audio, language="pt", beam_size=3, best_of=1, temperature=0,
        condition_on_previous_text=False, vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )
    text = " ".join(segment.text.strip() for segment in segments).strip()
    if not text:
        raise AudioError("no_speech")
    if len(text) > MAX_TRANSCRIPT:
        raise AudioError("too_long", 413)
    return {"text": text, "language": "pt", "duration": round(len(audio) / SAMPLE_RATE, 2), "engine": "faster-whisper-local"}


def handler_class(model, token: str):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(25)

        def log_message(self, *_):
            # Não registra conteúdo de voz, telefone, transcrição ou credenciais.
            pass

        def respond(self, status: int, payload: dict):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            try:
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            if self.path == "/health":
                self.respond(200, {"ok": True, "engine": "faster-whisper-local", "model": "small", "ready": True})
            else:
                self.respond(404, {"error": "not_found"})

        def do_POST(self):
            if self.path != "/transcribe":
                self.respond(404, {"error": "not_found"})
                return
            if not hmac.compare_digest(self.headers.get("x-internal-token", "").encode(), token.encode()):
                self.respond(401, {"error": "unauthorized"})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                size = 0
            if size <= 0 or size > MAX_BYTES:
                self.respond(413, {"error": "too_large"})
                return
            if not REQUEST_SLOTS.acquire(blocking=False):
                self.respond(503, {"error": "busy"})
                return
            try:
                data = self.rfile.read(size)
                if len(data) != size:
                    raise AudioError("invalid_audio")
                if not MODEL_LOCK.acquire(timeout=90):
                    raise AudioError("busy", 503)
                try:
                    result = transcribe_audio(data, model)
                finally:
                    MODEL_LOCK.release()
                self.respond(200, result)
            except AudioError as error:
                self.respond(error.status, {"error": error.code})
            except Exception:
                print("transcription_request_failed", flush=True)
                self.respond(500, {"error": "transcription_failed"})
            finally:
                REQUEST_SLOTS.release()

    return Handler


def main():
    from faster_whisper import WhisperModel
    token = os.environ.get("BAILEYS_INTERNAL_TOKEN", "")
    if not token:
        raise RuntimeError("BAILEYS_INTERNAL_TOKEN precisa estar configurado.")
    model = WhisperModel(
        MODEL_PATH, device="cpu", compute_type="int8", local_files_only=True,
        cpu_threads=int(os.environ.get("WHISPER_CPU_THREADS", "2")), num_workers=1,
    )
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("TRANSCRIPTION_PORT", "3032"))), handler_class(model, token))
    server.daemon_threads = True
    print("local_transcription_ready", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
