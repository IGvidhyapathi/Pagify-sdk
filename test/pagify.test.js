import pagify, { PagifySDK } from '../pagify.js';

describe('Pagify SDK', () => {
    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = '';
    });

    test('should export default instance', () => {
        expect(pagify).toBeInstanceOf(PagifySDK);
    });

    test('should create PagifySDK instance', () => {
        const instance = new PagifySDK();
        expect(instance).toBeInstanceOf(PagifySDK);
    });

    test('should have render method', () => {
        expect(typeof pagify.render).toBe('function');
    });

    test('should have generatePDF method', () => {
        expect(typeof pagify.generatePDF).toBe('function');
    });

    test('should render with basic options', async () => {
        const mockCallback = jest.fn();
        
        await pagify.render({
            body_html: '<h1>Test</h1>',
            callback: mockCallback
        });

        // Check if iframe was created
        const iframes = document.querySelectorAll('iframe');
        expect(iframes.length).toBe(1);
    });

    test('should render with container selector', async () => {
        // Create container
        const container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);

        await pagify.render({
            body_html: '<h1>Test</h1>',
            containerSelector: '#test-container'
        });

        // Check if iframe was added to container
        const iframe = container.querySelector('iframe');
        expect(iframe).toBeTruthy();
        expect(iframe.style.width).toBe('100%');
        expect(iframe.style.height).toBe('100%');
    });

    test('should handle missing container gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        await pagify.render({
            body_html: '<h1>Test</h1>',
            containerSelector: '#non-existent'
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            'Container with selector "#non-existent" not found. Using document.body instead.'
        );

        consoleSpy.mockRestore();
    });

    test('should generate iframe HTML with correct structure', () => {
        const instance = new PagifySDK();
        const html = instance.buildIframeHTML({
            body_html: '<h1>Test</h1>',
            header_html: '<div>Header</div>',
            footer_html: '<div>Footer</div>',
            head_html: '<style>body { margin: 0; }</style>',
            page_size: 'A4',
            margin_left: '10mm',
            margin_right: '10mm',
            header_height: '15mm',
            footer_height: '15mm',
            footer_only_on_last_page: false,
            page_padding_top: '16px',
            pageNumberCSS: ''
        });

        expect(html).toContain('<h1>Test</h1>');
        expect(html).toContain('<div>Header</div>');
        expect(html).toContain('<div>Footer</div>');
        expect(html).toContain('<style>body { margin: 0; }</style>');
        expect(html).toContain('margin-left: 10mm');
        expect(html).toContain('margin-right: 10mm');
    });

    test('should create iframe with correct styles', () => {
        const instance = new PagifySDK();
        
        // Test with container selector
        const iframeWithContainer = instance.createIframe('#container');
        expect(iframeWithContainer.style.width).toBe('100%');
        expect(iframeWithContainer.style.height).toBe('100%');
        
        // Test without container selector
        const iframeWithoutContainer = instance.createIframe(null);
        expect(iframeWithoutContainer.style.position).toBe('absolute');
        expect(iframeWithoutContainer.style.top).toBe('-9999px');
        expect(iframeWithoutContainer.style.left).toBe('-9999px');
    });

    test('should get container element correctly', () => {
        const instance = new PagifySDK();
        
        // Create test container
        const container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
        
        // Test existing container
        const foundContainer = instance.getContainer('#test-container');
        expect(foundContainer).toBe(container);
        
        // Test non-existent container
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const fallbackContainer = instance.getContainer('#non-existent');
        expect(fallbackContainer).toBe(document.body);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
        
        // Test no container selector
        const defaultContainer = instance.getContainer(null);
        expect(defaultContainer).toBe(document.body);
    });

    test('should handle errors gracefully', async () => {
        const mockOnError = jest.fn();
        
        // Mock console.error to avoid noise in tests
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await pagify.render({
            body_html: '<h1>Test</h1>',
            onPdfError: mockOnError
        });
        
        consoleSpy.mockRestore();
    });

    describe('strict CSP (script-src \'self\')', () => {
        const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

        const renderAndLoad = async (instance, options = {}) => {
            await instance.render({ body_html: '<h1>Test</h1>', ...options });
            const iframe = document.querySelector('iframe[data-pagify-iframe="true"]');
            const postMessage = jest.spyOn(iframe.contentWindow, 'postMessage').mockImplementation();
            iframe.dispatchEvent(new Event('load'));
            return { iframe, postMessage, instanceId: postMessage.mock.calls[0][0].instanceId };
        };

        const sendFromFrame = (source, data) => {
            window.dispatchEvent(new MessageEvent('message', { data, source, origin: window.location.origin }));
        };

        test('iframe HTML contains no scripts, inline handlers or CDN URLs', () => {
            const html = new PagifySDK().buildIframeHTML({
                body_html: '<h1>Test</h1>',
                page_size: 'A4',
                pageNumberCSS: ''
            });
            expect(html).not.toMatch(/<script/i);
            expect(html).not.toMatch(/\sonload=/i);
            expect(html).not.toContain('unpkg.com');
        });

        test('loads the same-origin frame page and sends it data only', async () => {
            const { iframe, postMessage } = await renderAndLoad(new PagifySDK(), {
                page_size: 'Letter',
                isViewOnlySkipMakingPDF: true,
                beautifyListItems: false
            });

            expect(iframe.src).toBe(`${window.location.origin}/pagify-frame.html`);
            expect(postMessage).toHaveBeenCalledTimes(1);
            const [message, targetOrigin] = postMessage.mock.calls[0];
            expect(targetOrigin).toBe(window.location.origin);
            expect(message).toMatchObject({
                type: 'PAGIFY_RENDER',
                page_size: 'Letter',
                isViewOnlySkipMakingPDF: true,
                beautifyListItems: false,
                baseUrl: document.baseURI
            });
            expect(message.html).toContain('<h1>Test</h1>');
        });

        test('uses a custom frameUrl', async () => {
            const { iframe } = await renderAndLoad(new PagifySDK(), { frameUrl: '/static/pagify/pagify-frame.html' });
            expect(iframe.src).toBe(`${window.location.origin}/static/pagify/pagify-frame.html`);
        });

        test('delivers the PDF Blob from its own iframe', async () => {
            const onPdfReady = jest.fn();
            const instance = new PagifySDK();
            const { iframe, instanceId } = await renderAndLoad(instance, { onPdfReady });
            const blob = new Blob(['%PDF-'], { type: 'application/pdf' });

            sendFromFrame(iframe.contentWindow, { type: 'PDF_READY', blob, iter: instanceId });

            expect(onPdfReady).toHaveBeenCalledWith('blob:mock-url', blob);
            expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
        });

        test('ignores messages that do not come from its iframe', async () => {
            const onPdfReady = jest.fn();
            const callback = jest.fn();
            const instance = new PagifySDK();
            const { iframe, instanceId } = await renderAndLoad(instance, { onPdfReady, callback });
            const blob = new Blob(['%PDF-']);

            // Another window
            sendFromFrame(window, { type: 'PDF_READY', blob, iter: instanceId });
            sendFromFrame(window, { type: 'renderpdf', iter: instanceId });
            // Right window, wrong origin
            window.dispatchEvent(new MessageEvent('message', {
                data: { type: 'PDF_READY', blob, iter: instanceId },
                source: iframe.contentWindow,
                origin: 'https://evil.example'
            }));

            expect(onPdfReady).not.toHaveBeenCalled();
            expect(callback).not.toHaveBeenCalled();
        });

        test('generatePDF resolves with the Blob without fetching a blob: URL', async () => {
            const instance = new PagifySDK();
            const fetchSpy = jest.fn();
            global.fetch = fetchSpy;
            const blob = new Blob(['%PDF-'], { type: 'application/pdf' });

            const promise = instance.generatePDF({ body_html: '<p>x</p>' });
            await flush();
            const iframe = document.querySelector('iframe[data-pagify-iframe="true"]');
            const postMessage = jest.spyOn(iframe.contentWindow, 'postMessage').mockImplementation();
            iframe.dispatchEvent(new Event('load'));
            sendFromFrame(iframe.contentWindow, { type: 'PDF_READY', blob, iter: postMessage.mock.calls[0][0].instanceId });

            await expect(promise).resolves.toBe(blob);
            expect(fetchSpy).not.toHaveBeenCalled();
            delete global.fetch;
        });
    });
});
