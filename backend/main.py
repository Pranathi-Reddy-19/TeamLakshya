# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional, Literal
from datetime import datetime
import asyncio
import traceback
import os
import shutil
from pathlib import Path

# Import services
from .core.db_connect import db_manager
from .core.rag_service import RAGService
from .core.llm_service import llm_service, get_llm
from .core.graph_store import GraphStore
from .core.predictive_service import predictive_service
from .core.audit_service import log_action, AuditCategory, AuditLevel
from .core.vector_store import VectorStore
from .core.multi_channel_ingestion import IngestionConfig, MultiChannelIngestionService, CanonicalEvent
from .core.notification_service import notification_service
from .core.jira_service import jira_service, JIRAError
from .core.embedding import get_embedding_model
from .core.audio_service import audio_service

# Import routers and authentication
from .routers import auth as auth_router
from .core.auth_service import get_current_active_user
from .core.models import User

# Import Celery tasks
from .tasks import process_audio_task, run_ingestion_task, process_webhook_task

# --- Singleton Instances ---
ingestion_config = IngestionConfig()
multi_ingestion_service = MultiChannelIngestionService(
    config=ingestion_config,
    vector_store=VectorStore(),
    graph_store=GraphStore()
)


# --- Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles application startup and shutdown events."""
    print("\n" + "="*60)
    print("APPLICATION STARTUP (v3: Decoupled w/ Celery)")
    print("="*60)
    
    # Neo4j - Async driver
    try:
        driver = await db_manager.get_neo4j_driver()
        await driver.verify_connectivity()
        print("Neo4j connection established")
        
        gs = GraphStore()
        await gs.create_constraints()
        print("Neo4j constraints ensured")
    except Exception as e:
        print(f"Failed to connect to Neo4j: {e}")
        traceback.print_exc()
    
    # Milvus
    try:
        client = db_manager.get_milvus_client()
        client.list_collections()
        print("Milvus connection established")
        
        vs = VectorStore()
        vs.create_collection_if_not_exists()
        print("Milvus collection ensured")
    except Exception as e:
        print(f"Failed to connect to Milvus: {e}")
        traceback.print_exc()
    
    # RAG Service
    try:
        RAGService()
        print("RAG Service initialized (embedding model loaded)")
    except Exception as e:
        print(f"Failed to initialize RAG Service: {e}")
        traceback.print_exc()
    
    # LLM Service
    try:
        model_info = llm_service.get_model_info()
        if model_info["model_loaded"]:
            print(f"LLM Service initialized ({model_info['model_name']} on {model_info['device']})")
        else:
            print("LLM Service initialized in fallback mode")
    except Exception as e:
        print(f"Failed to initialize LLM Service: {e}")
        traceback.print_exc()
    
    # Predictive Service
    try:
        _ = predictive_service.graph_store
        print("Predictive Service initialized")
    except Exception as e:
        print(f"Failed to initialize Predictive Service: {e}")
        traceback.print_exc()
    
    # Audio & Jira Services
    print("Audio transcription service ready (in worker)")
    
    try:
        jira_service.get_jira_client()
        print("Jira integration service ready")
    except Exception as e:
        print(f"Jira integration service disabled: {e}")
    
    print("Ingestion service ready. Trigger ingestion via API.")
    
    print("="*60)
    print("Application ready to serve requests")
    print("="*60 + "\n")
    
    yield
    
    # --- Shutdown ---
    print("\n" + "="*60)
    print("APPLICATION SHUTDOWN")
    print("="*60)
    
    await db_manager.close_connections()
    
    print("All database connections closed")
    print("="*60 + "\n")


# --- FastAPI App ---
app = FastAPI(
    title="Context IQ API",
    description="The reasoning core for the Cognitive Operating System.",
    version="0.9.1",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Add Routers ---
app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["Authentication"])


# --- Pydantic Models ---
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class HealthResponse(BaseModel):
    api: Dict[str, str]
    neo4j: Dict[str, str]
    milvus: Dict[str, str]

class ConnectorStatus(BaseModel):
    source: str
    status: str
    last_run: Optional[str] = None
    error: Optional[str] = None

class IngestionRunResponse(BaseModel):
    source: str
    status: str
    message: str
    total_events: int
    vectors_inserted: int
    duration_seconds: float

class AudioUploadResponse(BaseModel):
    file_name: str
    status: str
    message: str
    events_processed: int

