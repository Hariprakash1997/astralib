import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { FAQItem } from '@astralibx/chat-types';
import { safeRegister } from '../../utils/safe-register.js';
import { HttpClient } from '../../api/http-client.js';
import { AlxChatConfig } from '../../config.js';
import {
  alxChatResetStyles,
  alxChatThemeStyles,
  alxChatDensityStyles,
  alxChatButtonStyles,
  alxChatInputStyles,
  alxChatBadgeStyles,
  alxChatLoadingStyles,
  alxChatCardStyles,
  alxChatToolbarStyles,
} from '../../styles/shared.js';

interface FAQItemData extends FAQItem {
  _id?: string;
  itemId?: string;
  isActive?: boolean;
}

export class AlxChatFaqEditor extends LitElement {
  static styles = [
    alxChatResetStyles,
    alxChatThemeStyles,
    alxChatDensityStyles,
    alxChatButtonStyles,
    alxChatInputStyles,
    alxChatBadgeStyles,
    alxChatLoadingStyles,
    alxChatCardStyles,
    alxChatToolbarStyles,
    css`
      :host { display: block; }

      .faq-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .faq-item {
        border: 1px solid var(--alx-border);
        border-radius: var(--alx-radius);
        overflow: hidden;
      }

      .faq-item-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--alx-surface-alt);
        cursor: pointer;
      }

      .faq-drag {
        cursor: grab;
        color: var(--alx-text-muted);
        user-select: none;
      }

      .faq-question {
        flex: 1;
        font-weight: 500;
        font-size: 0.8125rem;
      }

      .faq-category {
        font-size: 0.6875rem;
        color: var(--alx-text-muted);
      }

      .faq-body {
        padding: 0.75rem;
        display: none;
      }

      .faq-body.expanded {
        display: block;
      }

      .faq-actions {
        display: flex;
        gap: 0.25rem;
      }

      .categories-bar {
        display: flex;
        gap: 0.375rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
      }

      .category-chip {
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        font-size: 0.6875rem;
        background: color-mix(in srgb, var(--alx-primary) 10%, transparent);
        color: var(--alx-primary);
        cursor: pointer;
        border: 1px solid transparent;
      }

      .category-chip.active {
        border-color: var(--alx-primary);
        background: color-mix(in srgb, var(--alx-primary) 20%, transparent);
      }
    `,
  ];

  @property({ type: String }) density: 'default' | 'compact' = 'default';
  @state() private items: FAQItemData[] = [];
  @state() private categories: string[] = [];
  @state() private loading = false;
  @state() private error = '';
  @state() private expandedId = '';
  @state() private categoryFilter = '';
  @state() private editItem: FAQItemData | null = null;

  private http!: HttpClient;

  connectedCallback() {
    super.connectedCallback();
    this.http = new HttpClient(AlxChatConfig.getApiUrl('chatEngine'));
    this.loadItems();
    this.loadCategories();
  }

