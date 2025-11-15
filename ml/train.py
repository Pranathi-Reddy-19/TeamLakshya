# ml/train.py
import pandas as pd
import numpy as np
import joblib
import os
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, classification_report
from neo4j import GraphDatabase, Driver  # <-- From Step 1
from dotenv import load_dotenv  # <-- From Step 1
from neo4j.time import Duration  # <-- NEW: To handle time calculations

# Define the paths
MODEL_DIR = Path(__file__).parent / "models"
TIMELINE_MODEL_PATH = MODEL_DIR / "decision_timeline_model.joblib"
IMPACT_MODEL_PATH = MODEL_DIR / "decision_impact_model.joblib"
PREPROCESSOR_PATH = MODEL_DIR / "preprocessor.joblib"

# --- Function from Step 1 ---
def get_neo4j_driver() -> Driver:
    """
    Connects to the Neo4j database using environment variables.
    """
    env_path = Path(__file__).parent.parent / "infra" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")

    if not password:
        print("NEO4J_PASSWORD environment variable not set.")
        print("Please ensure your /infra/.env file is set up correctly.")
        raise ValueError("Missing Neo4j Password")

    return GraphDatabase.driver(uri, auth=(user, password))

# --- NEW: Function to get real data from Neo4j ---
def generate_real_data():
    """
    Queries the Neo4j Knowledge Graph to build a real training DataFrame.
    """
    print("Attempting to fetch real data from Neo4j...")
    
    # FIXED: Updated query to match actual graph schema
    CYPHER_QUERY = """
    MATCH (t:Task)
    // Get the team size assigned to the task
    OPTIONAL MATCH (t)-[:ASSIGNED_TO]->(u:User)
    WITH t, count(u) as teamSize
    
    // Get the project the task is part of
    // NOTE: Your current schema does not link Tasks to Projects.
    // We will default this to 'GENERAL' as planned.
    
    // We only want 'completed' tasks to learn from.
    // Your graph_store.py sets status to 'open' or 'closed'.
    WHERE t.status = 'closed'
      AND t.created_at IS NOT NULL 
      AND t.last_updated IS NOT NULL
      
    // Calculate the duration
    WITH t, teamSize, 
         duration.between(t.created_at, t.last_updated) as taskDuration
         
    RETURN
        t.text as decision_text, // Use t.text
        // 'priority' does not exist, default to 'medium'
        'medium' as urgency,
        teamSize as team_size,
        // 'Project' nodes do not exist, default to 'GENERAL'
        'GENERAL' as project_code,
        // Get timeline in whole days
        taskDuration.days as timeline_days,
        // Map status to an 'outcome'
        CASE t.status
            WHEN 'closed' THEN 'high'
            ELSE 'medium'
        END as outcome_category
    """
    
    driver = None
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            results = session.run(CYPHER_QUERY)
            data = [record.data() for record in results]
            
            if not data:
                print("No matching data found in Neo4j.")
                return None
                
            df = pd.DataFrame(data)
            
            # Simple cleanup: ensure timeline is at least 1 day
            df['timeline_days'] = df['timeline_days'].apply(lambda x: max(1, int(x)))
            # Ensure team size is at least 1
            df['team_size'] = df['team_size'].apply(lambda x: max(1, int(x)))
            
            print(f"Successfully fetched {len(df)} records from Neo4j.")
            print(df.head())
            return df
            
    except Exception as e:
        print(f"Error connecting to or querying Neo4j: {e}")
        return None
    finally:
        if driver:
            driver.close()
# --- End of new function ---


