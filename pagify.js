/**
 * Pagify SDK - Modular Version
 * Provides a simple API for rendering HTML content as paginated PDFs using Paged.js
 * 
 * Usage:
 * - Render paginated content: pagify.render(options)
 * 
 * @author Pagify SDK
 * @version 1.2.0
 * @license MIT
 */

/**
 * Pagify SDK Class
 * Handles PDF rendering with pagination using Paged.js and html2pdf.js
 *
 * Paged.js and html2pdf.js run inside an iframe that loads pagify-frame.html /
 * pagify-frame.js from the host app's own origin, so the SDK works under a
 * Content Security Policy of `script-src 'self'` (no inline scripts, no CDN).
 */
const pagifyIframeIdentifier = 'iframe[data-pagify-iframe="true"]';
const defaultFrameUrl = '/pagify-frame.html';

// How long the frame has to acknowledge PAGIFY_RENDER after it loads
const frameAckTimeoutMs = 5000;

class PagifySDK {
    constructor() {
        // Counter for unique iframe instances
        this.instanceCounter = 1;

        // Storage for callback functions indexed by instance ID
        this.callbackStorage = {};
        this.pdfCallbackStorage = {};

        // Iframe and origin per instance ID, used to verify who sent a message
        this.frameStorage = {};

        // Initialize message listener
        this.initMessageListener();
    }

    
    /**
     * Initialize message listener for iframe communication
     */
    initMessageListener() {
        if (typeof window !== 'undefined') {
            window.addEventListener("message", (event) => {
                // Only accept messages from the iframe this SDK created for that instance
                const frame = this.frameStorage[event.data?.iter];
                if (!frame || event.source !== frame.iframe.contentWindow || event.origin !== frame.origin) {
                    return;
                }
                this.handleFrameMessage(event);
            }, false);
        }
    }

    /**
     * Handle a verified message from a Pagify frame
     */
    handleFrameMessage(event) {
        const frame = this.frameStorage[event.data?.iter];
        if (event.data?.type === "PAGIFY_ACK") {
            // The frame received the content; it is rendering now
            clearTimeout(frame?.ackTimer);
            return;
        }
        if (["PDF_READY", "PDF_ERROR", "PREVIEW_READY", "PREVIEW_ERROR"].includes(event.data?.type)) {
            clearTimeout(frame?.ackTimer);
            delete this.frameStorage[event.data?.iter];
        }

        if (event.data?.type === "renderpdf") {
            const callback = this.callbackStorage[event.data?.iter];
            if (callback) {
                callback();
            }
            // Clean up callback storage
            delete this.callbackStorage[event.data?.iter];
        } else if (event.data?.type === "PDF_READY") {
            // Handle PDF blob ready event. The frame sends the Blob itself so the
            // URL belongs to this page and survives removal of the iframe.
            const blobUrl = URL.createObjectURL(event.data.blob);
            console.log('PDF blob ready:', blobUrl);
                    
            // Check if there's a specific callback for this instance
            const instanceId = event.data?.iter;
            if (instanceId && this.pdfCallbackStorage[instanceId]?.onPdfReady) {
                this.pdfCallbackStorage[instanceId].onPdfReady(blobUrl, event.data.blob);
                delete this.pdfCallbackStorage[instanceId];
            }
                    
            // Also trigger global PDF ready event for backward compatibility
            window.dispatchEvent(new CustomEvent('pdfReady', { 
                detail: { blobUrl: blobUrl } 
            }));
                    
        } else if (event.data?.type === "PDF_ERROR") {
            // Handle PDF generation error
            console.error('PDF generation error:', event.data.error);
                    
            // Check if there's a specific callback for this instance
            const instanceId = event.data?.iter;
            if (instanceId && this.pdfCallbackStorage[instanceId]?.onPdfError) {
                this.pdfCallbackStorage[instanceId].onPdfError(event.data.error);
                delete this.pdfCallbackStorage[instanceId];
            }
                    
            // Also trigger global PDF error event for backward compatibility
            window.dispatchEvent(new CustomEvent('pdfError', { 
                detail: { error: event.data.error } 
            }));
        }
        else if (event.data?.type === "PREVIEW_READY") {
            const instanceId = event.data?.iter;
            if (instanceId && this.pdfCallbackStorage[instanceId]?.onPreviewReady) {
                this.pdfCallbackStorage[instanceId].onPreviewReady({
                    success: true
                });
                delete this.pdfCallbackStorage[instanceId];
            }
                    
            // Also trigger global preview ready event for backward compatibility
            window.dispatchEvent(new CustomEvent('previewReady', { 
                detail: { success: true } 
            }));
        } else if (event.data?.type === "PREVIEW_ERROR") {
            console.error('Preview error:', event.data.error);
                    
            const instanceId = event.data?.iter;
            if (instanceId && this.pdfCallbackStorage[instanceId]?.onPreviewReady) {
                this.pdfCallbackStorage[instanceId].onPreviewReady({
                    success: false,
                    error: event.data.error
                });
                delete this.pdfCallbackStorage[instanceId];
            }
                    
            window.dispatchEvent(new CustomEvent('previewError', { 
                detail: { success: false, error: event?.data?.error } 
            }));
        }
    }

