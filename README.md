Here is your complete, updated `README.md` file.

It has been rewritten to prioritize the local setup we just built (Option A) while keeping the original Docker-based setup as an alternative (Option B). It includes all the fixes and steps we discovered.

-----

# Context IQ

**The Cognitive Operating System for Organizations**

> *From remembering what teams said — to understanding **why**, and predicting **what happens next**.*

-----

### The Problem

Modern organizations operate across a maze of tools — **Slack, Zoom, Google Docs, Notion, Jira, email, etc.**
Information becomes **scattered and fragmented**, leading to **organizational amnesia**:

  - What did we decide last week?
  - Who was supposed to do this?
  - Why did we choose this approach?

Critical decisions, tasks, and dependencies disappear across platforms. Teams lose context. Work gets duplicated. Accountability vanishes.

-----

### The Solution: A Dual-Memory AI Platform

**Context IQ** acts as a **living, reasoning AI brain** for your organization.

It ingests fragmented data and builds **two complementary memory systems**:

1.  **Semantic Memory (Milvus)**
    A vector database that **understands the *meaning*** of your data.

2.  **Knowledge Graph (Neo4j)**
    A graph database that **understands the *relationships*** — *who, what, when, where, and why*.

Together, they power a sophisticated **Retrieval-Augmented Generation (RAG)** engine, advanced analytics, and real-time insights, all built on a robust, asynchronous architecture.

-----

### Core Features

#### 1\. Unified Team Memory (RAG Engine)

  - **Natural Language Interface**
    Ask: `“What is the status of Project Phoenix?”` → Get **evidence-backed answers** from your entire corporate history.
  - **Privacy-First RAG**
    Automatic PII redaction using **Presidio**.
  - **Evidence-Based Responses**
    Every AI answer links directly to the original source messages, documents, or tasks it used for its reasoning.

#### 2\. Multi-Channel Data Connectors

Context IQ ingests data from all major tools and normalizes them into a **CanonicalEvent** format.

| Category | Supported Tools | Ingestion Method |
| :--- | :--- | :--- |
| **Chat** | Slack, Discord, Microsoft Teams | ⚡️ **Real-time Bots** & Webhooks |
| **PM** | Jira | ⚡️ **Real-time Webhooks** |
| **Documents** | Google Docs, Notion | ⚡️ **Automated Polling** (via Celery Beat) |
| **Email** | Gmail | ⚡️ **Automated Polling** (via Celery Beat) |
| **Meetings** | Audio/Video Uploads | ⚡️ **Real-time Transcription** (via Whisper & Celery) |
| **Local Files** | .pdf, .docx, .txt | ⚡️ **Real-time Upload** & Ingestion |

#### 3\. Productivity & Summarization Suite

  - **AI Summarizer**
    Get summaries of any channel, document, or meeting on demand. `“Summarize #project-phoenix for the last 72 hours.”`
  - **Automatic Task Extraction**
    The AI reads all messages and identifies action items, creating `Task` nodes in the Knowledge Graph.
  - **Jira Integration**
    Convert any extracted task into a Jira issue in **one click**.

#### 4\. Insight Analytics Dashboards

  - **Risk & Dependency Analyzer** (Replaces Predictive Suite)
    Propose a decision (e.g., `“Delay Project Phoenix launch by two weeks”`) and the AI queries the Knowledge Graph to surface **factual evidence** of its impact—like all dependent tasks and related negative sentiments.
  - **Team Dynamics** (Replaces Trust Graph)
    No more "hairball" graphs. Get real, scannable insights:
      - **Knowledge Silos:** Identifies topics or tasks where only one person is contributing.
      - **Key Influencers:** Ranks users by the positive agreements and replies their ideas generate.
      - **Team Fragmentation:** Shows which teams (by channel) are not communicating.
  - **Team Performance Dashboard**
    Tracks top contributors, most active channels, and team sentiment over time using **VADER**.

