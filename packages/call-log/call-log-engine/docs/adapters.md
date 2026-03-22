# Adapters

Adapters are callback functions passed in the `adapters` and `agents` config objects. They let you plug in custom logic for contact lookup, contact creation, authentication, and agent name resolution.

## `lookupContact` (required)

Looks up a contact from your external contact store by phone, email, or external ID.

```ts
lookupContact: (query: { phone?: string; email?: string; externalId?: string }) => Promise<ContactInfo | null>
```

**Return type:**

```ts
interface ContactInfo {
  externalId: string;
  displayName: string;
  phone?: string;
  email?: string;
}
```

**Called when:**
- Creating a new call log (to resolve the contact reference)
- Searching contacts from the UI

**Example:**

```ts
adapters: {
  lookupContact: async (query) => {
    const filter: Record<string, unknown> = {};
    if (query.phone) filter.phone = query.phone;
    if (query.email) filter.email = query.email;
    if (query.externalId) filter._id = query.externalId;

    const contact = await ContactModel.findOne(filter);
    if (!contact) return null;

    return {
      externalId: contact._id.toString(),
      displayName: contact.name,
      phone: contact.phone,
      email: contact.email,
    };
  },
}
```

## `addContact` (optional)

Creates a new contact in your external contact store. Only called when the call log form submits a new contact that does not exist.

```ts
addContact: (data: {
  displayName: string;
  phone?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}) => Promise<ContactInfo>
```

**Called when:**
- The UI form submits a new contact during call log creation

**Example:**

```ts
adapters: {
  addContact: async (data) => {
    const contact = await ContactModel.create({
      name: data.displayName,
      phone: data.phone,
      email: data.email,
      metadata: data.metadata,
    });
    return {
      externalId: contact._id.toString(),
      displayName: contact.name,
      phone: contact.phone,
      email: contact.email,
    };
  },
}
```

If not provided, the "add new contact" functionality in the UI form will not be available.

## `authenticateAgent` (required)

Verifies a bearer token from the `Authorization` header and returns agent identity. Called on every protected route request. The engine extracts the token from the `Authorization` header (stripping the `Bearer ` prefix if present) and passes it to this adapter.

```ts
authenticateAgent: (token: string) => Promise<AuthResult | null>
```

**Return type:**

```ts
interface AuthResult {
  adminUserId: string;
  displayName: string;
}
```

Return `null` to deny access (results in 401 Unauthorized).

**Called when:**
- Every request to any protected route (all routes are protected when this adapter is provided)

**Example:**

```ts
adapters: {
  authenticateAgent: async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return {
        adminUserId: decoded.sub,
        displayName: decoded.name,
      };
    } catch {
      return null;
    }
  },
}
```

## `resolveAgent` (optional, in `agents` config)

Resolves an agent ID to display information. Used by the analytics service to show agent names in leaderboards and reports.

```ts
agents: {
  resolveAgent: (agentId: string) => Promise<AgentInfo | null>
}
```

**Return type:**

```ts
interface AgentInfo {
  agentId: string;
  displayName: string;
  avatar?: string;
  teamId?: string;
}
```

**Called when:**
- Analytics queries need to resolve agent display names
- Agent leaderboard generation

**Example:**

```ts
agents: {
  resolveAgent: async (agentId) => {
    const agent = await AgentModel.findById(agentId);
    if (!agent) return null;
    return {
      agentId: agent._id.toString(),
      displayName: agent.name,
      avatar: agent.avatar,
      teamId: agent.teamId,
    };
  },
}
```

If not provided, analytics will show raw agent IDs instead of display names.
