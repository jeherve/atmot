// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { openHelp, maybeShowFirstVisitHelp } from '../src/ui/help.js';
import { setColorBlind } from '../src/ui/colorblind.js';

// happy-dom doesn't fully implement <dialog>; make showModal/close deterministic
// so the open/close lifecycle (and the [open] guard) is exercisable in tests.
beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  document.documentElement.className = '';
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

describe('openHelp', () => {
  it('mounts a dialog with the rules and one example per scored state', () => {
    openHelp('en');
    const dialog = document.querySelector('dialog.help');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelectorAll('ul li')).toHaveLength(3);
    expect(dialog!.querySelector('.tile.correct')).not.toBeNull();
    expect(dialog!.querySelector('.tile.present')).not.toBeNull();
    expect(dialog!.querySelector('.tile.absent')).not.toBeNull();
    expect(dialog!.textContent).toContain('How to play');
  });

  it('does not stack a second dialog while one is open', () => {
    openHelp('en');
    openHelp('en');
    expect(document.querySelectorAll('dialog.help')).toHaveLength(1);
  });

  it('removes the dialog from the DOM when closed', () => {
    openHelp('en');
    const dialog = document.querySelector('dialog.help') as HTMLDialogElement;
    const close = dialog.querySelector('.help-close') as HTMLButtonElement;
    close.click();
    expect(document.querySelector('dialog.help')).toBeNull();
  });

  it('renders French copy in fr', () => {
    openHelp('fr');
    expect(document.querySelector('dialog.help')!.textContent).toContain('Comment jouer');
  });

  it('shows the colour-blind hint when the mode is off', () => {
    openHelp('en');
    expect(document.querySelector('.help-hint')).not.toBeNull();
  });

  it('hides the colour-blind hint once the mode is on', () => {
    setColorBlind(true);
    openHelp('en');
    expect(document.querySelector('.help-hint')).toBeNull();
  });
});

describe('maybeShowFirstVisitHelp', () => {
  it('opens once, then never again once the flag is stored', () => {
    maybeShowFirstVisitHelp('en');
    expect(document.querySelector('dialog.help')).not.toBeNull();

    // Dismiss, then a second visit must not re-open it.
    (document.querySelector('.help-close') as HTMLButtonElement).click();
    expect(document.querySelector('dialog.help')).toBeNull();

    maybeShowFirstVisitHelp('en');
    expect(document.querySelector('dialog.help')).toBeNull();
  });
});