  async loadItems() {
    this.loading = true;
    this.error = '';
    try {
      const params: Record<string, unknown> = {};
      if (this.categoryFilter) params.category = this.categoryFilter;
      const result = await this.http.get<FAQItemData[] | { data: FAQItemData[] }>('/faq', params);
      this.items = Array.isArray(result) ? result : (result as { data: FAQItemData[] }).data ?? [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load FAQ';
    } finally {
      this.loading = false;
    }
  }

  async loadCategories() {
    try {
      const result = await this.http.get<string[]>('/faq/categories');
      this.categories = Array.isArray(result) ? result : [];
    } catch {
      // Non-critical
    }
  }

  private toggleExpand(id: string) {
    this.expandedId = this.expandedId === id ? '' : id;
  }

  private startEdit(item: FAQItemData) {
    this.editItem = { ...item };
    this.expandedId = item._id || item.itemId || '';
  }

  private startAdd() {
    this.editItem = { question: '', answer: '', category: '', tags: [], order: this.items.length };
    this.expandedId = '__new__';
  }

  private cancelEdit() {
    this.editItem = null;
    this.expandedId = '';
  }

  private updateEditField(field: string, value: unknown) {
    if (!this.editItem) return;
    this.editItem = { ...this.editItem, [field]: value };
  }

  private async saveItem() {
    if (!this.editItem) return;
    if (!this.editItem.question?.trim() || !this.editItem.answer?.trim()) {
      this.error = 'Question and answer are required';
      return;
    }
    try {
      const body = {
        question: this.editItem.question,
        answer: this.editItem.answer,
        category: this.editItem.category || undefined,
        tags: this.editItem.tags,
        order: this.editItem.order,
      };
      const id = this.editItem._id || this.editItem.itemId;
      if (id) {
        await this.http.put(`/faq/${id}`, body);
      } else {
        await this.http.post('/faq', body);
      }
      this.editItem = null;
      this.loadItems();
      this.loadCategories();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to save';
    }
  }

  private async deleteItem(item: FAQItemData) {
    const id = item._id || item.itemId;
    if (!id || !confirm(`Delete FAQ "${item.question.slice(0, 50)}..."?`)) return;
    try {
      await this.http.delete(`/faq/${id}`);
      this.loadItems();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete';
    }
  }

  private async moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.items.length) return;
    const updated = [...this.items];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    const reorder = updated.map((item, i) => ({
      itemId: item._id || item.itemId || '',
      order: i,
    }));
    try {
      await this.http.put('/faq/reorder', { items: reorder });
      this.loadItems();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to reorder';
    }
  }

  private onImport() {
    this.dispatchEvent(new CustomEvent('faq-import', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="alx-card">
        <div class="alx-card-header">
          <h3>FAQ Management</h3>
          <div style="display:flex;gap:0.375rem;">
            <button class="alx-btn-sm" @click=${this.onImport}>Import</button>
            <button class="alx-btn-primary alx-btn-sm" @click=${() => this.startAdd()}>+ Add FAQ</button>
          </div>
        </div>

        ${this.categories.length > 0 ? html`
          <div class="categories-bar">
            <span class="category-chip ${!this.categoryFilter ? 'active' : ''}"
              @click=${() => { this.categoryFilter = ''; this.loadItems(); }}>All</span>
            ${this.categories.map(c => html`
              <span class="category-chip ${this.categoryFilter === c ? 'active' : ''}"
                @click=${() => { this.categoryFilter = c; this.loadItems(); }}>${c}</span>
            `)}
          </div>
        ` : ''}

        ${this.error ? html`<div class="alx-error">${this.error}</div>` : ''}
        ${this.loading ? html`<div class="alx-loading"><span class="alx-spinner"></span> Loading...</div>` : ''}

        ${!this.loading && this.items.length === 0 && !this.editItem
          ? html`<div class="alx-empty">No FAQ items</div>` : ''}

        <div class="faq-list">
          ${this.expandedId === '__new__' && this.editItem ? html`
            <div class="faq-item">
              <div class="faq-item-header">
                <span class="faq-question">New FAQ Item</span>
              </div>
              <div class="faq-body expanded">
                <div class="form-group">
                  <label>Question</label>
                  <input type="text" .value=${this.editItem.question}
                    @input=${(e: Event) => this.updateEditField('question', (e.target as HTMLInputElement).value)} />
                </div>
                <div class="form-group">
                  <label>Answer</label>
                  <textarea rows="4" .value=${this.editItem.answer}
                    @input=${(e: Event) => this.updateEditField('answer', (e.target as HTMLTextAreaElement).value)}></textarea>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Category</label>
                    <input type="text" .value=${this.editItem.category || ''}
                      @input=${(e: Event) => this.updateEditField('category', (e.target as HTMLInputElement).value)} />
                  </div>
                  <div class="form-group">
                    <label>Tags (comma-separated)</label>
                    <input type="text" .value=${(this.editItem.tags || []).join(', ')}
                      @input=${(e: Event) => this.updateEditField('tags', (e.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean))} />
                  </div>
                </div>
                <div class="form-actions">
                  <button @click=${() => this.cancelEdit()}>Cancel</button>
                  <button class="alx-btn-primary" @click=${() => this.saveItem()}>Save</button>
                </div>
              </div>
            </div>
          ` : ''}

          ${this.items.map((item, i) => {
            const id = item._id || item.itemId || String(i);
            const isExpanded = this.expandedId === id;
            const isEditing = isExpanded && this.editItem && (this.editItem._id === item._id || this.editItem.itemId === item.itemId);

            return html`
              <div class="faq-item">
                <div class="faq-item-header" @click=${() => this.toggleExpand(id)}>
                  <span class="faq-drag" @click=${(e: Event) => e.stopPropagation()}>
                    <span @click=${() => this.moveItem(i, -1)} style="cursor:pointer;">&uarr;</span>
                    <span @click=${() => this.moveItem(i, 1)} style="cursor:pointer;">&darr;</span>
                  </span>
                  <span class="faq-question">${item.question}</span>
                  ${item.category ? html`<span class="faq-category">${item.category}</span>` : ''}
                  <div class="faq-actions" @click=${(e: Event) => e.stopPropagation()}>
                    <button class="alx-btn-icon" title="Edit" @click=${() => this.startEdit(item)}>&#9998;</button>
                    <button class="alx-btn-icon danger" title="Delete" @click=${() => this.deleteItem(item)}>&#10005;</button>
                  </div>
                </div>
                <div class="faq-body ${isExpanded ? 'expanded' : ''}">
                  ${isEditing && this.editItem ? html`
                    <div class="form-group">
                      <label>Question</label>
                      <input type="text" .value=${this.editItem.question}
                        @input=${(e: Event) => this.updateEditField('question', (e.target as HTMLInputElement).value)} />
                    </div>
                    <div class="form-group">
                      <label>Answer</label>
                      <textarea rows="4" .value=${this.editItem.answer}
                        @input=${(e: Event) => this.updateEditField('answer', (e.target as HTMLTextAreaElement).value)}></textarea>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Category</label>
                        <input type="text" .value=${this.editItem.category || ''}
                          @input=${(e: Event) => this.updateEditField('category', (e.target as HTMLInputElement).value)} />
                      </div>
                      <div class="form-group">
                        <label>Tags</label>
                        <input type="text" .value=${(this.editItem.tags || []).join(', ')}
                          @input=${(e: Event) => this.updateEditField('tags', (e.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean))} />
                      </div>
                    </div>
                    <div class="form-actions">
                      <button @click=${() => this.cancelEdit()}>Cancel</button>
                      <button class="alx-btn-primary" @click=${() => this.saveItem()}>Save</button>
                    </div>
                  ` : html`
                    <div style="font-size:0.8125rem;line-height:1.6;">${item.answer}</div>
                    ${item.tags?.length ? html`
                      <div style="margin-top:0.5rem;display:flex;gap:0.2rem;">
                        ${item.tags.map(t => html`<span class="alx-badge alx-badge-muted">${t}</span>`)}
                      </div>
                    ` : ''}
                  `}
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

safeRegister('alx-chat-faq-editor', AlxChatFaqEditor);
