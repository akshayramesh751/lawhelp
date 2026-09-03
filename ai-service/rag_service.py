import os
import re
from typing import Optional, List, Dict, Any
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi

def map_contract_domain_to_rag_domain(domain: Optional[str]) -> Optional[str]:
    """Normalizes arbitrary contract classification domain names into strict ChromaDB legal domain tags."""
    if not domain:
        return None
    d = domain.lower()
    if any(k in d for k in ["rent", "lease", "tenan", "property", "sale deed"]):
        return "Leases"
    if any(k in d for k in ["employ", "labour", "job", "service agreement", "workman"]):
        return "Employment"
    if any(k in d for k in ["nda", "confidential", "trade secret", "non-disclosure"]):
        return "NDAs"
    if any(k in d for k in ["vendor", "commercial", "msa", "sale of goods", "supply"]):
        return "Contracts"
    if any(k in d for k in ["benefit", "gratuity", "provident", "pf", "pension"]):
        return "Statutory Benefits"
    if domain in ["Employment", "Leases", "NDAs", "Contracts", "Statutory Benefits"]:
        return domain
    return None

class LegalRAGStore:
    def __init__(self, db_dir="./chroma_db"):
        self.db_dir = db_dir
        os.makedirs(db_dir, exist_ok=True)
        
        # 1. Initialize persistent ChromaDB Client
        self.chroma_client = chromadb.PersistentClient(path=db_dir)
        
        # 2. Load Embedding Model
        print("[RAG] Loading SentenceTransformer embedding model 'all-MiniLM-L6-v2'...")
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        
        # 3. Create/Get collections
        self.collections = {
            "statutes": self.chroma_client.get_or_create_collection("statutes"),
            "state_laws": self.chroma_client.get_or_create_collection("state_laws"),
            "rules_regulations": self.chroma_client.get_or_create_collection("rules_regulations"),
            "case_laws": self.chroma_client.get_or_create_collection("case_laws")
        }
        
        # 4. Initialize BM25 indexes
        self.bm25_indexes = {}
        self.bm25_docs = {}
        self.rebuild_bm25_all()

    def tokenize(self, text: str) -> list:
        return re.findall(r'\b\w+\b', text.lower())

    def rebuild_bm25(self, col_name: str):
        """Fetches all documents from a Chroma collection and builds the BM25 index."""
        collection = self.collections[col_name]
        results = collection.get()
        
        ids = results.get("ids", [])
        documents = results.get("documents", [])
        metadatas = results.get("metadatas", [])
        
        if not documents:
            self.bm25_indexes[col_name] = None
            self.bm25_docs[col_name] = []
            return
            
        tokenized_corpus = [self.tokenize(doc) for doc in documents]
        self.bm25_indexes[col_name] = BM25Okapi(tokenized_corpus)
        self.bm25_docs[col_name] = [
            {"id": ids[i], "content": documents[i], "metadata": metadatas[i]}
            for i in range(len(ids))
        ]
        print(f"[RAG] Rebuilt BM25 index for '{col_name}' ({len(documents)} docs)")

    def rebuild_bm25_all(self):
        for col_name in self.collections.keys():
            self.rebuild_bm25(col_name)

    def ingest_chunks(self, target_collection: str, chunks: list):
        """
        Ingests legal chunk entities into the specified Chroma collection.
        Each chunk: {"chunk_id": str, "content": str, "metadata": dict}
        """
        if target_collection not in self.collections:
            raise ValueError(f"Collection '{target_collection}' does not exist.")
            
        collection = self.collections[target_collection]
        
        ids = []
        documents = []
        embeddings = []
        metadatas = []
        
        for chunk in chunks:
            ids.append(chunk["chunk_id"])
            documents.append(chunk["content"])
            metadatas.append(chunk["metadata"])
            
        # Bulk generate embeddings
        chunk_embeddings = self.embedding_model.encode(documents).tolist()
        
        # Upsert into Chroma
        collection.upsert(
            ids=ids,
            documents=documents,
            embeddings=chunk_embeddings,
            metadatas=metadatas
        )
        
        print(f"[RAG] Ingested {len(chunks)} chunks into '{target_collection}'")
        self.rebuild_bm25(target_collection)

    def retrieve(self, query: str, state: str = None, country: str = "India", domain: str = None, limit: int = 3) -> list:
        """
        Runs a hybrid (Dense Vector + BM25 Sparse) search with metadata pre-filtering,
        re-ranking matches using Reciprocal Rank Fusion (RRF).
        """
        query_vector = self.embedding_model.encode(query).tolist()
        rag_domain = map_contract_domain_to_rag_domain(domain)
        
        # Build strict metadata filter for Chroma
        # e.g., {'$and': [{'country': 'India'}, {'domain': 'Employment'}]}
        filters = []
        if country:
            filters.append({"country": country})
        if rag_domain:
            filters.append({"domain": rag_domain})
            
        where_filter = {"$and": filters} if len(filters) > 1 else (filters[0] if filters else None)
        
        # Determine collections to search
        # central statutes and state-specific laws/rules
        active_collections = ["statutes", "case_laws"]
        if state:
            active_collections.extend(["state_laws", "rules_regulations"])
            
        vector_candidates = []
        sparse_candidates = []
        
        # 1. Fetch Candidates from Vector Search
        for col_name in active_collections:
            collection = self.collections[col_name]
            
            # Apply state filter inside state collections if applicable
            state_where = where_filter
            if col_name in ["state_laws", "rules_regulations"] and state:
                state_filters = list(filters)
                state_filters.append({"state": state})
                state_where = {"$and": state_filters}
                
            try:
                res = collection.query(
                    query_embeddings=[query_vector],
                    n_results=10,
                    where=state_where
                )
            except Exception as e:
                # If filtered query returns empty/error, try with broader collection
                res = collection.query(
                    query_embeddings=[query_vector],
                    n_results=10
                )
            
            if res["documents"] and res["documents"][0]:
                for idx in range(len(res["documents"][0])):
                    doc_id = res["ids"][0][idx]
                    content = res["documents"][0][idx]
                    metadata = res["metadatas"][0][idx]
                    dist = res["distances"][0][idx]
                    # Convert distance to a similarity score (cosine distance is [0, 2])
                    score = 1.0 - (dist / 2.0)
                    
                    vector_candidates.append({
                        "id": doc_id,
                        "content": content,
                        "metadata": metadata,
                        "score": score,
                        "collection": col_name
                    })

        # 2. Fetch Candidates from BM25 Sparse Search
        tokenized_query = self.tokenize(query)
        for col_name in active_collections:
            bm25 = self.bm25_indexes.get(col_name)
            docs = self.bm25_docs.get(col_name, [])
            
            if not bm25 or not docs:
                continue
                
            # Filter docs by metadata first
            filtered_indices = []
            filtered_docs = []
            
            for idx, doc in enumerate(docs):
                meta = doc["metadata"]
                # Match Country
                if country and meta.get("country") != country:
                    continue
                # Match Domain (Strict Domain Isolation)
                if rag_domain and meta.get("domain") != rag_domain:
                    continue
                # Match State for state collections
                if col_name in ["state_laws", "rules_regulations"] and state and meta.get("state") != state:
                    continue
                    
                filtered_indices.append(idx)
                filtered_docs.append(doc)
                
            if not filtered_docs:
                continue
                
            # Score corpus using rank-bm25
            scores = bm25.get_scores(tokenized_query)
            
            # Map back scores and sort
            col_candidates = []
            for f_idx, doc in enumerate(filtered_docs):
                orig_idx = filtered_indices[f_idx]
                score = scores[orig_idx]
                if score > 0:
                    col_candidates.append({
                        "id": doc["id"],
                        "content": doc["content"],
                        "metadata": doc["metadata"],
                        "score": score,
                        "collection": col_name
                    })
                    
            # Sort and take top 10
            col_candidates = sorted(col_candidates, key=lambda x: x["score"], reverse=True)[:10]
            sparse_candidates.extend(col_candidates)

        # 3. Reciprocal Rank Fusion (RRF)
        # Combines the ranks from sparse and dense search pipelines
        rrf_scores = {}
        rrf_docs = {}
        
        # Sort candidates to assign ranks
        vec_sorted = sorted(vector_candidates, key=lambda x: x["score"], reverse=True)
        spa_sorted = sorted(sparse_candidates, key=lambda x: x["score"], reverse=True)
        
        k = 60 # Constant parameter for RRF
        
        for rank, doc in enumerate(vec_sorted):
            doc_id = doc["id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))
            rrf_docs[doc_id] = doc
            
        for rank, doc in enumerate(spa_sorted):
            doc_id = doc["id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))
            # Keep document if not already loaded from vector branch
            if doc_id not in rrf_docs:
                rrf_docs[doc_id] = doc

        # Sort combined documents by fused RRF scores
        fused_results = sorted(
            [{"doc": rrf_docs[doc_id], "rrf_score": score} for doc_id, score in rrf_scores.items()],
            key=lambda x: x["rrf_score"],
            reverse=True
        )
        
        # Format return payload
        output = []
        for item in fused_results[:limit]:
            doc = item["doc"]
            output.append({
                "id": doc["id"],
                "content": doc["content"],
                "metadata": doc["metadata"],
                "collection": doc["collection"],
                "rrf_score": round(item["rrf_score"], 4)
            })
            
        return output

    def validate_authority_strength(
        self,
        retrieved_contexts: List[Dict[str, Any]],
        clause_text: str,
        clause_type: str = "General Clause",
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Step 4 Authority Validation Gate:
        Evaluates whether retrieved statutory provisions have strong legal applicability
        before invoking expensive LLM reasoning.
        """
        text_lower = clause_text.lower()
        red_flag_terms = ["waive", "forfeit", "indemnif", "unlimited", "penalty", "compete", "bar", "prohibit", "sole discretion", "unilateral", "without notice", "immediate effect", "hold harmless"]
        has_red_flags = any(k in text_lower for k in red_flag_terms)

        if has_red_flags:
            return {
                "is_authoritative": True,
                "has_conflict_risk": True,
                "top_act": retrieved_contexts[0].get("metadata", {}).get("act", "Statute") if retrieved_contexts else "Indian Legal Code",
                "top_score": retrieved_contexts[0].get("rrf_score", 0.0) if retrieved_contexts else 0.0,
                "reason": "Contractual liabilities, waivers, or restrictive covenants present in text requiring legal review."
            }

        if not retrieved_contexts:
            return {
                "is_authoritative": False,
                "has_conflict_risk": False,
                "reason": "Zero statutory provisions retrieved from Indian legal repository."
            }

        top_score = retrieved_contexts[0].get("rrf_score", 0.0)
        top_meta = retrieved_contexts[0].get("metadata", {})
        act_name = top_meta.get("act", "")

        if top_score >= 0.02:
            return {
                "is_authoritative": True,
                "has_conflict_risk": False,
                "top_act": act_name,
                "top_score": top_score,
                "reason": "Authoritative legal provision matched with potential statutory compliance implication."
            }

        return {
            "is_authoritative": False,
            "has_conflict_risk": False,
            "top_act": act_name,
            "top_score": top_score,
            "reason": "Weak legal correlation; operational clause with no statutory liability indicators."
        }

# Singleton instance
rag_store = LegalRAGStore()
