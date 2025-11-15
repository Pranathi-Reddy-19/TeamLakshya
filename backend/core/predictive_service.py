# backend/core/predictive_service.py
from typing import Dict, Any, List, Optional, Tuple
import traceback
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import json
import joblib

from .graph_store import GraphStore
from .embedding import embedding_service
from .vector_store import VectorStore
# --- FIX: Import the singleton 'extractor_service' instance instead of 'extract_entities' ---
from ml.extractor import extractor_service
# --- End of fix ---

# Advanced ML imports
try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import DBSCAN
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.compose import ColumnTransformer
    import scipy.stats as stats
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("⚠️ Advanced ML libraries not available. Install scikit-learn and scipy for full functionality.")

# Model paths for pre-trained models
ML_MODEL_DIR = Path("/app/ml/models")
TIMELINE_MODEL_PATH = ML_MODEL_DIR / "decision_timeline_model.joblib"
IMPACT_MODEL_PATH = ML_MODEL_DIR / "decision_impact_model.joblib"
PREPROCESSOR_PATH = ML_MODEL_DIR / "preprocessor.joblib"


@dataclass
class PredictionFeatures:
    """Feature vector for ML-based prediction"""
    entity_count: int
    decision_length: int
    sentiment_score: float
    urgency_score: float
    complexity_score: float
    stakeholder_count: int
    historical_similar_count: int
    avg_historical_sentiment: float
    avg_historical_impact: float
    temporal_relevance: float


@dataclass
class OutcomeMetrics:
    """Structured outcome metrics"""
    timeline_days: float
    cost: float
    sentiment: float
    task_count: int
    risk_score: float
    success_probability: float
    affected_teams: List[str]
    cascade_effects: int


class TemporalPatternAnalyzer:
    """Analyzes temporal patterns in decision outcomes"""
    
    def __init__(self, graph_store: GraphStore):
        self.graph_store = graph_store
        
    async def analyze_seasonal_patterns(self, entity: str, lookback_days: int = 365) -> Dict[str, Any]:
        """Detect seasonal patterns in decision outcomes"""
        query = """
            MATCH (ent:Entity {name: $entity})<-[:MENTIONS]-(evt:Event)-[:LEAD_TO]->(d:Decision)
            WHERE evt.timestamp > datetime() - duration({days: $lookback_days})
            OPTIONAL MATCH (evt)-[:CREATES]->(t:Task)
            WITH d, evt, 
                 evt.timestamp.month AS month,
                 evt.timestamp.dayOfWeek AS day_of_week,
                 COUNT(t) AS task_count,
                 evt.sentimentScore AS sentiment
            RETURN month, day_of_week, 
                    AVG(task_count) AS avg_tasks,
                    AVG(sentiment) AS avg_sentiment,
                    COUNT(d) AS decision_count
        """
        
        try:
            results = await self.graph_store.run_cypher_query(query, {"entity": entity, "lookback_days": lookback_days})
                
            monthly_patterns = defaultdict(lambda: {"tasks": [], "sentiment": []})
            weekly_patterns = defaultdict(lambda: {"tasks": [], "sentiment": []})
            
            for record in results:
                month = record["month"]
                day = record["day_of_week"]
                monthly_patterns[month]["tasks"].append(record["avg_tasks"] or 0)
                monthly_patterns[month]["sentiment"].append(record["avg_sentiment"] or 0)
                weekly_patterns[day]["tasks"].append(record["avg_tasks"] or 0)
                weekly_patterns[day]["sentiment"].append(record["avg_sentiment"] or 0)
            
            return {
                "monthly_trends": {
                    month: {
                        "avg_tasks": np.mean(data["tasks"]) if data["tasks"] else 0,
                        "avg_sentiment": np.mean(data["sentiment"]) if data["sentiment"] else 0
                    }
                    for month, data in monthly_patterns.items()
                },
                "weekly_trends": {
                    day: {
                        "avg_tasks": np.mean(data["tasks"]) if data["tasks"] else 0,
                        "avg_sentiment": np.mean(data["sentiment"]) if data["sentiment"] else 0
                    }
                    for day, data in weekly_patterns.items()
                }
            }
        except Exception as e:
            print(f"❌ Error analyzing seasonal patterns: {e}")
            return {"monthly_trends": {}, "weekly_trends": {}}
    
    async def detect_trend_changes(self, entity: str, window_size: int = 30) -> Dict[str, Any]:
        """Detect significant trend changes using statistical tests"""
        query = """
            MATCH (ent:Entity {name: $entity})<-[:MENTIONS]-(evt:Event)-[:LEAD_TO]->(d:Decision)
            WHERE evt.timestamp > datetime() - duration({days: 180})
            OPTIONAL MATCH (evt)-[:CREATES]->(t:Task)
            WITH d, evt, COUNT(t) AS task_count
            ORDER BY evt.timestamp DESC
            RETURN evt.timestamp AS timestamp,
                   task_count,
                   evt.sentimentScore AS sentiment,
                   d.decision_id AS decision_id
            LIMIT 100
        """
        
        try:
            results = await self.graph_store.run_cypher_query(query, {"entity": entity})
                
            if len(results) < window_size * 2:
                return {"trend_detected": False, "reason": "Insufficient data"}
            
            # Split into recent and historical windows
            recent_tasks = [r["task_count"] for r in results[:window_size]]
            historical_tasks = [r["task_count"] for r in results[window_size:window_size*2]]
            
            recent_sentiment = [r["sentiment"] or 0 for r in results[:window_size]]
            historical_sentiment = [r["sentiment"] or 0 for r in results[window_size:window_size*2]]
            
            # Perform t-tests
            task_t_stat, task_p_value = stats.ttest_ind(recent_tasks, historical_tasks)
            sentiment_t_stat, sentiment_p_value = stats.ttest_ind(recent_sentiment, historical_sentiment)
            
            return {
                "trend_detected": task_p_value < 0.05 or sentiment_p_value < 0.05,
                "task_trend": {
                    "recent_avg": np.mean(recent_tasks),
                    "historical_avg": np.mean(historical_tasks),
                    "change_significant": task_p_value < 0.05,
                    "p_value": float(task_p_value),
                    "direction": "increasing" if np.mean(recent_tasks) > np.mean(historical_tasks) else "decreasing"
                },
                "sentiment_trend": {
                    "recent_avg": np.mean(recent_sentiment),
                    "historical_avg": np.mean(historical_sentiment),
                    "change_significant": sentiment_p_value < 0.05,
                    "p_value": float(sentiment_p_value),
                    "direction": "improving" if np.mean(recent_sentiment) > np.mean(historical_sentiment) else "declining"
                }
            }
        except Exception as e:
            print(f"❌ Error detecting trend changes: {e}")
            return {"trend_detected": False, "error": str(e)}


