#!/usr/bin/env python3
"""
piper_server.py — SAM Piper TTS HTTP Server

Run this on your Android device via Termux, or on any machine on your local network.

SETUP (Termux):
    pkg install python
    pip install piper-tts flask
    python piper_server.py --model en_US-amy-medium --port 5000

SETUP (Linux/Mac):
    pip install piper-tts flask
    python piper_server.py --model en_US-amy-medium --port 5000

    Then in SAM Settings:
        Piper Host: <your local IP, e.g. 192.168.1.100>
        Piper Port: 5000
        Enable Piper: ON

API:
    GET  /health                    → {"status": "ok", "model": "..."}
    GET  /models                    → list of available model files
    POST /synthesize                → WAV bytes
    POST /synthesize/stream         → chunked WAV stream (future)

POST /synthesize body:
    {
        "text": "Hello world",
        "model": "en_US-amy-medium",   (optional, uses --model default)
        "speaking_rate": 1.0,          (0.5 – 2.0)
        "noise_scale": 0.667,          (voice texture, 0.0 – 1.0)
        "noise_w": 0.8                 (prosody variation, 0.0 – 1.0)
    }

MODELS:
    Piper model quality tiers:
        x_low   — fastest, smallest, most robotic (~8MB)
        low     — fast, decent quality (~15MB)
        medium  — balanced quality/speed (~30MB) ← RECOMMENDED for SAM
        high    — best quality, slower (~60MB)

    Recommended for SAM (medium quality, English):
        en_US-amy-medium      — female voice, clear, natural
        en_US-ryan-medium     — male voice, warm
        en_GB-alan-medium     — British male, articulate
        en_IN-cori-high       — Indian English female (ideal for en-IN locale)

    Download models:
        pip install piper-tts
        python -c "from piper import PiperVoice; PiperVoice.load('en_US-amy-medium')"
        (auto-downloads to ~/.local/share/piper/)
"""

import argparse
import io
import json
import os
import sys
import wave
import time
import threading
from pathlib import Path

try:
    from flask import Flask, request, Response, jsonify
    from piper import PiperVoice
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install piper-tts flask")
    sys.exit(1)

# ─────────────────────────────────────────────
# Argument parsing
# ─────────────────────────────────────────────

parser = argparse.ArgumentParser(description="SAM Piper TTS Server")
parser.add_argument("--model",  default="en_US-amy-medium", help="Piper model name or path")
parser.add_argument("--host",   default="0.0.0.0",          help="Bind host (0.0.0.0 for all interfaces)")
parser.add_argument("--port",   default=5000, type=int,     help="Port number")
parser.add_argument("--cuda",   action="store_true",         help="Use CUDA GPU if available")
args = parser.parse_args()

# ─────────────────────────────────────────────
# Flask app
# ─────────────────────────────────────────────

app = Flask(__name__)

# Thread lock: Piper is not thread-safe; serialize synthesis requests
synthesis_lock = threading.Lock()

# Lazy-loaded voice (loaded on first synthesis request or at startup)
voice = None
active_model = None

# ─────────────────────────────────────────────
# Model loading
# ─────────────────────────────────────────────

def load_voice(model_name: str) -> PiperVoice:
    """Load a Piper voice model, downloading if necessary."""
    global voice, active_model
    if voice is not None and active_model == model_name:
        return voice

    print(f"[SAM Piper] Loading model: {model_name} ...")
    start = time.time()
    try:
        voice = PiperVoice.load(model_name, use_cuda=args.cuda)
        active_model = model_name
        elapsed = time.time() - start
        print(f"[SAM Piper] Model loaded in {elapsed:.2f}s — ready.")
        return voice
    except Exception as e:
        print(f"[SAM Piper] Failed to load model '{model_name}': {e}")
        raise

# ─────────────────────────────────────────────
# Synthesis helper
# ─────────────────────────────────────────────