class QueryRequest(BaseModel):
    text: str
    top_k: int = 5
    source_filter: Optional[str] = None
    include_graph_context: bool = True
    chat_history: List[ChatMessage] = Field(default_factory=list)

class EvidenceItem(BaseModel):
    id: str
    text: str
    source: str
    timestamp: str
    score: float
    metadata: Dict[str, Any] = Field(default_factory=dict)

class QueryResponse(BaseModel):
    query: str
    answer: str
    evidence: List[EvidenceItem]
    metadata: Dict[str, Any]

class TaskItem(BaseModel):
    id: str
    title: str
    status: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None

class TaskStatusUpdate(BaseModel):
    status: str

class SummarizationRequest(BaseModel):
    channel_id: str
    lookback_hours: int = 24
    summary_type: Literal["brief", "detailed"] = "brief"

class SummarizationResponse(BaseModel):
    channel_id: str
    summary: str
    event_count: int
    lookback_hours: int

class ChartDataPoint(BaseModel):
    label: str
    value: float

class SentimentTimelinePoint(BaseModel):
    date: str
    positive: float
    neutral: float
    negative: float

class PerformanceAnalyticsResponse(BaseModel):
    top_active_channels: List[ChartDataPoint]
    top_contributors: List[ChartDataPoint]
    sentiment_over_time: List[SentimentTimelinePoint]
    avg_response_time_seconds: Optional[float] = None

class SentimentOverviewData(BaseModel):
    overall_sentiment: str
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    total_messages: int

class ChannelSentimentSummary(BaseModel):
    channel: str
    positive: int
    neutral: int
    negative: int
    total: int

class TrustNode(BaseModel):
    user: str
    agreements: int
    strength: float

class TrustEdge(BaseModel):
    source: str
    target: str
    weight: int

class TrustGraphResponse(BaseModel):
    nodes: List[TrustNode]
    edges: List[TrustEdge]

class JiraIssueRequest(BaseModel):
    project_key: str
    summary: str
    description: str
    task_id: Optional[str] = None

class JiraIssueResponse(BaseModel):
    key: str
    url: str

class RiskAnalysisRequest(BaseModel):
    decision_text: str = Field(..., min_length=10)

class DependencyItem(BaseModel):
    node_type: str = Field(..., description="Type of node, e.g., 'Task', 'Project'")
    node_id: str = Field(..., description="The ID of the node")
    summary: str = Field(..., description="The summary or text of the node")
    link_type: str = Field(..., description="How it's linked, e.g., 'DEPENDS_ON', 'PART_OF'")

class SentimentItem(BaseModel):
    user_name: str
    text: str
    sentiment_label: str
    sentiment_score: float
    channel: str
    timestamp: str

class RiskAnalysisResponse(BaseModel):
    decision_text: str
    key_entities: List[str]
    dependencies: List[DependencyItem]
    related_sentiments: List[SentimentItem]
    summary: str

class KnowledgeSilo(BaseModel):
    topic: str = Field(..., description="The topic or project being siloed")
    user_id: str
    user_name: str
    event_count: int = Field(..., description="Number of events this user authored on the topic")
    percentage: float = Field(..., description="Percentage of all events on this topic authored by this user")

class KeyInfluencer(BaseModel):
    user_id: str
    user_name: str
    agreements_received: int
    replies_received: int
    total_score: int

class TeamInteraction(BaseModel):
    team_a: str
    team_b: str
    interaction_count: int

class TeamDynamicsResponse(BaseModel):
    knowledge_silos: List[KnowledgeSilo]
    key_influencers: List[KeyInfluencer]
    team_interactions: List[TeamInteraction]