#### 5\. Decoupled & Scalable Infrastructure

  - **Asynchronous API:** Built with **FastAPI**, the main API is non-blocking. Heavy tasks like transcription or ingestion are instantly delegated.
  - **Distributed Task Queue:** Powered by **Celery** and **RabbitMQ**, the system can scale to handle thousands of background jobs (ingestions, transcriptions, AI summaries) without slowing down the user experience.
  - **Automated Scheduling:** **Celery Beat** runs the automated, periodic ingestion for Google Docs, Gmail, and Notion, replacing the old `APScheduler`.
  - **Real-time Notifications:** A persistent **WebSocket** connection pushes live updates to the frontend, such as "Ingestion Complete" or "Task Assigned."

-----

### Tech Stack Overview

#### Monorepo Structure

```
/backend    → FastAPI, APIs, all core logic, celery_app.py, tasks.py
/frontend   → React + TypeScript + Vite
/ml         → NLP/ML models (extractor.py, train.py)
/slack_bot  → Separate FastAPI server for Slack's Event API
/infra      → Docker Compose configuration & .env file
/data       → Demo data
```

#### Core Technologies

**Backend**
FastAPI • Python 3.11 • Pydantic • asyncio • Uvicorn

**Frontend**
React 18 • TypeScript • Vite • react-router-dom • recharts • axios

**Databases & State**

  - **Milvus** (Vector DB for Semantic Memory)
  - **Neo4j** (Graph DB for Knowledge Graph)
  - **RabbitMQ** (Message Broker for Celery)
  - **Minio** (S3 Object Storage for vectors)
  - **Etcd** (Metadata store for Milvus)

**AI / ML**

  - RAG LLM: FLAN-T5
  - Embeddings: Sentence Transformers
  - PII: Presidio
  - Sentiment: VADER
  - NER: spaCy
  - Audio: OpenAI Whisper
  - Predictions: scikit-learn + joblib

**Infrastructure & Jobs**

  - **Docker Compose**
  - **Celery** (Distributed Task Queue)
  - **Celery Beat** (Periodic Task Scheduler)
  - **WebSockets** (Real-time UI Notifications)
  - **Ngrok** (for exposing webhooks during development)

-----

### 🚀 Quickstart (Local Development)

This guide is for running the stack on your local machine (e.g., Windows/macOS) for development. This is now the recommended approach.

-----

#### Phase 1: Install Background Services

You must install these services on your local machine.

1.  **Neo4j Desktop:**

      * Download and install **Neo4j Desktop**.
      * Create a new project and a new **Local Database**.
      * Set a password for the database (e.g., `yourpassword`). **You will need this for Phase 2.**
      * **Start** the database.

2.  **RabbitMQ:**

      * Download and install **Erlang** (a RabbitMQ dependency).
      * Download and install **RabbitMQ Server**.
      * Run `rabbitmq-plugins enable rabbitmq_management` in a terminal to enable the UI.
      * The service will run in the background. (Check: `http://localhost:15672`).

3.  **Docker Desktop (for Milvus Stack):**

      * Download and install **Docker Desktop**.
      * In a new terminal, navigate to the `/infra` folder and run:
        ```bash
        docker-compose up -d standalone
        ```
      * This will start Milvus, Minio, and etcd. (Check: `http://localhost:9001` or `http://localhost:9011` for Minio console).
      * **Port Conflict?** If Docker fails because ports `9000` or `9001` are busy, edit `infra/docker-compose.yml` and change the `minio:` ports to "9010:9000" and "9011:9001".

-----

#### Phase 2: Configure Environment

1.  **Create `.env` File:**

      * In the `/infra` folder, create a file named `.env`.
      * Paste the entire contents below. This version is configured for your new **local** setup.
      * Fill in your `NEO4J_PASSWORD` (from Phase 1) and your API keys.

    <!-- end list -->

    ```env
    # --- Docker ---
    NEO4J_PASSWORD=yourpassword

    # --- Authentication ---
    AUTH_SECRET_KEY=a_very_long_random_string_for_jwt

    # --- Slack Bot ---
    SLACK_BOT_TOKEN=xoxb-...
    SLACK_SIGNING_SECRET=...

    # --- Jira ---
    JIRA_SERVER=https://your-company.atlassian.net
    JIRA_USERNAME=your-email@company.com
    JIRA_API_TOKEN=...
    JIRA_PROJECT_KEYS=PROJ1

    # --- Notion ---
    NOTION_TOKEN=secret_...

    # --- Email (Optional) ---
    SMTP_USERNAME=your-email@gmail.com
    SMTP_PASSWORD=your-google-app-password

    # =======================================================
    # VITAL: LOCALHOST OVERRIDES
    # =Example:
    # =======================================================
    CELERY_BROKER_URL=amqp://guest:guest@localhost:5672//
    NEO4J_URI=bolt://localhost:7687
    MILVUS_URI=http://localhost:19530

    # This tells your local Slack Bot to find your local Backend
    BACKEND_API_URL=http://localhost:8000/api/v1

    # Local paths for Google credentials
    GOOGLE_CREDENTIALS_PATH=backend/credentials.json
    GOOGLE_TOKEN_PATH=backend/token.json
    ```

