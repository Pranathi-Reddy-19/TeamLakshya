# backend/core/audit_service.py
import logging
import json
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Literal
from enum import Enum
from dataclasses import dataclass, asdict
from pathlib import Path
import threading
from collections import defaultdict, deque

# Database imports
try:
    from core.db_connect import db_manager
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False
    print("Warning: Database not available for audit persistence")


class AuditLevel(str, Enum):
    """Audit severity levels"""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    SECURITY = "SECURITY"


class AuditCategory(str, Enum):
    """Categories of auditable actions"""
    AUTHENTICATION = "AUTHENTICATION"
    AUTHORIZATION = "AUTHORIZATION"
    DATA_ACCESS = "DATA_ACCESS"
    DATA_MODIFICATION = "DATA_MODIFICATION"
    SYSTEM_OPERATION = "SYSTEM_OPERATION"
    QUERY_EXECUTION = "QUERY_EXECUTION"
    FILE_OPERATION = "FILE_OPERATION"
    API_CALL = "API_CALL"
    CONFIGURATION_CHANGE = "CONFIGURATION_CHANGE"
    USER_MANAGEMENT = "USER_MANAGEMENT"


@dataclass
class AuditEntry:
    """Structured audit log entry"""
    timestamp: str
    user_id: str
    action: str
    category: AuditCategory
    level: AuditLevel
    details: Dict[str, Any]
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    result: Optional[str] = None  # success, failure, partial
    error_message: Optional[str] = None
    resource_id: Optional[str] = None
    resource_type: Optional[str] = None
    duration_ms: Optional[float] = None
    checksum: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(self.to_dict(), default=str)


