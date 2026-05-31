# Calendar & Scheduling

Marketer Pro Office gives you two connected scheduling tools: the **Calendar Drawer** for a visual overview of your content calendar, and the **Scheduler Tower** for deciding exactly when a post goes live.

---

## The Calendar Drawer

The Calendar Drawer is the visual calendar on the right side of the Desk.

**Opening the calendar:**
- Tap the calendar icon in the Workspace Header
- Tap the calendar icon in the Quick Actions Bar (mobile)
- On tablet/desktop, the Calendar Drawer is always visible

### Reading the Calendar

Each day in the grid shows coloured dots for posts scheduled that day:

| Dot colour | Meaning |
|---|---|
| 🟡 Gold | Scheduled — awaiting publish time |
| 🟢 Green | Successfully published |
| ⚫ Grey | Draft — not yet confirmed |
| 🔴 Red | Failed to publish |

### Navigating Months
Use the **← →** arrows at the top of the Calendar Drawer to move forward or backward through months.

### Viewing a Day's Posts
Tap any day in the calendar to see the posts scheduled for that day listed below the grid. Each post shows:
- Platform icon and colour
- Caption preview (first 60 characters)
- Scheduled time

### Rescheduling a Post
Tap a post in the day view, then tap **Edit schedule** to open the Scheduler Tower for that post. Change the time and confirm.

---

## The Scheduler Tower

The Scheduler Tower is the scene where you confirm when a post will be published.

**Opening the Scheduler Tower:**
- From the Presentation Chamber after a generation (tap **Schedule** on an artifact)
- From the Artifact Vault (tap an artifact → **Schedule**)
- From the Calendar Drawer (tap **+** to schedule a new post for a day)

---

### Auto-Schedule

Tap **Auto-Schedule** for the AI to suggest the optimal posting time for your content.

The suggested time is calculated based on:
- **Platform best-practice windows** — each platform has known high-engagement time windows (e.g. Instagram performs best at 8–10am and 7–9pm in the user's timezone)
- **Your historical engagement** (Pro) — as you accumulate post history, the system learns which times your specific audience engages most
- **Day of week patterns** — different platforms perform differently on weekdays vs weekends

The suggested time and reason ("optimal engagement window") are displayed in the calendar hologram confirmation screen.

### Quick Select

Four preset time options for fast scheduling without thinking:

| Option | When it schedules |
|---|---|
| In 2 hours | Exactly 2 hours from now |
| Tonight 8pm | Today at 8:00pm in your timezone |
| Tomorrow 9am | Tomorrow at 9:00am in your timezone |
| Tomorrow noon | Tomorrow at 12:00pm in your timezone |

### Manual Time Selection

Tap **Pick a custom time** to open a time picker and set any date and time you want.

### Confirming the Schedule

Once you have a time selected — via Auto-Schedule, Quick Select, or manual — the **Confirm Schedule** screen shows:

- The date in large display font
- The exact time
- The reason (if auto-scheduled)

Tap **Confirm Schedule** to lock it in. The post appears in the Calendar Drawer immediately.

Tap **← Change time** to go back and pick a different time.

---

## Platform-Specific Scheduling

When you confirm a schedule, the system publishes to all platforms connected in your [Integrations](./07-social-integrations.md) settings. If a platform is not connected, the post is saved as a draft you can manually publish later.

| Status | What it means |
|---|---|
| **Scheduled** | Connected platform — will auto-publish at the set time |
| **Draft** | Platform not connected — requires manual publish |

---

## Managing Scheduled Posts

### Editing a Scheduled Post
Tap a post in the Calendar Drawer day view → **Edit post** to change the caption, hashtags, or image before it publishes.

### Cancelling a Scheduled Post
Tap a post → **Cancel schedule** to move it back to draft status. The post is not deleted — it remains in the Artifact Vault.

### What Happens at Publish Time
At the scheduled time, Marketer Pro Office sends the post to the connected platform API. The post dot in the calendar turns green on success or red on failure. If a post fails, you receive a notification and can retry from the Calendar Drawer.

---

## Tips

- **Schedule a week ahead on Sundays.** Use the Vault Generator to produce a week's worth of content, then use Auto-Schedule to distribute posts across optimal windows.
- **Check your timezone.** Scheduling uses your device's timezone by default. Verify this in Settings → Account → Timezone if you manage brands in different regions.
- **Use the Scheduler Tower's auto-schedule for new platforms.** Until you have enough historical data, the platform best-practice windows are your best starting point.
