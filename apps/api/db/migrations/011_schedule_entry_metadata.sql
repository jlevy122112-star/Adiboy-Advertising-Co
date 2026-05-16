-- Post-level metadata: hashtags, mentions, alt text, platform extras.
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN schedule_entries.metadata IS
  'PostMetadata shape: hashtags[], mentions[], altText, location, firstComment, articleTitle, youtubeDescription, youtubeTags[], youtubeCategory.';
