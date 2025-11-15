# backend/core/audio_service.py
import whisper
import os
import traceback
from fastapi import UploadFile
from typing import Dict, Any
from pathlib import Path

class AudioService:
    """
    Handles audio transcription using OpenAI's Whisper model.
    """
    _instance = None
    _model = None
    MODEL_TYPE = "base.en" # Use "base.en" for speed and English-only

    def __new__(cls):
        if cls._instance is None:
            print("🧠 Initializing AudioService (loading Whisper model)...")
            cls._instance = super(AudioService, cls).__new__(cls)
            try:
                # Load the Whisper model
                cls._model = whisper.load_model(cls.MODEL_TYPE)
                print(f"✓ Whisper model '{cls.MODEL_TYPE}' loaded successfully.")
            except Exception as e:
                print(f"❌❌ FAILED to load Whisper model: {e}")
                print("   Make sure 'ffmpeg' is installed on your system.")
                print("   (macOS: brew install ffmpeg) | (Ubuntu: sudo apt-get install ffmpeg)")
                cls._model = None
        return cls._instance

    def transcribe_audio_file(self, file_path: str) -> Dict[str, Any]:
        """
        Transcribes a given audio file.
        """
        if not self._model:
            raise Exception("Whisper model is not loaded. Transcription failed.")
        
        try:
            print(f"  → Transcribing {file_path}...")
            # Run transcription
            result = self._model.transcribe(file_path, fp16=False) # fp16=False for CPU
            
            print("  ✓ Transcription complete.")
            return {
                "text": result.get("text", ""),
                "language": result.get("language", "unknown"),
                "segments": result.get("segments", [])
            }
        except Exception as e:
            print(f"❌ Error during transcription: {e}")
            traceback.print_exc()
            raise

# Singleton instance
audio_service = AudioService()