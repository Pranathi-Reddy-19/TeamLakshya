# backend/core/proactive_service.py
import os
import smtplib
import logging
import traceback
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
from datetime import datetime

from .graph_store import GraphStore
from .notification_service import notification_service
from .models import Insight
from .db_connect import db_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# --- EMAIL CONFIGURATION ---
# The user MUST set these environment variables to send emails.
# For Gmail, this requires an "App Password".
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")  # Your email (e.g., "context.iq.bot@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # Your email app password

# A hardcoded list of users to send digests to.
# In a real app, this would come from a database.
# We'll use the user_ids we know from the data.
DIGEST_RECIPIENTS = {
    "Charlie": "charlie@example.com",
    "Alice": "alice@example.com",
    "Bob": "bob@example.com"
}
# Make sure to replace the emails with a real email address you can test with.


class ProactiveService:
    """
    Service for running proactive analysis on the graph and sending notifications.
    This service is intended to be run on a schedule (e.g., daily).
    Combines daily insights generation with email digest functionality.
    """

    def __init__(self):
        try:
            # --- FIX: Call GraphStore() with no arguments ---
            self.graph_store = GraphStore()
            # --- End of fix ---
            
            self.notifier = notification_service
            self.is_email_configured = bool(SMTP_USER and SMTP_PASSWORD)
            
            if not self.is_email_configured:
                log.warning("⚠️ ProactiveService: SMTP environment variables not set. Email digests will be disabled.")
            
            log.info("ProactiveService initialized.")
        except Exception as e:
            log.error(f"Failed to initialize ProactiveService: {e}")
            self.graph_store = None
            self.notifier = None
            self.is_email_configured = False

    # ==================== EMAIL DIGEST FUNCTIONALITY ====================

    def _send_email(self, to_email: str, subject: str, html_content: str):
        """
        Connects to an SMTP server and sends an HTML email.
        """
        if not self.is_email_configured:
            log.info("  - Skipping email: SMTP service not configured.")
            return

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = SMTP_USER
            message["To"] = to_email
            
            # Attach the HTML content
            message.attach(MIMEText(html_content, "html"))
            
            # Send the email
            log.info(f"  → Connecting to SMTP server: {SMTP_SERVER}:{SMTP_PORT}...")
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, message.as_string())
            server.quit()
            log.info(f"  ✓ Email digest sent to {to_email}")
            
        except Exception as e:
            log.error(f"❌ Error sending email to {to_email}: {e}")
            traceback.print_exc()

    def _generate_digest_html(self, user_name: str, tasks: list, analytics: dict) -> str:
        """
        Generates an HTML string for the daily digest.
        """
        today_str = datetime.now().strftime('%B %d, %Y')
        
        # --- Task List HTML ---
        task_html = ""
        if tasks:
            task_list_items = "".join(f"""
                <li style="margin-bottom: 10px; padding: 10px; background-color: #252936; border-left: 3px solid #667eea; border-radius: 4px;">
                    {task['text']}
                </li>
            """ for task in tasks)
            task_html = f"""
                <h2 style="font-size: 18px; color: #e4e7eb; border-bottom: 1px solid #2d3142; padding-bottom: 5px;">
                    Your Open Action Items ({len(tasks)})
                </h2>
                <ul style="list-style: none; padding: 0;">{task_list_items}</ul>
            """
        else:
            task_html = f"""
                <h2 style="font-size: 18px; color: #e4e7eb;">Your Open Action Items</h2>
                <p style="color: #10b981; font-weight: 600;">✅ All clear! You have no open tasks.</p>
            """

        # --- Analytics HTML ---
        sentiment_dist = analytics.get('sentiment_distribution', {})
        pos = sentiment_dist.get('positive', 0)
        neu = sentiment_dist.get('neutral', 0)
        neg = sentiment_dist.get('negative', 0)
        total = pos + neu + neg
        
        if total == 0:
            total = 1  # Avoid division by zero
        
        analytics_html = f"""
            <h2 style="font-size: 18px; color: #e4e7eb; border-bottom: 1px solid #2d3142; padding-bottom: 5px;">
                Team Pulse (Last 24h)
            </h2>
            <p style="color: #a0a8b8;">
                Overall Sentiment Score: <strong>{analytics.get('average_score', 0.0):.2f}</strong>
            </p>
            <div style="display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: #0f1117;">
                <div style="width: {pos/total*100}%; background-color: #10b981;" title="Positive"></div>
                <div style="width: {neu/total*100}%; background-color: #6b7280;" title="Neutral"></div>
                <div style="width: {neg/total*100}%; background-color: #ef4444;" title="Negative"></div>
            </div>
        """

        # --- Main Template ---
        return f"""
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1d29; color: #a0a8b8; }}
                .container {{ width: 90%; max-width: 600px; margin: 20px auto; padding: 30px; background-color: #1f232e; border: 1px solid #2d3142; border-radius: 16px; }}
                .header {{ font-size: 24px; font-weight: 600; color: #e4e7eb; margin: 0 0 10px; }}
                .date {{ font-size: 14px; color: #a0a8b8; margin: 0 0 30px; }}
                .footer {{ margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="container">
                <p class="header">Hi {user_name},</p>
                <p class="date">Here's your Context IQ Digest for {today_str}.</p>
                
                {task_html}
                
                <div style="margin-top: 30px;">
                    {analytics_html}
                </div>
                
                <div class="footer">
                    Context IQ | Your Cognitive Operating System
                </div>
            </div>
        </body>
        </html>
        """

    def send_daily_digest(self):
        """
        Fetches tasks and analytics for each user and sends them an email.
        This is called by the scheduler for email digests.
        """
        log.info(f"\n--- 🚀 Running Daily Digest Job ({datetime.now()}) ---")
        if not self.is_email_configured:
            log.info("  - Aborting: SMTP service not configured.")
            return

        if not self.graph_store:
            log.error("  - Aborting: GraphStore not initialized.")
            return

        try:
            # 1. Get global analytics (for today)
            sentiment_analytics = self.graph_store.get_sentiment_stats()
            
            # 2. Get tasks for all users
            all_tasks = self.graph_store.get_open_tasks()
            
            # 3. Group tasks by user
            user_tasks = {user_id: [] for user_id in DIGEST_RECIPIENTS.keys()}
            for task in all_tasks:
                assignee_id = task.get('assignee_id')
                if assignee_id in user_tasks:
                    user_tasks[assignee_id].append(task)
            
            # 4. Send email to each user
            for user_id, email in DIGEST_RECIPIENTS.items():
                log.info(f"  - Preparing digest for {user_id}...")
                user_name = user_id.capitalize()
                tasks = user_tasks.get(user_id, [])
                
                html_content = self._generate_digest_html(user_name, tasks, sentiment_analytics)
                self._send_email(
                    to_email=email,
                    subject=f"🚀 Your Context IQ Daily Digest - {len(tasks)} Open Tasks",
                    html_content=html_content
                )
            
            log.info("--- ✅ Daily Digest Job Complete ---")

        except Exception as e:
            log.error(f"❌ Unhandled error in send_daily_digest: {e}")
            traceback.print_exc()

    # ==================== PROACTIVE INSIGHTS FUNCTIONALITY ====================

    def find_isolated_decisions(self) -> List[Dict[str, Any]]:
        """
        Finds decisions that were made but have no follow-up tasks or discussions.
        """
        if not self.graph_store:
            return []
        
        log.info("Proactive: Searching for isolated decisions...")
        query = """
        MATCH (d:Decision)
        WHERE NOT (d)<-[:LEAD_TO]-()<-[:MENTIONS]-()<-[:IN_CHANNEL]->()
              -[:IN_CHANNEL]->(follow_up:Event)
        AND NOT (d)<-[:LEAD_TO]-()<-[:CREATES]-(:Task)
        RETURN d.decision_id AS decision_id, d.text AS text, d.timestamp AS timestamp
        LIMIT 20
        """
        try:
            results = self.graph_store.run_cypher_query(query)
            log.info(f"Found {len(results)} isolated decisions.")
            return results
        except Exception as e:
            log.error(f"Error finding isolated decisions: {e}")
            return []

    def find_trending_topics(self) -> List[Dict[str, Any]]:
        """
        Finds entities (topics) that have had a high velocity of discussion recently.
        """
        if not self.graph_store:
            return []

        log.info("Proactive: Searching for trending topics...")
        query = """
        MATCH (e:Entity)<-[:MENTIONS]-(evt:Event)
        WHERE evt.timestamp > datetime() - duration({days: 2})
        WITH e, COUNT(evt) AS recent_mentions
        ORDER BY recent_mentions DESC
        LIMIT 10
        RETURN e.name AS topic, recent_mentions
        """
        try:
            results = self.graph_store.run_cypher_query(query)
            log.info(f"Found {len(results)} trending topics.")
            return results
        except Exception as e:
            log.error(f"Error finding trending topics: {e}")
            return []

    def generate_daily_insights(self) -> List[Insight]:
        """
        Generates a list of actionable insights based on daily analysis.
        """
        insights = []
        
        # Insight 1: Isolated Decisions
        isolated = self.find_isolated_decisions()
        if isolated:
            insight = Insight(
                id="daily_isolated_decisions",
                title="Isolated Decisions Detected",
                description="The following decisions were made but appear to have no follow-up tasks or discussions. "
                            "This could indicate a lack of action or incomplete communication.",
                source_type="proactive_analysis",
                content=json.dumps([{"id": d['decision_id'], "text": d['text']} for d in isolated]),
                recommendations=[
                    "Review each decision to ensure required actions were taken.",
                    "Assign tasks or follow-ups if necessary.",
                    "Ensure the decision was communicated to all relevant stakeholders."
                ]
            )
            insights.append(insight)

        # Insight 2: Trending Topics
        trending = self.find_trending_topics()
        if trending:
            topics = [f"{t['topic']} ({t['recent_mentions']} mentions)" for t in trending]
            insight = Insight(
                id="daily_trending_topics",
                title="Trending Topics Detected",
                description="The following topics have a high discussion velocity in the last 48 hours.",
                source_type="proactive_analysis",
                content=json.dumps(trending),
                recommendations=[
                    "Review trending topics for emerging issues or opportunities.",
                    "Consider if a formal decision or action is needed for high-velocity topics."
                ]
            )
            insights.append(insight)
            
        return insights

    async def run_daily_analysis(self):
        """
        The main job to be run by the scheduler.
        Generates insights and sends notifications.
        """
        log.info("="*50)
        log.info("Starting daily proactive analysis...")
        
        if not self.graph_store or not self.notifier:
            log.error("ProactiveService not fully initialized. Skipping daily analysis.")
            return

        try:
            insights = self.generate_daily_insights()
            
            if not insights:
                log.info("No new proactive insights found today.")
                log.info("Daily analysis complete.")
                log.info("="*50)
                return

            log.info(f"Generated {len(insights)} new insights. Sending to notification service...")
            
            # Send each insight to a default channel (e.g., 'general' or 'admin')
            # You should configure this to a real channel ID
            default_channel = os.getenv("DEFAULT_NOTIFICATION_CHANNEL", "C012345678")  # Example Slack ID
            
            for insight in insights:
                await self.notifier.send_proactive_insight(
                    channel_id=default_channel,
                    insight=insight
                )
            
            log.info("Daily analysis and notifications complete.")
            log.info("="*50)

        except Exception as e:
            log.error(f"Error during daily analysis: {e}")
            traceback.print_exc()


# Singleton instance
proactive_service = ProactiveService()