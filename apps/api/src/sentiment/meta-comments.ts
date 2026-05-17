export interface RawComment {
  externalCommentId: string;
  authorName?: string;
  authorId?: string;
  body: string;
  likeCount?: number;
  replyCount?: number;
  postedAt?: string;
}

export async function fetchMetaComments(externalPostId: string): Promise<RawComment[]> {
  const token = process.env.MARKETER_META_ACCESS_TOKEN?.trim();
  if (!token) return [];

  try {
    const url = `https://graph.facebook.com/v19.0/${externalPostId}/comments`
      + `?fields=id,message,from,like_count,comment_count,created_time`
      + `&access_token=${token}&limit=50`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as {
      data?: Array<{
        id: string;
        message?: string;
        from?: { id?: string; name?: string };
        like_count?: number;
        comment_count?: number;
        created_time?: string;
      }>;
    };

    return (data.data ?? []).map(c => ({
      externalCommentId: c.id,
      authorName: c.from?.name,
      authorId: c.from?.id,
      body: c.message ?? "",
      likeCount: c.like_count,
      replyCount: c.comment_count,
      postedAt: c.created_time,
    }));
  } catch {
    return [];
  }
}