def synthesize_to_wav(text: str,
                       model_name: str,
                       speaking_rate: float = 1.0,
                       noise_scale: float = 0.667,
                       noise_w: float = 0.8) -> bytes:
    """Synthesize text to WAV bytes."""

    # Build synthesis configuration
    synthesis_config = {
        "length_scale": 1.0 / max(0.1, speaking_rate),  # Piper uses length_scale (inverse of speed)
        "noise_scale":  noise_scale,
        "noise_w":      noise_w,
    }

    v = load_voice(model_name)

    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        v.synthesize(text, wav_file, **synthesis_config)

    wav_buffer.seek(0)
    return wav_buffer.read()

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": active_model or args.model,
        "cuda": args.cuda,
        "version": "1.0.0"
    })

@app.route("/models", methods=["GET"])
def list_models():
    """List available .onnx model files."""
    model_dirs = [
        Path.home() / ".local" / "share" / "piper",
        Path("/data/data/com.termux/files/home/.local/share/piper"),  # Termux path
        Path("."),
    ]
    found = []
    for d in model_dirs:
        if d.exists():
            for f in d.glob("*.onnx"):
                found.append(str(f.stem))
    return jsonify({"models": found})

@app.route("/synthesize", methods=["POST"])
def synthesize():
    """
    Synthesize text to WAV.
    Body: { "text": str, "model": str?, "speaking_rate": float?, "noise_scale": float?, "noise_w": float? }
    Response: audio/wav
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        text = data.get("text", "").strip()

        if not text:
            return jsonify({"error": "text is required"}), 400

        model_name   = data.get("model",         args.model)
        speaking_rate = float(data.get("speaking_rate", 1.0))
        noise_scale  = float(data.get("noise_scale",  0.667))
        noise_w      = float(data.get("noise_w",      0.8))

        # Clamp to valid ranges
        speaking_rate = max(0.3, min(3.0, speaking_rate))
        noise_scale   = max(0.0, min(1.0, noise_scale))
        noise_w       = max(0.0, min(1.0, noise_w))

        print(f"[SAM Piper] Synthesize: '{text[:60]}' "
              f"rate={speaking_rate} noise={noise_scale} nw={noise_w}")

        start = time.time()
        with synthesis_lock:
            wav_bytes = synthesize_to_wav(text, model_name, speaking_rate, noise_scale, noise_w)
        elapsed = time.time() - start

        print(f"[SAM Piper] Done in {elapsed*1000:.0f}ms — {len(wav_bytes)} bytes")

        return Response(
            wav_bytes,
            mimetype="audio/wav",
            headers={
                "X-Synthesis-Time-Ms": str(int(elapsed * 1000)),
                "X-Text-Length": str(len(text)),
            }
        )

    except Exception as e:
        print(f"[SAM Piper] Synthesis error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/synthesize/stream", methods=["POST"])
def synthesize_stream():
    """
    Streaming synthesis — returns audio chunks as they are generated.
    Reduces time-to-first-audio for long texts.
    FUTURE: Android app will support this in a later phase.
    """
    return jsonify({"error": "Streaming not yet implemented. Use /synthesize."}), 501

# ─────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════╗
║        SAM Piper TTS Server v1.0             ║
║  Model: {args.model:<36}║
║  Host:  {args.host}:{args.port:<27}  ║
║  CUDA:  {'YES' if args.cuda else 'NO':<40}  ║
╚══════════════════════════════════════════════╝
""")

    # Preload model at startup to avoid first-request latency
    try:
        load_voice(args.model)
    except Exception as e:
        print(f"Warning: Could not preload model: {e}")
        print("Model will be loaded on first request.")

    print(f"[SAM Piper] Server listening on http://{args.host}:{args.port}")
    print(f"[SAM Piper] Health check: http://127.0.0.1:{args.port}/health")
    print("[SAM Piper] Press Ctrl+C to stop.")

    app.run(
        host=args.host,
        port=args.port,
        debug=False,
        threaded=False,  # Single-threaded: synthesis_lock handles serialization
        use_reloader=False
    )
