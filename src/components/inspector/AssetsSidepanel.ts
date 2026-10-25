/**
 * Assets Sidepanel Submodule
 * Sliding drawer panel for browsing, searching, and uploading media assets.
 */

export interface AssetItem {
  id?: string;
  name?: string;
  url: string;
  size?: string;
}

export interface AssetsSidepanelOptions {
  container: HTMLElement;
  initialAssets?: (AssetItem | string)[];
  onUploadImage?: (file: File, callback: (url: string) => void) => void;
}

export class AssetsSidepanel {
  private container: HTMLElement;
  private customAssets: AssetItem[] = [];
  private onUploadImage?: (file: File, callback: (url: string) => void) => void;

  constructor(options: AssetsSidepanelOptions) {
    this.container = options.container;
    this.onUploadImage = options.onUploadImage;
    if (options.initialAssets) {
      this.setAssets(options.initialAssets);
    }
  }

  public setAssets(assets: (AssetItem | string)[]): void {
    this.customAssets = (assets || []).map((item) => {
      if (typeof item === 'string') {
        const url = item;
        const name = url.split('/').pop()?.split('?')[0] || 'image.png';
        return { id: url, name, url, size: '' };
      }
      return {
        id: item.id || item.url,
        name: item.name || item.url.split('/').pop()?.split('?')[0] || 'image.png',
        url: item.url,
        size: item.size || ''
      };
    });
  }

  public getAssets(): AssetItem[] {
    return this.customAssets;
  }

  public addAsset(asset: AssetItem): void {
    this.customAssets.unshift(asset);
  }

  public showUploadNotice(msg = 'Upload is not setup yet, check documentation.'): void {
    const notice = this.container.querySelector<HTMLElement>('#arch-img-upload-notice');
    if (notice) {
      const span = notice.querySelector('span');
      if (span) span.textContent = msg;
      notice.classList.add('is-visible');
      notice.style.display = 'flex';
    }
  }