class CausalInferenceEngine:
    """Performs causal inference to understand decision impact"""
    
    def __init__(self, graph_store: GraphStore):
        self.graph_store = graph_store
    
    async def estimate_treatment_effect(self, decision_type: str, control_group: str) -> Dict[str, Any]:
        """Estimate causal effect using propensity score matching approach"""
        query = """
            // Find treated group (decisions of specific type)
            MATCH (d:Decision)
            WHERE d.text CONTAINS $decision_type
            OPTIONAL MATCH (d)<-[:LEAD_TO]-(evt:Event)-[:CREATES]->(t:Task)
            WITH d, evt, COUNT(t) AS outcome_treated, evt.sentimentScore AS sentiment_treated
            
            // Find control group
            MATCH (d_control:Decision)
            WHERE NOT d_control.text CONTAINS $decision_type
              AND d_control.text CONTAINS $control_group
            OPTIONAL MATCH (d_control)<-[:LEAD_TO]-(evt_control:Event)-[:CREATES]->(t_control:Task)
            WITH AVG(outcome_treated) AS avg_treated,
                 AVG(sentiment_treated) AS sent_treated,
                 COUNT(t_control) AS outcome_control,
                 evt_control.sentimentScore AS sentiment_control
            
            RETURN avg_treated,
                   sent_treated,
                   AVG(outcome_control) AS avg_control,
                   AVG(sentiment_control) AS sent_control
        """
        
        try:
            result = await self.graph_store.run_cypher_query(
                query, 
                {"decision_type": decision_type, "control_group": control_group}
            )
                
            if result:
                result = result[0]  # Get first record
                treated_outcome = result["avg_treated"] or 0
                control_outcome = result["avg_control"] or 0
                ate = treated_outcome - control_outcome
                
                return {
                    "average_treatment_effect": float(ate),
                    "treated_mean": float(treated_outcome),
                    "control_mean": float(control_outcome),
                    "effect_size": float(ate / (control_outcome + 0.01)),
                    "interpretation": "positive" if ate > 0 else "negative"
                }
        except Exception as e:
            print(f"❌ Error estimating treatment effect: {e}")
        
        return {"error": "Could not estimate treatment effect"}
    
    async def identify_confounders(self, decision_id: str) -> List[Dict[str, Any]]:
        """Identify potential confounding variables"""
        query = """
            MATCH (d:Decision {decision_id: $decision_id})<-[:LEAD_TO]-(evt:Event)
            MATCH (evt)-[:MENTIONS]->(ent:Entity)
            MATCH (evt)-[:IN_CHANNEL]->(ch:Channel)
            MATCH (evt)<-[:AUTHORED]-(u:User)
            
            // Find other decisions by same author
            MATCH (u)-[:AUTHORED]->(other_evt:Event)-[:LEAD_TO]->(other_d:Decision)
            WHERE other_d <> d
            
            RETURN ent.name AS entity,
                   ch.channel_id AS channel,
                   u.user_id AS author,
                   COUNT(other_d) AS author_decision_count,
                   AVG(other_evt.sentimentScore) AS author_avg_sentiment
        """
        
        try:
            results = await self.graph_store.run_cypher_query(query, {"decision_id": decision_id})
                
            confounders = []
            for record in results:
                confounders.append({
                    "type": "author_experience",
                    "value": record["author_decision_count"],
                    "author": record["author"],
                    "avg_sentiment": record["author_avg_sentiment"] or 0
                })
            
            return confounders
        except Exception as e:
            print(f"❌ Error identifying confounders: {e}")
            return []