    /**
     * Report a failure for an instance whose frame never answered,
     * through the same callbacks and events as a frame-reported error
     */
    failInstance(instanceId, isViewOnlySkipMakingPDF, error) {
        console.error('Pagify:', error);
        this.handleFrameMessage({
            data: {
                type: isViewOnlySkipMakingPDF ? "PREVIEW_ERROR" : "PDF_ERROR",
                error: error,
                iter: instanceId
            }
        });
    }

    /**
     * Render HTML content as a paginated PDF
     * @param {Object} options - Configuration options for PDF rendering
     * @param {string} options.body_html - Main HTML content for the PDF body
     * @param {string} options.header_html - HTML content for page headers
     * @param {string} options.footer_html - HTML content for page footers
     * @param {string} options.head_html - Additional HTML for the <head> section
     * @param {string} options.page_size - Page size (A4, Letter, etc.)
     * @param {string} options.margin_left - Left page margin
     * @param {string} options.margin_right - Right page margin
     * @param {string} options.header_height - Height reserved for header
     * @param {string} options.footer_height - Height reserved for footer
     * @param {string} options.page_number_selector - CSS selector for page numbering
     * @param {boolean} options.footer_only_on_last_page - Show footer only on last page
     * @param {string} options.page_padding_top - Top padding for page content
     * @param {function} options.callback - Function called when rendering completes
     * @param {function} options.onPdfReady - Callback when PDF blob is ready (receives blobUrl, blob)
     * @param {function} options.onPdfError - Callback when PDF generation fails (receives error)
     * @param {string} options.containerSelector - CSS selector for container element
     * @param {boolean} options.isViewOnlySkipMakingPDF - If true, only render preview without generating PDF
     * @param {function} options.onPreviewReady - Callback when in preview only mode, fired on iframe ready in DOM (receives {success: boolean, error?: string})
     * @param {boolean} options.beautifyListItems - If true, apply bullet point fixes to list items (default: true)
     * @param {string} options.frameUrl - Same-origin URL of pagify-frame.html (default: '/pagify-frame.html')
     * @returns {Promise<void>}
     */
    async render({
        body_html = "",
        header_html = "",
        footer_html = "",
        head_html = "",
        page_size = "A4",
        margin_left = "0mm",
        margin_right = "0mm",
        header_height = "0mm",
        footer_height = "0mm",
        page_number_selector = "",
        footer_only_on_last_page = false,
        page_padding_top = "16px",
        callback = null,
        onPdfReady = null,
        onPdfError = null,
        containerSelector = null,
        isViewOnlySkipMakingPDF = false,
        onPreviewReady = null,
        beautifyListItems = true,
        frameUrl = defaultFrameUrl,
    }) {
        try {
            // Generate unique instance ID
            const instanceId = this.instanceCounter++;

            // Store callback for later execution
            this.callbackStorage[instanceId] = callback;

            // Store PDF callbacks for later execution
            if (onPdfReady || onPdfError) {
                this.pdfCallbackStorage[instanceId] = {
                    onPdfReady: onPdfReady,
                    onPdfError: onPdfError
                };
            }
            if (onPreviewReady) {
                this.pdfCallbackStorage[instanceId] = {
                    ...this.pdfCallbackStorage[instanceId],
                    onPreviewReady: onPreviewReady
                };
            }

            // Generate page numbering CSS if selector is provided
            const pageNumberCSS = page_number_selector
                ? `${page_number_selector}::before {
                    content: "Page " counter(page) " of " counter(pages) " ";
                }`
                : "";

            // Build the HTML document (markup and styles only) for the iframe
            const iframeHTML = this.buildIframeHTML({
                body_html,
                header_html,
                footer_html,
                head_html,
                page_size,
                margin_left,
                margin_right,
                header_height,
                footer_height,
                footer_only_on_last_page,
                page_padding_top,
                pageNumberCSS,
            });

            // The frame is matched by origin, which file:// pages do not have
            if (window.location.protocol === 'file:') {
                this.failInstance(instanceId, isViewOnlySkipMakingPDF,
                    'Pagify must be served over http(s); pages opened from file:// cannot talk to the Pagify frame.');
                return;
            }

            // Create and configure iframe
            const iframe = this.createIframe(containerSelector);

            // The frame page loads its code from pagify-frame.js on this origin.
            // It receives only data (HTML + options), never code, so its CSP can be
            // `script-src 'self'` like the rest of the app.
            const frameSrc = new URL(frameUrl, window.location.href);
            iframe.src = frameSrc.href;
            this.frameStorage[instanceId] = { iframe, origin: frameSrc.origin };

            // Once the frame page is ready, send it the content to render.
            iframe.addEventListener('load', () => {
                // If frameUrl is wrong (e.g. 404) nothing answers: report it instead of hanging
                this.frameStorage[instanceId].ackTimer = setTimeout(() => {
                    if (!this.frameStorage[instanceId]) return;
                    delete this.frameStorage[instanceId];
                    this.failInstance(instanceId, isViewOnlySkipMakingPDF,
                        `Pagify frame did not respond. Check that ${frameSrc.href} serves pagify-frame.html (with pagify-frame.js next to it) from the same origin as this page.`);
                }, frameAckTimeoutMs);

                iframe.contentWindow.postMessage({
                    type: 'PAGIFY_RENDER',
                    instanceId,
                    html: iframeHTML,
                    baseUrl: document.baseURI,
                    isViewOnlySkipMakingPDF,
                    beautifyListItems,
                    page_size,
                }, frameSrc.origin);
            }, { once: true });

            // Insert iframe into specified container or body
            const container = this.getContainer(containerSelector);
            container.appendChild(iframe);

        } catch (error) {
            console.error("Pagify render error:", error);
            if (onPdfError) {
                onPdfError(error.message);
            }
        }
    }

