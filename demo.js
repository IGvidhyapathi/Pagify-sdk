// Pagify SDK demo — loaded as an external file so the page works under script-src 'self'

// The iframe page shipped in dist/, next to the SDK build
const FRAME_URL = 'dist/pagify-frame.html';

// Global variables
let pagify = null;
let consoleMessages = [];
let isSDKReady = false;

// Initialize Pagify SDK after DOM and script loading
function initializePagifySDK() {
    try {
        // The UMD build exports the singleton instance as 'Pagify.default'
        if (window.Pagify && window.Pagify.default) {
            pagify = window.Pagify.default;
            console.log('✅ Using Pagify.default singleton instance');
        } else if (window.Pagify && typeof window.Pagify.render === 'function') {
            // Fallback: sometimes it might be directly on Pagify
            pagify = window.Pagify;
            console.log('✅ Using Pagify direct instance');
        } else {
            throw new Error('Pagify SDK not found. Expected window.Pagify.default');
        }
        
        // Verify the instance has the render method
        if (typeof pagify.render !== 'function') {
            throw new Error('Pagify instance does not have render method');
        }
        
        isSDKReady = true;
        console.log('✅ Pagify SDK initialized successfully');
        console.log('SDK instance type:', typeof pagify);
        console.log('Available methods:', Object.keys(pagify));
        updateStatus('Pagify SDK loaded and ready!', 'success');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Pagify SDK:', error);
        updateStatus(`SDK initialization failed: ${error.message}`, 'error');
        return false;
    }
}

// Override console methods to capture output
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

function logToConsole(type, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    consoleMessages.push(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    
    // Update console tab
    const consoleElement = document.getElementById('consoleLog');
    if (consoleElement) {
        consoleElement.textContent = consoleMessages.join('\n');
    }
    
    // Call original console method
    originalConsole[type](...args);
}

console.log = (...args) => logToConsole('log', ...args);
console.error = (...args) => logToConsole('error', ...args);
console.warn = (...args) => logToConsole('warn', ...args);
console.info = (...args) => logToConsole('info', ...args);

function showTab(tabName, tabButton) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Add active class to clicked tab
    tabButton.classList.add('active');
}

function getFormData() {
    return {
        body_html: document.getElementById('bodyHtml').value.trim(),
        header_html: document.getElementById('headerHtml').value.trim(),
        footer_html: document.getElementById('footerHtml').value.trim(),
        head_html: document.getElementById('headHtml').value.trim(),
        page_size: document.getElementById('pageSize').value,
        margin_left: document.getElementById('marginLeft').value,
        margin_right: document.getElementById('marginRight').value,
        header_height: document.getElementById('headerHeight').value,
        footer_height: document.getElementById('footerHeight').value,
        page_padding_top: document.getElementById('pagePaddingTop').value,
        page_number_selector: document.getElementById('pageNumberSelector').value,
        footer_only_on_last_page: document.getElementById('footerOnlyOnLastPage').checked,
        containerSelector: document.getElementById('containerSelector').value || null,
        frameUrl: FRAME_URL
    };
}

function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
    
    console.info('Status:', message);
}

function updateConfigPreview() {
    const config = getFormData();
    const configElement = document.getElementById('configPreview');
    configElement.textContent = `// Pagify SDK Configuration
const config = ${JSON.stringify(config, null, 2)};

// Render call
pagify.render({
    ...config,
    callback: () => {
        console.log('Pagination complete!');
    },
    onPdfReady: (blobUrl, blob) => {
        console.log('PDF ready:', blobUrl, blob.size + ' bytes');
        // Download or display PDF
    },
    onPdfError: (error) => {
        console.error('PDF generation error:', error);
    }
});`;
}

async function renderPDF() {
    try {
        // Check if SDK is ready
        if (!isSDKReady || !pagify) {
            updateStatus('Initializing Pagify SDK...', 'info');
            const initialized = initializePagifySDK();
            if (!initialized) {
                throw new Error('Failed to initialize Pagify SDK');
            }
        }
        
        updateStatus('Preparing to render...', 'info');
        
        const config = getFormData();
        updateConfigPreview();
        
        // Clear previous content
        const container = document.querySelector(config.containerSelector || '#preview-container');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Rendering...</div>';
        }
        
        console.log('Starting PDF render with config:', config);
        updateStatus('Rendering PDF with Pagify SDK...', 'info');
        
        // Call Pagify render
        await pagify.render({
            ...config,
            callback: () => {
                console.log('✅ Pagination completed successfully!');
                updateStatus('Pagination completed! Check the preview above.', 'success');
            },
            onPdfReady: (blobUrl, blob) => {
                console.log('✅ PDF ready! Blob URL:', blobUrl, `(${Math.round(blob.size / 1024)} KB)`);
                updateStatus('PDF generated successfully! Check console for blob URL.', 'success');
                
                // Create download link
                const downloadLink = document.createElement('a');
                downloadLink.href = blobUrl;
                downloadLink.download = 'pagify-demo.pdf';
                downloadLink.textContent = '📥 Download PDF';
                downloadLink.style.cssText = 'display: inline-block; margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; text-decoration: none; border-radius: 4px;';
                
                const statusElement = document.getElementById('status');
                statusElement.appendChild(document.createElement('br'));
                statusElement.appendChild(downloadLink);
            },
            onPdfError: (error) => {
                console.error('❌ PDF generation error:', error);
                updateStatus(`PDF generation failed: ${error}`, 'error');
            }
        });
        
    } catch (error) {
        console.error('❌ Render error:', error);
        updateStatus(`Render failed: ${error.message}`, 'error');
    }
}

