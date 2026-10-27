import { PlaceholdersOption, PlaceholderCategory } from '../../types';

interface NormalizedPlaceholder {
  value: string;
  label: string;
  description: string;
  category: string;
}

function normalizeOne(p: any, defaultCategory?: string): NormalizedPlaceholder {
  const value = String(p?.value ?? p?.code ?? '').trim();
  const category = String(p?.category ?? p?.category_name ?? defaultCategory ?? 'General').trim() || 'General';
  const label = String(p?.label ?? p?.description ?? value).trim();
  const description = String(p?.description ?? '').trim();
  return { value, label, description, category };
}

function normalize(input: any): NormalizedPlaceholder[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((p) => normalizeOne(p));
  }
  if (input && Array.isArray(input.categories)) {
    const out: NormalizedPlaceholder[] = [];
    for (const cat of input.categories as PlaceholderCategory[]) {
      const catName = String(cat?.category_name ?? cat?.category ?? 'General').trim() || 'General';
      const list = Array.isArray(cat?.placeholders) ? cat.placeholders : [];
      for (const p of list) out.push(normalizeOne(p, catName));
    }
    return out;
  }
  return [];
}



const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

export class PlaceholdersSidepanel {
  private container: HTMLElement;
  private onSelect: (code: string) => void;
  private panel: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private searchVisible = true;
  private placeholders: NormalizedPlaceholder[] = [];
  private rawPlaceholders: any = null;

  constructor(options: { container: HTMLElement; onSelect: (code: string) => void; placeholders?: PlaceholdersOption }) {
    this.container = options.container;
    this.onSelect = options.onSelect;
    this.rawPlaceholders = options.placeholders ?? null;
    this.placeholders = normalize(options.placeholders);
  }

  public setPlaceholders(input: PlaceholdersOption): void {
    this.rawPlaceholders = input;
    this.placeholders = normalize(input);
    if (this.panel) {
      const list = this.panel.querySelector<HTMLElement>('#ph-list');
      if (list) this.renderInto(list, '');
      const search = this.panel.querySelector<HTMLInputElement>('#ph-search');
      if (search) search.value = '';
    }
  }

  public isOpen(): boolean {
    return this.panel?.classList.contains('is-open') ?? false;
  }

  public open(): void {
    if (this.panel) {
      this.panel.classList.add('is-open');
      this.container.style.overflow = 'hidden';
      return;
    }

    this.container.style.overflow = 'hidden';

    const panel = document.createElement('div');
    panel.className = 'arch-assets-sidepanel arch-placeholders-sidepanel';
    panel.innerHTML = `
      <div class="arch-prop-header arch-assets-header">
        <div class="arch-prop-title">Template Strings</div>
        <div class="arch-prop-actions arch-assets-header-actions">
          <button type="button" class="arch-icon-btn" id="btn-ph-search-toggle" title="Search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-ph-close" title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="arch-assets-search-wrap" id="ph-search-wrap">
        <div class="arch-assets-search-box">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="arch-assets-search-input" id="ph-search" placeholder="Search template strings..." />
        </div>
      </div>
      <div class="arch-assets-body" id="ph-body">
        <div class="arch-placeholders-list" id="ph-list"></div>
      </div>
    `;

    this.container.appendChild(panel);
    this.panel = panel;
    this.searchInput = panel.querySelector<HTMLInputElement>('#ph-search')!;

    const searchWrap = panel.querySelector<HTMLElement>('#ph-search-wrap')!;
    const searchToggle = panel.querySelector<HTMLButtonElement>('#btn-ph-search-toggle')!;
    const closeBtn = panel.querySelector<HTMLButtonElement>('#btn-ph-close')!;
    const list = panel.querySelector<HTMLElement>('#ph-list')!;

    const copyItem = (code: string, row: HTMLElement) => {
      this.onSelect(code);
      const copyBtn = row.querySelector<HTMLButtonElement>('.arch-placeholder-item__copy');
      if (copyBtn) {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.classList.add('is-copied');
        window.setTimeout(() => {
          copyBtn.innerHTML = original;
          copyBtn.classList.remove('is-copied');
        }, 1200);
      }
    };

    const renderInto = (container: HTMLElement, query: string) => {
      const q = query.trim().toLowerCase();
      const items = this.placeholders.filter((p) =>
        !q ||
        p.value.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );

      if (items.length === 0) {
        container.innerHTML = '<div class="arch-assets-no-match">No template strings. Pass <code>placeholders</code> when creating the editor.</div>';
        return;
      }

      const groups = Array.from(new Set(items.map((p) => p.category)));
      container.innerHTML = groups
        .map((group) => {
          const count = items.filter((p) => p.category === group).length;
          return `
        <div class="arch-placeholders-group">
          <div class="arch-placeholders-group-title">
            <span class="arch-placeholders-group-name">${group}</span>
            <span class="arch-placeholders-group-count">${count}</span>
          </div>
          ${items
            .filter((p) => p.category === group)
            .map(
              (p) => `
            <div class="arch-placeholder-item" data-code="${p.value}">
              <div class="arch-placeholder-item__info">
                <span class="arch-placeholder-item__code">${p.value}</span>
                <span class="arch-placeholder-item__desc">${p.label}</span>
              </div>
              <div class="arch-placeholder-item__actions">
                <button type="button" class="arch-icon-btn arch-placeholder-item__copy" title="Copy ${p.value}">
                  ${COPY_ICON}
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
        })
        .join('');

      container.querySelectorAll<HTMLElement>('.arch-placeholder-item').forEach((row) => {
        const code = row.dataset.code;
        if (!code) return;
        row.addEventListener('click', () => copyItem(code, row));
        const copyBtn = row.querySelector<HTMLButtonElement>('.arch-placeholder-item__copy');
        copyBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          copyItem(code, row);
        });
      });
    };

    this.renderInto = renderInto;
    renderInto(list, '');

    this.searchInput.addEventListener('input', () => renderInto(list, this.searchInput!.value));

    searchToggle.addEventListener('click', () => {
      this.searchVisible = !this.searchVisible;
      searchToggle.classList.toggle('is-active', this.searchVisible);
      searchWrap.classList.toggle('is-collapsed', !this.searchVisible);
      if (this.searchVisible) {
        this.searchInput?.focus();
      } else {
        if (this.searchInput) this.searchInput.value = '';
        renderInto(list, '');
      }
    });

    closeBtn.addEventListener('click', () => this.close());

    panel.classList.add('is-open');
  }

  private renderInto: (container: HTMLElement, query: string) => void = () => {};

  public getPlaceholders(): any {
    return this.rawPlaceholders;
  }

  public close(): void {
    if (!this.panel) return;
    this.panel.classList.remove('is-open');
    this.container.style.overflow = '';
    const panel = this.panel;
    window.setTimeout(() => {
      panel.remove();
      if (this.panel === panel) {
        this.panel = null;
        this.searchInput = null;
      }
    }, 260);
  }
}
