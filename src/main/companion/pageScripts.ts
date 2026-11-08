// Scripts injected into the agent's tab via executeJavaScript. Each one is a
// self-contained IIFE string; arguments are embedded with JSON.stringify.

export interface PageSnapshot {
  url: string;
  title: string;
  elements: string;
  text: string;
}

export type ElementResult =
  | { ok: true; kind?: "text" | "select" }
  | { ok: false; error: string };

const MAX_ELEMENTS = 150;
const MAX_TEXT = 4000;

const findRef = (ref: number): string => `
  const el = document.querySelector('[data-bb-ref="${ref}"]');
  if (!el) return { ok: false, error: "No element with ref ${ref}. Call read_page again." };
`;

// Tags visible interactive elements with data-bb-ref and lists them as
// `[ref] role "name"` so the model can act on them by number.
export const READ_PAGE = `(() => {
  const SELECTOR = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [contenteditable="true"], [role=button], [role=link], [role=checkbox], [role=tab], [role=menuitem], [role=option]';
  document.querySelectorAll('[data-bb-ref]').forEach((el) => el.removeAttribute('data-bb-ref'));

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.bottom < -200 || r.top > innerHeight * 3) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, 80);

  const lines = [];
  let ref = 0;
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (ref >= ${MAX_ELEMENTS}) break;
    if (el.disabled || !isVisible(el)) continue;
    el.setAttribute('data-bb-ref', String(++ref));

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'input' ? 'input:' + (el.type || 'text') : tag);
    const img = el.querySelector('img[alt], svg title');
    const href = tag === 'a' ? el.getAttribute('href') : '';
    // Icon-only controls have no text, so fall back to image alt text or the link target
    const name = clean(el.getAttribute('aria-label') || el.innerText || el.placeholder || el.title || el.alt || el.name
      || (img && (img.alt || img.textContent)) || href);
    let extra = '';
    if ((tag === 'input' || tag === 'textarea') && el.value && el.type !== 'password') extra += ' value="' + clean(el.value) + '"';
    if (el.type === 'checkbox' || el.type === 'radio') extra += el.checked ? ' (checked)' : ' (unchecked)';
    if (tag === 'select') extra += ' options=' + JSON.stringify([...el.options].slice(0, 15).map((o) => clean(o.text)));
    lines.push('[' + ref + '] ' + role + ' "' + name + '"' + extra);
  }

  const text = (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, ${MAX_TEXT});
  return { url: location.href, title: document.title, elements: lines.join('\\n'), text };
})()`;

export const click = (ref: number): string => `(() => {
  ${findRef(ref)}
  // Keep navigation in the agent's tab instead of spawning windows
  if (el.tagName === 'A') el.removeAttribute('target');
  el.scrollIntoView({ block: 'center' });
  if (el.focus) el.focus();
  el.click();
  return { ok: true };
})()`;

// Focuses and selects the field so the real input pipeline (insertText) replaces its content
export const focusForTyping = (ref: number): string => `(() => {
  ${findRef(ref)}
  el.scrollIntoView({ block: 'center' });
  if (el.tagName === 'SELECT') return { ok: true, kind: 'select' };
  el.focus();
  if (el.isContentEditable) document.execCommand('selectAll');
  else if (el.select) el.select();
  return { ok: true, kind: 'text' };
})()`;

export const selectOption = (ref: number, label: string): string => `(() => {
  ${findRef(ref)}
  const wanted = ${JSON.stringify(label)}.toLowerCase();
  const option = [...el.options].find((o) => o.text.trim().toLowerCase() === wanted || o.value.toLowerCase() === wanted)
    || [...el.options].find((o) => o.text.toLowerCase().includes(wanted));
  if (!option) return { ok: false, error: 'No option matching ' + JSON.stringify(wanted) };
  el.value = option.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
})()`;

export const scroll = (direction: "up" | "down"): string =>
  `(() => { window.scrollBy({ top: ${direction === "down" ? "" : "-"}innerHeight * 0.8 }); return { ok: true }; })()`;

// Deterministic safety net: returns a reason if acting on this element should
// need the user's approval, regardless of whether the model asked.
export const sensitiveReason = (
  ref: number,
  action: "click" | "type",
): string => `(() => {
  const el = document.querySelector('[data-bb-ref="${ref}"]');
  if (!el) return null;
  const form = el.closest('form');
  const isSecretField = (f) => f.type === 'password' || /^cc-/.test(f.autocomplete || '') || /card|cvc|cvv/i.test(f.name || '');

  if (${JSON.stringify(action)} === 'type') {
    return isSecretField(el) ? 'Typing into a password or payment field' : null;
  }

  const label = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase();
  if (/\\b(buy|pay|purchase|place order|checkout|check out|confirm order|köp|betala|beställ|slutför|till kassan)\\b/.test(label)) {
    return 'This looks like a purchase or checkout step';
  }
  const isSubmit = el.type === 'submit' || (el.tagName === 'BUTTON' && !el.getAttribute('type') && form);
  if (isSubmit && form && [...form.elements].some(isSecretField)) {
    return 'Submitting a form with password or payment details';
  }
  return null;
})()`;
