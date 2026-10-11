/**
 * Pagify Frame - runs inside the Pagify iframe (pagify-frame.html)
 *
 * All code that the iframe executes lives in this file, which is served from the
 * host app's own origin. The iframe document therefore needs no inline <script>,
 * no inline event handlers and no CDN, so it works under `script-src 'self'`.
 *
 * Protocol:
 *  parent -> frame: { type: 'PAGIFY_RENDER', instanceId, html, baseUrl, isViewOnlySkipMakingPDF, beautifyListItems, page_size }
 *  frame -> parent: { type: 'renderpdf' | 'PDF_READY' | 'PDF_ERROR' | 'PREVIEW_READY' | 'PREVIEW_ERROR', iter, ... }
 *
 * The `html` field is data only (markup + styles). Any <script> in it is never
 * executed: it is parsed with DOMParser and the frame's CSP blocks inline scripts.
 */

import { Previewer, Handler, registerHandlers } from 'pagedjs';
import html2pdf from 'html2pdf.js';

class RepeatingTableHeaders extends Handler {
    afterPageLayout(pageElement, page, breakToken, chunker) {
        // Find all split table elements
        let tables = pageElement.querySelectorAll("table[data-split-from]");

        tables.forEach((table) => {
            // There is an edge case where the previous page table
            // has zero height (isn't visible).
            // To avoid double header we will only add header if there is none.
            let tableHeader = table.querySelector("thead");
            if (tableHeader) {
                return;
            }

            // Get the reference UUID of the node
            let ref = table.dataset.ref;
            // Find the node in the original source
            let sourceTable = chunker.source.querySelector("[data-ref='" + ref + "']");

            // Find if there is a header
            let sourceHeader = sourceTable.querySelector("thead");
            if (sourceHeader) {
                console.log("Table header was cloned, because it is splitted.");
                // Clone the header element
                let clonedHeader = sourceHeader.cloneNode(true);
                // Insert the header at the start of the split table
                table.insertBefore(clonedHeader, table.firstChild);
            }
        });

        // Find all tables
        tables = pageElement.querySelectorAll("table");

        // special case which might not fit for everyone
        tables.forEach((table) => {
            // if the table has no rows in body, hide it.
            // This happens because my render engine creates empty tables.
            let sourceBody = table.querySelector("tbody > tr");
            if (!sourceBody) {
                console.log("Table was hidden, because it has no rows in tbody.");
                table.style.visibility = "hidden";
                table.style.position = "absolute";

                var lineSpacer = table.nextSibling;
                if (lineSpacer && lineSpacer.style) {
                    lineSpacer.style.visibility = "hidden";
                    lineSpacer.style.position = "absolute";
                }
            }
        });
        try {
            // setting the page to show overflowing content
            let contents = pageElement.querySelectorAll(".pagedjs_page_content");
            contents.forEach((content) => {
                content.style.height = 'max-content';
            });
        } catch (e) {
            console.warn("Failed to set page content height to max-content", e);
        }
    }
}

registerHandlers(RepeatingTableHeaders);

function notifyParent(message) {
    // Same-origin only: the frame page must be served from the host app's origin.
    window.parent.postMessage(message, window.location.origin);
}

/**
 * Load the generated document into this frame without executing any script in it.
 */
function mountDocument(html, baseUrl) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    // Defense in depth: scripts would be blocked by CSP anyway, drop them outright.
    parsed.querySelectorAll('script').forEach((script) => script.remove());

    // Resolve relative URLs (images, fonts) against the parent page, as srcdoc did.
    if (baseUrl && !parsed.querySelector('base')) {
        const base = document.createElement('base');
        base.href = baseUrl;
        document.head.prepend(base);
    }

    document.head.append(...Array.from(parsed.head.childNodes).map((node) => document.adoptNode(node)));
    Array.from(parsed.body.attributes).forEach((attr) => {
        document.body.setAttribute(attr.name, attr.value);
    });
    document.body.append(...Array.from(parsed.body.childNodes).map((node) => document.adoptNode(node)));
}

function getBulletChar(listStyleType) {
    const bulletMap = {
        'disc': '•',
        'circle': '○',
        'square': '▪',
        'none': '',
    };
    return bulletMap[listStyleType] || '•';
}

