import { LitElement, html, css, nothing } from 'lit';
import { state, property } from 'lit/decorators.js';
import { safeRegister } from '../../utils/safe-register.js';
import { alxBaseStyles } from '../../styles/theme.js';
import { alxDensityStyles, alxButtonStyles, alxInputStyles } from '../../styles/shared.js';

interface MetadataRow {
  key: string;
  value: string | string[];
  type: 'text' | 'list';
}

export class AlxMetadataEditor extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    css`
      :host {
        display: block;
      }

      .entries {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .entry {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        padding: 0.5rem;
        background: var(--alx-bg);
      }

      .entry-header {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        margin-bottom: 0.375rem;
      }

      .entry-key {
        flex: 1;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        border: 1px solid transparent;
        border-radius: 3px;
        background: transparent;
        color: var(--alx-text);
        font-family: var(--alx-font-family);
        min-width: 0;
      }

      .entry-key:focus {
        outline: none;
        border-color: var(--alx-primary);
        background: var(--alx-surface);
      }

      .entry-key::placeholder {
        color: var(--alx-text-muted);
        font-weight: 400;
      }

      .type-btn {
        font-size: 0.6rem;
        padding: 0.1rem 0.35rem;
        border-radius: 3px;
        border: 1px solid var(--alx-border);
        background: var(--alx-surface);
        color: var(--alx-text-muted);
        cursor: pointer;
        font-family: var(--alx-font-family);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        transition: all 0.15s;
        line-height: 1.5;
      }

      .type-btn:hover {
        border-color: var(--alx-primary);
        color: var(--alx-primary);
      }

      .remove-btn {
        font-size: 0.9rem;
        line-height: 1;
        padding: 0.1rem 0.25rem;
        border: none;
        background: transparent;
        color: var(--alx-text-muted);
        cursor: pointer;
        border-radius: 3px;
        transition: all 0.15s;
      }

      .remove-btn:hover {
        color: var(--alx-danger);
        background: color-mix(in srgb, var(--alx-danger) 10%, transparent);
      }

      .entry-body {
        padding-left: 0.5rem;
      }

      /* Text mode */
      .text-input {
        width: 100%;
        font-size: 0.8rem;
        padding: 0.3rem 0.5rem;
        border: 1px solid var(--alx-border);
        border-radius: 3px;
        background: var(--alx-surface);
        color: var(--alx-text);
        font-family: var(--alx-font-family);
      }

      .text-input:focus {
        outline: none;
        border-color: var(--alx-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--alx-primary) 15%, transparent);
      }

      /* List mode */
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        padding: 0.15rem 0.4rem;
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
        color: var(--alx-primary);
        border-radius: 3px;
        font-size: 0.7rem;
        font-weight: 500;
        line-height: 1.4;
      }

      .chip-x {
        cursor: pointer;
        font-size: 0.8rem;
        line-height: 1;
        opacity: 0.6;
        transition: opacity 0.1s;
      }

      .chip-x:hover {
        opacity: 1;
      }

      .chip-input {
        border: none;
        outline: none;
        font-size: 0.75rem;
        padding: 0.15rem 0.25rem;
        min-width: 80px;
        flex: 1;
        background: transparent;
        color: var(--alx-text);
        font-family: var(--alx-font-family);
      }

      .chip-input::placeholder {
        color: var(--alx-text-muted);
        opacity: 0.6;
      }

      .add-btn {
        font-size: 0.75rem;
        padding: 0.25rem 0.625rem;
        margin-top: 0.375rem;
      }

      .empty-hint {
        font-size: 0.75rem;
        color: var(--alx-text-muted);
        padding: 0.5rem 0;
      }
    `,
  ];

  @property({ type: String, reflect: true }) density: 'default' | 'compact' = 'default';
  @property({ type: Object }) value: Record<string, string | string[]> = {};

  @state() private rows: MetadataRow[] = [];
  private _initialized = false;

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('value') && !this._initialized) {
      this.rows = Object.entries(this.value ?? {}).map(([key, val]) => ({
        key,
        value: val,
        type: Array.isArray(val) ? 'list' as const : 'text' as const,
      }));
      this._initialized = true;
    }
  }

  private emitChange(): void {
    const metadata: Record<string, string | string[]> = {};
    for (const row of this.rows) {
      if (row.key.trim()) {
        metadata[row.key.trim()] = row.value;
      }
    }
    this.dispatchEvent(
      new CustomEvent('metadata-change', {
        detail: metadata,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onKeyChange(index: number, val: string): void {
    this.rows = this.rows.map((r, i) => (i === index ? { ...r, key: val } : r));
    this.emitChange();
  }

  private onValueChange(index: number, val: string): void {
    this.rows = this.rows.map((r, i) => (i === index ? { ...r, value: val } : r));
    this.emitChange();
  }

  private onToggleType(index: number): void {
    const row = this.rows[index];
    const newType = row.type === 'text' ? 'list' : 'text';
    let newValue: string | string[];
    if (newType === 'list') {
      newValue = typeof row.value === 'string' && row.value
        ? row.value.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(row.value) ? row.value : [];
    } else {
      newValue = Array.isArray(row.value) ? row.value.join(', ') : (row.value ?? '');
    }
    this.rows = this.rows.map((r, i) =>
      i === index ? { ...r, type: newType, value: newValue } : r,
    );
    this.emitChange();
  }

  private onAddRow(): void {
    this.rows = [...this.rows, { key: '', value: [] as string[], type: 'list' }];
  }

  private onRemoveRow(index: number): void {
    this.rows = this.rows.filter((_, i) => i !== index);
    this.emitChange();
  }

  private onChipInputKeydown(index: number, e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const tag = input.value.trim().replace(/,$/g, '');
    if (!tag) return;
    const row = this.rows[index];
    const arr = Array.isArray(row.value) ? row.value : [];
    this.rows = this.rows.map((r, i) =>
      i === index ? { ...r, value: [...arr, tag] } : r,
    );
    input.value = '';
    this.emitChange();
  }

  private onRemoveChip(rowIndex: number, chipIndex: number): void {
    const row = this.rows[rowIndex];
    if (!Array.isArray(row.value)) return;
    const newVal = row.value.filter((_, i) => i !== chipIndex);
    this.rows = this.rows.map((r, i) =>
      i === rowIndex ? { ...r, value: newVal } : r,
    );
    this.emitChange();
  }

  override render() {
    if (this.rows.length === 0) {
      return html`
        <div class="empty-hint">No metadata entries</div>
        <button class="alx-btn-sm add-btn" @click=${this.onAddRow}>+ Add Field</button>
      `;
    }

    return html`
      <div class="entries">
        ${this.rows.map((row, i) => html`
          <div class="entry">
            <div class="entry-header">
              <input
                class="entry-key"
                type="text"
                .value=${row.key}
                @input=${(e: Event) => this.onKeyChange(i, (e.target as HTMLInputElement).value)}
                placeholder="field name"
              />
              <button
                class="type-btn"
                title="Toggle between text and list"
                @click=${() => this.onToggleType(i)}
              >${row.type === 'list' ? 'list' : 'text'}</button>
              <button
                class="remove-btn"
                title="Remove field"
                @click=${() => this.onRemoveRow(i)}
              >&times;</button>
            </div>
            <div class="entry-body">
              ${row.type === 'text'
                ? html`
                    <input
                      class="text-input"
                      type="text"
                      .value=${typeof row.value === 'string' ? row.value : ''}
                      @input=${(e: Event) => this.onValueChange(i, (e.target as HTMLInputElement).value)}
                      placeholder="value"
                    />
                  `
                : html`
                    <div class="chips">
                      ${(Array.isArray(row.value) ? row.value : []).map((chip, ci) => html`
                        <span class="chip">
                          ${chip}
                          <span class="chip-x" @click=${() => this.onRemoveChip(i, ci)}>&times;</span>
                        </span>
                      `)}
                      <input
                        class="chip-input"
                        type="text"
                        placeholder="Type + Enter"
                        @keydown=${(e: KeyboardEvent) => this.onChipInputKeydown(i, e)}
                      />
                    </div>
                  `}
            </div>
          </div>
        `)}
      </div>
      <button class="alx-btn-sm add-btn" @click=${this.onAddRow}>+ Add Field</button>
    `;
  }
}
safeRegister('alx-metadata-editor', AlxMetadataEditor);

declare global {
  interface HTMLElementTagNameMap {
    'alx-metadata-editor': AlxMetadataEditor;
  }
}
