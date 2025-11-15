# context-iq/backend/Dockerfile
FROM python:3.11-slim

# === Environment Setup ===
WORKDIR /app

# Add /app to Python path to allow imports like `from backend.main import app`
ENV PYTHONPATH=/app

# === System Dependencies ===
# build-essential: needed for compiling some packages (e.g., cryptography, uvicorn)
# curl: useful for health checks
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# === Python Dependencies ===
# Copy only requirements first to leverage Docker layer caching
COPY ./backend/requirements.txt /app/backend_requirements.txt
COPY ./ml/requirements.txt /app/ml_requirements.txt

# Upgrade pip and install all dependencies
RUN pip install --upgrade pip

# --- THIS IS THE CRITICAL FIX ---
RUN pip install --no-cache-dir --upgrade -r /app/backend_requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/ml_requirements.txt
# --- END OF FIX ---

# === Download spaCy Model ===
# MUST be after spaCy is installed from requirements
RUN python -m spacy download en_core_web_lg
RUN python -m spacy download en_core_web_sm

# === Copy Application Code ===
# Copy backend and ml code
COPY ./backend /app/backend
COPY ./ml /app/ml

# Optional: copy data (can be overridden by volume in docker-compose)
COPY ./data /app/data

# === Expose Port ===
EXPOSE 8000

# === Run Application ===
# Use backend.main:app to match module structure
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]