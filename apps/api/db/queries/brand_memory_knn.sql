-- Canonical kNN vector retrieval for brand_memory_chunks (cosine distance `<=>`).
-- Preconditions:
--   $1 workspace_id, $2 brand_id (one logical brand scope = one dim column: 1536).
--   $3::vector must be exactly 1536 dimensions or Postgres will reject the cast.
-- Chunks with embedding NULL are lexical-only; they never appear here.

SELECT chunk_id, text
FROM brand_memory_chunks
WHERE workspace_id = $1
  AND brand_id = $2
  AND embedding IS NOT NULL
ORDER BY embedding <=> $3::vector
LIMIT 20;