function clearPreview() {
    const container = document.querySelector('#preview-container');
    if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">Click "Render PDF" to see the paginated preview here</div>';
    }
    
    document.getElementById('status').style.display = 'none';
    consoleMessages = [];
    document.getElementById('consoleLog').textContent = '// Console output will appear here';
    
    console.log('🧹 Preview cleared');
}

function loadSample() {
    // Load sample data with more interesting content
    document.getElementById('bodyHtml').value = `<div style="padding: 20px;">
    <h1 style="color: #667eea; text-align: center;">Annual Report 2025</h1>
    
    <section>
<h2>Executive Summary</h2>
<p>This annual report demonstrates the powerful pagination capabilities of Pagify SDK. The document automatically flows across multiple pages while maintaining proper formatting and styling.</p>

<div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
    <strong>Key Highlights:</strong>
    <ul>
        <li>📈 Revenue growth of 150%</li>
        <li>🚀 New product launches</li>
        <li>🌍 Global expansion</li>
        <li>💡 Innovation in PDF generation</li>
    </ul>
</div>
    </section>
    
    <div style="page-break-after: always;"></div>
    
    <section>
<h2>Financial Overview</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
        <tr style="background: #667eea; color: white;">
            <th style="padding: 10px; border: 1px solid #ddd;">Quarter</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Revenue</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Growth</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Q1 2025</td>
            <td style="padding: 10px; border: 1px solid #ddd;">$1.2M</td>
            <td style="padding: 10px; border: 1px solid #ddd;">+25%</td>
        </tr>
        <tr style="background: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #ddd;">Q2 2025</td>
            <td style="padding: 10px; border: 1px solid #ddd;">$1.5M</td>
            <td style="padding: 10px; border: 1px solid #ddd;">+30%</td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Q3 2025</td>
            <td style="padding: 10px; border: 1px solid #ddd;">$1.8M</td>
            <td style="padding: 10px; border: 1px solid #ddd;">+35%</td>
        </tr>
    </tbody>
</table>
    </section>
    
    <div style="page-break-after: always;"></div>
    
    <section>
<h2>Future Outlook</h2>
<p>Looking ahead to 2026, we anticipate continued growth driven by:</p>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #1976d2;">Technology</h3>
        <p>Advanced PDF rendering with improved performance and new features.</p>
    </div>
    <div style="background: #f3e5f5; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #7b1fa2;">Market Expansion</h3>
        <p>Reaching new markets and customer segments worldwide.</p>
    </div>
</div>

<p style="text-align: center; font-style: italic; margin-top: 40px;">
    "Innovation in document generation is our passion" - Pagify Team
</p>
    </section>
</div>`;

    document.getElementById('headerHtml').value = `<div style="text-align: center; font-weight: bold; color: #667eea; padding: 10px; border-bottom: 2px solid #667eea;">
    📊 Annual Report 2025 | Pagify SDK Demo
</div>`;

    document.getElementById('footerHtml').value = `<div style="text-align: center; font-size: 12px; color: #666; padding: 10px; border-top: 1px solid #ddd;">
    <span class="page-number"></span> | Confidential | © 2025 Pagify SDK
</div>`;

    document.getElementById('headHtml').value = `<style>
    body { 
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
line-height: 1.6; 
color: #333;
    }
    h1, h2, h3 { 
color: #667eea; 
margin-bottom: 15px;
    }
    h1 { font-size: 2.5em; }
    h2 { font-size: 1.8em; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
    h3 { font-size: 1.3em; }
    .page-number::before { 
content: "Page " counter(page) " of " counter(pages); 
    }
    section {
margin-bottom: 30px;
    }
    @media print {
body { margin: 0; }
    }
</style>`;

    updateStatus('Sample content loaded! Click "Render PDF" to see the result.', 'info');
    console.log('📝 Sample content loaded');
}

// Initialize with config preview
document.addEventListener('DOMContentLoaded', function() {
    updateConfigPreview();
    
    // Try to initialize SDK immediately
    setTimeout(() => {
        const initialized = initializePagifySDK();
        if (!initialized) {
            updateStatus('SDK initialization failed. Please check the console.', 'error');
        } else if (window.location.protocol === 'file:') {
            updateStatus('Open this demo through a local server, not as a file: run "npm run build" and "python3 -m http.server 8080", then open http://localhost:8080/', 'error');
        }
    }, 100);
    
    console.log('🚀 Pagify SDK Demo page loaded');
});

// Also try to initialize when window loads (fallback)
window.addEventListener('load', function() {
    if (!isSDKReady) {
        console.log('Retrying SDK initialization on window load...');
        initializePagifySDK();
    }
});

// Update config preview when form changes
document.getElementById('pagifyForm').addEventListener('input', updateConfigPreview);
document.getElementById('pagifyForm').addEventListener('change', updateConfigPreview);

// Buttons (wired here instead of onclick= attributes, which script-src 'self' blocks)
document.getElementById('renderBtn').addEventListener('click', renderPDF);
document.getElementById('clearBtn').addEventListener('click', clearPreview);
document.getElementById('sampleBtn').addEventListener('click', loadSample);
document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab, tab));
});
