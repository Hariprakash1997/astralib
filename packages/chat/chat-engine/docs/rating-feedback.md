# Rating & Feedback

> **Note:** All routes shown are relative to your chat engine mount point (e.g., if mounted at `/api/chat`, the full path would be `/api/chat/settings/rating`).

The chat engine supports a configurable rating system with three rating types, follow-up questions, and optional free-text comments.

## Rating Types

| Type | Constant | Values | Description |
|------|----------|--------|-------------|
| Thumbs | `thumbs` | `0` (down) or `1` (up) | Binary thumbs up/down |
| Stars | `stars` | `1` to `5` | Classic star rating |
| Emoji | `emoji` | `1` to `5` | Emoji-based scale |

## Two-Step Rating Flow

The rating system uses a two-step flow:

1. **Step 1: Rating** -- Visitor selects a rating value (thumbs, stars, or emoji)
2. **Step 2: Follow-up** -- Based on the rating value, the visitor sees contextual follow-up options and an optional comment field

The follow-up options are configured per rating value, so you can ask "What went wrong?" for negative ratings and "What did you like?" for positive ratings.

## Configuration

Configure the rating system via the REST API:

```ts
// GET /settings/rating
// PUT /settings/rating
```

**Example -- enable thumbs rating with follow-ups:**

```ts
// PUT /settings/rating
{
  "enabled": true,
  "ratingType": "thumbs",
  "followUpOptions": {
    "0": ["Slow response", "Unhelpful answer", "Rude agent", "Other"],
    "1": ["Quick resolution", "Friendly agent", "Clear explanation"]
  }
}
```

**Example -- stars rating:**

```ts
{
  "enabled": true,
  "ratingType": "stars",
  "followUpOptions": {
    "1": ["Very unhelpful", "Long wait time"],
    "2": ["Could be better", "Confusing answer"],
    "3": ["Average experience"],
    "4": ["Good support", "Mostly helpful"],
    "5": ["Excellent!", "Very knowledgeable"]
  }
}
```

### Rating Config Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable the rating prompt |
| `ratingType` | `'thumbs' \| 'stars' \| 'emoji'` | `'thumbs'` | Rating input type |
| `followUpOptions` | `Record<string, string[]>` | `{}` | Follow-up options keyed by rating value |

## Submitting Feedback

Feedback is submitted via `POST /sessions/:sessionId/feedback`.

**Two-step format (recommended):**

```ts
// POST /sessions/:sessionId/feedback
{
  "ratingType": "thumbs",
  "ratingValue": 1,
  "followUpSelections": ["Quick resolution", "Friendly agent"],
  "comment": "Really helpful, thanks!"
}
```

**Legacy format (backward compatible):**

```ts
// POST /sessions/:sessionId/feedback
{
  "rating": 4,
  "survey": { "comment": "Good support" }
}
```

### Validation Rules

| Field | Type | Rule |
|-------|------|------|
| `ratingType` | `string` | Must match the configured rating type |
| `ratingValue` | `number` | `0-1` for thumbs, `1-5` for stars/emoji |
| `followUpSelections` | `string[]` | Optional array of strings |
| `comment` | `string` | Optional free-text comment |

## Querying Feedback Data

**Aggregate stats:**

```ts
// GET /sessions/feedback-stats
```

Returns:

```json
{
  "totalRatings": 142,
  "averageRating": 4.2,
  "countByRating": {
    "1": 5,
    "2": 8,
    "3": 15,
    "4": 52,
    "5": 62
  }
}
```

**Per-session feedback:** Available in the session object returned by `GET /sessions/:sessionId`:

```json
{
  "session": {
    "feedback": {
      "ratingType": "stars",
      "ratingValue": 5,
      "followUpSelections": ["Excellent!"],
      "comment": "Very helpful",
      "submittedAt": "2026-03-20T10:30:00.000Z"
    }
  }
}
```

## Webhook Integration

When a rating is submitted and webhooks are configured, the `rating.submitted` event fires:

```json
{
  "event": "rating.submitted",
  "payload": {
    "sessionId": "abc-123",
    "ratingType": "thumbs",
    "ratingValue": 1,
    "followUpSelections": ["Quick resolution"],
    "comment": "Thanks!"
  }
}
```

See [Webhooks](https://github.com/Hariprakash1997/astralib/blob/main/packages/chat/chat-engine/docs/webhooks.md) for details.

## Hooks

The `onFeedbackReceived` hook fires when feedback is submitted:

```ts
hooks: {
  onFeedbackReceived: (sessionId, feedback) => {
    analytics.track('chat_rating', {
      sessionId,
      ratingType: feedback.ratingType,
      ratingValue: feedback.ratingValue,
    });
  },
}
```