2.  **Add Google `credentials.json`:**

      * Place your downloaded `credentials.json` file inside the **/backend** folder.

-----

#### Phase 3: Set Up Project Environments

1.  **Main Backend/ML Environment:**

      * `cd C:\CIQ` (go to project root)
      * `python -m venv venv_main`
      * `.\venv_main\Scripts\Activate.ps1`
      * `pip install -r backend/requirements.txt`
      * `pip install -r ml/requirements.txt`

2.  **Slack Bot Environment:**

      * `cd C:\CIQ\slack_bot`
      * `python -m venv venv_slack`
      * `.\venv_slack\Scripts\Activate.ps1`
      * `pip install -r requirements.txt`
      * `deactivate`

3.  **Frontend Environment:**

      * `cd C:\CIQ\frontend`
      * `npm install`

-----

#### Phase 4: Run the Full Stack (5 Terminals)

Open 5 **PowerShell (as Administrator)** terminals and run the following.

**Terminal 1: Main Backend API**

```powershell
cd C:\CIQ
.\venv_main\Scripts\Activate.ps1
$env:CIQ_ENV = (Get-Content -Path ".\infra\.env" -Raw); $env:CIQ_ENV -split "[\r\n]+" | ForEach-Object { if ($_ -match "=" -and $_ -notmatch "^\s*#") { $name, $value = $_ -split "=", 2; Set-Item -Path "Env:\$name" -Value $value } }
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2: Celery Worker**

```powershell
cd C:\CIQ
.\venv_main\Scripts\Activate.ps1
$env:CIQ_ENV = (Get-Content -Path ".\infra\.env" -Raw); $env:CIQ_ENV -split "[\r\n]+" | ForEach-Object { if ($_ -match "=" -and $_ -notmatch "^\s*#") { $name, $value = $_ -split "=", 2; Set-Item -Path "Env:\$name" -Value $value } }
celery -A backend.celery_app worker --loglevel=info -c 1 --pool=solo
```

**Terminal 3: Celery Beat (Scheduler)**

```powershell
cd C:\CIQ
.\venv_main\Scripts\Activate.ps1
$env:CIQ_ENV = (Get-Content -Path ".\infra\.env" -Raw); $env:CIQ_ENV -split "[\r\n]+" | ForEach-Object { if ($_ -match "=" -and $_ -notmatch "^\s*#") { $name, $value = $_ -split "=", 2; Set-Item -Path "Env:\$name" -Value $value } }
celery -A backend.celery_app beat --loglevel=info
```

**Terminal 4: Frontend**

```powershell
cd C:\CIQ\frontend
npm run dev
```

**Terminal 5: Slack Bot**

```powershell
cd C:\CIQ\slack_bot
.\venv_slack\Scripts\Activate.ps1
$env:CIQ_ENV = (Get-Content -Path "..\infra\.env" -Raw); $env:CIQ_ENV -split "[\r\n]+" | ForEach-Object { if ($_ -match "=" -and $_ -notmatch "^\s*#") { $name, $value = $_ -split "=", 2; Set-Item -Path "Env:\$name" -Value $value } }
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

-----

#### Phase 5: One-Time Setup (Final Step)

Open a **6th (new) Administrator PowerShell** terminal.

