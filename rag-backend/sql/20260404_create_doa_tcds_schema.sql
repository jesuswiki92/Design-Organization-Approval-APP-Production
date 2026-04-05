-- ============================================
-- DOA TCDS - Supabase Migration
-- ============================================
--
-- Apply this migration in Supabase to create the
-- TCDS storage bucket, embeddings table, indexes,
-- and search functions.
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

INSERT INTO storage.buckets (id, name, public)
VALUES ('doa-tcds-storage', 'doa-tcds-storage', TRUE)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

CREATE TABLE IF NOT EXISTS doa_tcds_embeddings (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(3072) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    parent_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_metadata_chunk_id
    ON doa_tcds_embeddings ((metadata->>'chunk_id'));

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_metadata_official_code
    ON doa_tcds_embeddings ((metadata->>'official_code'));

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_metadata_agency
    ON doa_tcds_embeddings ((metadata->>'agency'));

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_metadata_doc_type
    ON doa_tcds_embeddings ((metadata->>'doc_type'));

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_metadata_section_id
    ON doa_tcds_embeddings ((metadata->>'section_id'));

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_metadata_normalized_section_id
    ON doa_tcds_embeddings ((metadata->>'normalized_section_id'));

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_parent_id
    ON doa_tcds_embeddings (parent_id);

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_created_at
    ON doa_tcds_embeddings (created_at DESC);

-- Immutable wrapper for GIN index (to_tsvector is STABLE, not IMMUTABLE)
CREATE OR REPLACE FUNCTION doa_tcds_search_vector(content TEXT, metadata JSONB)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT to_tsvector(
        'simple',
        concat_ws(
            ' ',
            COALESCE(content, ''),
            COALESCE(metadata->>'search_text', ''),
            COALESCE(metadata->>'section_id', ''),
            COALESCE(metadata->>'normalized_section_id', ''),
            COALESCE(metadata->>'official_code', ''),
            COALESCE(metadata->>'document_title', ''),
            COALESCE(metadata->>'title', ''),
            COALESCE(metadata->>'agency', ''),
            COALESCE(metadata->>'doc_type', '')
        )
    );
$$;

CREATE INDEX IF NOT EXISTS idx_doa_tcds_embeddings_search_text
    ON doa_tcds_embeddings
    USING gin (doa_tcds_search_vector(content, metadata));

-- NOTE: pgvector ivfflat/hnsw indexes are limited to 2000 dimensions.
-- vector(3072) columns (OpenAI text-embedding-3-large) use exact nearest-neighbor
-- search via sequential scan. This is acceptable for datasets under ~100k rows.
-- For larger datasets, consider dimensionality reduction or use text-embedding-3-small (1536).

CREATE OR REPLACE FUNCTION match_doa_tcds(
    query_embedding vector(3072),
    match_count INT DEFAULT 10,
    filter_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    parent_id TEXT,
    similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        d.id,
        d.content,
        d.metadata,
        d.parent_id,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM doa_tcds_embeddings d
    WHERE (filter_code IS NULL OR d.metadata->>'official_code' = filter_code)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION hybrid_search_doa_tcds(
    query_embedding vector(3072),
    query_text TEXT,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    parent_id TEXT,
    similarity FLOAT,
    text_rank FLOAT
)
LANGUAGE sql
STABLE
AS $$
    WITH ts_query AS (
        SELECT plainto_tsquery('simple', COALESCE(query_text, '')) AS q
    ),
    ranked AS (
        SELECT
            d.id,
            d.content,
            d.metadata,
            d.parent_id,
            1 - (d.embedding <=> query_embedding) AS similarity,
            ts_rank_cd(
                doa_tcds_search_vector(d.content, d.metadata),
                ts_query.q
            ) AS text_rank
        FROM doa_tcds_embeddings d
        CROSS JOIN ts_query
        WHERE doa_tcds_search_vector(d.content, d.metadata) @@ ts_query.q
    )
    SELECT
        id,
        content,
        metadata,
        parent_id,
        similarity,
        text_rank
    FROM ranked
    ORDER BY (similarity * 0.7 + text_rank * 0.3) DESC
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION update_doa_tcds_embeddings_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_doa_tcds_embeddings_updated_at
    ON doa_tcds_embeddings;

CREATE TRIGGER update_doa_tcds_embeddings_updated_at
    BEFORE UPDATE ON doa_tcds_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_doa_tcds_embeddings_updated_at_column();
