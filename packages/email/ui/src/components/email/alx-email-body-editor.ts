import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';

/**
 * Email-specific content editor for the shared template editor's content slot.
 * Handles: subjects (A/B variants), bodies (MJML), preheaders, textBody.
 *
 * Usage:
 * <alx-template-editor baseUrl="/api/rules">
 *   <alx-email-body-editor slot="content"></alx-email-body-editor>
 * </alx-template-editor>
 */
export class AlxEmailBodyEditor extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    .section { margin-bottom: 16px; }
    .section label { display: block; font-size: 12px; font-weight: 600; color: var(--alx-text-muted, #6b7280); margin-bottom: 4px; text-transform: uppercase; }
    .variant-row { display: flex; gap: 8px; margin-bottom: 6px; align-items: center; }
    .variant-row input, .variant-row textarea { flex: 1; padding: 6px 10px; border: 1px solid var(--alx-border, #d1d5db); border-radius: var(--alx-radius, 4px); font-size: 13px; box-sizing: border-box; }
    textarea { font-family: monospace; min-height: 200px; resize: vertical; width: 100%; padding: 10px; border: 1px solid var(--alx-border, #d1d5db); border-radius: var(--alx-radius, 4px); font-size: 13px; box-sizing: border-box; }
    .add-btn { background: none; border: 1px dashed var(--alx-border, #d1d5db); padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--alx-text-muted, #6b7280); }
    .add-btn:hover { border-color: var(--alx-primary, #4f46e5); color: var(--alx-primary, #4f46e5); }
    .remove-btn { background: none; border: none; cursor: pointer; color: var(--alx-danger, #ef4444); font-size: 16px; padding: 0 4px; }
    .hint { font-size: 11px; color: var(--alx-text-muted, #9ca3af); margin-top: 2px; }
  `;

  @property({ type: Array }) bodies: string[] = [''];
  @property({ type: Array }) subjects: string[] = [''];
  @property({ type: Array }) preheaders: string[] = [];
  @property() textBody = '';
  @property({ type: Object }) metadata?: Record<string, unknown>;
  @property({ type: Array }) variables: string[] = [];
  @property({ type: Array }) collectionFields: any[] = [];

  private _emit() {
    this.dispatchEvent(new CustomEvent('content-changed', {
      detail: {
        bodies: this.bodies,
        subjects: this.subjects,
        preheaders: this.preheaders,
        textBody: this.textBody,
      },
      bubbles: true,
      composed: true,
    }));
  }

  private _updateSubject(index: number, value: string) {
    const updated = [...this.subjects];
    updated[index] = value;
    this.subjects = updated;
    this._emit();
  }

  private _addSubject() {
    this.subjects = [...this.subjects, ''];
    this._emit();
  }

  private _removeSubject(index: number) {
    if (this.subjects.length <= 1) return;
    this.subjects = this.subjects.filter((_, i) => i !== index);
    this._emit();
  }

  private _updateBody(index: number, value: string) {
    const updated = [...this.bodies];
    updated[index] = value;
    this.bodies = updated;
    this._emit();
  }

  private _addBody() {
    this.bodies = [...this.bodies, ''];
    this._emit();
  }

  private _removeBody(index: number) {
    if (this.bodies.length <= 1) return;
    this.bodies = this.bodies.filter((_, i) => i !== index);
    this._emit();
  }

  private _updatePreheader(index: number, value: string) {
    const updated = [...this.preheaders];
    updated[index] = value;
    this.preheaders = updated;
    this._emit();
  }

  private _addPreheader() {
    this.preheaders = [...this.preheaders, ''];
    this._emit();
  }

  private _removePreheader(index: number) {
    this.preheaders = this.preheaders.filter((_, i) => i !== index);
    this._emit();
  }

  override render() {
    return html`
      <div class="section">
        <label>Subject Lines ${this.subjects.length > 1 ? `(${this.subjects.length} variants)` : ''}</label>
        ${this.subjects.map((s, i) => html`
          <div class="variant-row">
            <input type="text" .value=${s} placeholder="Subject line${this.subjects.length > 1 ? ` (variant ${i + 1})` : ''}"
              @input=${(e: Event) => this._updateSubject(i, (e.target as HTMLInputElement).value)} />
            ${this.subjects.length > 1 ? html`<button class="remove-btn" @click=${() => this._removeSubject(i)}>&times;</button>` : ''}
          </div>
        `)}
        <button class="add-btn" @click=${this._addSubject}>+ Add Subject Variant</button>
        <div class="hint">Use {{variable}} syntax for personalization. Multiple subjects enable A/B testing.</div>
      </div>

      <div class="section">
        <label>Email Body (MJML) ${this.bodies.length > 1 ? `(${this.bodies.length} variants)` : ''}</label>
        ${this.bodies.map((b, i) => html`
          <div style="margin-bottom: 8px;">
            ${this.bodies.length > 1 ? html`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span style="font-size:11px;color:var(--alx-text-muted);">Variant ${i + 1}</span><button class="remove-btn" @click=${() => this._removeBody(i)}>&times;</button></div>` : ''}
            <textarea .value=${b} placeholder="MJML body content (e.g. <mj-text>Hello {{name}}</mj-text>)"
              @input=${(e: Event) => this._updateBody(i, (e.target as HTMLTextAreaElement).value)}></textarea>
          </div>
        `)}
        <button class="add-btn" @click=${this._addBody}>+ Add Body Variant</button>
        <div class="hint">Write MJML markup. Use &lt;mj-text&gt;, &lt;mj-image&gt;, &lt;mj-button&gt; etc. The engine auto-wraps in a full MJML document.</div>
      </div>

      <div class="section">
        <label>Preheaders</label>
        ${this.preheaders.map((p, i) => html`
          <div class="variant-row">
            <input type="text" .value=${p} placeholder="Preheader text (preview in inbox)"
              @input=${(e: Event) => this._updatePreheader(i, (e.target as HTMLInputElement).value)} />
            <button class="remove-btn" @click=${() => this._removePreheader(i)}>&times;</button>
          </div>
        `)}
        <button class="add-btn" @click=${this._addPreheader}>+ Add Preheader</button>
        <div class="hint">Preheader text appears in email inbox previews (Gmail, Outlook).</div>
      </div>

      <div class="section">
        <label>Plain Text Body (optional)</label>
        <textarea .value=${this.textBody} placeholder="Plain text fallback (auto-generated from HTML if left empty)"
          style="min-height: 100px;"
          @input=${(e: Event) => { this.textBody = (e.target as HTMLTextAreaElement).value; this._emit(); }}></textarea>
      </div>
    `;
  }
}

safeRegister('alx-email-body-editor', AlxEmailBodyEditor);