class AuditService:
    """
    Advanced audit service with encryption, persistence, and compliance features.
    """
    
    def __init__(
        self,
        log_file: str = "/app/logs/audit_trail.log",  # CORRECTED PATH
        enable_encryption: bool = True,
        enable_database: bool = False,  # DISABLED FOR MVP (requires separate DB config)
        enable_anomaly_detection: bool = True,
        max_memory_entries: int = 1000,
        secret_key: Optional[str] = None
    ):
        """
        Initialize the audit service.
        
        Args:
            log_file: Path to audit log file
            enable_encryption: Enable log entry encryption/signing
            enable_database: Enable database persistence
            enable_anomaly_detection: Enable real-time anomaly detection
            max_memory_entries: Max entries to keep in memory for analysis
            secret_key: Secret key for HMAC signing (auto-generated if None)
        """
        self.log_file = Path(log_file)
        self.enable_encryption = enable_encryption
        self.enable_database = enable_database and DB_AVAILABLE
        self.enable_anomaly_detection = enable_anomaly_detection
        self.max_memory_entries = max_memory_entries
        
        # Generate or use provided secret key for HMAC
        self.secret_key = secret_key or secrets.token_hex(32)
        
        # In-memory storage for recent entries (for analytics)
        self.recent_entries: deque = deque(maxlen=max_memory_entries)
        
        # Anomaly detection structures
        self.user_action_patterns: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.failed_login_attempts: Dict[str, List[datetime]] = defaultdict(list)
        self.suspicious_activities: List[Dict[str, Any]] = []
        
        # Thread lock for concurrent access
        self.lock = threading.RLock()
        
        # Set up logging
        self._setup_logger()
        
        # Initialize database schema if enabled
        if False:  # self.enable_database:  # DISABLED FOR MVP
            self._init_database()
        
        # Log service initialization
        self.log_action(
            user_id="SYSTEM",
            action="AUDIT_SERVICE_INITIALIZED",
            category=AuditCategory.SYSTEM_OPERATION,
            level=AuditLevel.INFO,
            details={
                "encryption_enabled": enable_encryption,
                "database_enabled": self.enable_database,
                "anomaly_detection_enabled": enable_anomaly_detection
            }
        )
    
    def _setup_logger(self):
        """Set up dedicated audit logger"""
        self.logger = logging.getLogger('audit')
        self.logger.setLevel(logging.INFO)
        self.logger.propagate = False
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        # Ensure log directory exists
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # File handler
        file_handler = logging.FileHandler(str(self.log_file))
        file_handler.setLevel(logging.INFO)
        
        # Detailed format with all fields
        formatter = logging.Formatter(
            '%(asctime)s - [AUDIT] - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)
        
        # Console handler for critical events
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.WARNING)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
    
    def _init_database(self):
        """Initialize database schema for audit persistence"""
        if not self.enable_database:
            return
        
        try:
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Create audit_logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        action TEXT NOT NULL,
                        category TEXT NOT NULL,
                        level TEXT NOT NULL,
                        details TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        session_id TEXT,
                        result TEXT,
                        error_message TEXT,
                        resource_id TEXT,
                        resource_type TEXT,
                        duration_ms REAL,
                        checksum TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create indexes for common queries
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_audit_user_id 
                    ON audit_logs(user_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_audit_timestamp 
                    ON audit_logs(timestamp)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_audit_category 
                    ON audit_logs(category)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_audit_level 
                    ON audit_logs(level)
                """)
                
                conn.commit()
                print("✓ Audit database schema initialized")
        except Exception as e:
            print(f"⚠ Failed to initialize audit database: {e}")
            self.enable_database = False
    
    def _compute_checksum(self, entry: AuditEntry) -> str:
        """
        Compute HMAC checksum for log entry integrity.
        
        Args:
            entry: Audit entry to sign
            
        Returns:
            HMAC hex digest
        """
        if not self.enable_encryption:
            return ""
        
        # Create canonical representation
        data = f"{entry.timestamp}|{entry.user_id}|{entry.action}|{json.dumps(entry.details, sort_keys=True)}"
        
        # Compute HMAC-SHA256
        signature = hmac.new(
            self.secret_key.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def _verify_checksum(self, entry: AuditEntry) -> bool:
        """
        Verify integrity of audit entry.
        
        Args:
            entry: Audit entry to verify
            
        Returns:
            True if checksum is valid
        """
        if not self.enable_encryption or not entry.checksum:
            return True
        
        computed = self._compute_checksum(entry)
        return hmac.compare_digest(computed, entry.checksum)
    
    def _detect_anomalies(self, entry: AuditEntry):
        """
        Perform real-time anomaly detection on audit entries.
        
        Args:
            entry: New audit entry to analyze
        """
        if not self.enable_anomaly_detection:
            return
        
        with self.lock:
            # Track user action patterns
            self.user_action_patterns[entry.user_id][entry.action] += 1
            
            # Detect failed login attempts
            if entry.category == AuditCategory.AUTHENTICATION and entry.result == "failure":
                self.failed_login_attempts[entry.user_id].append(datetime.fromisoformat(entry.timestamp))
                
                # Clean old attempts (> 1 hour)
                one_hour_ago = datetime.now() - timedelta(hours=1)
                self.failed_login_attempts[entry.user_id] = [
                    ts for ts in self.failed_login_attempts[entry.user_id]
                    if ts > one_hour_ago
                ]
                
                # Alert on multiple failed attempts
                if len(self.failed_login_attempts[entry.user_id]) >= 5:
                    self._raise_alert(
                        alert_type="BRUTE_FORCE_ATTEMPT",
                        severity="CRITICAL",
                        user_id=entry.user_id,
                        details={
                            "failed_attempts": len(self.failed_login_attempts[entry.user_id]),
                            "time_window": "1 hour"
                        }
                    )
            
            # Detect unusual data access patterns
            if entry.category == AuditCategory.DATA_ACCESS:
                user_total_actions = sum(self.user_action_patterns[entry.user_id].values())
                
                # Alert on excessive data access
                if user_total_actions > 1000:  # Threshold
                    self._raise_alert(
                        alert_type="EXCESSIVE_DATA_ACCESS",
                        severity="WARNING",
                        user_id=entry.user_id,
                        details={
                            "total_actions": user_total_actions,
                            "action": entry.action
                        }
                    )
            
            # Detect privilege escalation attempts
            if entry.category == AuditCategory.AUTHORIZATION and entry.result == "failure":
                self._raise_alert(
                    alert_type="AUTHORIZATION_FAILURE",
                    severity="SECURITY",
                    user_id=entry.user_id,
                    details={
                        "action": entry.action,
                        "resource": entry.resource_id
                    }
                )
            
            # Detect after-hours activity
            current_hour = datetime.now().hour
            if current_hour < 6 or current_hour > 22:  # Outside business hours
                if entry.category in [
                    AuditCategory.DATA_MODIFICATION,
                    AuditCategory.CONFIGURATION_CHANGE,
                    AuditCategory.USER_MANAGEMENT
                ]:
                    self._raise_alert(
                        alert_type="AFTER_HOURS_ACTIVITY",
                        severity="WARNING",
                        user_id=entry.user_id,
                        details={
                            "action": entry.action,
                            "hour": current_hour
                        }
                    )
    
    def _raise_alert(
        self,
        alert_type: str,
        severity: str,
        user_id: str,
        details: Dict[str, Any]
    ):
        """
        Raise a security alert.
        
        Args:
            alert_type: Type of alert
            severity: Alert severity
            user_id: User involved
            details: Alert details
        """
        alert = {
            "timestamp": datetime.now().isoformat(),
            "type": alert_type,
            "severity": severity,
            "user_id": user_id,
            "details": details
        }
        
        self.suspicious_activities.append(alert)
        
        # Log to main audit trail
        self.logger.warning(f"SECURITY ALERT: {json.dumps(alert)}")
        
        # Keep only recent alerts (last 100)
        if len(self.suspicious_activities) > 100:
            self.suspicious_activities = self.suspicious_activities[-100:]
    
    def _persist_to_database(self, entry: AuditEntry):
        """
        Persist audit entry to database.
        
        Args:
            entry: Audit entry to persist
        """
        if not self.enable_database:
            return
        
        try:
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO audit_logs (
                        timestamp, user_id, action, category, level,
                        details, ip_address, user_agent, session_id,
                        result, error_message, resource_id, resource_type,
                        duration_ms, checksum
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    entry.timestamp,
                    entry.user_id,
                    entry.action,
                    entry.category.value,
                    entry.level.value,
                    json.dumps(entry.details),
                    entry.ip_address,
                    entry.user_agent,
                    entry.session_id,
                    entry.result,
                    entry.error_message,
                    entry.resource_id,
                    entry.resource_type,
                    entry.duration_ms,
                    entry.checksum
                ))
                conn.commit()
        except Exception as e:
            print(f"⚠ Failed to persist audit entry to database: {e}")
    
    def log_action(
        self,
        user_id: str,
        action: str,
        category: AuditCategory,
        level: AuditLevel = AuditLevel.INFO,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        result: Optional[str] = None,
        error_message: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        duration_ms: Optional[float] = None
    ):
        """
        Log an auditable action with comprehensive metadata.
        
        Args:
            user_id: User performing the action
            action: Action description
            category: Action category
            level: Severity level
            details: Additional context
            ip_address: Client IP address
            user_agent: Client user agent
            session_id: Session identifier
            result: Action result (success/failure/partial)
            error_message: Error details if failed
            resource_id: ID of affected resource
            resource_type: Type of affected resource
            duration_ms: Operation duration in milliseconds
        """
        try:
            # Create audit entry
            entry = AuditEntry(
                timestamp=datetime.now().isoformat(),
                user_id=user_id,
                action=action,
                category=category,
                level=level,
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                result=result,
                error_message=error_message,
                resource_id=resource_id,
                resource_type=resource_type,
                duration_ms=duration_ms
            )
            
            # Compute checksum for integrity
            if self.enable_encryption:
                entry.checksum = self._compute_checksum(entry)
            
            # Store in memory
            with self.lock:
                self.recent_entries.append(entry)
            
            # Detect anomalies
            self._detect_anomalies(entry)
            
            # Log to file
            log_message = entry.to_json()
            
            if level == AuditLevel.CRITICAL or level == AuditLevel.SECURITY:
                self.logger.critical(log_message)
            elif level == AuditLevel.WARNING:
                self.logger.warning(log_message)
            else:
                self.logger.info(log_message)
            
            # Persist to database
            self._persist_to_database(entry)
            
        except Exception as e:
            print(f"⚠ Failed to write to audit log: {e}")
            # Fallback to simple logging
            self.logger.error(f"Audit logging failed: {e}")
    
    def query_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        category: Optional[AuditCategory] = None,
        level: Optional[AuditLevel] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Query audit logs with filters.
        
        Args:
            user_id: Filter by user
            action: Filter by action
            category: Filter by category
            level: Filter by level
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum results
            
        Returns:
            List of matching audit entries
        """
        if True:  # not self.enable_database:  # FORCE IN-MEMORY QUERY FOR MVP
            # Query from memory
            results = []
            with self.lock:
                for entry in reversed(self.recent_entries):
                    if user_id and entry.user_id != user_id:
                        continue
                    if action and entry.action != action:
                        continue
                    if category and entry.category != category:
                        continue
                    if level and entry.level != level:
                        continue
                    if start_time:
                        entry_time = datetime.fromisoformat(entry.timestamp)
                        if entry_time < start_time:
                            continue
                    if end_time:
                        entry_time = datetime.fromisoformat(entry.timestamp)
                        if entry_time > end_time:
                            continue
                    
                    results.append(entry.to_dict())
                    
                    if len(results) >= limit:
                        break
            
            return results
        
        # Query from database
        try:
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Build query
                query = "SELECT * FROM audit_logs WHERE 1=1"
                params = []
                
                if user_id:
                    query += " AND user_id = ?"
                    params.append(user_id)
                if action:
                    query += " AND action = ?"
                    params.append(action)
                if category:
                    query += " AND category = ?"
                    params.append(category.value)
                if level:
                    query += " AND level = ?"
                    params.append(level.value)
                if start_time:
                    query += " AND timestamp >= ?"
                    params.append(start_time.isoformat())
                if end_time:
                    query += " AND timestamp <= ?"
                    params.append(end_time.isoformat())
                
                query += " ORDER BY timestamp DESC LIMIT ?"
                params.append(limit)
                
                cursor.execute(query, params)
                
                # Convert to dict
                columns = [desc[0] for desc in cursor.description]
                results = []
                for row in cursor.fetchall():
                    entry_dict = dict(zip(columns, row))
                    # Parse JSON details
                    if entry_dict.get('details'):
                        entry_dict['details'] = json.loads(entry_dict['details'])
                    results.append(entry_dict)
                
                return results
        except Exception as e:
            print(f"⚠ Failed to query audit logs: {e}")
            return []
    
    def get_user_activity_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get summary of user's activity.
        
        Args:
            user_id: User to analyze
            
        Returns:
            Activity summary
        """
        with self.lock:
            user_actions = self.user_action_patterns.get(user_id, {})
            total_actions = sum(user_actions.values())
            
            # Get recent entries for this user
            recent = [
                entry.to_dict()
                for entry in self.recent_entries
                if entry.user_id == user_id
            ][-10:]  # Last 10
            
            return {
                "user_id": user_id,
                "total_actions": total_actions,
                "action_breakdown": dict(user_actions),
                "recent_actions": recent,
                "failed_login_attempts": len(self.failed_login_attempts.get(user_id, [])),
                "last_activity": recent[-1]["timestamp"] if recent else None
            }
    
    def get_security_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get recent security alerts.
        
        Args:
            limit: Maximum alerts to return
            
        Returns:
            List of security alerts
        """
        with self.lock:
            return self.suspicious_activities[-limit:]
    
    def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Generate compliance report for audit period.
        
        Args:
            start_date: Report start date
            end_date: Report end date
            
        Returns:
            Compliance report
        """
        logs = self.query_logs(
            start_time=start_date,
            end_time=end_date,
            limit=10000
        )
        
        # Analyze logs
        report = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "total_events": len(logs),
            "by_category": defaultdict(int),
            "by_level": defaultdict(int),
            "by_user": defaultdict(int),
            "failed_operations": 0,
            "security_events": 0,
            "critical_events": 0,
            "top_users": [],
            "top_actions": defaultdict(int)
        }
        
        for log in logs:
            report["by_category"][log.get("category", "unknown")] += 1
            report["by_level"][log.get("level", "unknown")] += 1
            report["by_user"][log.get("user_id", "unknown")] += 1
            report["top_actions"][log.get("action", "unknown")] += 1
            
            if log.get("result") == "failure":
                report["failed_operations"] += 1
            if log.get("level") == "SECURITY":
                report["security_events"] += 1
            if log.get("level") == "CRITICAL":
                report["critical_events"] += 1
        
        # Get top users
        report["top_users"] = sorted(
            report["by_user"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        # Get top actions
        report["top_actions"] = dict(sorted(
            report["top_actions"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10])
        
        # Convert defaultdicts to regular dicts
        report["by_category"] = dict(report["by_category"])
        report["by_level"] = dict(report["by_level"])
        report["by_user"] = dict(report["by_user"])
        
        return report
    
    def verify_log_integrity(self, entry_dict: Dict[str, Any]) -> bool:
        """
        Verify integrity of a log entry.
        
        Args:
            entry_dict: Log entry as dictionary
            
        Returns:
            True if entry is valid
        """
        try:
            # Reconstruct entry
            entry = AuditEntry(
                timestamp=entry_dict["timestamp"],
                user_id=entry_dict["user_id"],
                action=entry_dict["action"],
                category=AuditCategory(entry_dict["category"]),
                level=AuditLevel(entry_dict["level"]),
                details=entry_dict.get("details", {}),
                ip_address=entry_dict.get("ip_address"),
                user_agent=entry_dict.get("user_agent"),
                session_id=entry_dict.get("session_id"),
                result=entry_dict.get("result"),
                error_message=entry_dict.get("error_message"),
                resource_id=entry_dict.get("resource_id"),
                resource_type=entry_dict.get("resource_type"),
                duration_ms=entry_dict.get("duration_ms"),
                checksum=entry_dict.get("checksum")
            )
            
            return self._verify_checksum(entry)
        except Exception as e:
            print(f"⚠ Failed to verify entry: {e}")
            return False


# Global audit service instance
audit_service = AuditService()


# Convenience functions for backward compatibility
def log_action(
    user_id: str,
    action: str,
    details: Dict[str, Any],
    category: AuditCategory = AuditCategory.SYSTEM_OPERATION,
    level: AuditLevel = AuditLevel.INFO,
    **kwargs
):
    """
    Convenience function to log an action.
    
    Args:
        user_id: User performing the action
        action: Action description
        details: Additional context
        category: Action category
        level: Severity level
        **kwargs: Additional audit metadata
    """
    audit_service.log_action(
        user_id=user_id,
        action=action,
        category=category,
        level=level,
        details=details,
        **kwargs
    )


# Export key components
__all__ = [
    'AuditService',
    'AuditLevel',
    'AuditCategory',
    'AuditEntry',
    'audit_service',
    'log_action'
]