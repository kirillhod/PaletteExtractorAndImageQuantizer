# PEIQ browser check

Do this before claiming a UI change is done. The dev server stays on port 5173; a second
`npm run dev` fails with `EADDRINUSE`.

## 0. Automated smoke first

`npm test` runs `tools/browser-check.mjs` after the Node suite. It starts its own static
server on a free port, launches headless Chrome or Edge with a throwaway profile, and
checks at 1280x900 and 360x800:

- canvas painting, worker result, and the palette;
- theme painting, persistence, and layout stability;
- keyboard focus order, focus rings, and the divider keys;
- editor and preview caption clipboard copy;
- full screen and hidden canvas, the aligned and growing palette, `Esc`, and no persisted
  stage state;
- horizontal overflow and 44 px touch targets;
- a validated indexed export that decodes and is smaller than its raw scanlines.

`npm run test:browser` runs only that half. It is a smoke suite, not a visual review: it
does not compare colors against `DESIGN.md`, run Firefox or Safari, exercise touch
gestures, or replace the checklist below. If Chrome is not in a standard location, set
`CHROME_PATH`; `PEIQ_CHROME_FLAGS` adds flags such as `--no-sandbox` for a container.

## 1. Start headless Chrome

```powershell
$chrome = Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  -ArgumentList '--headless=new','--remote-debugging-port=9229',
    "--user-data-dir=$env:TEMP\peiq-chrome",'--disable-gpu','--hide-scrollbars',
    '--no-first-run','--no-default-browser-check','about:blank' `
  -PassThru -WindowStyle Hidden
$chrome.Id
```

Keep the PID. Kill it before starting a new one; reusing the profile while an old
instance lives silently reuses the old port and profile state.

## 2. Drive the page

The client is `tools/cdp.mjs` (Node 22, no dependencies). It talks to the first page
target and takes JSON parameters from a file, which avoids PowerShell quoting problems:

```powershell
'{"url":"http://localhost:5173/?t=1"}' | Set-Content D:\Temp\nav.json
node tools/cdp.mjs call Page.navigate @D:\Temp\nav.json
node tools/cdp.mjs eval check.js --width=1280 --height=900
node tools/cdp.mjs eval check.js --width=360 --height=800 --dpr=3
node tools/cdp.mjs shot out-360.png --width=360 --height=800 --dpr=3
```

Viewport overrides belong to one CDP connection, so pass `--width` to the same `eval` or
`shot` call that needs it. For a multi-step scenario, put the whole scenario in one
`eval` file and return only the fields you need.

An `eval` file is one expression. Use an async IIFE and return only the fields you need:

```js
(async () => ({
  status: document.getElementById('statusbar').innerText,
  rows: document.querySelectorAll('#download-result .peiq-download-result__file').length,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()
```

## 3. Load an image without a file dialog

```js
(async () => {
  const response = await fetch('/assets/sample.png');
  const bytes = await response.arrayBuffer();
  const file = new File([bytes], 'sample.png', { type: 'image/png' });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  document.dispatchEvent(new DragEvent('drop', {
    bubbles: true, cancelable: true, dataTransfer: transfer,
  }));
  return true;
})()
```

For a local file, base64 it into the expression. Wait for `#workspace` to unhide and the
status text to stop matching `Decoding|Processing`.

## 4. Clipboard

Grant permissions once per browser session, for the exact origin:

```powershell
'{"origin":"http://localhost:5173","permissions":["clipboardReadWrite","clipboardSanitizedWrite"]}' | Set-Content D:\Temp\grant.json
node tools/cdp.mjs call Browser.grantPermissions @D:\Temp\grant.json
```

Then read back: `navigator.clipboard.read()` for images, `readText()` for `.hex`/`.gpl`/
`.json`. A real click is required; dispatch it through CDP input events, not `click()`.

## 5. Checklist

- Console: no errors. Collect `Runtime.exceptionThrown` and `Log.entryAdded` while the
  scenario runs; a clean load is not enough.
- 1280 px and 360 px: no horizontal overflow
  (`scrollWidth === clientWidth`), canvas and palette visible.
- Keyboard-only: divider arrows, native selects, palette Esc, focus visible.
- Both themes: toggle auto -> light -> dark and reload; no flash, no layout shift.
- Touch targets at 360 px stay at least 44 px.
- Screenshots only when a visual decision depends on them; reading an image is expensive.

## 6. Clean up

```powershell
taskkill /PID <pid> /T /F
Remove-Item -LiteralPath "$env:TEMP\peiq-chrome" -Recurse -Force -ErrorAction SilentlyContinue
```

Leave the dev server running only when the user asked for it.

Every Chrome instance writes a full profile: 70-200 MB, tens of thousands of files. Use
**one** path, `$env:TEMP\peiq-chrome`, for every run, including one-shot
`--screenshot` calls. Never invent a new `--user-data-dir` per screenshot; a few dozen
ad-hoc checks silently cost several gigabytes. Kill the instance first, then delete the
profile, and reuse the same path on the next run.

Sweep leftovers from earlier runs when the temp drive grows:

```powershell
Get-ChildItem D:\Temp, D:\Temp\opencode -Directory -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'Local State') } |
  Remove-Item -Recurse -Force
```

`Local State` marks a Chrome profile root, so the filter never touches scripts or images.
