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

<!-- end list -->

  * **Automated Scheduling:** **Celery Beat** runs the automated, periodic ingestion for Google Docs, Gmail, and Notion, replacing the old `APScheduler`.

<!-- end list -->

  - **Real-time Notifications:** A persistent **WebSocket** connection pushes live updates to the frontend, such as "Ingestion Complete" or "Task Assigned."

-----

### Tech Stack Overview

#### Monorepo Structure

/backend → FastAPI, APIs, all core logic, `celery_app.py`, `tasks.py`
/frontend → React + TypeScript + Vite
/ml → NLP/ML models (extractor.py, train.py)
/slack\_bot → Separate FastAPI server for Slack's Event API
/infra → Docker Compose configuration
/data → Demo data

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

### 🚀 Quickstart: Run with Docker

#### 1\. Create `.env` File

In the `/infra` folder, create a file named `.env`.

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

# --- Email (Optional) ---
# SMTP_USERNAME=your-email@gmail.com
# SMTP_PASSWORD=your_gmail_app_password
```

#### 2\. Add Google `credentials.json`

To use the Google Docs & Gmail connectors, you must have a `credentials.json` file.

1.  Follow the Google Cloud instructions to create a **"Desktop app"** credential.
2.  **Enable** the `Gmail API`, `Google Drive API`, and `Google Docs API`.
3.  Add your email as a **Test User** on the OAuth Consent Screen.
4.  Place the downloaded `credentials.json` file inside the **/backend** folder.

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

You must run this command *once* to generate your `token.json` file.

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

Your organization now has a brain\!