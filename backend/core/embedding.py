import torch
from transformers import AutoTokenizer, AutoModel
from typing import List


class EmbeddingService:
    """
    Manages loading the embedding model and creating vectors.
    Uses a singleton pattern to ensure the model is loaded only once.
    """
    _instance = None
    _model = None
    _tokenizer = None

    MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
    
    @staticmethod
    def _mean_pooling(model_output, attention_mask):
        """
        Perform mean pooling on token embeddings.
        """
        token_embeddings = model_output[0]
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(
            input_mask_expanded.sum(1), min=1e-9
        )

    def __new__(cls):
        if cls._instance is None:
            print("🧠 Initializing EmbeddingService (loading model)...")
            cls._instance = super(EmbeddingService, cls).__new__(cls)
            
            try:
                # Load model from HuggingFace Hub
                cls._tokenizer = AutoTokenizer.from_pretrained(cls.MODEL_NAME)
                cls._model = AutoModel.from_pretrained(cls.MODEL_NAME)
                cls._model.eval()  # Set to evaluation mode
                print("  ✓ Embedding model loaded successfully.")
            except Exception as e:
                print(f"  ❌ Error loading embedding model: {e}")
                raise
                
        return cls._instance

    def get_embeddings(self, sentences: List[str]) -> List[List[float]]:
        """
        Generates embeddings for a list of sentences.
        
        Args:
            sentences: List of text strings to embed
            
        Returns:
            List of embedding vectors (each is a list of floats)
        """
        if not self._model or not self._tokenizer:
            raise Exception("Embedding model not initialized.")
        
        if not sentences:
            return []
            
        try:
            # Tokenize sentences
            encoded_input = self._tokenizer(
                sentences, 
                padding=True, 
                truncation=True, 
                return_tensors='pt',
                max_length=512
            )
            
            # Compute token embeddings
            with torch.no_grad():
                model_output = self._model(**encoded_input)
                
            # Perform pooling
            sentence_embeddings = self._mean_pooling(
                model_output, 
                encoded_input['attention_mask']
            )
            
            # Normalize embeddings
            sentence_embeddings = torch.nn.functional.normalize(
                sentence_embeddings, 
                p=2, 
                dim=1
            )
            
            return sentence_embeddings.tolist()
            
        except Exception as e:
            print(f"❌ Error generating embeddings: {e}")
            import traceback
            traceback.print_exc()
            raise


# Create a singleton instance for the app to use
embedding_service = EmbeddingService()


def get_embedding_model() -> EmbeddingService:
    """
    Singleton getter for the EmbeddingService.
    """
    return embedding_service


if __name__ == "__main__":
    # Test the service
    print("\n Testing EmbeddingService...")
    sentences = ["This is a test sentence.", "Hello, world!"]
    embeddings = embedding_service.get_embeddings(sentences)
    print(f"✓ Generated {len(embeddings)} embeddings.")
    print(f"✓ Dimension of first embedding: {len(embeddings[0])}")
    assert len(embeddings[0]) == 384, "Expected 384 dimensions"
    print("✓ All tests passed!")