# Brand memory — ingest handler (reference pseudocode)

Authoritative DDL: [`apps/api/db/migrations/006_brand_memory_pgvector.sql`](../../apps/api/db/migrations/006_brand_memory_pgvector.sql).  
Canonical vector query: [`apps/api/db/queries/brand_memory_knn.sql`](../../apps/api/db/queries/brand_memory_knn.sql).  
HTTP server (ingest + query): `npm run start:brand-memory -w @home-link/marketer-api` — [`apps/api/src/brand-memory-server.ts`](../../apps/api/src/brand-memory-server.ts).  
Contract validation (1536, no embedder): `@home-link/marketer-pro-contract` → `brand-memory-embedding.ts`, `brand-retrieval.ts`, `brand-memory-http.ts`.

Below is the **ingest upsert** flow to implement in the API (no embedder calls; caller-supplied vectors only).

```text
function upsertBrandMemorySource(req):
  workspaceId = req.path.workspaceId
  brandId     = req.path.brandId

  body = parseJson(req.body)

  # required identifiers
  sourceId   = require(body.sourceId)
  version    = require(body.metadata.version)  # or body.version if you prefer
  sourceType = require(body.sourceType)

  # optional metadata for lexical scoring
  title   = body.title ?? ""
  summary = body.summary ?? ""
  tags    = body.tags ?? []
  trusted = body.trusted ?? false

  # raw text for chunking
  rawText = require(body.text)

  # chunking config with safe defaults
  chunkCfg = body.chunking ?? { strategy: "by_tokens", maxTokens: 350, overlapTokens: 60 }

  # optional embeddings block (caller-supplied)
  embeddingBlock = body.embedding ?? null
  if embeddingBlock != null:
     dims = require(embeddingBlock.dims)
     if dims != 1536:  # fixed policy you chose
        return http400("embedding.dims must be 1536")
     chunkVectors = embeddingBlock.chunks ?? []  # [{chunkIndex, vector}]
     # validate each vector length
     for v in chunkVectors:
        if length(v.vector) != 1536:
           return http400("each embedding vector must be length 1536")

  # chunk the text (server-side)
  chunks = chunkText(rawText, chunkCfg)
  # chunks: [{chunkIndex, text, tokenCount}]

  # transaction start (idempotent upsert)
  beginTransaction()

  # upsert source row (logical document)
  upsert brand_memory_sources
    key (workspace_id, brand_id, source_id, version)
    set source_type=sourceType, title=title, summary=summary, tags=tags, trusted=trusted, updated_at=now()

  # delete existing chunks for this source+version (simple, reliable idempotency)
  delete from brand_memory_chunks
    where workspace_id=workspaceId and brand_id=brandId and source_id=sourceId and version=version

  # build a quick lookup from chunkIndex -> vector (if provided)
  vectorByIndex = map()
  if embeddingBlock != null:
     for item in embeddingBlock.chunks:
        vectorByIndex[item.chunkIndex] = item.vector

  # insert new chunks
  for c in chunks:
     vec = vectorByIndex.get(c.chunkIndex)  # may be null
     insert into brand_memory_chunks(
        workspace_id, brand_id, source_id, version,
        chunk_index, text, token_count, embedding, created_at
     ) values (
        workspaceId, brandId, sourceId, version,
        c.chunkIndex, c.text, c.tokenCount, vec, now()
     )

  commitTransaction()

  return http200({
    "workspaceId": workspaceId,
    "brandId": brandId,
    "sourceId": sourceId,
    "version": version,
    "chunkCount": length(chunks),
    "embeddedChunkCount": count where vectorByIndex has key for chunkIndex
  })
```
