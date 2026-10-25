/**
 * Inspector Controls Submodule
 * Common UI inputs: steppers, color pickers, and alignment segment controls.
 */

/**
 * Converts rgb(...) or named colors to valid 6-char hex for <input type="color">.
 */
export function toHexColor(colorStr?: string, fallback = '#000000'): string {
  if (!colorStr) return fallback;
  const trimmed = colorStr.trim().toLowerCase();
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 7) return trimmed;
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
  }
  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return fallback;
}

export function renderStepper(id: string, value: number, min = 0, max = 500, step = 1): string {
  return `
    <div class="arch-stepper" data-stepper-id="${id}">
      <button type="button" class="arch-stepper-btn" data-step="-${step}">−</button>
      <input type="text" class="arch-stepper-val" id="${id}" value="${value}" data-min="${min}" data-max="${max}" data-step="${step}" />
      <button type="button" class="arch-stepper-btn" data-step="${step}">+</button>
    </div>
  `;
}

export function bindStepper(container: HTMLElement, id: string, onChange: (val: number) => void): void {
  const root = container.querySelector<HTMLElement>(`[data-stepper-id="${id}"]`);
  if (!root) return;
  const inp = root.querySelector<HTMLInputElement>(`#${id}`);
  if (!inp) return;

  const min = parseInt(inp.getAttribute('data-min') || '0', 10);
  const max = parseInt(inp.getAttribute('data-max') || '500', 10);

  const updateVal = (newVal: number) => {
    const clamped = Math.max(min, Math.min(max, newVal));
    inp.value = String(clamped);
    onChange(clamped);
  };

  root.querySelectorAll<HTMLButtonElement>('.arch-stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.getAttribute('data-step') || '1', 10);
      const current = parseInt(inp.value, 10) || 0;
      updateVal(current + delta);
    });
  });

  inp.addEventListener('change', () => {
    const parsed = parseInt(inp.value, 10);
    updateVal(isNaN(parsed) ? 0 : parsed);
  });
}

export function renderColorPicker(swatchId: string, hexId: string, value: string): string {
  const hex = toHexColor(value, '#ffffff');
  return `
    <div class="arch-color-picker-control">
      <input type="color" class="arch-color-swatch" id="${swatchId}" value="${hex}" />
      <input type="text" class="arch-color-hex" id="${hexId}" value="${value || hex}" />
    </div>
  `;
}

export function bindColorPicker(
  container: HTMLElement,
  swatchId: string,
  hexId: string,
  onChange: (color: string, isCommit?: boolean) => void
): void {
  const swatch = container.querySelector<HTMLInputElement>(`#${swatchId}`);
  const hex = container.querySelector<HTMLInputElement>(`#${hexId}`);
  if (!swatch || !hex) return;

  swatch.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    hex.value = val;
    onChange(val, false);
  });

  swatch.addEventListener('change', (e) => {
    const val = (e.target as HTMLInputElement).value;
    hex.value = val;
    onChange(val, true);
  });

  hex.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)) {
      swatch.value = toHexColor(val, swatch.value);
      onChange(val, false);
    }
  });

  hex.addEventListener('change', (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    const hexColor = toHexColor(val, '#ffffff');
    swatch.value = hexColor;
    hex.value = val || hexColor;
    onChange(hexColor, true);
  });
}

export function renderAlignment(groupClass: string, current: string, hasJustify = false): string {
  const opts = hasJustify ? ['left', 'center', 'right', 'justify'] : ['left', 'center', 'right'];
  return `
    <div class="arch-segmented-group ${groupClass}">
      ${opts
        .map((align) => {
          const isActive = current === align ? 'is-active' : '';
          const svgIcon =
            align === 'left'
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>`
              : align === 'center'
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`
              : align === 'right'
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>`;
          return `<button type="button" class="arch-segmented-icon-btn ${isActive}" data-align="${align}" title="Align ${align}">${svgIcon}</button>`;
        })
        .join('')}
    </div>
  `;
}

export function bindAlignment(container: HTMLElement, groupClass: string, onChange: (val: string) => void): void {
  const group = container.querySelector<HTMLElement>(`.${groupClass}`);
  if (!group) return;
  const btns = group.querySelectorAll<HTMLButtonElement>('[data-align]');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-align') || 'left';
      btns.forEach((b) => b.classList.toggle('is-active', b === btn));
      onChange(val);
    });
  });
}
