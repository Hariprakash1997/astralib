# Content Slot Guide — `@astralibx/rule-engine-ui`

Source: [`packages/rule-engine/ui/src/components/alx-template-editor.ts`](https://github.com/Hariprakash1997/astralib/blob/main/packages/rule-engine/ui/src/components/alx-template-editor.ts)

---

## What is the Content Slot?

The `<alx-template-editor>` component renders a two-column layout: a fixed sidebar on the left and a main content area on the right. The main content area is exposed as a named slot:

```html
<slot name="content"></slot>
```

This slot is the extension point for platform-specific content editing. The sidebar — which handles template settings (name, slug, description, platform, audience, category), collection selection, joins, subject lines, and variable management — is always rendered by the editor itself. The slot gives you full control over how the actual message body is authored for your particular channel (email, Telegram, WhatsApp, SMS, etc.).

---

## How It Works

The editor renders its own sidebar and wraps a `<slot name="content">` inside `.editor-main`. Whatever element you place with `slot="content"` fills the right-hand content area.

```html
<alx-template-editor base-url="/api">
  <!-- Your custom editor goes here -->
  <my-email-editor slot="content"></my-email-editor>
</alx-template-editor>
```

The slotted element is a standard DOM child of `<alx-template-editor>` — it lives in the light DOM, not the shadow DOM. This means:

- You can style it with your own CSS without piercing shadow roots.
- It can use any framework or vanilla JS — it does not have to be a Lit component.
- Properties are set on it directly by the editor after every state change.

---

## Data Flow

The template editor uses a push model. After every relevant state change (`_form` or `_collectionFields` updates), the editor calls `_syncSlotContent()`, which directly sets properties on the slotted element:

```typescript
// Inside alx-template-editor — called after every relevant update
private _syncSlotContent(): void {
  const slotted = this.querySelector('[slot="content"]') as any;
  if (slotted) {
    slotted.bodies           = this._form.bodies;
    slotted.subjects         = this._form.subjects;
    slotted.preheaders       = this._form.preheaders;
    slotted.textBody         = this._form.textBody;
    slotted.metadata         = this._form.metadata;
    slotted.variables        = this._form.variables;
    slotted.collectionFields = this._collectionFields;
  }
}
```

To send changes back, the slotted element dispatches a `content-changed` CustomEvent. The editor listens for this event on itself and merges the detail into the form state:

```typescript
// Inside alx-template-editor — registered in connectedCallback
this.addEventListener('content-changed', ((e: CustomEvent) => {
  const detail = e.detail;
  this._form = { ...this._form, ...detail };
}) as EventListener);
```

### Props received by the slot component

| Prop | Type | Description |
|---|---|---|
| `bodies` | `string[]` | Array of body content variants (A/B variants are represented as multiple entries) |
| `subjects` | `string[]` | Subject line variants (primarily for email; may be empty for other channels) |
| `preheaders` | `string[]` | Preheader text variants (email preview text shown in inbox listings) |
| `textBody` | `string` | Plain text fallback body (used alongside HTML body for email) |
| `metadata` | `Record<string, unknown>` | Platform-specific structured data (e.g. button arrays for WhatsApp) |
| `variables` | `string[]` | List of template variable paths selected by the user (e.g. `["user.name", "order.total"]`) |
| `collectionFields` | `CollectionField[]` | All fields from the selected collection and its joins, available for a variable picker UI |

### Event to emit

When the user makes any change in the slotted editor, dispatch `content-changed` with the updated fields as the event detail. Only include the fields you are updating — the editor merges the detail shallowly into its form state.

```typescript
this.dispatchEvent(new CustomEvent('content-changed', {
  detail: {
    bodies: [...],       // required — at least one entry
    subjects: [...],     // optional — include if your component manages subjects
    preheaders: [...],   // optional
    textBody: '...',     // optional
    metadata: { ... },   // optional
  },
  bubbles: true,
  composed: true,        // must be true so the event crosses the shadow boundary
}));
```

`bubbles: true` and `composed: true` are both required. Without `composed: true` the event will not cross the shadow DOM boundary of `<alx-template-editor>` and the editor will never receive it.

---

## Building an Email Editor

The following example creates `<alx-email-body-editor>` — a Lit component with an MJML/HTML textarea for each body variant plus a subject input for each subject variant.

```typescript
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

class AlxEmailBodyEditor extends LitElement {
  @property({ type: Array }) bodies: string[] = [''];
  @property({ type: Array }) subjects: string[] = [''];
  @property({ type: Array }) preheaders: string[] = [];
  @property({ type: Array }) variables: string[] = [];

  static override styles = css`
    :host { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; }
    textarea { width: 100%; min-height: 320px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
    label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #888; }
    .variant { border: 1px solid #333; border-radius: 4px; padding: 0.75rem; }
    .variable-bar { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.5rem; }
    .var-chip { font-size: 0.7rem; background: #2a2a2a; border: 1px solid #444; border-radius: 3px; padding: 2px 6px; cursor: pointer; }
  `;

  private _emit(): void {
    this.dispatchEvent(new CustomEvent('content-changed', {
      detail: { bodies: this.bodies, subjects: this.subjects, preheaders: this.preheaders },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateBody(index: number, value: string): void {
    const bodies = [...this.bodies];
    bodies[index] = value;
    this.bodies = bodies;
    this._emit();
  }

  private _updateSubject(index: number, value: string): void {
    const subjects = [...this.subjects];
    subjects[index] = value;
    this.subjects = subjects;
    this._emit();
  }

  private _insertVariable(v: string, bodyIndex: number): void {
    const textarea = this.shadowRoot!.querySelectorAll('textarea')[bodyIndex] as HTMLTextAreaElement;
    const start = textarea.selectionStart ?? this.bodies[bodyIndex].length;
    const bodies = [...this.bodies];
    bodies[bodyIndex] = bodies[bodyIndex].slice(0, start) + `{{${v}}}` + bodies[bodyIndex].slice(start);
    this.bodies = bodies;
    this._emit();
  }

  override render() {
    return html`
      ${this.bodies.map((body, i) => html`
        <div class="variant">
          <label>Variant ${i + 1}</label>

          <label style="margin-top:0.5rem">Subject</label>
          <input
            type="text"
            .value=${this.subjects[i] ?? ''}
            @input=${(e: Event) => this._updateSubject(i, (e.target as HTMLInputElement).value)}
            placeholder="Subject line…"
          />

          <label style="margin-top:0.5rem">MJML / HTML Body</label>
          ${this.variables.length > 0 ? html`
            <div class="variable-bar">
              ${this.variables.map(v => html`
                <span class="var-chip" @click=${() => this._insertVariable(v, i)}>{{${v}}}</span>
              `)}
            </div>
          ` : ''}
          <textarea
            .value=${body}
            @input=${(e: Event) => this._updateBody(i, (e.target as HTMLTextAreaElement).value)}
            placeholder="<mjml>…</mjml>"
          ></textarea>
        </div>
      `)}
    `;
  }
}

customElements.define('alx-email-body-editor', AlxEmailBodyEditor);
```

Usage:

```html
<alx-template-editor base-url="/api" .platforms=${['email']}>
  <alx-email-body-editor slot="content"></alx-email-body-editor>
</alx-template-editor>
```

---

## Building a Telegram Editor

Telegram messages are plain text (or Markdown). A single textarea per variant is sufficient. Subjects and preheaders are not relevant for Telegram, so only `bodies` is included in the event detail.

```typescript
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

class AlxTelegramBodyEditor extends LitElement {
  @property({ type: Array }) bodies: string[] = [''];
  @property({ type: Array }) variables: string[] = [];

  static override styles = css`
    :host { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
    textarea { width: 100%; min-height: 200px; resize: vertical; }
    label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #888; }
    .var-bar { display: flex; flex-wrap: wrap; gap: 4px; }
    .var-chip { font-size: 0.7rem; background: #1e1e1e; border: 1px solid #333; border-radius: 3px; padding: 2px 6px; cursor: pointer; }
  `;

  private _emit(): void {
    this.dispatchEvent(new CustomEvent('content-changed', {
      detail: { bodies: this.bodies },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateBody(index: number, value: string): void {
    const bodies = [...this.bodies];
    bodies[index] = value;
    this.bodies = bodies;
    this._emit();
  }

  override render() {
    return html`
      ${this.bodies.map((body, i) => html`
        <div>
          <label>Message Variant ${i + 1}</label>
          ${this.variables.length > 0 ? html`
            <div class="var-bar">
              ${this.variables.map(v => html`<span class="var-chip">{{${v}}}</span>`)}
            </div>
          ` : ''}
          <textarea
            .value=${body}
            @input=${(e: Event) => this._updateBody(i, (e.target as HTMLTextAreaElement).value)}
            placeholder="Your Telegram message…"
          ></textarea>
        </div>
      `)}
    `;
  }
}

customElements.define('alx-telegram-body-editor', AlxTelegramBodyEditor);
```

Usage:

```html
<alx-template-editor base-url="/api" .platforms=${['telegram']}>
  <alx-telegram-body-editor slot="content"></alx-telegram-body-editor>
</alx-template-editor>
```

---

## Building a WhatsApp Editor

WhatsApp templates can include interactive buttons. The `metadata` field is the right place to store the buttons array. The editor treats `metadata` as a `Record<string, unknown>`, so you can structure it however your backend expects.

```typescript
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';

interface WAButton { type: 'QUICK_REPLY' | 'URL'; text: string; url?: string; }

class AlxWhatsappBodyEditor extends LitElement {
  @property({ type: Array }) bodies: string[] = [''];
  @property({ type: Object }) metadata: Record<string, unknown> = {};
  @property({ type: Array }) variables: string[] = [];

  static override styles = css`
    :host { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; }
    textarea { width: 100%; min-height: 160px; resize: vertical; }
    label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #888; }
    .btn-list { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.4rem; }
    .btn-row { display: flex; gap: 0.4rem; align-items: center; }
    .btn-row input { flex: 1; }
    button.add { font-size: 0.75rem; margin-top: 0.4rem; }
  `;

  private get _buttons(): WAButton[] {
    return (this.metadata?.buttons as WAButton[]) ?? [];
  }

  private _emit(): void {
    this.dispatchEvent(new CustomEvent('content-changed', {
      detail: { bodies: this.bodies, metadata: this.metadata },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateBody(value: string): void {
    this.bodies = [value];
    this._emit();
  }

  private _addButton(): void {
    const buttons = [...this._buttons, { type: 'QUICK_REPLY' as const, text: '' }];
    this.metadata = { ...this.metadata, buttons };
    this._emit();
  }

  private _updateButtonText(index: number, text: string): void {
    const buttons = this._buttons.map((b, i) => i === index ? { ...b, text } : b);
    this.metadata = { ...this.metadata, buttons };
    this._emit();
  }

  private _removeButton(index: number): void {
    const buttons = this._buttons.filter((_, i) => i !== index);
    this.metadata = { ...this.metadata, buttons };
    this._emit();
  }

  override render() {
    return html`
      <label>Message Body</label>
      <textarea
        .value=${this.bodies[0] ?? ''}
        @input=${(e: Event) => this._updateBody((e.target as HTMLTextAreaElement).value)}
        placeholder="Your WhatsApp message…"
      ></textarea>

      <label>Quick Reply / URL Buttons</label>
      <div class="btn-list">
        ${this._buttons.map((btn, i) => html`
          <div class="btn-row">
            <select
              .value=${btn.type}
              @change=${(e: Event) => this._updateButtonText(i, btn.text)}
            >
              <option value="QUICK_REPLY">Quick Reply</option>
              <option value="URL">URL</option>
            </select>
            <input
              type="text"
              .value=${btn.text}
              @input=${(e: Event) => this._updateButtonText(i, (e.target as HTMLInputElement).value)}
              placeholder="Button label"
            />
            <button @click=${() => this._removeButton(i)}>&times;</button>
          </div>
        `)}
        <button class="add" @click=${this._addButton}>+ Add Button</button>
      </div>
    `;
  }
}

customElements.define('alx-whatsapp-body-editor', AlxWhatsappBodyEditor);
```

Usage:

```html
<alx-template-editor base-url="/api" .platforms=${['whatsapp']}>
  <alx-whatsapp-body-editor slot="content"></alx-whatsapp-body-editor>
</alx-template-editor>
```

---

## Fallback

When no element with `slot="content"` is provided, the editor renders a minimal fallback inside `.editor-main`:

```html
<div class="fallback-editor">
  <label>Content</label>
  <textarea placeholder="Template body content"></textarea>
</div>
```

The fallback textarea is bound to `bodies[0]` and dispatches updates internally — it is fully functional for simple use cases where you do not need platform-specific editing. For any real deployment you should replace it with a slotted component appropriate for your channel.