function beautifyListItemsHandler(originalBody) {
    try {
        const clonedBody = originalBody?.cloneNode?.(true);
        if (!clonedBody) return originalBody;

        clonedBody?.querySelectorAll?.('ul, ol')?.forEach?.((list) => {
            list?.querySelectorAll?.('li')?.forEach?.((li) => {
                const originalLi = originalBody?.querySelector?.(`[data-ref="${li?.getAttribute?.('data-ref')}"]`) || li;
                const computedStyle = window?.getComputedStyle?.(originalLi);

                if (computedStyle?.listStyleType !== 'none') {
                    li.style.listStyleType = 'none';
                    li.style.position = 'relative';
                    li.style.paddingLeft = '-1.2em';
                    li.style.paddingTop = '-0.3em';

                    const bullet = document?.createElement?.('span');
                    if (bullet) {
                        bullet.textContent = getBulletChar(computedStyle?.listStyleType);
                        bullet.style.cssText = `
                            position: absolute;
                            left: -1.4em;
                            top: -0.28em;
                            line-height: 1.25rem;
                            font-size: 1.2em;
                            font-weight: bold;
                            color: currentColor;
                        `;

                        li?.insertBefore?.(bullet, li?.firstChild);
                    }
                }
            });
        });

        return clonedBody;
    } catch (error) {
        console.error('beautifyListItemsHandler failed:', error);
        return originalBody;
    }
}

async function generatePdfBlob({ instanceId, beautifyListItems, page_size, totalPages }) {
    try {
        console.log('Starting PDF generation...');

        const originalBody = document.body;
        let targetElement = originalBody;

        if (beautifyListItems) {
            targetElement = beautifyListItemsHandler(originalBody);
        }

        if (!targetElement || targetElement?.innerHTML?.trim()?.length === 0) {
            throw new Error('No content found in body element');
        }

        console.log('Estimated pages:', totalPages);

        const opt = {
            margin: [0, 0, 0, 0],
            filename: "document.pdf",
            image: {
                type: "jpeg",
                quality: 0.98
            },
            html2canvas: {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff'
            },
            jsPDF: {
                unit: "mm",
                format: page_size.toLowerCase(),
                orientation: "portrait",
                compress: true
            }
        };

        const blob = await html2pdf().set(opt).from(targetElement)
            .toPdf()
            .get("pdf").then(pdf => {
                const pageCount = pdf.internal.getNumberOfPages();
                console.log('Generated PDF with', pageCount, 'pages');

                // Remove extra pages if necessary
                if (pageCount > totalPages && totalPages > 0) {
                    for (let i = pageCount; i > totalPages; i--) {
                        pdf.deletePage(i);
                    }
                }
            })
            .outputPdf("blob");

        // Send the Blob itself: a blob: URL created here would be revoked as soon
        // as this iframe is removed, so the parent creates its own URL.
        notifyParent({
            type: "PDF_READY",
            blob: blob,
            iter: instanceId
        });
    } catch (error) {
        console.error("PDF generation error:", error);
        notifyParent({
            type: "PDF_ERROR",
            error: error.message,
            iter: instanceId
        });
    }
}

async function render({ instanceId, html, baseUrl, isViewOnlySkipMakingPDF, beautifyListItems, page_size }) {
    try {
        mountDocument(html, baseUrl);

        // Wait for fonts to load before starting pagination
        await document.fonts.ready;
        console.log("Fonts are ready");

        const previewer = new Previewer();
        const result = await previewer.preview();

        console.log('Paged.js pagination complete:', result);

        // Notify parent window that rendering is complete
        notifyParent({
            type: "renderpdf",
            iter: instanceId
        });

        if (isViewOnlySkipMakingPDF) {
            notifyParent({
                type: "PREVIEW_READY",
                iter: instanceId
            });
        } else {
            await generatePdfBlob({ instanceId, beautifyListItems, page_size, totalPages: result.total });
        }
    } catch (error) {
        console.error('Failed to load or initialize Paged.js:', error);
        notifyParent({
            type: isViewOnlySkipMakingPDF ? "PREVIEW_ERROR" : "PDF_ERROR",
            error: "Failed to initialize Paged.js: " + error.message,
            iter: instanceId
        });
    }
}

let hasRendered = false;

window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) {
        return;
    }
    if (event.data?.type !== 'PAGIFY_RENDER' || hasRendered) {
        return;
    }
    // One frame renders exactly one document.
    hasRendered = true;
    render(event.data);
});
