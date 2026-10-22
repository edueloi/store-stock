"""HTTP/autenticação sem dependências; com SAMPLE também testa voz real em português."""
import importlib.util
import io
import json
import os
from pathlib import Path
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import wave

source = Path(os.environ.get("TRANSCRIPTION_SERVER_FILE", Path(__file__).resolve().parents[1] / "transcription-service/server.py"))
spec = importlib.util.spec_from_file_location("local_whatsapp_transcription", source)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class TranscriptionTests(unittest.TestCase):
    def test_http_authentication_limits_and_utf8(self):
        server = worker.ThreadingHTTPServer(("127.0.0.1", 0), worker.handler_class(None, "segredo-de-teste"))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with urlopen(base + "/health") as response:
                self.assertTrue(json.load(response)["ready"])
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(base + "/transcribe", data=b"audio", method="POST"))
            self.assertEqual(error.exception.code, 401)
            error.exception.close()
            with patch.object(worker, "transcribe_audio", return_value={"text": "Quero uma bolsa preta. Ação e conexão."}) as transcribe:
                request = Request(base + "/transcribe", data=b"audio", headers={"x-internal-token": "segredo-de-teste"}, method="POST")
                with urlopen(request) as response:
                    self.assertEqual(json.load(response)["text"], "Quero uma bolsa preta. Ação e conexão.")
                transcribe.assert_called_once()
            with patch.object(worker, "transcribe_audio", side_effect=worker.AudioError("no_speech")):
                with self.assertRaises(HTTPError) as error:
                    urlopen(request)
                self.assertEqual(json.load(error.exception)["error"], "no_speech")
                error.exception.close()
        finally:
            server.shutdown()
            server.server_close()

    @unittest.skipUnless(os.environ.get("TRANSCRIPTION_SAMPLE"), "Teste de voz roda no ambiente com o modelo local")
    def test_real_portuguese_audio_and_silence(self):
        from faster_whisper import WhisperModel
        model = WhisperModel(os.environ["WHISPER_MODEL_PATH"], device="cpu", compute_type="int8", local_files_only=True, cpu_threads=2)
        started = time.monotonic()
        result = worker.transcribe_audio(Path(os.environ["TRANSCRIPTION_SAMPLE"]).read_bytes(), model)
        self.assertIn("bolsa", result["text"].lower())
        self.assertIn("preta", result["text"].lower())
        print(json.dumps({"test_audio_transcript": result["text"], "processing_seconds": round(time.monotonic() - started, 2)}, ensure_ascii=False))
        silence = io.BytesIO()
        with wave.open(silence, "wb") as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(16000)
            output.writeframes(b"\x00\x00" * 16000 * 2)
        with self.assertRaises(worker.AudioError) as error:
            worker.transcribe_audio(silence.getvalue(), model)
        self.assertEqual(error.exception.code, "no_speech")
        too_long = io.BytesIO()
        with wave.open(too_long, "wb") as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(16000)
            output.writeframes(b"\x00\x00" * 16000 * 301)
        with self.assertRaises(worker.AudioError) as error:
            worker.decode_audio_limited(too_long.getvalue())
        self.assertEqual(error.exception.code, "too_long")


if __name__ == "__main__":
    unittest.main()
