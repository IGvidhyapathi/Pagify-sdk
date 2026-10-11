// Test setup file

// Mock the dynamic imports
global.mockPagedJS = {
    Previewer: class MockPreviewer {
        async preview() {
            return { total: 1 };
        }
    }
};

global.mockHtml2pdf = {
    default: () => ({
        set: () => ({
            from: () => ({
                toPdf: () => ({
                    get: () => ({
                        then: (fn) => {
                            fn({
                                internal: {
                                    getNumberOfPages: () => 1
                                }
                            });
                            return {
                                outputPdf: () => ({
                                    then: (fn) => {
                                        fn(new Blob(['test'], { type: 'application/pdf' }));
                                        return {
                                            catch: () => {}
                                        };
                                    }
                                })
                            };
                        }
                    })
                })
            })
        })
    })
};

// Mock URL.createObjectURL / revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock dynamic imports
jest.mock('pagedjs', () => global.mockPagedJS);
jest.mock('html2pdf.js', () => global.mockHtml2pdf);
