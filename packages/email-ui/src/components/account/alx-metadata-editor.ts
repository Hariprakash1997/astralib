import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { alxBaseStyles } from '../../styles/theme.js';
import { alxDensityStyles, alxButtonStyles, alxInputStyles } from '../../styles/shared.js';

interface MetadataRow {
  key: string;
  value: string | string[];
  type: 'text' | 'list';
}

@customElement('alx-metadata-editor')
export class AlxMetadataEditor extends LitElement {
  static override styles = [
    alxBaseStyles,
    alxDensityStyles,
    alxButtonStyles,
    alxInputStyles,
    css`
      .meta-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .meta-row input {
        flex: 1;
        min-width: 0;
      }
      .meta-row select {
        width: 70px;
        flex-shrink: 0;
      }
      .btn-remove {
        padding: 0.35rem 0.5rem;
        font-size: 0.75rem;
        background: transparent;
        border: 1px solid var(--alx-danger);
        color: var(--alx-danger);
        border-radius: var(--alx-radius);
        cursor: pointer;
        flex-shrink: 0;
      }
      .btn-remove:hover {
        background: color-mix(in srgb, var(--alx-danger) 15%, transparent);
      }
      .btn-add {
        font-size: 0.8rem;
        padding: 0.25rem 0.625rem;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex: 1;
        min-width: 0;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.4rem;
        background: color-mix(in srgb, var(--alx-primary) 15%, transparent);
        border-radius: 4px;
        font-size: 0.75rem;
        color: var(--alx-text);
      }
      .chip-remove {
        cursor: pointer;
        color: var(--alx-text-muted);
        font-size: 0.85rem;
        line-height: 1;
      }
      .chip-remove:hover {
        color: var(--alx-danger);
      }
      .chip-input {
        flex: 1;
        min-width: 60px;
      }
      .list-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        min-width: 0;
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

  private onTypeChange(index: number, type: 'text' | 'list'): void {
    this.rows = this.rows.map((r, i) => {
      if (i !== index) return r;
      if (type === 'list') {
        const listVal = typeof r.value === 'string' && r.value
          ? r.value.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(r.value) ? r.value : [];
        return { ...r, type, value: listVal };
      }
      const textVal = Array.isArray(r.value) ? r.value.join(', ') : r.value;
      return { ...r, type, value: textVal };
    });
    this.emitChange();
  }

  private onAddRow(): void {
    this.rows = [...this.rows, { key: '', value: '', type: 'text' }];
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

  private renderListValue(row: MetadataRow, index: number) {
    const items = Array.isArray(row.value) ? row.value : [];
    return html`
      <div class="list-wrapper">
        <div class="chips">
          ${items.map(
            (chip, ci) => html`
              <span class="chip">
                ${chip}
                <span class="chip-remove" @click=${() => this.onRemoveChip(index, ci)}>x</span>
              </span>
            `,
          )}
        </div>
        <input
          class="chip-input"
          type="text"
          placeholder="Type + Enter"
          @keydown=${(e: KeyboardEvent) => this.onChipInputKeydown(index, e)}
        />
      </div>
    `;
  }

  override render() {
    return html`
      ${this.rows.map(
        (row, i) => html`
          <div class="meta-row">
            <input
              type="text"
              .value=${row.key}
              @input=${(e: Event) => this.onKeyChange(i, (e.target as HTMLInputElement).value)}
              placeholder="Key"
            />
            ${row.type === 'text'
              ? html`<input
                  type="text"
                  .value=${typeof row.value === 'string' ? row.value : ''}
                  @input=${(e: Event) => this.onValueChange(i, (e.target as HTMLInputElement).value)}
                  placeholder="Value"
                />`
              : this.renderListValue(row, i)}
            <select
              .value=${row.type}
              @change=${(e: Event) => this.onTypeChange(i, (e.target as HTMLSelectElement).value as 'text' | 'list')}
            >
              <option value="text">Text</option>
              <option value="list">List</option>
            </select>
            <button class="btn-remove" @click=${() => this.onRemoveRow(i)}>x</button>
          </div>
        `,
      )}
      <button class="alx-btn-sm btn-add" @click=${this.onAddRow}>+ Add Row</button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'alx-metadata-editor': AlxMetadataEditor;
  }
}
