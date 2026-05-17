import type { RawComment } from "./meta-comments.js";

export async function fetchYouTubeComments(externalPostId: string): Promise<RawComment[]> {
  const token = process.env.MARKETER_YOUTUBE_ACCESS_TOKEN?.trim();
  if (!token) return [];

  try {
    const url = `https://www.googleapis.com/youtube/v3/commentThreads`
      + `?part=snippet&videoId=${externalPostId}&maxResults=50&order=relevance`
      + `&access_token=${token}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json() as {
      items?: Array<{
        id?: string;
        snippet?: {
          topLevelComment?: {
            id?: string;
            snippet?: {
              textDisplay?: string;
              authorDisplayName?: string;
              authorChannelId?: { value?: string };
              likeCount?: number;
              publishedAt?: string;
            };
          };
          totalReplyCount?: number;
        };
      }>;
    };

    return (data.items ?? []).map(item => {
      const s = item.snippet?.topLevelComment?.snippet;
      return {
        externalCommentId: item.snippet?.topLevelComment?.id ?? item.id ?? "",
        authorName: s?.authorDisplayName,
        authorId: s?.authorChannelId?.value,
        body: s?.textDisplay ?? "",
        likeCount: s?.likeCount,
        replyCount: item.snippet?.totalReplyCount,
        postedAt: s?.publishedAt,
      };
    });
  } catch {
    return [];
  }
}
