import spacy
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from typing import Dict, Any, List

# --- FIX: Removed this unused import line that was causing the crash ---
# from .train import VADER_SENTIMENT_MODEL, SENTIMENT_MODEL_PATH
# --- End of fix ---

# Load models once
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Downloading en_core_web_sm model...")
    # This command will run if the model isn't found
    from spacy.cli import download
    download("en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")


analyzer = SentimentIntensityAnalyzer()
analyzer_engine = AnalyzerEngine()
anonymizer_engine = AnonymizerEngine()


class ExtractorService:
    """
    A service for extracting ML-based insights from text.
    - PII Redaction (using Presidio)
    - Sentiment Analysis (using VADER)
    - Entity Extraction (using spaCy NER)
    
    NO CIRCULAR DEPENDENCIES - This module is completely self-contained.
    """

    def __init__(self):
        print("🧠 ExtractorService initialized with spaCy, VADER, and Presidio.")

    def extract_pii(self, text: str) -> Dict[str, Any]:
        """
        Analyzes text and returns both the PII entities and a redacted version.
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dict with 'redacted_text' and 'pii_entities'
        """
        try:
            analyzer_results = analyzer_engine.analyze(
                text=text,
                language="en",
                entities=["PERSON", "PHONE_NUMBER", "EMAIL_ADDRESS", "LOCATION"],
                score_threshold=0.35
            )
            
            anonymized_results = anonymizer_engine.anonymize(
                text=text,
                analyzer_results=analyzer_results
            )
            
            return {
                "redacted_text": anonymized_results.text,
                "pii_entities": [
                    {"type": res.entity_type, "value": text[res.start:res.end]}
                    for res in analyzer_results
                ]
            }
        except Exception as e:
            print(f"❌ PII extraction failed: {e}")
            return {"redacted_text": text, "pii_entities": []}

    def extract_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analyzes sentiment using VADER.
        
        Args:
            text: Input text to analyze
            
        Returns:
            Dict with 'label' (positive/negative/neutral), 'score' (compound), 
            and 'scores' (full breakdown)
        """
        try:
            sentiment = analyzer.polarity_scores(text)
            compound = sentiment['compound']
            
            if compound >= 0.05:
                label = 'positive'
            elif compound <= -0.05:
                label = 'negative'
            else:
                label = 'neutral'
                
            return {
                "label": label,
                "score": compound,
                "scores": sentiment  # Full breakdown (pos, neg, neu, compound)
            }
        except Exception as e:
            print(f"❌ Sentiment extraction failed: {e}")
            return {"label": "neutral", "score": 0.0, "scores": {}}

    def extract_entities(self, text: str) -> List[Dict[str, str]]:
        """
        Performs Named Entity Recognition (NER) on text using spaCy.
        
        Args:
            text: Input text to analyze
            
        Returns:
            List of entities with 'text' and 'label' fields
        """
        try:
            doc = nlp(text)
            entities = []
            for ent in doc.ents:
                # Filter for common/useful entities
                if ent.label_ in ["PERSON", "ORG", "GPE", "PRODUCT", "DATE", "EVENT", "WORK_OF_ART", "MONEY"]:
                    entities.append({
                        "text": ent.text,
                        "label": ent.label_
                    })
            return entities
        except Exception as e:
            print(f"❌ Entity extraction failed: {e}")
            return []

    def extract_all(self, event: Any) -> Dict[str, Any]:
        """
        Runs a full extraction pipeline on a single text event.
        This is the primary method used by the ingestion service.
        
        Args:
            event: An object with .id and .text attributes
            
        Returns:
            Dict containing:
                - event_id: The event ID
                - raw_text: Original text
                - redacted_text: Text with PII redacted
                - pii_entities: List of detected PII
                - sentiment: Sentiment analysis results
                - entities: Named entities extracted
        """
        text = event.text
        
        # Step 1: PII redaction
        pii_results = self.extract_pii(text)
        
        # Step 2: Sentiment analysis on original text
        sentiment_results = self.extract_sentiment(text)
        
        # Step 3: NER on redacted text (to avoid extracting PII as entities)
        ner_results = self.extract_entities(pii_results['redacted_text'])
        
        return {
            "event_id": event.id,
            "raw_text": text,
            "redacted_text": pii_results['redacted_text'],
            "pii_entities": pii_results['pii_entities'],
            "sentiment": sentiment_results,
            "entities": ner_results
        }


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================
# This is what gets imported by other services: from ml.extractor import extractor_service
extractor_service = ExtractorService()


# ============================================================================
# TEST CODE (only runs when file is executed directly)
# ============================================================================
if __name__ == "__main__":
    print("\n" + "="*70)
    print("TESTING ExtractorService")
    print("="*70)
    
    # Mock event object for testing
    class MockEvent:
        def __init__(self, event_id: str, text: str):
            self.id = event_id
            self.text = text
    
    # Test cases
    test_cases = [
        MockEvent(
            "test-001",
            "Hello, my name is Abhiram and my email is abhiram@google.com. This project is great!"
        ),
        MockEvent(
            "test-002",
            "Contact John Doe at john.doe@company.com or call him at 555-1234."
        ),
        MockEvent(
            "test-003",
            "This is terrible! The deadline was missed and the client is furious."
        ),
        MockEvent(
            "test-004",
            "Microsoft announced a new partnership with OpenAI worth $10 billion."
        ),
    ]
    
    service = ExtractorService()
    
    import json
    
    for i, mock_event in enumerate(test_cases, 1):
        print(f"\n{'='*70}")
        print(f"TEST CASE {i}")
        print(f"{'='*70}")
        print(f"Original Text: {mock_event.text}\n")
        
        results = service.extract_all(mock_event)
        
        print("Results:")
        print(json.dumps(results, indent=2))
        
        # Summary
        print(f"\n📊 Summary:")
        print(f"     - Sentiment: {results['sentiment']['label']} ({results['sentiment']['score']:.2f})")
        print(f"     - PII Found: {len(results['pii_entities'])} item(s)")
        print(f"     - Entities: {len(results['entities'])} item(s)")
        
        if results['pii_entities']:
            print(f"     - PII Types: {[p['type'] for p in results['pii_entities']]}")
        
        if results['entities']:
            print(f"     - Entity Types: {[e['label'] for e in results['entities']]}")
    
    print("\n" + "="*70)
    print("✅ ALL TESTS COMPLETED")
    print("="*70)