import type { RawComment } from "./meta-comments.js";

export async function fetchLinkedInComments(externalPostId: string): Promise<RawComment[]> {
  const token = process.env.MARKETER_LINKEDIN_ACCESS_TOKEN?.trim();
  if (!token) return [];

  try {
    const encodedPost = encodeURIComponent(externalPostId);
    const url = `https://api.linkedin.com/v2/socialActions/${encodedPost}/comments`
      + `?projection=(elements*(id,message,created,actor~(localizedFirstName,localizedLastName),likesSummary,commentsSummary))`
      + `&count=50`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    if (!res.ok) return [];

    const data = await res.json() as {
      elements?: Array<{
        id?: string;
        message?: { text?: string };
        created?: { time?: number };
        "actor~"?: { localizedFirstName?: string; localizedLastName?: string };
        likesSummary?: { totalLikes?: number };
        commentsSummary?: { totalFirstLevelComments?: number };
      }>;
    };

    return (data.elements ?? []).map(c => {
      const actor = c["actor~"];
      const name = actor ? `${actor.localizedFirstName ?? ""} ${actor.localizedLastName ?? ""}`.trim() : undefined;
      return {
        externalCommentId: c.id ?? "",
        authorName: name || undefined,
        body: c.message?.text ?? "",
        likeCount: c.likesSummary?.totalLikes,
        replyCount: c.commentsSummary?.totalFirstLevelComments,
        postedAt: c.created?.time ? new Date(c.created.time).toISOString() : undefined,
      };
    });
  } catch {
    return [];
  }
}
