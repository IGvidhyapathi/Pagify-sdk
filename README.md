# @unimeta_care/pagify-sdk

A JavaScript SDK for rendering HTML content as paginated PDFs using Paged.js and html2pdf.js.

This is a fork of [@eka-care/pagify-sdk](https://github.com/eka-care/Pagify-sdk) by [EKA Care](https://eka.care). The original library builds an iframe `srcdoc` full of inline `<script>` blocks, an inline `onload=` handler, and fetches `pagedjs` and `html2pdf.js` from unpkg.com at runtime. A strict Content Security Policy blocks all of that.

This fork moves every line of iframe code into a same-origin file (`pagify-frame.js`, with Paged.js and html2pdf.js bundled in) loaded by a static page (`pagify-frame.html`). The iframe receives only data — never code — so the SDK works with `script-src 'self'`: no `'unsafe-inline'`, no `'unsafe-eval'`, no CDN.

All credit for the core SDK design and implementation goes to the EKA Care team.

## Key Difference from Upstream

| | `@eka-care/pagify-sdk` | `@unimeta_care/pagify-sdk` |
|---|---|---|
| `pagedjs` loading | Fetched from `unpkg.com` at runtime | Bundled in `pagify-frame.js` (same origin) |
| `html2pdf.js` loading | Fetched from `unpkg.com` at runtime | Bundled in `pagify-frame.js` (same origin) |
| Iframe code | Inline `<script>` + `onload=` in `srcdoc` | External `pagify-frame.js` |
| CDN dependency | Yes | None |
| CSP compatibility | Requires `'unsafe-inline'` and `unpkg.com` in `script-src` | Works with `script-src 'self'` |
| `<script>` / `on*=` in your HTML content | Executed | Never executed |
| SDK size | ~25KB | ~10KB (+ ~1.3MB `pagify-frame.js`, loaded only by the iframe) |

## Installation

```bash
npm install @unimeta_care/pagify-sdk
```

## Setup: host the frame files

The SDK renders inside an iframe that loads two files from **your own origin**. Copy them from the package into your public/static folder (they must sit next to each other):

```bash
cp node_modules/@unimeta_care/pagify-sdk/dist/pagify-frame.html public/
cp node_modules/@unimeta_care/pagify-sdk/dist/pagify-frame.js   public/
```

By default the SDK loads `/pagify-frame.html`. If you serve it elsewhere, pass `frameUrl` (it must be on the same origin as your app).

If the frame page can't be reached (wrong `frameUrl`, 404, or a page opened from `file://`), `onPdfError` / `onPreviewReady({ success: false })` is called with an explanation instead of the render hanging.

> Upgrading from the `/pagify-loader.html` setup: delete the loader page and its permissive CSP rule (e.g. in `proxy.ts`/middleware). `pagify-frame.html` works under the same strict CSP as the rest of your app.

### Content Security Policy

Paged.js writes `<style>` elements at runtime, so the iframe needs inline styles. Scripts need nothing special:

```
script-src 'self';
style-src 'self' 'unsafe-inline';
frame-src 'self';
img-src 'self' data: blob:;
```

`unpkg.com`, `'unsafe-inline'` and `'unsafe-eval'` are **not** needed in `script-src`.

Because the iframe enforces `script-src 'self'`, any `<script>` tag or `on*=` attribute inside `body_html`, `header_html`, `footer_html` or `head_html` is ignored. Use `head_html` for styles and fonts only.

## Usage

### ES Modules

```javascript
import pagify from '@unimeta_care/pagify-sdk';

await pagify.render({
    body_html: '<h1>Hello World</h1><p>This is my first PDF.</p>',
    header_html: '<div>Page Header</div>',
    footer_html: '<div>Page <span class="pageNumber"></span></div>',
    onPdfReady: (blobUrl) => {
        document.getElementById('pdf-viewer').src = blobUrl;
    },
    onPdfError: (error) => {
        console.error('PDF generation failed:', error);
    }
});
```

### TypeScript

```typescript
import pagify, { PagifyOptions } from '@unimeta_care/pagify-sdk';

const options: PagifyOptions = {
    body_html: '<h1>TypeScript Support</h1>',
    onPdfReady: (blobUrl: string) => {
        console.log('PDF ready:', blobUrl);
    }
};

await pagify.render(options);
```

### Preview Mode

```javascript
// Render preview without generating a PDF file
await pagify.render({
    body_html: '<h1>Invoice #12345</h1>',
    header_html: '<div>Company Header</div>',
    footer_html: '<div>Page <span class="pageNumber"></span></div>',
    containerSelector: '#preview-container',
    isViewOnlySkipMakingPDF: true,
    onPreviewReady: ({ success, error }) => {
        if (!success) console.error('Preview failed:', error);
    }
});

// Then generate PDF on user action
document.getElementById('download-btn').onclick = async () => {
    await pagify.render({
        body_html: '<h1>Invoice #12345</h1>',
        header_html: '<div>Company Header</div>',
        footer_html: '<div>Page <span class="pageNumber"></span></div>',
        onPdfReady: (blobUrl) => {
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = 'invoice.pdf';
            link.click();
        }
    });
};
```

### Direct Blob

```javascript
const pdfBlob = await pagify.generatePDF({
    body_html: '<h1>Direct PDF Generation</h1>',
    header_html: '<div>Header</div>'
});

const url = URL.createObjectURL(pdfBlob);
window.open(url, '_blank');
```

## API Reference

### `pagify.render(options)`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `body_html` | `string` | `""` | Main HTML content |
| `header_html` | `string` | `""` | HTML for page headers |
| `footer_html` | `string` | `""` | HTML for page footers |
| `head_html` | `string` | `""` | Additional `<head>` content (styles, fonts) |
| `page_size` | `string` | `"A4"` | Page size (A4, Letter, etc.) |
| `margin_left` | `string` | `"0mm"` | Left margin |
| `margin_right` | `string` | `"0mm"` | Right margin |
| `header_height` | `string` | `"0mm"` | Header height |
| `footer_height` | `string` | `"0mm"` | Footer height |
| `containerSelector` | `string` | `null` | CSS selector for preview container |
| `isViewOnlySkipMakingPDF` | `boolean` | `false` | Preview only, skip PDF generation |
| `frameUrl` | `string` | `"/pagify-frame.html"` | Same-origin URL of `pagify-frame.html` |
| `onPdfReady` | `function` | `null` | Called with `(blobUrl, blob)` when PDF is ready |
| `onPdfError` | `function` | `null` | Called with error if PDF generation fails |
| `onPreviewReady` | `function` | `null` | Called with `{ success, error? }` when preview is ready |

### CSS Tips

**Page layout:**
```css
@page {
    size: A4 portrait;
    margin: 25mm 20mm;
}
```

**Dynamic page numbers:**
```html
Page <span class="pageNumber"></span> of <span class="totalPages"></span>
```

**Page breaks:**
```css
.page-break { page-break-before: always; }
.no-break    { page-break-inside: avoid; }
```

## Browser Support

Chrome 60+, Firefox 55+, Safari 12+, Edge 79+, iOS Safari, Chrome Mobile

## Build

```bash
npm install
npm run build     # production build (all three targets)
npm run dev       # watch mode
```

Build outputs:
- `dist/pagify.esm.js` — ES module
- `dist/pagify.js` — UMD
- `dist/pagify.standalone.js` — UMD (**this is the published main**)
- `dist/pagify-frame.html` + `dist/pagify-frame.js` — iframe page and its runtime (Paged.js + html2pdf.js bundled); host these on your origin

## Demo

`index.html` is an interactive demo that uses the local build and runs under `script-src 'self'` (its script lives in `demo.js`). It must be served over HTTP, not opened as a file:

```bash
npm run build
python3 -m http.server 8080    # or any static server, from the repo root
# open http://localhost:8080/
```

## Credits

This package is a fork of [@eka-care/pagify-sdk](https://github.com/eka-care/Pagify-sdk), originally created and maintained by [EKA Care](https://eka.care) (`dev@eka.care`). Licensed under MIT.

The same-origin frame approach was added by Unimeta Care to support strict CSP environments. The upstream PR is tracked at [IGvidhyapathi/Pagify-sdk](https://github.com/IGvidhyapathi/Pagify-sdk).

## License

MIT — see [LICENSE](LICENSE) for details.
