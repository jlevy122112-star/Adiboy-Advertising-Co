# Social Integrations

Connect your social media accounts to Marketer Pro Office to schedule and publish content directly from the app — no copy-pasting required.

**Access:** Tools Panel → Integrations (unlocks at Level 4)

---

## Supported Platforms

| Platform | Connection method | What you can do |
|---|---|---|
| **Instagram** | OAuth via Facebook | Schedule feed posts, Reels previews |
| **Facebook** | OAuth | Schedule Page posts |
| **TikTok** | OAuth | Schedule video posts (requires video upload) |
| **LinkedIn** | OAuth | Schedule personal and Company Page posts |
| **X (Twitter)** | OAuth | Schedule tweets and threads |

---

## Connecting a Platform

1. Open Tools Panel → Integrations
2. Tap **Connect** next to the platform you want to add
3. A browser window opens — log in to the platform and grant the requested permissions
4. Once authorised, you are returned to the app and the platform shows as **Connected**

Each platform integration requires specific permissions. We only request the minimum permissions necessary.

### Permissions We Request

**Instagram / Facebook:**
- `pages_manage_posts` — publish content to your Facebook Pages
- `instagram_content_publish` — publish content to your Instagram account
- `pages_read_engagement` — read engagement data for analytics

**LinkedIn:**
- `w_member_social` — post to your personal LinkedIn profile
- `w_organization_social` — post to LinkedIn Company Pages you manage
- `r_organization_social` — read analytics for your Company Pages

**TikTok:**
- `video.upload` — upload video content
- `video.publish` — publish video content to your account

**X (Twitter):**
- `tweet.write` — post tweets on your behalf
- `tweet.read` — read your timeline for analytics

> We do not request permission to read your messages, contact lists, or follower data beyond what is needed for analytics.

---

## Disconnecting a Platform

1. Open Tools Panel → Integrations
2. Tap the connected platform
3. Tap **Disconnect**

Disconnecting removes the stored access token from our system and revokes our app's access to the platform. Any posts that were already published are not affected. Scheduled posts for that platform become drafts.

You should also revoke access directly in the platform's app settings for complete removal:
- Instagram/Facebook: Settings → Apps and Websites → Marketer Pro Office → Remove
- LinkedIn: Settings → Data Privacy → Permitted Services → Marketer Pro Office → Remove
- TikTok: Profile → Settings → Apps and Websites → Marketer Pro Office → Revoke
- X: Settings → Security → Connected Apps → Marketer Pro Office → Revoke

---

## Publishing Flow

When a scheduled post time arrives, the system:

1. Retrieves the post content and media from your Artifact Vault
2. Sends it to the connected platform API using your stored access token
3. Marks the post as **Published** (green dot) in the Calendar Drawer on success
4. Marks the post as **Failed** (red dot) and sends a notification on failure

### Failed Posts
If a post fails to publish, tap the red dot in the Calendar Drawer to see the error reason. Common reasons:

| Error | What to do |
|---|---|
| **Token expired** | Reconnect the platform in Integrations |
| **Account permission changed** | Reconnect and re-grant permissions |
| **Content policy violation** | Review the post content — the platform rejected it |
| **Media upload failed** | Re-attach the media and reschedule |
| **Rate limit exceeded** | The platform has a daily post limit. Reschedule to another day |

---

## Integration Availability by Plan

| Feature | Free | Pro | Enterprise |
|---|---|---|---|
| Connect platforms | Up to 2 | All 5 | All 5 + team |
| Direct publishing | ✓ | ✓ | ✓ |
| Analytics pull | — | ✓ | ✓ |

---

## Security of Your Tokens

Your platform access tokens are stored encrypted in our database and never transmitted in plain text. We do not store your social media passwords — the connection is handled entirely through each platform's OAuth flow.

Access tokens are automatically rotated when platforms issue new ones. You can force-revoke all tokens by disconnecting from within the app or by going to each platform's app settings.

---

## Tips

- **Connect platforms before scheduling.** Posts scheduled without a connected platform are saved as drafts. If you connect a platform later, go to the Calendar Drawer and republish any drafts.
- **Check token expiry.** Platform tokens occasionally expire, especially if you change your platform password. If posts start failing, try reconnecting the platform.
- **Instagram requires a Professional account.** Instagram's publishing API only works with Creator or Business accounts. If you're on a personal account, you'll need to switch in the Instagram app first.
- **LinkedIn Company Pages require admin access.** You can only post to a LinkedIn Company Page if you are a Page Admin on that page.
