/**
 * Image Inspector Submodule
 * Image element controls: preview, file upload with loading overlay,
 * aspect ratio crop modal, remove image, replace dropdown, and sizing.
 */

import { SelectedElementInfo } from '../../types';
import { ImageAdapter } from '../../engine/adapters';
import { renderStepper, bindStepper, renderAlignment, bindAlignment } from './InspectorControls';
import { AssetsSidepanel, AssetItem } from './AssetsSidepanel';

export interface ImageInspectorEvents {
  onChange: (isDocumentSetting?: boolean) => void;
  onUploadImage?: (file: File, callback: (url: string) => void) => void;
  onBrowseMedia?: (callback: (url: string) => void) => void;
  onCropImage?: (element: HTMLElement) => void;
  onRemoveImage?: (element: HTMLElement) => void;
  onSelectElementNode?: (el: HTMLElement) => void;
}

export class ImageInspector {
  private element: HTMLElement;
  private assetsPanel: AssetsSidepanel;
  private events: ImageInspectorEvents;

  constructor(element: HTMLElement, assetsPanel: AssetsSidepanel, events: ImageInspectorEvents) {
    this.element = element;
    this.assetsPanel = assetsPanel;
    this.events = events;
  }

  public openCropModal(imageUrl: string, onApply: (croppedDataUrl: string) => void): void {
    const existing = document.getElementById('arch-crop-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'arch-modal-overlay';
    overlay.id = 'arch-crop-modal-overlay';
    overlay.style.zIndex = '9999';

    let selectedRatio = '1:1';

    overlay.innerHTML = `
      <div class="arch-modal" style="max-width: 480px; width: 90%;">
        <div class="arch-modal__header">
          <div style="font-weight: 700; font-size: 14px; color: #0f172a;">Crop Image</div>
          <button type="button" class="arch-modal__close" id="btn-crop-modal-close" style="background: none; border: none; cursor: pointer; color: #64748b; padding: 4px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="arch-modal__body" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
          <div style="width: 100%; height: 220px; background: #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
            <img id="arch-crop-modal-img" src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" crossOrigin="anonymous" />
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">Select Aspect Ratio</div>
            <div class="arch-crop-ratios" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
              <button type="button" class="arch-btn arch-crop-ratio-btn is-active" data-ratio="1:1" style="font-size: 11px; padding: 6px 4px; text-align: center;">1:1 Square</button>
              <button type="button" class="arch-btn arch-crop-ratio-btn" data-ratio="16:9" style="font-size: 11px; padding: 6px 4px; text-align: center;">16:9 Wide</button>
              <button type="button" class="arch-btn arch-crop-ratio-btn" data-ratio="4:3" style="font-size: 11px; padding: 6px 4px; text-align: center;">4:3 Standard</button>
              <button type="button" class="arch-btn arch-crop-ratio-btn" data-ratio="3:2" style="font-size: 11px; padding: 6px 4px; text-align: center;">3:2 Photo</button>
            </div>
          </div>
        </div>
        <div style="padding: 12px 18px; border-top: 1px solid var(--arch-border); display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="arch-btn" id="btn-crop-modal-cancel">Cancel</button>
          <button type="button" class="arch-btn arch-btn--primary" id="btn-crop-modal-apply">Apply Crop</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btn-crop-modal-close');
    const cancelBtn = overlay.querySelector('#btn-crop-modal-cancel');
    const applyBtn = overlay.querySelector('#btn-crop-modal-apply');
    const ratioBtns = overlay.querySelectorAll<HTMLButtonElement>('.arch-crop-ratio-btn');

    const closeModal = () => overlay.remove();
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    ratioBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        ratioBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        selectedRatio = btn.getAttribute('data-ratio') || '1:1';
      });
    });

    applyBtn?.addEventListener('click', () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const natW = img.naturalWidth || img.width || 400;
          const natH = img.naturalHeight || img.height || 400;
          let targetRatio = 1;
          if (selectedRatio === '16:9') targetRatio = 16 / 9;
          else if (selectedRatio === '4:3') targetRatio = 4 / 3;
          else if (selectedRatio === '3:2') targetRatio = 3 / 2;
          else targetRatio = 1;

          let cropW = natW;
          let cropH = natW / targetRatio;
          if (cropH > natH) {
            cropH = natH;
            cropW = natH * targetRatio;
          }

          const startX = (natW - cropW) / 2;
          const startY = (natH - cropH) / 2;

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(cropW);
          canvas.height = Math.round(cropH);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, canvas.width, canvas.height);
            const cropped = canvas.toDataURL('image/png');
            onApply(cropped);
          } else {
            onApply(imageUrl);
          }
          closeModal();
        };
        img.onerror = () => {
          onApply(imageUrl);
          closeModal();
        };
        img.src = imageUrl;
      } catch {
        onApply(imageUrl);
        closeModal();
      }
    });
  }

  public renderImageElementControls(container: HTMLElement, info: SelectedElementInfo): void {
    let src = ImageAdapter.getSrc(info.element, info.unit) || info.src || '';
    if (!src && info.element) {
      const img = info.element.tagName.toLowerCase() === 'img' ? (info.element as HTMLImageElement) : info.element.querySelector<HTMLImageElement>('img');
      if (img) src = img.getAttribute('src') || '';
    }
    if (!src && info.unit) {
      const img = info.unit.querySelector<HTMLImageElement>('img');
      if (img) src = img.getAttribute('src') || '';
    }
    const alt = ImageAdapter.getAlt(info.element, info.unit);
    const linkUrl = ImageAdapter.getLinkUrl(info.element, info.unit);
    const width = ImageAdapter.getWidth(info.element, info.unit);
    const numWidth = parseInt(width, 10) || 300;
    const align = ImageAdapter.getAlignment(info.element, info.unit) || 'center';
    const filename = src.split('/').pop()?.split('?')[0] || 'image.png';

    container.innerHTML = `
      <div class="arch-inspector-img-preview-wrap">
        <!-- Upload warning notice -->
        <div class="arch-img-upload-notice" id="arch-img-upload-notice" style="display: none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Upload is not setup yet, check documentation.</span>
        </div>

        <div class="arch-inspector-img-preview-box ${src ? 'has-image' : 'is-empty'}" id="arch-img-preview-box">
          <img id="arch-img-preview-tag" src="${src}" alt="${alt}" />
          <div class="arch-inspector-img-preview-empty" id="arch-img-preview-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            <span>No image preview</span>
          </div>

          <!-- Bottom Right Replace Dropdown -->
          <div class="arch-img-replace-dropdown" id="arch-img-replace-dropdown">
            <button type="button" class="arch-img-replace-btn" id="btn-img-replace-toggle" title="Replace image">
              <span>Replace</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="arch-img-replace-menu" id="menu-img-replace">
              <button type="button" class="arch-img-replace-item" id="opt-img-upload">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Upload</span>
              </button>
              <button type="button" class="arch-img-replace-item" id="opt-img-browse">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <span>Browse media</span>
              </button>
            </div>
            <input type="file" id="inp-img-file-upload" accept="image/*" style="display: none;" />
          </div>
        </div>

        <!-- Meta info & Actions row below the image -->
        <div class="arch-inspector-img-meta-row">
          <div class="arch-inspector-img-meta-info">
            <div class="arch-inspector-img-meta-name" id="arch-img-meta-name" title="${filename}">${src ? filename : 'No image selected'}</div>
            <div class="arch-inspector-img-meta-size" id="arch-img-meta-size">—</div>
          </div>
          <div class="arch-inspector-img-meta-actions">
            <button type="button" class="arch-img-meta-icon-btn" id="btn-img-crop" title="Crop image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2v14a2 2 0 0 0 2 2h14"></path>
                <path d="M18 22V8a2 2 0 0 0-2-2H2"></path>
              </svg>
            </button>
            <button type="button" class="arch-img-meta-icon-btn arch-img-btn-remove" id="btn-img-remove" title="Remove image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style="padding: 12px 18px; border-bottom: 1px solid #f2f3f5;">
        <div class="arch-url-group">
          <span class="arch-url-prefix">Url</span>
          <input type="text" class="arch-url-input" id="inp-img-src" value="${src}" placeholder="https://..." />
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Width</label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="text" class="arch-input" id="inp-img-width" value="${width}" style="width: 60px; text-align: center; height: 32px;" />
          ${renderStepper('stp-img-width', numWidth, 24, 600, 10)}
        </div>
      </div>

      <!-- Quick Preset Sizing Buttons -->
      <div class="arch-rge-row" style="padding-top: 0; padding-bottom: 12px; border-bottom: 1px solid #f2f3f5;">
        <span class="arch-rge-label" style="font-size: 11px; color: #94a3b8;">Presets</span>
        <div style="display: flex; gap: 4px;">
          <button type="button" class="arch-btn arch-btn--preset" data-width-preset="100%" style="font-size: 11px; padding: 3px 8px;">100%</button>
          <button type="button" class="arch-btn arch-btn--preset" data-width-preset="75%" style="font-size: 11px; padding: 3px 8px;">75%</button>
          <button type="button" class="arch-btn arch-btn--preset" data-width-preset="50%" style="font-size: 11px; padding: 3px 8px;">50%</button>
          <button type="button" class="arch-btn arch-btn--preset" data-width-preset="25%" style="font-size: 11px; padding: 3px 8px;">25%</button>
        </div>
      </div>

      <div class="arch-rge-row">
        <label class="arch-rge-label">Alignment</label>
        ${renderAlignment('grp-img-align', align, false)}
        <select class="arch-select" id="inp-img-align" style="display: none;">
          <option value="left" ${align === 'left' ? 'selected' : ''}>Left</option>
          <option value="center" ${align === 'center' ? 'selected' : ''}>Center</option>
          <option value="right" ${align === 'right' ? 'selected' : ''}>Right</option>
        </select>
      </div>

      <div class="arch-form-group" style="padding: 12px 18px 12px;">
        <label class="arch-form-label">Alt text</label>
        <input type="text" class="arch-input" id="inp-img-alt" value="${alt}" placeholder="Description of image" />
      </div>

      <div class="arch-form-group" style="padding: 12px 18px 12px;">
        <label class="arch-form-label">Link (optional)</label>
        <div class="arch-url-group">
          <span class="arch-url-prefix">https://</span>
          <input type="text" class="arch-url-input" id="inp-img-link" value="${linkUrl}" placeholder="example.com" />
        </div>
      </div>
    `;

    const previewBox = container.querySelector<HTMLElement>('#arch-img-preview-box');
    const previewImg = container.querySelector<HTMLImageElement>('#arch-img-preview-tag');
    const nameLabel = container.querySelector<HTMLElement>('#arch-img-meta-name');
    const sizeLabel = container.querySelector<HTMLElement>('#arch-img-meta-size');
    const cropBtn = container.querySelector<HTMLButtonElement>('#btn-img-crop');
    const removeBtn = container.querySelector<HTMLButtonElement>('#btn-img-remove');

    const formatKb = (bytes: number) => ((bytes / 1024).toFixed(2)) + 'kb';
    let currentKnownFileSize = '';

    const updateDimensionsAndSize = (url: string) => {
      if (!url) return;
      const testImg = new Image();
      testImg.onload = () => {
        const w = testImg.naturalWidth || testImg.width;
        const h = testImg.naturalHeight || testImg.height;
        if (sizeLabel) {
          const dimText = `${w} × ${h}px`;
          sizeLabel.textContent = currentKnownFileSize ? `${dimText} · ${currentKnownFileSize}` : dimText;
        }
      };
      testImg.src = url;
    };

    const updatePreview = (url: string, explicitName?: string, fileSize?: number | string) => {
      const cleanUrl = (url || '').trim();
      if (fileSize !== undefined) {
        currentKnownFileSize = typeof fileSize === 'number' ? formatKb(fileSize) : (fileSize || '');
      } else if (!cleanUrl) {
        currentKnownFileSize = '';
      }

      if (cleanUrl) {
        const notice = this.element.querySelector<HTMLElement>('#arch-img-upload-notice');
        if (notice) {
          notice.classList.remove('is-visible');
          notice.style.display = 'none';
        }
        if (previewImg) previewImg.src = cleanUrl;
        previewBox?.classList.add('has-image');
        previewBox?.classList.remove('is-empty');

        const resolvedName = explicitName || cleanUrl.split('/').pop()?.split('?')[0] || 'image.png';
        if (nameLabel) {
          nameLabel.textContent = resolvedName;
          nameLabel.title = resolvedName;
        }
        updateDimensionsAndSize(cleanUrl);
      } else {
        if (previewImg) previewImg.removeAttribute('src');
        previewBox?.classList.remove('has-image');
        previewBox?.classList.add('is-empty');
        if (nameLabel) {
          nameLabel.textContent = 'No image selected';
          nameLabel.title = '';
        }
        if (sizeLabel) sizeLabel.textContent = '—';
      }
    };

    if (src) {
      updateDimensionsAndSize(src);
    }

    const applySelectedUrl = (url: string, explicitName?: string, fileSize?: number | string) => {
      const srcInp = container.querySelector<HTMLInputElement>('#inp-img-src');
      if (srcInp) srcInp.value = url;
      updatePreview(url, explicitName, fileSize);
      ImageAdapter.setSrc(info.element, url, info.unit);
      this.events.onChange();
    };

    removeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.events.onRemoveImage) {
        this.events.onRemoveImage(info.element);
      }
      applySelectedUrl('');
    });

    cropBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.events.onCropImage) {
        this.events.onCropImage(info.element);
      }

      const currentSrc = ImageAdapter.getSrc(info.element, info.unit) || (srcInp ? srcInp.value : '') || '';
      if (!currentSrc) {
        this.assetsPanel.showUploadNotice('Please select or upload an image first to crop.');
        return;
      }

      this.openCropModal(currentSrc, (croppedUrl) => {
        applySelectedUrl(croppedUrl, 'cropped-image.png');
      });
    });

    // Replace Dropdown Handlers
    const replaceDropdown = container.querySelector<HTMLElement>('#arch-img-replace-dropdown');
    const replaceBtn = container.querySelector<HTMLButtonElement>('#btn-img-replace-toggle');
    const replaceMenu = container.querySelector<HTMLElement>('#menu-img-replace');
    const uploadOpt = container.querySelector<HTMLButtonElement>('#opt-img-upload');
    const browseOpt = container.querySelector<HTMLButtonElement>('#opt-img-browse');
    const fileInput = container.querySelector<HTMLInputElement>('#inp-img-file-upload');

    replaceBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = replaceDropdown?.classList.contains('is-open');
      if (isOpen) {
        replaceDropdown?.classList.remove('is-open');
        replaceMenu?.classList.remove('is-open');
      } else {
        replaceDropdown?.classList.add('is-open');
        replaceMenu?.classList.add('is-open');
      }
    });

    const onDocClick = (e: MouseEvent) => {
      if (replaceDropdown && !replaceDropdown.contains(e.target as Node)) {
        replaceDropdown.classList.remove('is-open');
        replaceMenu?.classList.remove('is-open');
      }
    };
    document.addEventListener('click', onDocClick);

    uploadOpt?.addEventListener('click', (e) => {
      e.stopPropagation();
      replaceDropdown?.classList.remove('is-open');
      replaceMenu?.classList.remove('is-open');

      if (!this.events.onUploadImage) {
        this.assetsPanel.showUploadNotice('Upload is not setup yet, check documentation.');
        return;
      }

      fileInput?.click();
    });

    browseOpt?.addEventListener('click', (e) => {
      e.stopPropagation();
      replaceDropdown?.classList.remove('is-open');
      replaceMenu?.classList.remove('is-open');

      if (this.events.onBrowseMedia) {
        this.events.onBrowseMedia(applySelectedUrl);
        return;
      }

      this.assetsPanel.openAssetsPanel(applySelectedUrl);
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      if (!this.events.onUploadImage) {
        this.assetsPanel.showUploadNotice('Upload is not setup yet, check documentation.');
        return;
      }

      this.events.onSelectElementNode?.(info.element);

      if (previewBox) {
        previewBox.classList.add('is-uploading');
        let overlay = previewBox.querySelector<HTMLElement>('.arch-preview-uploading-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'arch-preview-uploading-overlay';
          overlay.innerHTML = `
            <svg class="arch-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.25)"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" stroke-linecap="round"></path>
            </svg>
            <span>Uploading...</span>
          `;
          previewBox.appendChild(overlay);
        }
      }

      const formattedKb = ((file.size / 1024).toFixed(2)) + 'kb';
      this.events.onUploadImage(file, (url: string) => {
        if (previewBox) {
          previewBox.classList.remove('is-uploading');
          previewBox.querySelector('.arch-preview-uploading-overlay')?.remove();
        }
        if (url) {
          const newAsset: AssetItem = {
            id: 'asset-' + Date.now(),
            name: file.name,
            url: url,
            size: formattedKb
          };
          this.assetsPanel.addAsset(newAsset);
          applySelectedUrl(url, file.name, file.size);
          this.events.onSelectElementNode?.(info.element);
        }
      });
      fileInput.value = '';
    });

    const srcInp = container.querySelector<HTMLInputElement>('#inp-img-src')!;
    srcInp.addEventListener('input', (e) => {
      const newSrc = (e.target as HTMLInputElement).value;
      updatePreview(newSrc);
      ImageAdapter.setSrc(info.element, newSrc, info.unit);
      this.events.onChange();
    });

    const altInp = container.querySelector<HTMLInputElement>('#inp-img-alt')!;
    altInp.addEventListener('input', (e) => {
      ImageAdapter.setAlt(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const linkInp = container.querySelector<HTMLInputElement>('#inp-img-link')!;
    linkInp.addEventListener('input', (e) => {
      ImageAdapter.setLinkUrl(info.element, (e.target as HTMLInputElement).value, info.unit);
      this.events.onChange();
    });

    const widthInp = container.querySelector<HTMLInputElement>('#inp-img-width')!;
    widthInp.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        const valInp = container.querySelector<HTMLInputElement>('#stp-img-width');
        if (valInp) valInp.value = String(num);
      }
      ImageAdapter.setWidth(info.element, val, info.unit);
      this.events.onChange();
    });

    bindStepper(container, 'stp-img-width', (val) => {
      widthInp.value = `${val}px`;
      ImageAdapter.setWidth(info.element, `${val}px`, info.unit);
      this.events.onChange();
    });

    container.querySelectorAll<HTMLButtonElement>('[data-width-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-width-preset');
        if (preset) {
          widthInp.value = preset;
          ImageAdapter.setWidth(info.element, preset, info.unit);
          this.events.onChange();
        }
      });
    });

    const alignSel = container.querySelector<HTMLSelectElement>('#inp-img-align')!;
    alignSel.addEventListener('change', () => {
      const val = alignSel.value;
      container.querySelectorAll('.grp-img-align button').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-align') === val);
      });
      ImageAdapter.setAlignment(info.element, val as any, info.unit);
      this.events.onChange();
    });

    bindAlignment(container, 'grp-img-align', (val) => {
      alignSel.value = val;
      ImageAdapter.setAlignment(info.element, val as any, info.unit);
      this.events.onChange();
    });
  }
}