    /**
     * Build HTML content for the iframe.
     * Contains markup and styles only; pagify-frame.js supplies all behaviour.
     */
    buildIframeHTML({
        body_html,
        header_html,
        footer_html,
        head_html,
        page_size,
        margin_left,
        margin_right,
        header_height,
        footer_height,
        footer_only_on_last_page,
        page_padding_top,
        pageNumberCSS,
    }) {
        return `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        /* Ensure print colors are preserved */
                        body {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            margin: 0;
                            padding: 0;
                        }

                        /* Page numbering styles */
                        ${pageNumberCSS}

                        /* Header and footer positioning */
                        .header {
                            position: running(header);
                        }
                        
                        .footer {
                            position: running(footer);
                        }
                        
                        /* Paged.js content styling */
                        .pagedjs_page_content {
                            border-bottom-width: 1px;
                            border-top-width: 1px;
                            --tw-border-opacity: 1;
                            border-color: rgba(218, 222, 227, var(--tw-border-opacity));
                            padding-top: ${page_padding_top};
                        }
                        
                        .pagedjs_pages {
                            align-items: center;
                            display: flex;
                            flex: 1;
                            flex-direction: column;
                        }
                        
                        /* Prevent table rows from breaking across pages */
                        tr {
                            break-inside: avoid;
                        }
                        
                        /* Page layout configuration */
                        @page {
                            margin-left: ${margin_left};
                            margin-right: ${margin_right};
                            margin-top: ${header_height};
                            margin-bottom: ${footer_height};
                            size: ${page_size};
                        
                            @bottom-center {
                                content: element(footer);
                            }
                        
                            @top-center {
                                content: element(header);
                            }
                        }

                        /* Base64 image optimization */
                        img {
                            max-width: 100%;
                            height: auto;
                        }

                        /* Print-friendly table styles */
                        table {
                            border-collapse: collapse;
                            width: 100%;
                        }

                        /* Page break controls */
                        .page-break-before {
                            page-break-before: always;
                        }

                        .page-break-after {
                            page-break-after: always;
                        }

                        .page-break-inside-avoid {
                            page-break-inside: avoid;
                        }
                    </style>
                    ${head_html}
                </head>
                <body>
                    <!-- Header content (appears on every page) -->
                    <div class="header" style="width: 100%">
                        ${header_html}
                    </div>
                    
                    <!-- Footer content (conditional positioning) -->
                    ${footer_only_on_last_page ? "" : `<div class="footer" style="width: 100%">
                        ${footer_html}
                    </div>`}
                    
                    <!-- Main body content -->
                    ${body_html}

                    <!-- Footer on last page only (if specified) -->
                    ${footer_only_on_last_page ? `<div class="footer" style="width: 100%">
                        ${footer_html}
                    </div>` : ""}
                </body>
            </html>
        `;
    }