class MLPredictionModel:
    """
    Unified machine learning models for outcome prediction.
    Supports both inline training and loading pre-trained models.
    """
    
    def __init__(self):
        # Inline trained models (legacy)
        self.timeline_model = None
        self.cost_model = None
        self.success_classifier = None
        self.scaler = StandardScaler()
        
        # Pre-trained models (new)
        self.pretrained_timeline_model = None
        self.pretrained_impact_model = None
        self.preprocessor = None
        
        self.is_inline_trained = False
        self.is_pretrained_loaded = False
        
        # Try to load pre-trained models
        self._load_pretrained_models()
        
    def _load_pretrained_models(self):
        """Load pre-trained models from disk if available"""
        if not ML_AVAILABLE:
            return
            
        print("🔄 Attempting to load pre-trained models...")
        
        if not PREPROCESSOR_PATH.exists() or \
           not TIMELINE_MODEL_PATH.exists() or \
           not IMPACT_MODEL_PATH.exists():
            print("⚠️ Pre-trained models not found. Will use inline training if data available.")
            print(f"  Expected location: {ML_MODEL_DIR}")
            return
        
        try:
            self.preprocessor = joblib.load(PREPROCESSOR_PATH)
            self.pretrained_timeline_model = joblib.load(TIMELINE_MODEL_PATH)
            self.pretrained_impact_model = joblib.load(IMPACT_MODEL_PATH)
            
            self.is_pretrained_loaded = True
            print("✓ Pre-trained models loaded successfully")
            
        except Exception as e:
            print(f"❌ Failed to load pre-trained models: {e}")
            self.is_pretrained_loaded = False
    
    def extract_features(self, decision_data: Dict[str, Any]) -> np.ndarray:
        """Extract feature vector from decision data for inline models"""
        features = PredictionFeatures(
            entity_count=len(decision_data.get('entities', [])),
            decision_length=len(decision_data.get('text', '')),
            sentiment_score=decision_data.get('sentiment', 0.0),
            urgency_score=decision_data.get('urgency', 0.5),
            complexity_score=decision_data.get('complexity', 0.5),
            stakeholder_count=decision_data.get('stakeholder_count', 0),
            historical_similar_count=decision_data.get('similar_count', 0),
            avg_historical_sentiment=decision_data.get('avg_hist_sentiment', 0.0),
            avg_historical_impact=decision_data.get('avg_hist_impact', 0.5),
            temporal_relevance=decision_data.get('temporal_relevance', 1.0)
        )
        
        return np.array([
            features.entity_count,
            features.decision_length,
            features.sentiment_score,
            features.urgency_score,
            features.complexity_score,
            features.stakeholder_count,
            features.historical_similar_count,
            features.avg_historical_sentiment,
            features.avg_historical_impact,
            features.temporal_relevance
        ]).reshape(1, -1)
    
    def train_inline_models(self, training_data: List[Dict[str, Any]]) -> bool:
        """Train inline ML models on historical data"""
        if not ML_AVAILABLE or len(training_data) < 10:
            print("⚠️ Insufficient data or ML libraries unavailable for inline training")
            return False
        
        try:
            X = []
            y_timeline = []
            y_cost = []
            y_success = []
            
            for data in training_data:
                features = self.extract_features(data)
                X.append(features[0])
                y_timeline.append(data.get('actual_timeline', 10))
                y_cost.append(data.get('actual_cost', 5000))
                y_success.append(1 if data.get('successful', True) else 0)
            
            X = np.array(X)
            X_scaled = self.scaler.fit_transform(X)
            
            # Train regression models
            self.timeline_model = RandomForestRegressor(n_estimators=100, random_state=42)
            self.timeline_model.fit(X_scaled, y_timeline)
            
            self.cost_model = RandomForestRegressor(n_estimators=100, random_state=42)
            self.cost_model.fit(X_scaled, y_cost)
            
            # Train classification model
            self.success_classifier = GradientBoostingClassifier(n_estimators=100, random_state=42)
            self.success_classifier.fit(X_scaled, y_success)
            
            self.is_inline_trained = True
            print("✓ Inline ML models trained successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error training inline models: {e}")
            traceback.print_exc()
            return False
    
    def predict(self, decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make predictions using the best available model.
        Priority: Pre-trained > Inline trained > Fallback
        """
        # Try pre-trained models first
        if self.is_pretrained_loaded:
            try:
                return self._predict_with_pretrained(decision_data)
            except Exception as e:
                print(f"⚠️ Pre-trained prediction failed, falling back: {e}")
        
        # Fall back to inline trained models
        if self.is_inline_trained:
            try:
                return self._predict_with_inline(decision_data)
            except Exception as e:
                print(f"⚠️ Inline prediction failed: {e}")
        
        # Ultimate fallback
        return {
            "error": "No trained models available",
            "using_fallback": True,
            "predicted_timeline": 10.0,
            "predicted_cost": 5000.0,
            "success_probability": 0.5
        }
    
    def _predict_with_pretrained(self, decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make predictions using pre-trained models"""
        # Prepare data for preprocessor
        data_df = pd.DataFrame({
            'decision_text': [decision_data.get('text', '')],
            'urgency': [self._map_urgency_score_to_category(decision_data.get('urgency', 0.5))],
            'team_size': [decision_data.get('stakeholder_count', 3)],
            'project_code': [decision_data.get('project_code', 'unknown')]
        })
        
        # Transform features
        X_transformed = self.preprocessor.transform(data_df)
        
        # Predict timeline
        timeline_pred = self.pretrained_timeline_model.predict(X_transformed)[0]
        timeline_pred = max(1, int(round(timeline_pred)))
        
        # Predict impact/success
        impact_probs = self.pretrained_impact_model.predict_proba(X_transformed)[0]
        impact_classes = self.pretrained_impact_model.classes_
        success_prob = impact_probs[list(impact_classes).index('high')] if 'high' in impact_classes else np.max(impact_probs)
        
        # Estimate cost from timeline
        cost_pred = timeline_pred * 1500 + 2000
        
        return {
            "predicted_timeline": float(timeline_pred),
            "predicted_cost": float(cost_pred),
            "success_probability": float(success_prob),
            "predicted_impact": impact_classes[np.argmax(impact_probs)],
            "impact_probabilities": {cls: float(prob) for cls, prob in zip(impact_classes, impact_probs)},
            "model_type": "pretrained",
            "confidence_interval_timeline": (
                float(timeline_pred * 0.8),
                float(timeline_pred * 1.2)
            ),
            "confidence_interval_cost": (
                float(cost_pred * 0.7),
                float(cost_pred * 1.3)
            )
        }
    
    def _predict_with_inline(self, decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make predictions using inline trained models"""
        features = self.extract_features(decision_data)
        features_scaled = self.scaler.transform(features)
        
        timeline_pred = self.timeline_model.predict(features_scaled)[0]
        cost_pred = self.cost_model.predict(features_scaled)[0]
        success_prob = self.success_classifier.predict_proba(features_scaled)[0][1]
        
        # Get feature importance
        feature_importance = {
            "timeline_drivers": self.timeline_model.feature_importances_.tolist(),
            "cost_drivers": self.cost_model.feature_importances_.tolist()
        }
        
        return {
            "predicted_timeline": float(timeline_pred),
            "predicted_cost": float(cost_pred),
            "success_probability": float(success_prob),
            "model_type": "inline",
            "confidence_interval_timeline": (
                float(timeline_pred * 0.8),
                float(timeline_pred * 1.2)
            ),
            "confidence_interval_cost": (
                float(cost_pred * 0.7),
                float(cost_pred * 1.3)
            ),
            "feature_importance": feature_importance
        }
    
    def _map_urgency_score_to_category(self, urgency_score: float) -> str:
        """Map numeric urgency score to category"""
        if urgency_score < 0.33:
            return 'low'
        elif urgency_score < 0.67:
            return 'medium'
        else:
            return 'high'
    
    @property
    def is_trained(self) -> bool:
        """Check if any model is available"""
        return self.is_pretrained_loaded or self.is_inline_trained


class PredictiveService:
    """
    Advanced predictive analytics and counterfactual simulation
    with ML models, causal inference, and temporal analysis.
    
    Unified service supporting both pre-trained and inline-trained models.
    """
    
    def __init__(
        self,
        graph_store: Optional[GraphStore] = None,
        vector_store: Optional[VectorStore] = None
    ):
        self.graph_store = graph_store or GraphStore()
        self.vector_store = vector_store or VectorStore()
        self.temporal_analyzer = TemporalPatternAnalyzer(self.graph_store)
        self.causal_engine = CausalInferenceEngine(self.graph_store)
        self.ml_model = MLPredictionModel()
        
        # Auto-train inline models if pre-trained not available
        if not self.ml_model.is_pretrained_loaded:
            # Don't call async method from __init__ - will be called on first use
            self._inline_models_initialized = False
        
        print("✓ Advanced PredictiveService initialized.")
        print(f"  Pre-trained models: {'✓' if self.ml_model.is_pretrained_loaded else '✗'}")
        print(f"  Inline models: {'✓' if self.ml_model.is_inline_trained else '✗'}")
    
    async def _initialize_inline_models(self):
        """Load historical data and train inline ML models"""
        if self._inline_models_initialized:
            return
            
        print("🔄 Initializing inline ML models...")
        try:
            training_data = await self._load_training_data()
            if training_data:
                self.ml_model.train_inline_models(training_data)
                self._inline_models_initialized = True
        except Exception as e:
            print(f"⚠️ Could not initialize inline ML models: {e}")
    
    async def _load_training_data(self) -> List[Dict[str, Any]]:
        """Load historical decision data for model training"""
        query = """
            MATCH (d:Decision)<-[:LEAD_TO]-(evt:Event)
            WHERE evt.timestamp > datetime() - duration({days: 365})
            OPTIONAL MATCH (evt)-[:MENTIONS]->(ent:Entity)
            OPTIONAL MATCH (evt)-[:CREATES]->(t:Task)
            OPTIONAL MATCH (evt)-[:IN_CHANNEL]->(ch:Channel)<-[:IN_CHANNEL]-(follow_evt:Event)
            WHERE follow_evt.timestamp > evt.timestamp 
              AND follow_evt.timestamp <= evt.timestamp + duration({days: 14})
            
            WITH d, evt, 
                 COLLECT(DISTINCT ent.name) AS entities,
                 COUNT(DISTINCT t) AS task_count,
                 AVG(follow_evt.sentimentScore) AS follow_sentiment
            
            RETURN d.decision_id AS decision_id,
                   d.text AS text,
                   entities,
                   evt.sentimentScore AS sentiment,
                   task_count AS actual_timeline,
                   task_count * 1500 AS actual_cost,
                   CASE WHEN follow_sentiment > 0 THEN true ELSE false END AS successful
            LIMIT 100
        """
        
        try:
            results = await self.graph_store.run_cypher_query(query)
            training_data = []
            
            for record in results:
                training_data.append({
                    'decision_id': record['decision_id'],
                    'text': record['text'],
                    'entities': record['entities'],
                    'sentiment': record['sentiment'] or 0,
                    'actual_timeline': record['actual_timeline'] or 10,
                    'actual_cost': record['actual_cost'] or 5000,
                    'successful': record['successful'],
                    # Additional features
                    'entity_count': len(record['entities']),
                    'urgency': 0.7 if 'urgent' in record['text'].lower() else 0.3,
                    'complexity': min(1.0, len(record['entities']) / 5.0),
                    'stakeholder_count': len(record['entities']),
                    'similar_count': 5,
                    'avg_hist_sentiment': 0.2,
                    'avg_hist_impact': 0.5,
                    'temporal_relevance': 1.0
                })
            
            return training_data
        except Exception as e:
            print(f"❌ Error loading training data: {e}")
            return []
    
    async def predict_decision_impact(
        self, 
        decision_text: str,
        include_ml: bool = True,
        include_temporal: bool = True,
        include_causal: bool = False
    ) -> Dict[str, Any]:
        """
        Advanced impact prediction with multiple analysis methods.
        
        Args:
            decision_text: The decision to analyze
            include_ml: Use ML models for prediction
            include_temporal: Include temporal pattern analysis
            include_causal: Include causal inference (slower)
        """
        print(f"🧠 Advanced prediction for: '{decision_text}'")
        
        if not decision_text:
            return {"error": "Decision text cannot be empty."}
        
        try:
            # Initialize inline models if needed
            if not self.ml_model.is_trained and not self.ml_model.is_pretrained_loaded:
                await self._initialize_inline_models()
            
            # --- FIX: Call the method on the 'extractor_service' instance ---
            # This should return a list of entity dicts, not the full analysis dict
            entity_list = extractor_service.extract_entities(decision_text)
            # --- End of fix ---
            
            entities = [ent['text'] for ent in entity_list]
            print(f"   Entities extracted: {entities}")
            
            # 2. Find historical outcomes using graph patterns
            similar_outcomes = await self._find_historical_outcomes_advanced(entities, decision_text)
            print(f"   Found {len(similar_outcomes)} similar historical outcomes.")
            
            # 3. Temporal analysis
            temporal_insights = {}
            if include_temporal and entities:
                temporal_insights = await self.temporal_analyzer.analyze_seasonal_patterns(
                    entities[0],
                    lookback_days=365
                )
                trend_analysis = await self.temporal_analyzer.detect_trend_changes(entities[0])
                temporal_insights['trend_analysis'] = trend_analysis
            
            # 4. ML-based prediction
            ml_prediction = {}
            if include_ml and self.ml_model.is_trained:
                # We need the sentiment score, which is not in extract_entities
                # Let's get it separately.
                sentiment_analysis = extractor_service.extract_sentiment(decision_text)
                
                decision_data = {
                    'text': decision_text,
                    'entities': entities,
                    'sentiment': sentiment_analysis.get('score', 0.0), # Use sentiment score
                    'urgency': 0.7 if 'urgent' in decision_text.lower() else 0.3,
                    'complexity': min(1.0, len(entities) / 5.0),
                    'stakeholder_count': len(entities),
                    'similar_count': len(similar_outcomes),
                    'avg_hist_sentiment': np.mean([o['avg_sentiment'] for o in similar_outcomes]) if similar_outcomes else 0,
                    'avg_hist_impact': np.mean([o['tasks_created'] for o in similar_outcomes]) if similar_outcomes else 0.5,
                    'temporal_relevance': 1.0
                }
                ml_prediction = self.ml_model.predict(decision_data)
            
            # 5. Risk assessment
            risk_assessment = await self._assess_risks(
                decision_text, 
                entities, 
                similar_outcomes,
                temporal_insights
            )
            
            # 6. Cascade effect analysis
            cascade_effects = await self._analyze_cascade_effects(entities)
            
            # 7. Aggregate predictions
            if not similar_outcomes and not ml_prediction:
                return self._default_prediction(decision_text, entities, risk_assessment)
            
            # Combine historical and ML predictions
            if ml_prediction and not ml_prediction.get('error'):
                predicted_timeline = ml_prediction['predicted_timeline']
                predicted_cost = ml_prediction['predicted_cost']
                confidence = ml_prediction['success_probability']
            else:
                avg_tasks = np.mean([o['tasks_created'] for o in similar_outcomes]) if similar_outcomes else 3
                predicted_timeline = avg_tasks * 2 + 5
                predicted_cost = avg_tasks * 1500 + 2000
                confidence = min(0.9, 0.6 + len(similar_outcomes) * 0.03)
            
            avg_sentiment = np.mean([o['avg_sentiment'] for o in similar_outcomes]) if similar_outcomes else 0.0
            
            # Impact classification
            impact_level = self._classify_impact(predicted_timeline, predicted_cost, avg_sentiment)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                decision_text,
                entities,
                similar_outcomes,
                risk_assessment,
                temporal_insights,
                cascade_effects
            )
            
            return {
                "decision_text": decision_text,
                "predicted_impact": impact_level,
                "confidence": float(confidence),
                "predictions": {
                    "timeline_days": float(predicted_timeline),
                    "cost_estimate": float(predicted_cost),
                    "sentiment_impact": self._format_sentiment(avg_sentiment),
                    "risk_score": risk_assessment['overall_risk'],
                    "cascade_effect_probability": cascade_effects['probability']
                },
                "analysis": {
                    "historical_precedents": len(similar_outcomes),
                    "affected_teams": list(set(
                        team for o in similar_outcomes for team in o.get('involved_channels', [])
                    )),
                    "key_entities": entities,
                    "temporal_factors": temporal_insights.get('trend_analysis', {}),
                    "risk_factors": risk_assessment['factors'],
                    "cascade_effects": cascade_effects['potential_effects']
                },
                "ml_insights": ml_prediction if ml_prediction else None,
                "recommendations": recommendations,
                "confidence_intervals": ml_prediction.get('confidence_interval_timeline') if ml_prediction else None,
                "model_info": {
                    "type": ml_prediction.get('model_type') if ml_prediction else 'heuristic',
                    "pretrained_available": self.ml_model.is_pretrained_loaded,
                    "inline_trained": self.ml_model.is_inline_trained
                }
            }
            
        except Exception as e:
            print(f"❌ Error during advanced prediction: {e}")
            traceback.print_exc()
            return {"error": f"Prediction failed: {e}"}
    
    async def _find_historical_outcomes_advanced(
        self, 
        entities: List[str], 
        decision_text: str
    ) -> List[Dict[str, Any]]:
        """Enhanced historical outcome search with vector similarity"""
        
        # First, try entity-based search
        entity_outcomes = await self._find_historical_outcomes(entities) if entities else []
        
        # Then, add vector similarity search
        vector_outcomes = []
        if self.vector_store and decision_text:
            try:
                decision_embedding_list = embedding_service.get_embeddings([decision_text])
                if decision_embedding_list:
                    decision_vector = decision_embedding_list[0]
                    similar_events = self.vector_store.search_similar(
                        query_vector=decision_vector,
                        top_k=10,
                    )
                    for sim_event in similar_events:
                        event_id = sim_event.get('event_id')
                        linked_decision_id = await self._find_decision_linked_to_event(event_id)
                        if linked_decision_id:
                            outcome = await self._get_decision_outcome_detailed(linked_decision_id)
                            if outcome:
                                outcome['similarity_score'] = 1 - sim_event.get('score', 1.0)
                                vector_outcomes.append(outcome)
                else:
                    print("⚠️ Could not generate embedding for vector search.")
            except Exception as e:
                print(f"⚠️ Vector similarity search failed: {e}")
        
        # Combine and deduplicate
        combined_outcomes = entity_outcomes + vector_outcomes
        seen_ids = set()
        unique_outcomes = []
        for outcome in combined_outcomes:
            if outcome and outcome.get('decision_id') and outcome.get('decision_id') not in seen_ids:
                seen_ids.add(outcome.get('decision_id'))
                unique_outcomes.append(outcome)
        
        return unique_outcomes
    
    async def _find_decision_linked_to_event(self, event_id: str) -> Optional[str]:
        """Find a decision ID linked to a specific event ID."""
        query = """
            MATCH (evt:Event {event_id: $event_id})-[:LEAD_TO]->(d:Decision)
            RETURN d.decision_id AS decisionId
            LIMIT 1
        """
        try:
            results = await self.graph_store.run_cypher_query(query, {"event_id": event_id})
            return results[0]["decisionId"] if results else None
        except Exception as e:
            print(f"❌ Error finding decision for event {event_id}: {e}")
            return None
    
    async def _find_historical_outcomes(self, entities: List[str]) -> List[Dict[str, Any]]:
        """Original entity-based historical search"""
        if not entities:
            return []
        
        query = """
            MATCH (ent:Entity)<-[:MENTIONS]-(evt:Event)-[:LEAD_TO]->(d:Decision)
            WHERE ent.name IN $entities
            WITH d, evt ORDER BY evt.timestamp DESC
            LIMIT 50
            
            OPTIONAL MATCH (evt)-[:CREATES]->(t:Task)
            WITH d, evt, COLLECT(DISTINCT t) AS created_tasks
            
            OPTIONAL MATCH (evt)-[:IN_CHANNEL]->(c:Channel)<-[:IN_CHANNEL]-(follow_up_evt:Event)
            WHERE follow_up_evt.timestamp > evt.timestamp 
              AND follow_up_evt.timestamp <= evt.timestamp + duration({days: 7})
            
            WITH d, evt.source AS source, c.channel_id AS channel, 
                 SIZE(created_tasks) AS tasks_count, 
                 AVG(follow_up_evt.sentimentScore) AS avg_follow_up_sentiment
            
            RETURN DISTINCT
                 d.decision_id AS decisionId,
                 d.text AS decisionText,
                 tasks_count,
                 avg_follow_up_sentiment,
                 channel
        """
        
        outcomes = []
        try:
            results = await self.graph_store.run_cypher_query(query, {"entities": entities})
            for record in results:
                outcomes.append({
                    "decision_id": record["decisionId"],
                    "tasks_created": record["tasks_count"] or 0,
                    "avg_sentiment": record["avg_follow_up_sentiment"] or 0.0,
                    "involved_channels": [record["channel"]] if record["channel"] else []
                })
            return outcomes
        except Exception as e:
            print(f"❌ Error querying historical outcomes: {e}")
            traceback.print_exc()
            return []
    
    async def _assess_risks(
        self,
        decision_text: str,
        entities: List[str],
        similar_outcomes: List[Dict[str, Any]],
        temporal_insights: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Comprehensive risk assessment"""
        risk_factors = []
        risk_score = 0.0
        
        # Historical risk
        if similar_outcomes:
            negative_outcomes = sum(1 for o in similar_outcomes if o['avg_sentiment'] < -0.2)
            if negative_outcomes / len(similar_outcomes) > 0.3:
                risk_factors.append("High proportion of negative historical outcomes")
                risk_score += 0.25
        
        # Complexity risk
        if len(entities) > 5:
            risk_factors.append("High complexity (many entities involved)")
            risk_score += 0.15
        
        # Temporal risk
        if temporal_insights.get('trend_analysis', {}).get('sentiment_trend', {}).get('direction') == 'declining':
            risk_factors.append("Declining sentiment trend in this area")
            risk_score += 0.20
        
        # Urgency risk
        if any(keyword in decision_text.lower() for keyword in ['urgent', 'immediate', 'critical', 'asap']):
            risk_factors.append("High urgency may lead to rushed execution")
            risk_score += 0.15
        
        # Uncertainty risk
        if not similar_outcomes:
            risk_factors.append("No historical precedent - high uncertainty")
            risk_score += 0.30
        
        return {
            "overall_risk": min(1.0, risk_score),
            "risk_level": "high" if risk_score > 0.6 else ("medium" if risk_score > 0.3 else "low"),
            "factors": risk_factors
        }
    
    async def _analyze_cascade_effects(self, entities: List[str]) -> Dict[str, Any]:
        """Analyze potential cascade effects across teams/projects"""
        if not entities:
            return {"probability": 0.0, "potential_effects": []}
        
        query = """
            MATCH (ent:Entity)<-[:MENTIONS]-(evt1:Event)
            WHERE ent.name IN $entities
            MATCH (evt1)-[:IN_CHANNEL]->(ch:Channel)<-[:IN_CHANNEL]-(evt2:Event)
            MATCH (evt2)-[:MENTIONS]->(other_ent:Entity)
            WHERE other_ent <> ent
            WITH other_ent, COUNT(DISTINCT evt2) AS connection_strength
            ORDER BY connection_strength DESC
            LIMIT 10
            RETURN other_ent.name AS connected_entity,
                   connection_strength
        """
        
        try:
            results = await self.graph_store.run_cypher_query(query, {"entities": entities})
                
            if not results:
                return {"probability": 0.1, "potential_effects": []}
            
            effects = []
            total_strength = 0
            for record in results:
                strength = record['connection_strength']
                total_strength += strength
                effects.append({
                    "entity": record['connected_entity'],
                    "impact_strength": strength
                })
            
            probability = min(1.0, total_strength / 50.0)
            
            return {
                "probability": float(probability),
                "potential_effects": effects
            }
        except Exception as e:
            print(f"❌ Error analyzing cascade effects: {e}")
            return {"probability": 0.0, "potential_effects": []}
    
    def _classify_impact(self, timeline: float, cost: float, sentiment: float) -> str:
        """Classify overall impact level"""
        score = 0
        
        if timeline > 10:
            score += 2
        elif timeline > 5:
            score += 1
        
        if cost > 10000:
            score += 2
        elif cost > 5000:
            score += 1
        
        if sentiment < -0.2:
            score += 2
        elif sentiment < 0:
            score += 1
        
        if score >= 5:
            return "high"
        elif score >= 2:
            return "medium"
        else:
            return "low"
    
    def _format_sentiment(self, sentiment: float) -> str:
        """Format sentiment score into readable text"""
        if sentiment < -0.1:
            return f"Likely negative (score: {sentiment:.2f})"
        elif sentiment > 0.1:
            return f"Likely positive (score: {sentiment:.2f})"
        else:
            return f"Likely neutral (score: {sentiment:.2f})"
    
    def _generate_recommendations(
        self,
        decision_text: str,
        entities: List[str],
        similar_outcomes: List[Dict[str, Any]],
        risk_assessment: Dict[str, Any],
        temporal_insights: Dict[str, Any],
        cascade_effects: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        if risk_assessment['risk_level'] == 'high':
            recommendations.append("⚠️ High risk detected - consider stakeholder review before proceeding")
        
        if cascade_effects['probability'] > 0.5:
            recommendations.append(
                f"🔗 High cascade probability ({cascade_effects['probability']:.1%}) - "
                "coordinate with potentially affected teams"
            )
        
        if temporal_insights.get('trend_analysis', {}).get('sentiment_trend', {}).get('direction') == 'declining':
            recommendations.append("📉 Declining sentiment trend - address root causes before implementing")
        
        if similar_outcomes:
            negative_rate = sum(1 for o in similar_outcomes if o['avg_sentiment'] < 0) / len(similar_outcomes)
            if negative_rate > 0.4:
                recommendations.append(
                    f"📊 {negative_rate:.0%} of similar decisions had negative outcomes - "
                    "review failure patterns"
                )
        
        if not similar_outcomes:
            recommendations.append("🆕 No historical precedent - implement with extra monitoring and checkpoints")
        
        if len(entities) > 5:
            recommendations.append("🎯 High complexity - consider phased implementation approach")
        
        return recommendations or ["✓ Proceed with standard implementation process"]
    
    def _default_prediction(
        self, 
        decision_text: str, 
        entities: List[str],
        risk_assessment: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Default prediction when no historical data available"""
        return {
            "decision_text": decision_text,
            "predicted_impact": "medium",
            "confidence": 0.40,
            "predictions": {
                "timeline_days": 10.0,
                "cost_estimate": 5000.0,
                "sentiment_impact": "Unknown - insufficient historical data",
                "risk_score": risk_assessment['overall_risk'],
                "cascade_effect_probability": 0.3
            },
            "analysis": {
                "historical_precedents": 0,
                "affected_teams": [],
                "key_entities": entities,
                "risk_factors": risk_assessment['factors']
            },
            "recommendations": [
                "🆕 Insufficient historical data for detailed prediction",
                "📊 Implement with comprehensive monitoring to establish baseline",
                "✓ Document outcomes to improve future predictions"
            ]
        }
    
    async def simulate_counterfactual(
        self, 
        original_decision_id: str, 
        alternate_decision_text: str,
        simulation_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Advanced counterfactual simulation with causal inference.
        """
        print(f"⏳ Advanced counterfactual simulation for decision {original_decision_id}")
        
        if not original_decision_id or not alternate_decision_text:
            return {"error": "Original decision ID and alternate text are required."}
        
        params = simulation_params or {}
        num_simulations = params.get('num_simulations', 100)
        confidence_level = params.get('confidence_level', 0.95)
        
        try:
            # 1. Get original decision outcome
            original_outcome = await self._get_decision_outcome_detailed(original_decision_id)
            if not original_outcome:
                return {"error": f"Original decision {original_decision_id} not found."}
            
            print(f"   Original Outcome: {original_outcome}")
            
            # --- FIX: Call the method on the 'extractor_service' instance ---
            # This should return a list of entity dicts
            alt_entity_list = extractor_service.extract_entities(alternate_decision_text)
            # --- End of fix ---
            alt_entities = [ent['text'] for ent in alt_entity_list]
            
            # 3. Get historical data for alternate scenario
            alt_historical = await self._find_historical_outcomes_advanced(alt_entities, alternate_decision_text)
            
            # 4. Run Monte Carlo simulation
            simulations = self._run_monte_carlo_simulation(
                original_outcome,
                alternate_decision_text,
                alt_historical,
                num_simulations
            )
            
            # 5. Statistical analysis of simulations
            stats_analysis = self._analyze_simulation_results(simulations, confidence_level)
            
            # 6. Causal inference
            causal_estimate = self._estimate_causal_effect(
                original_outcome,
                stats_analysis['mean_outcome']
            )
            
            # 7. Scenario comparison
            comparison = self._compare_scenarios_advanced(
                original_outcome,
                stats_analysis['mean_outcome'],
                stats_analysis
            )
            
            return {
                "original_decision_id": original_decision_id,
                "alternate_decision_text": alternate_decision_text,
                "simulation_parameters": {
                    "num_simulations": num_simulations,
                    "confidence_level": confidence_level
                },
                "original_outcome": {
                    "timeline_days": original_outcome.get('timeline_days'),
                    "cost": original_outcome.get('cost'),
                    "sentiment": original_outcome.get('avg_sentiment'),
                    "risk_score": original_outcome.get('risk_score', 0.5)
                },
                "counterfactual_outcome": {
                    "timeline_days_mean": stats_analysis['mean_outcome']['timeline'],
                    "timeline_days_ci": stats_analysis['confidence_intervals']['timeline'],
                    "cost_mean": stats_analysis['mean_outcome']['cost'],
                    "cost_ci": stats_analysis['confidence_intervals']['cost'],
                    "sentiment_mean": stats_analysis['mean_outcome']['sentiment'],
                    "sentiment_ci": stats_analysis['confidence_intervals']['sentiment'],
                    "risk_score": stats_analysis['mean_outcome']['risk_score']
                },
                "causal_analysis": causal_estimate,
                "comparison": comparison,
                "confidence": float(stats_analysis['overall_confidence']),
                "recommendation": self._generate_counterfactual_recommendation(comparison, causal_estimate)
            }
            
        except Exception as e:
            print(f"❌ Error during counterfactual simulation: {e}")
            traceback.print_exc()
            return {"error": f"Simulation failed: {e}"}
    
    async def _get_decision_outcome_detailed(self, decision_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed outcome data for a decision"""
        query = """
            MATCH (d:Decision {decision_id: $decision_id})<-[:LEAD_TO]-(evt:Event)
            OPTIONAL MATCH (evt)-[:CREATES]->(t:Task)
            OPTIONAL MATCH (evt)-[:IN_CHANNEL]->(c:Channel)<-[:IN_CHANNEL]-(follow_evt:Event)
            WHERE follow_evt.timestamp > evt.timestamp 
              AND follow_evt.timestamp <= evt.timestamp + duration({days: 14})
            
            WITH d, evt, 
                 COUNT(DISTINCT t) AS task_count,
                 AVG(follow_evt.sentimentScore) AS avg_sentiment,
                 COLLECT(DISTINCT follow_evt.event_id) AS follow_up_events
            
            RETURN
                 d.text AS decisionText,
                 d.decision_id AS decisionId,
                 task_count,
                 avg_sentiment,
                 task_count * 2 + 5 AS timeline_days,
                 task_count * 1500 + 2000 AS cost,
                 SIZE(follow_up_events) AS engagement_level
            LIMIT 1
        """
        
        try:
            results = await self.graph_store.run_cypher_query(query, {"decision_id": decision_id})
            record = results[0] if results else None
                
            if record:
                task_count = record["task_count"] or 0
                sentiment = record["avg_sentiment"] or 0.0
                
                risk_score = 0.3
                if sentiment < -0.2:
                    risk_score += 0.3
                if task_count > 5:
                    risk_score += 0.2
                
                return {
                    "decision_id": record["decisionId"],
                    "decision_text": record["decisionText"],
                    "tasks_created": task_count,
                    "avg_sentiment": sentiment,
                    "timeline_days": record["timeline_days"] or 10,
                    "cost": record["cost"] or 5000,
                    "engagement_level": record["engagement_level"] or 0,
                    "risk_score": min(1.0, risk_score)
                }
            
            return None
                
        except Exception as e:
            print(f"❌ Error fetching detailed outcome for {decision_id}: {e}")
            return None
    
    def _run_monte_carlo_simulation(
        self,
        original_outcome: Dict[str, Any],
        alternate_text: str,
        historical_data: List[Dict[str, Any]],
        num_simulations: int
    ) -> List[Dict[str, Any]]:
        """Run Monte Carlo simulation for counterfactual scenario"""
        simulations = []
        
        # Calculate base statistics from historical data
        if historical_data:
            hist_timelines = [h.get('timeline_days', 10) for h in historical_data]
            hist_costs = [h.get('cost', 5000) for h in historical_data]
            hist_sentiments = [h.get('avg_sentiment', 0) for h in historical_data]
            
            timeline_mean = np.mean(hist_timelines)
            timeline_std = np.std(hist_timelines) if len(hist_timelines) > 1 else timeline_mean * 0.2
            cost_mean = np.mean(hist_costs)
            cost_std = np.std(hist_costs) if len(hist_costs) > 1 else cost_mean * 0.3
            sentiment_mean = np.mean(hist_sentiments)
            sentiment_std = np.std(hist_sentiments) if len(hist_sentiments) > 1 else 0.2
        else:
            timeline_mean = original_outcome.get('timeline_days', 10)
            timeline_std = timeline_mean * 0.3
            cost_mean = original_outcome.get('cost', 5000)
            cost_std = cost_mean * 0.4
            sentiment_mean = original_outcome.get('avg_sentiment', 0)
            sentiment_std = 0.3
        
        # Detect improvements in alternate text
        improvements = self._detect_improvements(
            original_outcome.get('decision_text', ''),
            alternate_text
        )
        
        # Run simulations
        for i in range(num_simulations):
            timeline = max(1, np.random.normal(timeline_mean, timeline_std))
            cost = max(100, np.random.normal(cost_mean, cost_std))
            sentiment = np.clip(np.random.normal(sentiment_mean, sentiment_std), -1, 1)
            
            # Apply improvements
            if improvements['addresses_delays']:
                timeline *= np.random.uniform(0.7, 0.9)
            if improvements['cost_conscious']:
                cost *= np.random.uniform(0.8, 0.95)
            if improvements['sentiment_positive']:
                sentiment += np.random.uniform(0.1, 0.3)
                sentiment = np.clip(sentiment, -1, 1)
            
            # Calculate risk
            risk_score = 0.3
            if sentiment < -0.1:
                risk_score += 0.2
            if timeline > 15:
                risk_score += 0.2
            
            simulations.append({
                'timeline': timeline,
                'cost': cost,
                'sentiment': sentiment,
                'risk_score': min(1.0, risk_score)
            })
        
        return simulations
    
    def _detect_improvements(self, original_text: str, alternate_text: str) -> Dict[str, bool]:
        """Detect potential improvements in alternate decision"""
        original_lower = original_text.lower()
        alternate_lower = alternate_text.lower()
        
        return {
            'addresses_delays': (
                'delay' in original_lower and 
                any(word in alternate_lower for word in ['faster', 'accelerate', 'expedite', 'quick'])
            ),
            'cost_conscious': any(
                word in alternate_lower for word in ['cost-effective', 'efficient', 'optimize', 'reduce cost']
            ),
            'sentiment_positive': any(
                word in alternate_lower for word in ['stability', 'improve', 'enhance', 'benefit', 'positive']
            ),
            'risk_mitigation': any(
                word in alternate_lower for word in ['mitigate', 'reduce risk', 'safe', 'careful', 'gradual']
            )
        }
    
    def _analyze_simulation_results(
        self, 
        simulations: List[Dict[str, Any]], 
        confidence_level: float
    ) -> Dict[str, Any]:
        """Analyze Monte Carlo simulation results"""
        timelines = [s['timeline'] for s in simulations]
        costs = [s['cost'] for s in simulations]
        sentiments = [s['sentiment'] for s in simulations]
        risks = [s['risk_score'] for s in simulations]
        
        # Calculate confidence intervals
        alpha = 1 - confidence_level
        
        timeline_ci = (
            np.percentile(timelines, alpha/2 * 100),
            np.percentile(timelines, (1 - alpha/2) * 100)
        )
        cost_ci = (
            np.percentile(costs, alpha/2 * 100),
            np.percentile(costs, (1 - alpha/2) * 100)
        )
        sentiment_ci = (
            np.percentile(sentiments, alpha/2 * 100),
            np.percentile(sentiments, (1 - alpha/2) * 100)
        )
        
        return {
            'mean_outcome': {
                'timeline': float(np.mean(timelines)),
                'cost': float(np.mean(costs)),
                'sentiment': float(np.mean(sentiments)),
                'risk_score': float(np.mean(risks))
            },
            'median_outcome': {
                'timeline': float(np.median(timelines)),
                'cost': float(np.median(costs)),
                'sentiment': float(np.median(sentiments))
            },
            'confidence_intervals': {
                'timeline': (float(timeline_ci[0]), float(timeline_ci[1])),
                'cost': (float(cost_ci[0]), float(cost_ci[1])),
                'sentiment': (float(sentiment_ci[0]), float(sentiment_ci[1]))
            },
            'std_dev': {
                'timeline': float(np.std(timelines)),
                'cost': float(np.std(costs)),
                'sentiment': float(np.std(sentiments))
            },
            'overall_confidence': float(1 - np.mean([
                np.std(timelines) / np.mean(timelines),
                np.std(costs) / np.mean(costs),
                np.std(sentiments) / 0.5
            ]) / 3)
        }
    
    def _estimate_causal_effect(
        self, 
        original: Dict[str, Any], 
        counterfactual: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Estimate causal effect of the alternate decision"""
        timeline_effect = counterfactual['timeline'] - original['timeline_days']
        cost_effect = counterfactual['cost'] - original['cost']
        sentiment_effect = counterfactual['sentiment'] - original['avg_sentiment']
        
        # Calculate effect sizes
        timeline_effect_size = timeline_effect / (original['timeline_days'] + 1)
        cost_effect_size = cost_effect / (original['cost'] + 1)
        
        return {
            'average_treatment_effect': {
                'timeline_days': float(timeline_effect),
                'cost': float(cost_effect),
                'sentiment': float(sentiment_effect)
            },
            'effect_sizes': {
                'timeline': float(timeline_effect_size),
                'cost': float(cost_effect_size)
            },
            'interpretation': {
                'timeline': 'improved' if timeline_effect < 0 else 'degraded',
                'cost': 'reduced' if cost_effect < 0 else 'increased',
                'sentiment': 'improved' if sentiment_effect > 0 else 'declined'
            }
        }
    
    def _compare_scenarios_advanced(
        self,
        original: Dict[str, Any],
        counterfactual: Dict[str, Any],
        stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Advanced scenario comparison with statistical significance"""
        timeline_diff = counterfactual['timeline'] - original['timeline_days']
        cost_diff = counterfactual['cost'] - original['cost']
        sentiment_diff = counterfactual['sentiment'] - original['avg_sentiment']
        risk_diff = counterfactual['risk_score'] - original.get('risk_score', 0.5)
        
        # Determine overall recommendation
        improvements = 0
        if timeline_diff < -1:
            improvements += 1
        if cost_diff < -500:
            improvements += 1
        if sentiment_diff > 0.1:
            improvements += 1
        if risk_diff < -0.1:
            improvements += 1
        
        recommendation = "strongly_recommend" if improvements >= 3 else (
            "recommend" if improvements >= 2 else (
                "neutral" if improvements == 1 else "not_recommended"
            )
        )
        
        return {
            "timeline_change": {
                "absolute": float(timeline_diff),
                "percentage": float(timeline_diff / original['timeline_days'] * 100),
                "interpretation": "faster" if timeline_diff < 0 else "slower"
            },
            "cost_change": {
                "absolute": float(cost_diff),
                "percentage": float(cost_diff / original['cost'] * 100),
                "interpretation": "reduced" if cost_diff < 0 else "increased"
            },
            "sentiment_change": {
                "absolute": float(sentiment_diff),
                "interpretation": "improved" if sentiment_diff > 0 else "declined"
            },
            "risk_change": {
                "absolute": float(risk_diff),
                "interpretation": "reduced" if risk_diff < 0 else "increased"
            },
            "overall_recommendation": recommendation,
            "improvements_count": improvements,
            "summary": f"Alternate scenario: {timeline_diff:+.1f} days, ${cost_diff:+,.0f}, {sentiment_diff:+.2f} sentiment, {risk_diff:+.2f} risk"
        }
    
    def _generate_counterfactual_recommendation(
        self, 
        comparison: Dict[str, Any], 
        causal: Dict[str, Any]
    ) -> str:
        """Generate recommendation based on counterfactual analysis"""
        recommendation = comparison['overall_recommendation']
        
        if recommendation == "strongly_recommend":
            return (
                "✅ **Strongly Recommend Alternate Decision**: "
                "Significant improvements across multiple dimensions with high confidence."
            )
        elif recommendation == "recommend":
            return (
                "✓ **Recommend Alternate Decision**: "
                "Notable improvements in key areas. Consider implementing."
            )
        elif recommendation == "neutral":
            return (
                "⚖️ **Mixed Results**: "
                "Trade-offs exist between scenarios. Evaluate based on priorities."
            )
        else:
            return (
                "❌ **Original Decision Preferred**: "
                "Alternate scenario shows degraded outcomes. Stick with original."
            )


# Singleton instance
predictive_service = PredictiveService()