def generate_dummy_data(num_samples=200):
    """
    Generates a dummy DataFrame of decision data.
    """
    print(f"Generating {num_samples} dummy samples...")
    
    # (Dummy data generation code is unchanged)
    data = {
        'decision_text': [
            "let's pivot to the new 'alpha' feature",
            "approve budget for marketing campaign",
            "hire two new junior developers",
            "deprecate the 'legacy' microservice",
            "delay launch by two weeks",
            "switch cloud providers to AWS",
            "implement a new design system",
            "reject the new feature proposal",
            "move to a new office space",
            "acquire the startup 'FastData'"
        ] * (num_samples // 10),
        'urgency': np.random.choice(
            ['low', 'medium', 'high'], 
            num_samples, 
            p=[0.4, 0.4, 0.2]
        ),
        'team_size': np.random.randint(1, 15, num_samples),
        'project_code': np.random.choice(
            ['phoenix', 'dragon', 'atlas', 'vega'], 
            num_samples
        ),
    }
    df = pd.DataFrame(data)
    df['timeline_days'] = df['team_size'] * np.random.uniform(0.5, 3.0, num_samples) + \
                          df['urgency'].map({'low': 5, 'medium': 10, 'high': 20}) + \
                          np.random.normal(0, 3, num_samples)
    df['timeline_days'] = df['timeline_days'].clip(lower=1).astype(int)
    def get_impact(row):
        if 'acquire' in row['decision_text'] or 'cloud' in row['decision_text']:
            return 'high'
        if row['urgency'] == 'high' or row['team_size'] > 10:
            return np.random.choice(['medium', 'high'], p=[0.6, 0.4])
        if row['urgency'] == 'low' and row['team_size'] < 4:
            return 'low'
        return np.random.choice(['low', 'medium'], p=[0.7, 0.3])
    df['outcome_category'] = df.apply(get_impact, axis=1)
    
    print("Dummy data generated successfully.")
    return df

def build_preprocessor():
    """
    Builds a ColumnTransformer to featurize our raw data.
    """
    # (Preprocessor code is unchanged)
    text_pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2), max_features=1000, stop_words='english'))
    ])
    categorical_features = ['urgency', 'project_code']
    categorical_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])
    numerical_features = ['team_size']
    numerical_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='median'))
    ])
    preprocessor = ColumnTransformer(
        transformers=[
            ('text', text_pipeline, 'decision_text'),
            ('cat', categorical_pipeline, categorical_features),
            ('num', numerical_pipeline, numerical_features)
        ],
        remainder='drop'
    )
    return preprocessor

def train():
    """Main training function."""
    print("--- Starting ML Model Training Pipeline ---")
    
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Get Data
    # --- MODIFIED SECTION ---
    df = generate_real_data()  # Try to get real data
    
    if df is None or df.empty:
        print("Falling back to dummy data.")
        df = generate_dummy_data()
    # --- END OF MODIFIED SECTION ---

    # Check if we have enough data to train
    if len(df) < 50:
        print(f"Not enough data ({len(df)} samples) to train. Need at least 50.")
        print("--- ML Model Training Pipeline Aborted ---")
        return

    # Define features (X) and targets (y)
    X = df[['decision_text', 'urgency', 'team_size', 'project_code']]
    y_timeline = df['timeline_days']
    y_impact = df['outcome_category']
    
    # Split data
    X_train, X_test, y_timeline_train, y_timeline_test, y_impact_train, y_impact_test = train_test_split(
        X, y_timeline, y_impact, test_size=0.2, random_state=42
    )

    # 2. Build and fit preprocessor
    print("\nBuilding and fitting preprocessor...")
    preprocessor = build_preprocessor()
    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)
    print("Preprocessor fitted.")
    
    joblib.dump(preprocessor, PREPROCESSOR_PATH)
    print(f"Preprocessor saved to {PREPROCESSOR_PATH}")

    # 3. Train Timeline Regressor (RandomForest)
    print("\nTraining Timeline Regressor...")
    timeline_model = RandomForestRegressor(n_estimators=100, random_state=42)
    timeline_model.fit(X_train_transformed, y_timeline_train)
    
    y_pred_timeline = timeline_model.predict(X_test_transformed)
    rmse = np.sqrt(mean_squared_error(y_timeline_test, y_pred_timeline))
    print(f"Timeline Model RMSE: {rmse:.2f} days")
    
    joblib.dump(timeline_model, TIMELINE_MODEL_PATH)
    print(f"Timeline model saved to {TIMELINE_MODEL_PATH}")

    # 4. Train Impact Classifier (GradientBoosting)
    print("\nTraining Impact Classifier...")
    impact_model = GradientBoostingClassifier(n_estimators=100, random_state=42)
    impact_model.fit(X_train_transformed, y_impact_train)
    
    y_pred_impact = impact_model.predict(X_test_transformed)
    print("Impact Model Classification Report:")
    print(classification_report(y_impact_test, y_pred_impact))
    
    joblib.dump(impact_model, IMPACT_MODEL_PATH)
    print(f"Impact model saved to {IMPACT_MODEL_PATH}")
    
    print("\n--- ML Model Training Pipeline Complete ---")

if __name__ == "__main__":
    train()