// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isEditableTarget } from '../src/ui/dom.js';

describe('isEditableTarget', () => {
  it('is true for an <input> (e.g. the sign-in field)', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
  });

  it('is true for a <textarea>', () => {
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
  });

  it('is true for a contenteditable element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('is false for the on-screen keyboard buttons and other elements', () => {
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
  });

  it('is false for a null target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});
