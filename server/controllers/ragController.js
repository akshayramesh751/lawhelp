/**
 * RAG controller coordinates legal index ingestion and search queries
 * with the python AI FastAPI microservice.
 */

/**
 * Seed legal documents into the vector database (ChromaDB)
 */
const seedLegalKnowledge = async (req, res) => {
    try {
        const { targetCollection, text, metadataDefaults } = req.body;
        if (!targetCollection || !text) {
            return res.status(400).json({ error: 'targetCollection and text fields are required.' });
        }

        const response = await fetch('http://localhost:8000/rag/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                target_collection: targetCollection,
                text,
                metadata_defaults: metadataDefaults || {}
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ error: data.detail || 'Failed to ingest RAG chunks.' });
        }

        res.json(data);
    } catch (error) {
        console.error('[RAG Controller] Ingestion Error:', error);
        res.status(500).json({ error: 'RAG ingestion failed.', details: error.message });
    }
};

/**
 * Query the hybrid (vector + BM25) search pipeline to retrieve legal context
 */
const retrieveLegalContext = async (req, res) => {
    try {
        const { query, state, country, domain, limit } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'query field is required.' });
        }

        const response = await fetch('http://localhost:8000/rag/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                state: state || null,
                country: country || 'India',
                domain: domain || null,
                limit: limit || 3
            })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ error: data.detail || 'Failed to retrieve RAG context.' });
        }

        res.json(data);
    } catch (error) {
        console.error('[RAG Controller] Retrieval Error:', error);
        res.status(500).json({ error: 'RAG retrieval failed.', details: error.message });
    }
};

module.exports = {
    seedLegalKnowledge,
    retrieveLegalContext
};