**1. Authorize Google (One-Time Step)**

  * Run these commands to activate your environment and load your secrets:
    ```powershell
    cd C:\CIQ
    .\venv_main\Scripts\Activate.ps1
    $env:CIQ_ENV = (Get-Content -Path ".\infra\.env" -Raw); $env:CIQ_ENV -split "[\r\n]+" | ForEach-Object { if ($_ -match "=" -and $_ -notmatch "^\s*#") { $name, $value = $_ -split "=", 2; Set-Item -Path "Env:\$name" -Value $value } }
    ```
  * Now, run the Google Auth command:
    ```powershell
    $env:OS_OAUTHLIB_INSECURE_TRANSPORT = 1
    python -c "from backend.core.multi_channel_ingestion import IngestionConfig; IngestionConfig().get_google_creds()"
    ```
  * Follow the on-screen prompts:
    1.  Copy the URL into your browser.
    2.  Sign in and click "Allow."
    3.  Copy the `http://localhost...` URL from your browser's address bar.
    4.  Paste that URL back into your terminal and press Enter.
    5.  It will say: `✅ Google credentials saved to backend/token.json`

**2. Train ML Models (First Run)**

  * In that **same terminal** (Terminal 6), run the training script:
    ```powershell
    python ml/train.py
    ```
  * This will train your models and save them to `ml/models/`.

**3. Restart for Final Load**

  * After the ML training is done, **CLOSE Terminal 1 (Backend)** and **CLOSE Terminal 2 (Celery Worker)**.
  * **Re-run the commands** for those terminals one last time (from Phase 4). This forces them to load the new `token.json` and the ML models you just trained.

Your stack is now 100% configured and running.

-----

### 🐳 Option B: Run with Docker (Original Method)

If you prefer to run the entire stack in Docker (requires a good internet connection for the first build).

#### 1\. Create `.env` File

In the `/infra` folder, create a file named `.env`. **Note: This file is different from the local setup.**

```env
# --- Docker ---
NEO4J_PASSWORD=your_strong_neo4j_password

# --- Authentication ---
AUTH_SECRET_KEY=your_very_strong_random_secret_key

# --- Slack Bot ---
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# --- Jira ---
JIRA_SERVER=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your_atlassian_api_token
JIRA_PROJECT_KEYS=PROJ1

# --- Notion ---
NOTION_TOKEN=secret_...
```

#### 2\. Add Google `credentials.json`

Place the downloaded `credentials.json` file inside the **/backend** folder.

#### 3\. Build & Start All Services

```bash
cd infra
docker-compose up -d --build
```

Your full stack is now running.

**Services now live:**
| Service | URL |
| :--- | :--- |
| **Frontend** | `http://localhost:5173` |
| **Backend API** | `http://localhost:8000` |
| **Swagger Docs** | `http://localhost:8000/docs` |
| **RabbitMQ UI** | `http://localhost:15672` (user: `guest`, pass: `guest`) |
| **Slack Bot** | `http://localhost:8001` (expose with `ngrok http 8001`) |
| **Jira Webhook** | `http://localhost:8000` (expose with `ngrok http 8000`) |
| **Neo4j Browser** | `http://localhost:7474` (user: `neo4j`, pass: your `.env` pass) |
| **Minio Console**| `http://localhost:9001` (user: `minioadmin`, pass: `minioadmin`) |

#### 4\. **CRITICAL:** Authorize Google (One-Time Step)

1.  Open an interactive shell in the `celery_worker`:
    ```bash
    docker-compose exec celery_worker bash
    ```
2.  Run the auth command (with the "insecure" flag for `http://localhost`):
    ```bash
    OS_OAUTHLIB_INSECURE_TRANSPORT=1 python -c "from backend.core.multi_channel_ingestion import IngestionConfig; IngestionConfig().get_google_creds()"
    ```
3.  This will print a URL. Copy/paste it into your browser.
4.  Click "Allow." You will get a "Site can't be reached" error.
5.  **Copy the entire URL from your browser** (the one starting with `http://localhost...`)
6.  **Paste that URL** back into the terminal.
7.  It will say `✅ Google credentials saved to /app/backend/token.json`.
8.  Type `exit` to leave the container.

#### 5\. Train ML Models (First Run)

Run this from the `/infra` folder to train the predictive models.

```bash
docker-compose exec backend python ml/train.py
docker-compose restart backend
```