  public openAssetsPanel(onSelect: (url: string, name?: string, size?: string) => void): void {
    const existing = this.container.querySelector('.arch-assets-sidepanel');
    if (existing) existing.remove();

    this.container.style.overflow = 'hidden';

    const isEmpty = this.customAssets.length === 0;

    const panel = document.createElement('div');
    panel.className = `arch-assets-sidepanel ${isEmpty ? 'is-empty-assets' : ''}`;
    panel.innerHTML = `
      <div class="arch-prop-header arch-assets-header">
        <div class="arch-prop-title">Assets</div>
        <div class="arch-prop-actions arch-assets-header-actions">
          <button type="button" class="arch-icon-btn" id="btn-assets-upload" title="Upload Image">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-assets-search-toggle" title="Search Images">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          <button type="button" class="arch-icon-btn" id="btn-assets-close" title="Close Assets">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <input type="file" id="inp-assets-upload-file" accept="image/*" style="display: none;" />

      <div class="arch-assets-search-wrap ${isEmpty ? 'is-collapsed' : ''}" id="arch-assets-search-wrap">
        <div class="arch-assets-search-box">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="arch-assets-search-input" id="inp-assets-search" placeholder="Search images..." />
        </div>
      </div>

      <div class="arch-assets-body ${isEmpty ? 'is-empty-assets' : ''}">
        <div class="arch-assets-masonry" id="arch-assets-grid"></div>
      </div>
    `;

    this.container.appendChild(panel);

    const body = panel.querySelector<HTMLElement>('.arch-assets-body')!;
    const grid = panel.querySelector<HTMLElement>('#arch-assets-grid')!;
    const searchInp = panel.querySelector<HTMLInputElement>('#inp-assets-search')!;
    const closeBtn = panel.querySelector<HTMLButtonElement>('#btn-assets-close')!;
    const searchToggleBtn = panel.querySelector<HTMLButtonElement>('#btn-assets-search-toggle')!;
    const searchWrap = panel.querySelector<HTMLElement>('#arch-assets-search-wrap')!;
    const uploadBtn = panel.querySelector<HTMLButtonElement>('#btn-assets-upload')!;
    const uploadInput = panel.querySelector<HTMLInputElement>('#inp-assets-upload-file')!;

    let searchVisible = this.customAssets.length > 0;
    searchToggleBtn?.addEventListener('click', () => {
      if (this.customAssets.length === 0) return;
      searchVisible = !searchVisible;
      searchToggleBtn.classList.toggle('is-active', searchVisible);
      searchWrap?.classList.toggle('is-collapsed', !searchVisible);
      if (searchVisible) {
        searchInp?.focus();
      } else {
        if (searchInp) searchInp.value = '';
        renderGrid(this.customAssets);
      }
    });

    uploadBtn?.addEventListener('click', () => {
      if (!this.onUploadImage) {
        closePanel();
        this.showUploadNotice('Upload is not setup yet, check documentation.');
        return;
      }
      uploadInput?.click();
    });

    uploadInput?.addEventListener('change', () => {
      const file = uploadInput.files?.[0];
      if (!file) return;

      if (!this.onUploadImage) {
        closePanel();
        this.showUploadNotice('Upload is not setup yet, check documentation.');
        uploadInput.value = '';
        return;
      }

      const origBtnHtml = uploadBtn ? uploadBtn.innerHTML : '';
      if (uploadBtn) {
        uploadBtn.classList.add('is-loading');
        uploadBtn.setAttribute('disabled', 'true');
        uploadBtn.innerHTML = `
          <svg class="arch-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
          <span>Uploading...</span>
        `;
      }

      const formattedKb = ((file.size / 1024).toFixed(2)) + 'kb';
      this.onUploadImage(file, (url: string) => {
        if (uploadBtn) {
          uploadBtn.classList.remove('is-loading');
          uploadBtn.removeAttribute('disabled');
          if (origBtnHtml) uploadBtn.innerHTML = origBtnHtml;
        }

        if (url) {
          const newAsset: AssetItem = {
            id: 'asset-' + Date.now(),
            name: file.name,
            url: url,
            size: formattedKb
          };
          this.customAssets.unshift(newAsset);
          panel.classList.remove('is-empty-assets');
          body.classList.remove('is-empty-assets');
          body.classList.remove('is-empty-search');
          searchWrap?.classList.remove('is-collapsed');
          renderGrid(this.customAssets);
          onSelect(url, file.name, formattedKb);
          closePanel();
        }
      });
      uploadInput.value = '';
    });

    const closePanel = () => {
      panel.classList.remove('is-open');
      this.container.style.overflow = '';
      setTimeout(() => {
        panel.remove();
      }, 260);
    };

    const renderGrid = (items: AssetItem[]) => {
      if (this.customAssets.length === 0) {
        panel.classList.add('is-empty-assets');
        body.classList.add('is-empty-assets');
        body.classList.remove('is-empty-search');
        grid.innerHTML = `
          <div class="arch-assets-empty-state" id="arch-assets-empty-state">
            <div class="arch-assets-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                <circle cx="9" cy="9" r="2"></circle>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
              </svg>
            </div>
            <div class="arch-assets-empty-title">No assets available</div>
            <div class="arch-assets-empty-desc">No assets source has been added yet. Add media items to your asset library or upload an image.</div>
            <button type="button" class="arch-assets-empty-upload-btn" id="btn-assets-empty-upload">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Upload Image</span>
            </button>
          </div>
        `;

        grid.querySelector('#btn-assets-empty-upload')?.addEventListener('click', () => {
          uploadBtn?.click();
        });
        return;
      }

      panel.classList.remove('is-empty-assets');
      body.classList.remove('is-empty-assets');

      if (items.length === 0) {
        body.classList.add('is-empty-search');
        grid.innerHTML = '<div class="arch-assets-no-match">No matching assets found</div>';
        return;
      } else {
        body.classList.remove('is-empty-search');
      }

      grid.innerHTML = items
        .map(
          (asset) => `
        <div class="arch-assets-card" data-url="${asset.url}" data-name="${asset.name || 'image.png'}" data-size="${asset.size || ''}" title="${asset.name || 'Image'}">
          <img src="${asset.url}" alt="${asset.name || 'Asset'}" loading="lazy" />
          <div class="arch-assets-card-overlay">
            <span class="arch-assets-card-name">${asset.name || 'image.png'}</span>
            ${asset.size ? `<span class="arch-assets-card-size">${asset.size}</span>` : ''}
          </div>
        </div>
      `
        )
        .join('');

      grid.querySelectorAll<HTMLElement>('.arch-assets-card').forEach((card) => {
        card.addEventListener('click', () => {
          const url = card.dataset.url || '';
          const name = card.dataset.name || '';
          const size = card.dataset.size || '';
          if (url) {
            onSelect(url, name, size);
            closePanel();
          }
        });
      });
    };

    renderGrid(this.customAssets);

    searchInp?.addEventListener('input', () => {
      const query = searchInp.value.trim().toLowerCase();
      const filtered = this.customAssets.filter((a) => (a.name || '').toLowerCase().includes(query));
      renderGrid(filtered);
    });

    closeBtn?.addEventListener('click', closePanel);

    requestAnimationFrame(() => {
      this.container.scrollTop = 0;
      this.container.style.overflow = 'hidden';
      panel.classList.add('is-open');
    });
  }
}
