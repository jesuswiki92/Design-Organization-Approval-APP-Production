-- ============================================
-- DOA Part-21 Classification RAG - Supabase Migration
-- ============================================
--
-- Knowledge base for aeronautical change classification
-- based on AMC-GM Part-21 Issue 2, G12-01 criteria,
-- and EASA regulatory guidance.
--
-- Separate table from doa_tcds_embeddings.
-- Same vector dimensions (3072) for OpenAI text-embedding-3-large.
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- -------------------------------------------
-- Table: doa_part21_embeddings
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS doa_part21_embeddings (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(3072) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    parent_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Metadata fields expected:
--   chunk_id          TEXT    - unique chunk identifier
--   document_title    TEXT    - source document name
--   document_code     TEXT    - e.g. "AMC-GM-Part21-Issue2", "G12-01"
--   chapter           TEXT    - e.g. "3", "Appendix_A"
--   section           TEXT    - e.g. "3.6.1", "A.1.2"
--   section_title     TEXT    - e.g. "Step 5. Is each group significant?"
--   category          TEXT    - aircraft category: "CS-23", "CS-25", "CS-27", "CS-29", "engines", "propellers", "general"
--   classification    TEXT    - "significant", "not_significant", "major", "minor", "process", "definition"
--   content_type      TEXT    - "criteria", "example", "guidance", "definition", "process_step", "table_entry"
--   example_number    INT     - example number within Appendix A tables
--   search_text       TEXT    - combined searchable text for FTS

COMMENT ON TABLE doa_part21_embeddings IS
    'Vector embeddings for Part-21 change classification guidance (AMC-GM Part-21, G12-01, EASA regulatory material)';

-- -------------------------------------------
-- Indexes
-- -------------------------------------------
CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_chunk_id
    ON doa_part21_embeddings ((metadata->>'chunk_id'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_document_code
    ON doa_part21_embeddings ((metadata->>'document_code'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_chapter
    ON doa_part21_embeddings ((metadata->>'chapter'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_section
    ON doa_part21_embeddings ((metadata->>'section'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_category
    ON doa_part21_embeddings ((metadata->>'category'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_classification
    ON doa_part21_embeddings ((metadata->>'classification'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_metadata_content_type
    ON doa_part21_embeddings ((metadata->>'content_type'));

CREATE INDEX IF NOT EXISTS idx_doa_part21_parent_id
    ON doa_part21_embeddings (parent_id);

CREATE INDEX IF NOT EXISTS idx_doa_part21_created_at
    ON doa_part21_embeddings (created_at DESC);

-- -------------------------------------------
-- Full-text search vector (immutable wrapper)
-- -------------------------------------------
CREATE OR REPLACE FUNCTION doa_part21_search_vector(content TEXT, metadata JSONB)
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
            COALESCE(metadata->>'section', ''),
            COALESCE(metadata->>'section_title', ''),
            COALESCE(metadata->>'document_code', ''),
            COALESCE(metadata->>'document_title', ''),
            COALESCE(metadata->>'category', ''),
            COALESCE(metadata->>'classification', ''),
            COALESCE(metadata->>'content_type', '')
        )
    );
$$;

CREATE INDEX IF NOT EXISTS idx_doa_part21_search_text
    ON doa_part21_embeddings
    USING gin (doa_part21_search_vector(content, metadata));

-- -------------------------------------------
-- Vector similarity search
-- -------------------------------------------
CREATE OR REPLACE FUNCTION match_doa_part21(
    query_embedding vector(3072),
    match_count INT DEFAULT 10,
    filter_category TEXT DEFAULT NULL,
    filter_classification TEXT DEFAULT NULL
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
    FROM doa_part21_embeddings d
    WHERE (filter_category IS NULL OR d.metadata->>'category' = filter_category)
      AND (filter_classification IS NULL OR d.metadata->>'classification' = filter_classification)
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- -------------------------------------------
-- Hybrid search (semantic + full-text)
-- -------------------------------------------
CREATE OR REPLACE FUNCTION hybrid_search_doa_part21(
    query_embedding vector(3072),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter_category TEXT DEFAULT NULL
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
                doa_part21_search_vector(d.content, d.metadata),
                ts_query.q
            ) AS text_rank
        FROM doa_part21_embeddings d
        CROSS JOIN ts_query
        WHERE (filter_category IS NULL OR d.metadata->>'category' = filter_category)
          AND doa_part21_search_vector(d.content, d.metadata) @@ ts_query.q
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

-- -------------------------------------------
-- Auto-update timestamp trigger
-- -------------------------------------------
CREATE OR REPLACE FUNCTION update_doa_part21_embeddings_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_doa_part21_embeddings_updated_at
    ON doa_part21_embeddings;

CREATE TRIGGER update_doa_part21_embeddings_updated_at
    BEFORE UPDATE ON doa_part21_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_doa_part21_embeddings_updated_at_column();
