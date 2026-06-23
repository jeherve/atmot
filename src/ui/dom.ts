/** Minimal hyperscript helper — no framework, tiny bundle. */
type Child = Node | string | null | undefined | false;

interface Attrs {
  class?: string;
  id?: string;
  type?: string;
  href?: string;
  title?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  ariaLabel?: string;
  ariaLive?: string;
  role?: string;
  dataset?: Record<string, string>;
  html?: string;
  [key: string]: unknown;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v as Record<string, string>)) node.dataset[dk] = dv;
    } else if (k === 'ariaLabel') node.setAttribute('aria-label', String(v));
    else if (k === 'ariaLive') node.setAttribute('aria-live', String(v));
    else if (k === 'role') node.setAttribute('role', String(v));
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'disabled') {
      (node as HTMLButtonElement).disabled = Boolean(v);
    } else if (k === 'value') {
      (node as HTMLInputElement).value = String(v);
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Replace all children of a container with new nodes. */
export function mount(container: HTMLElement, ...nodes: Child[]): void {
  container.replaceChildren(...nodes.filter((n): n is Node | string => n != null && n !== false));
}

export function clear(container: HTMLElement): void {
  container.replaceChildren();
}

/**
 * True when an event originated from an editable element (text input, textarea,
 * or contenteditable). Used to ignore global keystrokes while the user is typing
 * into a field such as the sign-in form, so they don't leak into the game board.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
