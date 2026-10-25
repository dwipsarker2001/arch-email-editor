import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchEmailEditor } from '../src/editor';
import { DEFAULT_PREBUILT_SECTIONS, getDefaultSections } from '../src/engine/sections';
import { PrebuiltSection } from '../src/types';

describe('Prebuilt Sections Library & Sections Tab', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'sections-test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('provides a curated default library of email-safe prebuilt sections', () => {
    const sections = getDefaultSections();
    expect(sections.length).toBeGreaterThanOrEqual(6);

    const categories = sections.map((s) => s.category);
    expect(categories).toContain('Header');
    expect(categories).toContain('Hero');
    expect(categories).toContain('Features');
    expect(categories).toContain('Call to Action');
    expect(categories).toContain('Footer');

    sections.forEach((s) => {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.html).toContain('<table');
      expect(s.html).toContain('class="row');
      expect(s.thumbnail).toBeTruthy();
    });
  });

  it('renders the SECTIONS tab in right sidebar with Lucide icon and text', () => {
    const editor = ArchEmailEditor.create(container);
    const sectionsTabBtn = container.querySelector<HTMLButtonElement>('[data-tab="sections"]');

    expect(sectionsTabBtn).toBeTruthy();
    expect(sectionsTabBtn?.textContent?.trim()).toContain('SECTIONS');
    expect(sectionsTabBtn?.querySelector('svg')).toBeTruthy();

    editor.destroy();
  });

  it('supports activating the tab via either "sections" or "rows" alias', () => {
    const editor = ArchEmailEditor.create(container);
    const rightPanel = (editor as any).rightPanel;

    rightPanel.setActiveTab('sections');
    expect(rightPanel.getActiveTab()).toBe('sections');

    rightPanel.setActiveTab('rows');
    expect(rightPanel.getActiveTab()).toBe('sections');

    editor.destroy();
  });

  it('renders prebuilt section cards and dynamic category dropdown', () => {
    const editor = ArchEmailEditor.create(container);
    const catalogEl = container.querySelector('#arch-sections-catalog');
    const categorySelect = container.querySelector<HTMLSelectElement>('#sel-section-category');

    expect(catalogEl).toBeTruthy();
    expect(categorySelect).toBeTruthy();

    const cards = catalogEl?.querySelectorAll('.arch-section-card');
    expect(cards?.length).toBe(DEFAULT_PREBUILT_SECTIONS.length);

    // Dropdown contains All Categories, empty rows, and specific categories
    const optionValues = Array.from(categorySelect?.options || []).map((o) => o.value);
    expect(optionValues).toContain('all');
    expect(optionValues).toContain('Header');
    expect(optionValues).toContain('Hero');
    expect(optionValues).toContain('Features');
    expect(optionValues).not.toContain('empty');

    editor.destroy();
  });

  it('filters sections when a specific category is selected', () => {
    const editor = ArchEmailEditor.create(container);
    const categorySelect = container.querySelector<HTMLSelectElement>('#sel-section-category')!;

    // Select 'Header'
    categorySelect.value = 'Header';
    categorySelect.dispatchEvent(new Event('change'));

    const catalogEl = container.querySelector('#arch-sections-catalog')!;
    const cards = catalogEl.querySelectorAll('.arch-section-card');
    expect(cards.length).toBeGreaterThan(0);

    cards.forEach((card) => {
      const badge = card.querySelector('.arch-section-badge');
      expect(badge?.textContent).toBe('Header');
    });

    // Empty rows are NOT in the sections catalog
    const emptyRowBtns = catalogEl.querySelectorAll('[data-row-layout]');
    expect(emptyRowBtns.length).toBe(0);

    editor.destroy();
  });

  it('filters sections when a search keyword is entered', () => {
    const editor = ArchEmailEditor.create(container);
    const searchInput = container.querySelector<HTMLInputElement>('#arch-sections-search-input')!;

    searchInput.value = 'Unsubscribe';
    searchInput.dispatchEvent(new Event('input'));

    const catalogEl = container.querySelector('#arch-sections-catalog')!;
    const cards = catalogEl.querySelectorAll('.arch-section-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Footer');

    // Search something nonexistent
    searchInput.value = 'NonExistentZzzz';
    searchInput.dispatchEvent(new Event('input'));
    expect(catalogEl.querySelector('.arch-sections-empty-state')).toBeTruthy();

    editor.destroy();
  });

  it('inserts section HTML into email canvas when a section card is clicked', () => {
    const editor = ArchEmailEditor.create(container);
    const catalogEl = container.querySelector('#arch-sections-catalog')!;
    const firstCard = catalogEl.querySelector<HTMLElement>('.arch-section-card')!;
    const sectionId = firstCard.getAttribute('data-section-id');
    const expectedSection = editor.getSectionById(sectionId!);

    expect(expectedSection).toBeTruthy();

    // Click card
    firstCard.click();

    const html = editor.getHTML();
    expect(html).toContain('arch-section-header');

    editor.destroy();
  });

  it('accepts customSections via EditorOptions and merges with defaults', () => {
    const customSection: PrebuiltSection = {
      id: 'custom-pricing-table',
      name: 'Tiered Pricing Table',
      category: 'Pricing',
      thumbnail: '<svg><rect/></svg>',
      html: '<table role="presentation" class="row arch-pricing-row"><tr><td>Custom Pricing $99</td></tr></table>'
    };

    const editor = ArchEmailEditor.create(container, {
      customSections: [customSection]
    });

    const sections = editor.getSections();
    expect(sections.some((s) => s.id === 'custom-pricing-table')).toBe(true);

    const categorySelect = container.querySelector<HTMLSelectElement>('#sel-section-category');
    const optionValues = Array.from(categorySelect?.options || []).map((o) => o.value);
    expect(optionValues).toContain('Pricing');

    // Click custom section card
    const customCard = container.querySelector<HTMLElement>('[data-section-id="custom-pricing-table"]')!;
    expect(customCard).toBeTruthy();
    customCard.click();

    expect(editor.getHTML()).toContain('Custom Pricing $99');

    editor.destroy();
  }, 15000);

  it('allows overriding all sections via EditorOptions.sections', () => {
    const singleSection: PrebuiltSection = {
      id: 'exclusive-hero',
      name: 'Exclusive Brand Hero',
      category: 'Branding',
      html: '<table role="presentation" class="row arch-exclusive"><tr><td>Exclusive Hero</td></tr></table>'
    };

    const editor = ArchEmailEditor.create(container, {
      sections: [singleSection]
    });

    const sections = editor.getSections();
    expect(sections.length).toBe(1);
    expect(sections[0].id).toBe('exclusive-hero');

    const cards = container.querySelectorAll('.arch-section-card');
    expect(cards.length).toBe(1);

    editor.destroy();
  });

  it('dynamically manages sections via addSection, removeSection, and setSections methods', () => {
    const editor = ArchEmailEditor.create(container);
    const initialCount = editor.getSections().length;

    // 1. addSection
    const newSection: PrebuiltSection = {
      id: 'dyn-cta-1',
      name: 'Flash Sale CTA',
      category: 'Promotions',
      html: '<table role="presentation" class="row arch-flash-sale"><tr><td>50% OFF FLASH SALE</td></tr></table>'
    };
    editor.addSection(newSection);

    expect(editor.getSections().length).toBe(initialCount + 1);
    expect(editor.getSectionById('dyn-cta-1')).toBeDefined();
    expect(container.querySelector('[data-section-id="dyn-cta-1"]')).toBeTruthy();

    // 2. removeSection
    editor.removeSection('dyn-cta-1');
    expect(editor.getSections().length).toBe(initialCount);
    expect(editor.getSectionById('dyn-cta-1')).toBeUndefined();
    expect(container.querySelector('[data-section-id="dyn-cta-1"]')).toBeNull();

    // 3. setSections
    const resetSections: PrebuiltSection[] = [
      {
        id: 'simple-banner',
        name: 'Simple Banner',
        category: 'Banner',
        html: '<table role="presentation" class="row"><tr><td>Hello World Banner</td></tr></table>'
      }
    ];
    editor.setSections(resetSections);

    expect(editor.getSections().length).toBe(1);
    expect(container.querySelectorAll('.arch-section-card').length).toBe(1);

    editor.destroy();
  });
});
