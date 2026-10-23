import { describe, it, expect } from 'vitest';

describe('Test Runner Setup', () => {
  it('runs vitest correctly in jsdom environment', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
  });
});
