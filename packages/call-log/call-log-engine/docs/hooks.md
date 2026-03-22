# Lifecycle Hooks

Hooks are optional callbacks passed in the `hooks` config object. They fire after internal state has been updated and are intended for notifications, analytics, and side effects. All hooks are fire-and-forget -- they do not block the main flow.

## `onCallCreated`

Fires after a new call log is created.

```ts
onCallCreated: (callLog: ICallLog) => void | Promise<void>
```

**When it fires:** Immediately after the call log document is saved to MongoDB, with the initial timeline entry ("Call log created") already appended.

**Example:**

```ts
hooks: {
  onCallCreated: (callLog) => {
    console.log(`New ${callLog.direction} call for ${callLog.contactRef.displayName}`);
    slackNotify(`New call logged: ${callLog.contactRef.displayName} (${callLog.priority})`);
  },
}
```

## `onStageChanged`

Fires after a call log transitions from one pipeline stage to another.

```ts
onStageChanged: (callLog: ICallLog, fromStage: string, toStage: string) => void | Promise<void>
```

**Parameters:**
- `callLog` -- the updated call log document (already at the new stage)
- `fromStage` -- the stage name the call was in before
- `toStage` -- the stage name the call is now in

**When it fires:** After stage change is saved and the timeline entry is appended. Also fires during bulk stage changes (once per call log).

**Example:**

```ts
hooks: {
  onStageChanged: (callLog, from, to) => {
    console.log(`Call ${callLog.callLogId}: ${from} -> ${to}`);
    if (to === 'Closed Won') {
      celebrateInSlack(callLog);
    }
  },
}
```

## `onCallClosed`

Fires after a call log is closed -- either by reaching a terminal stage or by manual close.

```ts
onCallClosed: (callLog: ICallLog) => void | Promise<void>
```

**When it fires:** After `isClosed` is set to `true` and `closedAt` is recorded. The timeline entry ("Call closed") is already appended.

**Example:**

```ts
hooks: {
  onCallClosed: (callLog) => {
    analytics.track('call_closed', {
      callLogId: callLog.callLogId,
      pipelineId: callLog.pipelineId,
      duration: callLog.durationMinutes,
    });
  },
}
```

## `onCallAssigned`

Fires after a call log is reassigned to a different agent.

```ts
onCallAssigned: (callLog: ICallLog, previousAgentId?: string) => void | Promise<void>
```

**Parameters:**
- `callLog` -- the updated call log (already assigned to the new agent)
- `previousAgentId` -- the agent ID who had the call before (undefined for first assignment)

**When it fires:** After the assignment is saved and the timeline entry is appended.

**Example:**

```ts
hooks: {
  onCallAssigned: (callLog, previousAgentId) => {
    notifyAgent(callLog.agentId, `You have been assigned call: ${callLog.contactRef.displayName}`);
    if (previousAgentId) {
      notifyAgent(previousAgentId, `Call ${callLog.contactRef.displayName} was reassigned`);
    }
  },
}
```

## `onFollowUpDue`

Fires when the FollowUpWorker detects that a call log's `nextFollowUpDate` has been reached.

```ts
onFollowUpDue: (callLog: ICallLog) => void | Promise<void>
```

**When it fires:** During the worker's polling cycle (every `followUpCheckIntervalMs`, default 60 seconds). The worker queries MongoDB for call logs where `nextFollowUpDate <= now` and `followUpNotifiedAt` is not set, then fires this hook for each.

After firing, the worker marks the call log with `followUpNotifiedAt` to prevent duplicate notifications.

**Example:**

```ts
hooks: {
  onFollowUpDue: async (callLog) => {
    await sendEmail({
      to: await getAgentEmail(callLog.agentId),
      subject: `Follow-up due: ${callLog.contactRef.displayName}`,
      body: `Your follow-up for ${callLog.contactRef.displayName} is due.`,
    });
  },
}
```

## `onMetric`

Fires for operational metrics that can be forwarded to monitoring systems.

```ts
onMetric: (metric: CallLogMetric) => void | Promise<void>
```

**Metric type:**

```ts
interface CallLogMetric {
  name: string;
  labels: Record<string, string>;
  value?: number;
}
```

**When it fires:** At various points during engine operations (call creation, stage changes, worker cycles).

**Example:**

```ts
hooks: {
  onMetric: (metric) => {
    prometheus.counter(metric.name, metric.labels).inc(metric.value ?? 1);
  },
}
```
