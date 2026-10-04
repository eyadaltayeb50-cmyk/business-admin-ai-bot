create extension if not exists vector with schema extensions;

alter table lectures
  add column if not exists index_status text not null default 'pending'
    check (index_status in ('pending','indexed','failed')),
  add column if not exists index_error text;

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references lectures(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (lecture_id, chunk_index)
);

create index if not exists idx_document_chunks_lecture
  on document_chunks(lecture_id);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count integer
)
returns table (
  id uuid,
  lecture_id uuid,
  chunk_index integer,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.lecture_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

create index if not exists idx_document_chunks_embedding
  on document_chunks using hnsw (embedding vector_cosine_ops);
