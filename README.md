# @unimeta_care/pagify-sdk

A JavaScript SDK for rendering HTML content as paginated PDFs using Paged.js and html2pdf.js.

This is a **standalone fork** of [@eka-care/pagify-sdk](https://github.com/eka-care/Pagify-sdk) by [EKA Care](https://eka.care). The original library fetches `pagedjs` and `html2pdf.js` from unpkg.com at runtime inside iframe srcdoc contexts. This fork inlines both dependencies at build time, eliminating all CDN fetches — required for environments with a strict Content Security Policy (e.g. `script-src 'self'` without unpkg.com).

All credit for the core SDK design and implementation goes to the EKA Care team.

## Key Difference from Upstream

| | `@eka-care/pagify-sdk` | `@unimeta_care/pagify-sdk` |
|---|---|---|
| `pagedjs` loading | Fetched from `unpkg.com` at runtime | Inlined at build time |
| `html2pdf.js` loading | Fetched from `unpkg.com` at runtime | Inlined at build time |
| CDN dependency | Yes | None |
| CSP compatibility | Requires `unpkg.com` in `script-src` + `connect-src` | Works with `script-src 'self'` |
| Bundle size | ~25KB | ~3.3MB (dependencies included) |

## Installation

```bash
npm install @unimeta_care/pagify-sdk
```

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
| `onPdfReady` | `function` | `null` | Called with blob URL when PDF is ready |
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

Three build outputs:
- `dist/pagify.esm.js` — ES module (external pagedjs/html2pdf peers)
- `dist/pagify.js` — UMD (external pagedjs/html2pdf peers)
- `dist/pagify.standalone.js` — UMD with pagedjs and html2pdf inlined (**this is the published main**)

## Credits

This package is a fork of [@eka-care/pagify-sdk](https://github.com/eka-care/Pagify-sdk), originally created and maintained by [EKA Care](https://eka.care) (`dev@eka.care`). Licensed under MIT.

The standalone inlining approach was added by Unimeta Care to support strict CSP environments. The upstream PR is tracked at [IGvidhyapathi/Pagify-sdk](https://github.com/IGvidhyapathi/Pagify-sdk).

## License

MIT — see [LICENSE](LICENSE) for details.
