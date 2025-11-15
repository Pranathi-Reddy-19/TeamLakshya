# backend/celery_app.py
import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
# We are not using Django, but this is a common convention.
# We load the config from environment variables.
broker_url = os.environ.get("CELERY_BROKER_URL", "amqp://guest:guest@rabbitmq:5672//")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "rpc://")

celery_app = Celery(
    "context_iq_tasks",
    broker=broker_url,
    backend=result_backend,
    include=["backend.tasks"]  # This tells Celery to look for tasks in 'backend.tasks.py'
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# --- NEW: CELERY BEAT SCHEDULE ---
# This defines our "real-time" polling jobs
celery_app.conf.beat_schedule = {
    'run-notion-ingestion-every-5-mins': {
        'task': 'backend.tasks.run_ingestion_task',
        'schedule': 300.0,  # 300 seconds = 5 minutes
        'args': ('notion', 1) # (source_name, lookback_hours)
    },
    'run-gdocs-ingestion-every-10-mins': {
        'task': 'backend.tasks.run_ingestion_task',
        'schedule': 600.0, # 10 minutes
        'args': ('gdocs', 1)
    },
    'run-gmail-ingestion-every-10-mins': {
        'task': 'backend.tasks.run_ingestion_task',
        'schedule': 600.0, # 10 minutes
        'args': ('gmail', 1)
    },
}

if __name__ == "__main__":
    celery_app.start()