# --- Root Endpoint ---
@app.get("/", tags=["General"])
def read_root():
    """Welcome endpoint for the API."""
    return {
        "message": "Context IQ API is running.",
        "version": "0.9.1",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


# --- WebSocket ---
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """Handles persistent WebSocket connections for real-time notifications."""
    await notification_service.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received message from {user_id}: {data}")
    except WebSocketDisconnect:
        notification_service.disconnect(user_id)
    except Exception as e:
        print(f"Error in WebSocket for {user_id}: {e}")
        notification_service.disconnect(user_id)


# --- Health Check ---
@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
async def get_health():
    """Check the health of all system components."""
    services = {
        "api": {"status": "online"},
        "neo4j": {"status": "offline"},
        "milvus": {"status": "offline"}
    }
    
    try:
        driver = await db_manager.get_neo4j_driver()
        await driver.verify_connectivity()
        services["neo4j"]["status"] = "online"
    except Exception as e:
        services["neo4j"]["error"] = str(e)
    
    try:
        db_manager.get_milvus_client().list_collections()
        services["milvus"]["status"] = "online"
    except Exception as e:
        services["milvus"]["error"] = str(e)
    
    return services


# --- SECURED ENDPOINTS ---

# --- Ingestion Endpoints ---
@app.get("/api/v1/ingest/connectors", response_model=List[ConnectorStatus], tags=["Ingestion"])
def get_connector_status(current_user: User = Depends(get_current_active_user)):
    """Get the status of all configured data source connectors."""
    try:
        print(f"Ingestion connectors accessed by user: {current_user.username}")
        return multi_ingestion_service.get_connector_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get connector status: {str(e)}")


@app.post("/api/v1/ingest/run/{source_name}", response_model=IngestionRunResponse, tags=["Ingestion"])
async def run_ingestion_for_source(
    source_name: str,
    current_user: User = Depends(get_current_active_user)
):
    """Queue an ingestion task for a specific data source."""
    log_action(
        user_id=current_user.username,
        action=f"QUEUE_INGESTION_{source_name.upper()}",
        category=AuditCategory.SYSTEM_OPERATION,
        level=AuditLevel.INFO,
        details={"source": source_name}
    )
    
    print(f"Queuing ingestion task for {source_name}")
    run_ingestion_task.delay(source_name, ingestion_config.lookback_hours)
    
    return IngestionRunResponse(
        source=source_name,
        status="queued",
        message=f"Ingestion task for {source_name} has been queued.",
        total_events=0,
        vectors_inserted=0,
        duration_seconds=0
    )


# --- SLACK WEBHOOK ENDPOINT ---
@app.post("/api/v1/ingest/events/slack", tags=["Ingestion"])
async def receive_slack_events(events: List[CanonicalEvent]):
    """
    Receive events from Slack webhook integration.
    This endpoint processes Slack events in canonical format.
    """
    if not events:
        return {"status": "no_events_received"}
    
    print(f"Received {len(events)} Slack event(s) via webhook")
    
    try:
        asyncio.create_task(
            multi_ingestion_service.process_and_store_events(events)
        )
        return {"status": "events_queued_for_ingestion"}
    except Exception as e:
        print(f"Error processing Slack webhook: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process events: {e}")


# --- GENERIC WEBHOOK ENDPOINT (FOR JIRA, NOTION, ETC.) ---
@app.post("/api/v1/ingest/webhook/{source_name}", tags=["Ingestion"])
async def receive_generic_webhook(
    source_name: str,
    request: Request,
):
    """
    A generic, unsecured endpoint to receive webhooks from various sources
    like Jira, Notion, etc.
    
    This endpoint immediately queues a background task for processing.
    The webhook sender receives an immediate 200 OK response.
    """
    try:
        # Get the raw JSON payload
        payload = await request.json()
    except Exception as e:
        # Fallback if payload isn't JSON - capture raw body
        payload = {"raw_body": (await request.body()).decode('utf-8')}
        
    print(f"Received webhook for source: {source_name}")
    
    # Queue the task with Celery for async processing
    process_webhook_task.delay(source_name, payload)
    
    # Immediately return a 200 OK to the webhook sender
    return {"status": "event_queued"}


# --- Audio Upload ---
@app.post("/api/v1/ingest/upload-audio", response_model=AudioUploadResponse, tags=["Ingestion"])
async def upload_audio_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload an audio file for transcription and ingestion.
    The file is saved and queued for processing by a Celery worker.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name specified.")

    temp_dir = Path("/app/data/temp_audio")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    unique_filename = f"{datetime.now().timestamp()}-{file.filename}"
    temp_file_path = temp_dir / unique_filename

    try:
        with temp_file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"Audio file saved to {temp_file_path}")
        process_audio_task.delay(str(temp_file_path), file.filename)

        return AudioUploadResponse(
            file_name=file.filename,
            status="queued",
            message="Audio file uploaded and queued for transcription.",
            events_processed=0
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Jira Integration ---
@app.post("/api/v1/integrations/jira/create-issue", response_model=JiraIssueResponse, tags=["Integrations"])
async def create_jira_issue(
    request: JiraIssueRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new Jira issue and optionally link it to a task in the knowledge graph."""
    try:
        log_action(
            user_id=current_user.username,
            action="CREATE_JIRA_ISSUE",
            category=AuditCategory.API_CALL,
            level=AuditLevel.INFO,
            details={"project": request.project_key}
        )
        
        result = await asyncio.to_thread(
            jira_service.create_issue,
            project_key=request.project_key,
            summary=request.summary,
            description=request.description
        )
        
        if request.task_id:
            await GraphStore().link_task_to_external_id(request.task_id, result["key"], "jira")
        
        return JiraIssueResponse(key=result["key"], url=result["url"])
    except JIRAError as e:
        raise HTTPException(status_code=400, detail=f"Jira Error: {e.text}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Query Endpoint ---
@app.post("/api/v1/query", response_model=QueryResponse, tags=["Query"])
async def post_query(
    query_request: QueryRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Perform a RAG-based query against the knowledge base.
    Returns an AI-generated answer with supporting evidence.
    """
    print(f"Query from {current_user.username}: {query_request.text}")
    
    rag_service = RAGService()
    filters = f"source == '{query_request.source_filter}'" if query_request.source_filter else None

    context = await rag_service.search_context(
        query=query_request.text,
        top_k=query_request.top_k,
        filters=filters,
        include_graph_context=query_request.include_graph_context,
        user_role=current_user.role
    )

    answer = await _generate_answer(query_request.text, context, query_request.chat_history)

    evidence = []
    for item in context:
        if isinstance(item.get("timestamp"), int):
            item["timestamp"] = datetime.fromtimestamp(item["timestamp"]).isoformat()
        try:
            evidence.append(EvidenceItem(**item))
        except: 
            continue

    return QueryResponse(
        query=query_request.text,
        answer=answer,
        evidence=evidence,
        metadata={
            "results_found": len(evidence),
            "user_role": current_user.role
        }
    )


async def _generate_answer(query: str, context: List[Dict], chat_history=None) -> str:
    """Helper function to generate an answer using the LLM service."""
    history = [msg.model_dump() for msg in (chat_history or [])]
    try:
        return await asyncio.to_thread(
            llm_service.generate_answer,
            query, context, history, include_sources=True
        )
    except Exception as e:
        return f"Error generating answer: {e}"


# --- Task Management ---
@app.get("/api/v1/tasks/open", response_model=List[TaskItem], tags=["Productivity"])
async def get_open_tasks(current_user: User = Depends(get_current_active_user)):
    """Get all open tasks from the knowledge graph."""
    return await GraphStore().get_open_tasks()


@app.put("/api/v1/tasks/{task_id}", response_model=TaskItem, tags=["Productivity"])
async def update_task(
    task_id: str,
    update: TaskStatusUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update the status of a task and notify the user via WebSocket."""
    gs = GraphStore()
    task = await gs.update_task_status(task_id, update.status, current_user.username)
    
    await notification_service.send_to_user(current_user.username, {
        "type": "TASK_UPDATE",
        "payload": {"text": f"Task updated to {update.status}", "task_id": task_id}
    })
    
    return task


# --- Summarization ---
@app.post("/api/v1/summarize", response_model=SummarizationResponse, tags=["Productivity"])
async def summarize_channel(
    request: SummarizationRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Generate an AI summary of recent activity in a specific channel."""
    events = await GraphStore().get_events_for_channel(request.channel_id, request.lookback_hours)
    
    if not events:
        raise HTTPException(404, "No events found for the specified channel and time period")
    
    history = [{"user_name": e["user_name"], "text": e["text"]} for e in events]
    summary = await asyncio.to_thread(
        llm_service.generate_summary, history, request.channel_id, request.summary_type
    )
    
    return SummarizationResponse(
        channel_id=request.channel_id,
        summary=summary,
        event_count=len(events),
        lookback_hours=request.lookback_hours
    )


# --- Analytics ---
@app.get("/api/v1/analytics/performance", response_model=PerformanceAnalyticsResponse, tags=["Analytics"])
async def get_performance_analytics(current_user: User = Depends(get_current_active_user)):
    """Get performance analytics including active channels, contributors, and sentiment trends."""
    return await GraphStore().get_performance_analytics()


# --- Sentiment & Trust Endpoints ---
@app.get("/api/v1/sentiment/overview", response_model=SentimentOverviewData, tags=["Analytics"])
async def get_sentiment_overview(current_user: User = Depends(get_current_active_user)):
    """Get an overview of sentiment statistics across all channels."""
    try:
        return await GraphStore().get_sentiment_stats()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/sentiment/channels/summary", response_model=List[ChannelSentimentSummary], tags=["Analytics"])
async def get_channel_sentiment_summary(current_user: User = Depends(get_current_active_user)):
    """Get a summary of sentiment statistics broken down by channel."""
    try:
        return await GraphStore().get_sentiment_by_channel_summary()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/sentiment/timeline", response_model=List[SentimentTimelinePoint], tags=["Analytics"])
async def get_sentiment_timeline(
    days: int = 7,
    current_user: User = Depends(get_current_active_user)
):
    """Get sentiment trends over time (default: last 7 days)."""
    try:
        return await GraphStore().get_sentiment_timeline(days_limit=days)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Team Dynamics Endpoint ---
@app.get("/api/v1/analytics/team-dynamics", response_model=TeamDynamicsResponse, tags=["Analytics"])
async def get_team_dynamics(
    silo_threshold: float = Query(
        default=0.7,
        ge=0.5,
        le=1.0,
        description="Percentage to be considered a silo (e.g., 0.7 = 70%)"
    ),
    current_user: User = Depends(get_current_active_user)
):
    """
    Analyzes the Knowledge Graph to find knowledge silos,
    key influencers, and team fragmentation.
    """
    try:
        gs = GraphStore()
        
        # Run the new graph queries in parallel
        silos_task = gs.get_knowledge_silos(silo_threshold)
        influencers_task = gs.get_key_influencers()
        interactions_task = gs.get_team_interactions()
        
        results = await asyncio.gather(
            silos_task,
            influencers_task,
            interactions_task
        )
        
        return TeamDynamicsResponse(
            knowledge_silos=results[0],
            key_influencers=results[1],
            team_interactions=results[2]
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Risk Analysis Endpoint ---
@app.post("/api/v1/analytics/risk-analysis", response_model=RiskAnalysisResponse, tags=["Analytics"])
async def run_risk_analysis(
    request: RiskAnalysisRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Runs a risk and dependency analysis on a proposed decision
    by querying the knowledge graph.
    """
    try:
        gs = GraphStore()
        llm = get_llm()
        embedding_model = get_embedding_model()

        # 1. Extract key entities from the decision text
        prompt = f"""
        You are a system architect. Extract the key nouns, projects, dates, or technical concepts
        from the following proposed decision. Respond with a comma-separated list.
        Decision: "{request.decision_text}"
        Example: "Project Phoenix, launch date, auth module"
        """
        entity_string = await asyncio.to_thread(llm.predict, prompt)
        key_entities = [e.strip() for e in entity_string.split(",") if e.strip()]
        
        if not key_entities:
            raise HTTPException(400, "Could not extract key entities from decision.")

        # 2. Get embeddings for these entities
        # FIXED: Changed from embed_documents to get_embeddings
        entity_embeddings = await asyncio.to_thread(embedding_model.get_embeddings, key_entities)
        
        # 3. Query the graph for dependencies and sentiments
        analysis_data = await gs.get_risk_analysis_data(key_entities, entity_embeddings)
        
        dependencies = analysis_data.get("dependencies", [])
        sentiments = analysis_data.get("sentiments", [])

        # Build summary strings for dependencies and sentiments
        deps_summary = "\n- ".join(
            [f"{d['node_type']} '{d['summary']}' (Linked via {d['link_type']})" for d in dependencies]
        ) if dependencies else "None"
        
        sents_summary = "\n- ".join(
            [f"User '{s['user_name']}' felt '{s['sentiment_label']}' about: '{s['text']}'" for s in sentiments]
        ) if sentiments else "None"

        # 4. Generate a summary of the findings
        summary_prompt = f"""
        As an AI project manager, analyze the following data about a proposed decision:
        Decision: "{request.decision_text}"
        
        Found Dependencies:
        - {deps_summary}
        
        Found Related Sentiments:
        - {sents_summary}
        
        Please provide a brief, bullet-pointed summary of the potential risks or impacts.
        Focus on surfacing facts, not making a final judgment.
        """
        
        summary = await asyncio.to_thread(llm.predict, summary_prompt)
        
        return RiskAnalysisResponse(
            decision_text=request.decision_text,
            key_entities=key_entities,
            dependencies=dependencies,
            related_sentiments=sentiments,
            summary=summary
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Run Server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )