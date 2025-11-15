# backend/core/jira_service.py
import os
from jira import JIRA, JIRAError
from typing import Optional, Dict, Any, List

class JiraService:
    """
    Handles connection and actions with a Jira instance.
    Uses API Token for authentication (free to create in Jira Cloud).
    
    Requires Environment Variables:
    - JIRA_SERVER: Your Jira Cloud URL (e.g., "https://your-company.atlassian.net")
    - JIRA_USER_EMAIL: The email you use to log in to Jira
    - JIRA_API_TOKEN: The API token you generate in your Jira account settings
    """
    _instance = None
    _client = None

    def __new__(cls):
        if cls._instance is None:
            print("🧠 Initializing JiraService...")
            cls._instance = super(JiraService, cls).__new__(cls)
            cls._instance._connect()
        return cls._instance

    def _connect(self):
        self.server = os.getenv("JIRA_SERVER")
        self.email = os.getenv("JIRA_USER_EMAIL")
        self.token = os.getenv("JIRA_API_TOKEN")

        if not all([self.server, self.email, self.token]):
            print("⚠️ JiraService: JIRA_SERVER, JIRA_USER_EMAIL, or JIRA_API_TOKEN env vars not set. Service will be disabled.")
            self._client = None
            return

        try:
            self._client = JIRA(
                server=self.server,
                basic_auth=(self.email, self.token)
            )
            # Test connection
            self._client.myself()
            print("✓ Jira connection successful.")
        except JIRAError as e:
            print(f"❌ FAILED to connect to Jira: {e.text}")
            self._client = None

    def is_configured(self) -> bool:
        return self._client is not None

    def create_issue(self, project_key: str, summary: str, description: str, issue_type: str = "Task") -> Dict[str, Any]:
        """
        Creates a new issue in Jira.
        
        Args:
            project_key: The Jira project key (e.g., "PROJ")
            summary: The issue title
            description: The issue body
            issue_type: The type of issue (e.g., "Task", "Story", "Bug")
        
        Returns:
            A dictionary with the new issue's key and URL.
        """
        if not self.is_configured():
            raise Exception("JiraService is not configured.")

        issue_dict = {
            'project': {'key': project_key},
            'summary': summary,
            'description': description,
            'issuetype': {'name': issue_type},
        }

        try:
            new_issue = self._client.create_issue(fields=issue_dict)
            return {
                "key": new_issue.key,
                "url": new_issue.permalink()
            }
        except JIRAError as e:
            print(f"❌ Error creating Jira issue: {e.text}")
            raise

    def get_recent_issues(self, project_key: str, lookback_hours: int = 24) -> List[Dict[str, Any]]:
        """
        Fetches recently updated issues from a Jira project.
        """
        if not self.is_configured():
            raise Exception("JiraService is not configured.")

        jql = f"project = {project_key} AND updated >= -{lookback_hours}h ORDER BY updated DESC"
        
        try:
            issues = self._client.search_issues(jql, maxResults=50)
            results = []
            for issue in issues:
                results.append({
                    "id": issue.key,
                    "summary": issue.fields.summary,
                    "description": issue.fields.description or "",
                    "status": issue.fields.status.name,
                    "assignee_name": issue.fields.assignee.displayName if issue.fields.assignee else "Unassigned",
                    "assignee_id": issue.fields.assignee.emailAddress if issue.fields.assignee else "unassigned",
                    "updated_at": issue.fields.updated,
                    "raw": issue.raw
                })
            return results
        except JIRAError as e:
            print(f"❌ Error fetching Jira issues: {e.text}")
            raise

# Singleton instance
jira_service = JiraService()