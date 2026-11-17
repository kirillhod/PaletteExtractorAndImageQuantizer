// @ts-check
import assert from 'node:assert/strict';
import test from 'node:test';
import { initShortcuts } from '../js/ui/shortcuts.js';

/**
 * Run initShortcuts against a captured keydown listener. The module only touches
 * `document.addEventListener`, so a one-method stub keeps the test DOM-free.
 *
 * @returns {{ calls: string[], press: (key:string, target:any, overrides?:any) => any }}
 */
function setup() {
  /** @type {((event:any) => void)|null} */
  let listener = null;
  const previous = globalThis.document;
  // @ts-expect-error minimal document stub for a DOM-free module
  globalThis.document = {
    addEventListener(type, fn) {
      if (type === 'keydown') listener = fn;
    },
  };
  const calls = [];
  initShortcuts({
    onFit: () => calls.push('fit'),
    onZoom100: () => calls.push('zoom100'),
    onToggleOriginal: () => calls.push('original'),
    onToggleHelp: () => calls.push('help'),
    onCycleTheme: () => calls.push('theme'),
    onToggleErrorMap: () => calls.push('map'),
  });
  globalThis.document = previous;
  assert.ok(listener, 'shortcuts must register a keydown listener');

  const handler = /** @type {(event:any) => void} */ (listener);
  return {
    calls,
    press(key, target, overrides = {}) {
      const event = {
        key,
        target,
        defaultPrevented: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        preventDefault() {
          event.defaultPrevented = true;
        },
        ...overrides,
      };
      handler(event);
      return event;
    },
  };
}

const body = { tagName: 'BODY', isContentEditable: false };
const select = { tagName: 'SELECT', isContentEditable: false };
const button = { tagName: 'BUTTON', isContentEditable: false };
const textInput = { tagName: 'INPUT', type: 'text', isContentEditable: false };
const numberInput = { tagName: 'INPUT', type: 'number', isContentEditable: false };
const rangeInput = { tagName: 'INPUT', type: 'range', isContentEditable: false };
const checkboxInput = { tagName: 'INPUT', type: 'checkbox', isContentEditable: false };
const textarea = { tagName: 'TEXTAREA', isContentEditable: false };
const editable = { tagName: 'DIV', isContentEditable: true };

test('question mark opens Help from the page and from non-text controls', () => {
  for (const target of [body, select, button, rangeInput, checkboxInput]) {
    const { calls, press } = setup();
    const event = press('?', target);
    assert.deepEqual(calls, ['help'], `${target.tagName} should open Help`);
    assert.equal(event.defaultPrevented, true);
  }
});

test('question mark leaves text entry alone', () => {
  for (const target of [textInput, numberInput, textarea, editable]) {
    const { calls, press } = setup();
    const event = press('?', target);
    assert.deepEqual(calls, [], `${target.tagName} keeps its own typing`);
    assert.equal(event.defaultPrevented, false);
  }
});

test('single-key shortcuts still work from the page', () => {
  const { calls, press } = setup();
  for (const key of ['f', '1', 'o', 'e', 't']) press(key, body);
  assert.deepEqual(calls, ['fit', 'zoom100', 'original', 'map', 'theme']);
});

test('letters follow the physical key on a non-Latin layout', () => {
  const { calls, press } = setup();
  // Russian layout: these positions produce Cyrillic letters.
  press('а', body, { code: 'KeyF' });
  press('щ', body, { code: 'KeyO' });
  press('у', body, { code: 'KeyE' });
  press('е', body, { code: 'KeyT' });
  assert.deepEqual(calls, ['fit', 'original', 'map', 'theme']);
});

test('letters also follow the produced character on a moved layout', () => {
  const { calls, press } = setup();
  // Dvorak puts F on the physical Y key; the character still names the action.
  press('f', body, { code: 'KeyY' });
  assert.deepEqual(calls, ['fit']);
});

test('1 uses the top-row key but Shift+1 stays an exclamation mark', () => {
  const { calls, press } = setup();
  press('1', body, { code: 'Digit1' });
  press('!', body, { code: 'Digit1', shiftKey: true });
  assert.deepEqual(calls, ['zoom100']);
});

test('single-key shortcuts pause when a list or input has focus', () => {
  for (const target of [select, rangeInput, textInput]) {
    const { calls, press } = setup();
    for (const key of ['f', '1', 'o', 'e', 't']) press(key, target);
    press('а', target, { code: 'KeyF' });
    assert.deepEqual(calls, [], `${target.tagName} should keep its keys`);
  }
});

test('modifiers and handled events are ignored', () => {
  const { calls, press } = setup();
  press('?', body, { ctrlKey: true });
  press('?', body, { metaKey: true });
  press('?', body, { altKey: true });
  press('?', body, { defaultPrevented: true });
  press('f', body, { ctrlKey: true });
  assert.deepEqual(calls, []);
});

test('unrelated keys do nothing', () => {
  const { calls, press } = setup();
  press('x', body);
  press('Escape', body);
  assert.deepEqual(calls, []);
});
