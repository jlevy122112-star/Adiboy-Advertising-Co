import type { RawComment } from "./meta-comments.js";

export async function fetchXComments(externalPostId: string): Promise<RawComment[]> {
  const token = process.env.MARKETER_X_ACCESS_TOKEN?.trim();
  if (!token) return [];

  try {
    const url = `https://api.twitter.com/2/tweets/search/recent`
      + `?query=conversation_id:${externalPostId}`
      + `&tweet.fields=created_at,public_metrics,author_id`
      + `&expansions=author_id&user.fields=name`
      + `&max_results=50`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];

    const data = await res.json() as {
      data?: Array<{
        id: string;
        text?: string;
        author_id?: string;
        created_at?: string;
        public_metrics?: { like_count?: number; reply_count?: number };
      }>;
      includes?: { users?: Array<{ id: string; name: string }> };
    };

    const userMap = new Map((data.includes?.users ?? []).map(u => [u.id, u.name]));

    return (data.data ?? []).map(t => ({
      externalCommentId: t.id,
      authorId: t.author_id,
      authorName: t.author_id ? userMap.get(t.author_id) : undefined,
      body: t.text ?? "",
      likeCount: t.public_metrics?.like_count,
      replyCount: t.public_metrics?.reply_count,
      postedAt: t.created_at,
    }));
  } catch {
    return [];
  }
}
