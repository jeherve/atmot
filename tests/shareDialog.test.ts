// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { openShareDialog } from '../src/ui/shareDialog.js';
import type { GameResult } from '../src/engine/types.js';

const result: GameResult = {
  lang: 'fr',
  puzzleNumber: 412,
  solved: true,
  guessCount: 4,
  rows: [['correct', 'correct', 'correct', 'correct', 'correct']],
};

// happy-dom doesn't fully implement <dialog>; shim the open/close lifecycle.
beforeEach(() => {
  document.body.replaceChildren();
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('openShareDialog', () => {
  it('mounts a dialog with the editable note prefilled to the header', () => {
    openShareDialog('en', result, async () => {});
    const ta = document.querySelector('dialog.share-edit textarea') as HTMLTextAreaElement;
    expect(ta).not.toBeNull();
    expect(ta.value).toBe('AT Mot 412 (FR) 4/6 #puzzlesurf');
  });

  it('shows the grid + link in a read-only preview', () => {
    openShareDialog('en', result, async () => {});
    const pre = document.querySelector('.share-locked') as HTMLElement;
    expect(pre.textContent).toContain('🟩🟩🟩🟩🟩');
    expect(pre.textContent).toContain('https://atmot.herve.bzh/p/fr/412');
  });

  it('disables Post and flags the counter when over the limit', () => {
    openShareDialog('en', result, async () => {});
    const ta = document.querySelector('dialog.share-edit textarea') as HTMLTextAreaElement;
    ta.value = 'x'.repeat(400);
    ta.dispatchEvent(new Event('input'));
    const post = document.querySelector('.share-actions .primary') as HTMLButtonElement;
    expect(post.disabled).toBe(true);
    expect(document.querySelector('.share-counter.over')).not.toBeNull();
  });

  it('calls onSubmit with the note and closes on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    openShareDialog('en', result, onSubmit);
    const ta = document.querySelector('dialog.share-edit textarea') as HTMLTextAreaElement;
    ta.value = 'My note';
    ta.dispatchEvent(new Event('input'));
    (document.querySelector('.share-actions .primary') as HTMLButtonElement).click();
    await flush();
    expect(onSubmit).toHaveBeenCalledWith('My note');
    expect(document.querySelector('dialog.share-edit')).toBeNull();
  });

  it('keeps the dialog open when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('nope'));
    openShareDialog('en', result, onSubmit);
    (document.querySelector('.share-actions .primary') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('dialog.share-edit')).not.toBeNull();
    const post = document.querySelector('.share-actions .primary') as HTMLButtonElement;
    expect(post.disabled).toBe(false);
  });

  it('Cancel closes without calling onSubmit', () => {
    const onSubmit = vi.fn();
    openShareDialog('en', result, onSubmit);
    const cancel = Array.from(document.querySelectorAll('.share-actions .btn')).find(
      (b) => !b.classList.contains('primary'),
    ) as HTMLButtonElement;
    cancel.click();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector('dialog.share-edit')).toBeNull();
  });

  it('does not stack a second dialog while one is open', () => {
    openShareDialog('en', result, async () => {});
    openShareDialog('en', result, async () => {});
    expect(document.querySelectorAll('dialog.share-edit')).toHaveLength(1);
  });
});