    /**
     * Create and configure iframe
     */
    createIframe(containerSelector) {
        const iframe = document.createElement("iframe");
        
        iframe.setAttribute('data-pagify-iframe', 'true');
        // Configure iframe styling based on container selector
        if (containerSelector) {
            // If container is specified, make iframe fill the container
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = "none";
        } else {
            // If no container, hide iframe off-screen
            iframe.style.position = "absolute";
            iframe.style.top = "-9999px";
            iframe.style.left = "-9999px";
            iframe.style.border = "none";
        }
        
        return iframe;
    }

    cleanupIframesOnContainerLevel(container) {
        const oldPagifyIframes = container?.querySelectorAll(pagifyIframeIdentifier) || [];
        oldPagifyIframes?.forEach(iframe => {
            iframe?.remove();
        });
    }

    cleanupIframesOnDOMLevel() {
        const oldPagifyIframes = document?.querySelectorAll(pagifyIframeIdentifier) || [];
        oldPagifyIframes?.forEach(iframe => {
            iframe?.remove();
        });
    }

    /**
     * Get container element for iframe
     */
    getContainer(containerSelector) {
        let container;
        if (containerSelector) {
            container = document.querySelector(containerSelector);
            if (!container) {
                console.warn(`Container with selector "${containerSelector}" not found. Using document.body instead.`);
                container = document.body;
            }
            this.cleanupIframesOnContainerLevel(container);
        } else {
            container = document.body;
            this.cleanupIframesOnDOMLevel();
        }
        return container;
    }

    /**
     * Direct PDF generation without iframe (for Node.js environments)
     * @param {Object} options - Same options as render method
     * @returns {Promise<Blob>} - PDF blob
     */
    async generatePDF(options) {
        if (typeof window === "undefined") {
            throw new Error("Direct PDF generation is only available in browser environments");
        }

        return new Promise(async (resolve, reject) => {
            try {
                const modifiedOptions = {
                    ...options,
                    onPdfReady: (blobUrl, blob) => {
                        // Use the Blob directly: fetching a blob: URL needs `connect-src blob:`
                        URL.revokeObjectURL(blobUrl);
                        resolve(blob);
                    },
                    onPdfError: (error) => {
                        reject(new Error(error));
                    }
                };

                await this.render(modifiedOptions);
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Create singleton instance
const pagify = new PagifySDK();

// Export for ES modules
export default pagify;
export { PagifySDK };

// Also expose on window for browser compatibility
if (typeof window !== "undefined") {
    window.pagify = pagify;
}
