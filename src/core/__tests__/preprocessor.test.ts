/**
 * Tests for HTML preprocessor
 */

import { describe, it, expect } from 'vitest';
import {
    stripHtml,
    preprocess,
    preprocessWithDetails,
    resolveHtmlStripOptions,
} from '../preprocessor.js';
import type { HtmlStripOptions, PreprocessingConfig } from '../types.js';

describe('resolveHtmlStripOptions', () => {
    it('returns null for undefined', () => {
        expect(resolveHtmlStripOptions(undefined)).toBeNull();
    });

    it('returns null for false', () => {
        expect(resolveHtmlStripOptions(false)).toBeNull();
    });

    it('returns default options for true', () => {
        const result = resolveHtmlStripOptions(true);
        expect(result).toEqual({
            extractText: true,
            preserveStructure: false,
            removeSelectors: [],
            maxLength: undefined,
        });
    });

    it('merges provided options with defaults', () => {
        const options: HtmlStripOptions = {
            preserveStructure: true,
            maxLength: 1000,
        };
        const result = resolveHtmlStripOptions(options);
        expect(result).toEqual({
            extractText: true,
            preserveStructure: true,
            removeSelectors: [],
            maxLength: 1000,
        });
    });

    it('respects all provided options', () => {
        const options: HtmlStripOptions = {
            extractText: false,
            preserveStructure: true,
            removeSelectors: ['.ad', '#sidebar'],
            maxLength: 500,
        };
        const result = resolveHtmlStripOptions(options);
        expect(result).toEqual(options);
    });
});

describe('stripHtml', () => {
    describe('basic text extraction', () => {
        it('returns plain text unchanged', () => {
            const input = 'Hello, World!';
            const result = stripHtml(input, { extractText: true });
            expect(result).toBe('Hello, World!');
        });

        it('strips simple HTML tags', () => {
            const input = '<p>Hello, <strong>World</strong>!</p>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toBe('Hello, World!');
        });

        it('strips nested HTML tags', () => {
            const input = '<div><p>Paragraph <span>with <em>nested</em> tags</span></p></div>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Paragraph');
            expect(result).toContain('nested');
            expect(result).toContain('tags');
        });

        it('removes script tags and their content', () => {
            const input = '<p>Text</p><script>var x = "dangerous";</script><p>More text</p>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Text');
            expect(result).toContain('More text');
            expect(result).not.toContain('dangerous');
            expect(result).not.toContain('var');
        });

        it('removes style tags and their content', () => {
            const input = '<style>.class { color: red; }</style><p>Visible text</p>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Visible text');
            expect(result).not.toContain('color');
            expect(result).not.toContain('.class');
        });

        it('removes nav elements', () => {
            const input = '<nav><a href="/">Home</a><a href="/about">About</a></nav><main>Content</main>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Content');
            expect(result).not.toContain('Home');
            expect(result).not.toContain('About');
        });

        it('removes footer elements', () => {
            const input = '<main>Content</main><footer>© 2024 Company</footer>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Content');
            expect(result).not.toContain('© 2024');
        });

        it('removes aside elements', () => {
            const input = '<article>Main content</article><aside>Sidebar content</aside>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Main content');
            expect(result).not.toContain('Sidebar');
        });

        it('removes header elements', () => {
            const input = '<header><h1>Site Title</h1></header><main>Page content</main>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Page content');
            expect(result).not.toContain('Site Title');
        });
    });

    describe('preserveStructure option', () => {
        it('converts h1 to markdown heading', () => {
            const input = '<h1>Main Title</h1>';
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toBe('# Main Title');
        });

        it('converts h2-h6 to appropriate markdown headings', () => {
            const input = '<h2>Subtitle</h2><h3>Section</h3><h4>Subsection</h4>';
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toContain('## Subtitle');
            expect(result).toContain('### Section');
            expect(result).toContain('#### Subsection');
        });

        it('converts unordered lists to markdown', () => {
            const input = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toContain('- Item 1');
            expect(result).toContain('- Item 2');
            expect(result).toContain('- Item 3');
        });

        it('converts ordered lists to markdown', () => {
            const input = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toContain('1. First');
            expect(result).toContain('1. Second');
            expect(result).toContain('1. Third');
        });

        it('converts blockquotes to markdown', () => {
            const input = '<blockquote>A famous quote</blockquote>';
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toContain('> A famous quote');
        });

        it('preserves paragraph text', () => {
            const input = '<p>First paragraph</p><p>Second paragraph</p>';
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toContain('First paragraph');
            expect(result).toContain('Second paragraph');
        });

        it('handles complex document structure', () => {
            const input = `
                <article>
                    <h1>Article Title</h1>
                    <p>Introduction paragraph.</p>
                    <h2>Section One</h2>
                    <p>Section content.</p>
                    <ul>
                        <li>Point A</li>
                        <li>Point B</li>
                    </ul>
                </article>
            `;
            const result = stripHtml(input, { preserveStructure: true });
            expect(result).toContain('# Article Title');
            expect(result).toContain('Introduction paragraph');
            expect(result).toContain('## Section One');
            expect(result).toContain('- Point A');
            expect(result).toContain('- Point B');
        });
    });

    describe('removeSelectors option', () => {
        it('removes elements matching custom class selectors', () => {
            const input = '<div class="content">Good</div><div class="advertisement">Bad</div>';
            const result = stripHtml(input, { 
                extractText: true,
                removeSelectors: ['.advertisement'],
            });
            expect(result).toContain('Good');
            expect(result).not.toContain('Bad');
        });

        it('removes elements matching custom id selectors', () => {
            const input = '<div id="main">Content</div><div id="cookie-banner">Accept cookies</div>';
            const result = stripHtml(input, { 
                extractText: true,
                removeSelectors: ['#cookie-banner'],
            });
            expect(result).toContain('Content');
            expect(result).not.toContain('Accept cookies');
        });

        it('removes multiple custom selectors', () => {
            const input = `
                <div class="content">Main content</div>
                <div class="ad-wrapper">Ad 1</div>
                <div id="subscribe-modal">Subscribe!</div>
                <div class="popup">Popup content</div>
            `;
            const result = stripHtml(input, { 
                extractText: true,
                removeSelectors: ['.ad-wrapper', '#subscribe-modal', '.popup'],
            });
            expect(result).toContain('Main content');
            expect(result).not.toContain('Ad 1');
            expect(result).not.toContain('Subscribe!');
            expect(result).not.toContain('Popup content');
        });
    });

    describe('maxLength option', () => {
        it('does not truncate short content', () => {
            const input = '<p>Short text</p>';
            const result = stripHtml(input, { extractText: true, maxLength: 100 });
            expect(result).toBe('Short text');
        });

        it('truncates long content at word boundary', () => {
            const input = '<p>This is a very long piece of text that should be truncated</p>';
            const result = stripHtml(input, { extractText: true, maxLength: 30 });
            expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
            expect(result).toContain('...');
        });

        it('truncates plain text with maxLength', () => {
            const longText = 'A'.repeat(200);
            const result = stripHtml(longText, { extractText: true, maxLength: 100 });
            expect(result.length).toBeLessThanOrEqual(103); // 100 + '...'
        });
    });

    describe('real-world HTML scenarios', () => {
        it('handles a typical web page structure', () => {
            const input = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Page Title</title>
                    <script>console.log('tracking');</script>
                    <style>body { font-size: 16px; }</style>
                </head>
                <body>
                    <header>
                        <nav>
                            <a href="/">Home</a>
                            <a href="/about">About</a>
                        </nav>
                    </header>
                    <main>
                        <article>
                            <h1>Article Title</h1>
                            <p>This is the main content of the article.</p>
                            <p>It contains important information.</p>
                        </article>
                    </main>
                    <aside>
                        <div class="ad-banner">Advertisement</div>
                    </aside>
                    <footer>
                        <p>© 2024 Company Name</p>
                    </footer>
                </body>
                </html>
            `;
            const result = stripHtml(input, { extractText: true });
            
            // Should contain main content
            expect(result).toContain('Article Title');
            expect(result).toContain('main content');
            expect(result).toContain('important information');
            
            // Should not contain noise
            expect(result).not.toContain('tracking');
            expect(result).not.toContain('font-size');
            expect(result).not.toContain('Home');
            expect(result).not.toContain('About');
            expect(result).not.toContain('© 2024');
        });

        it('handles HTML with entities', () => {
            const input = '<p>Price: &dollar;100 &amp; discount: 10&percnt;</p>';
            const result = stripHtml(input, { extractText: true });
            // node-html-parser preserves some entities
            expect(result).toContain('100');
            expect(result).toContain('discount');
        });

        it('handles malformed HTML gracefully', () => {
            const input = '<p>Unclosed paragraph<div>Mixed <span>tags</p></div>';
            const result = stripHtml(input, { extractText: true });
            expect(result).toContain('Unclosed paragraph');
            expect(result).toContain('Mixed');
            expect(result).toContain('tags');
        });
    });
});

describe('preprocess', () => {
    it('returns input unchanged when no preprocessing configured', () => {
        const input = '<p>Hello</p>';
        const config: PreprocessingConfig = {};
        const result = preprocess(input, config);
        expect(result).toBe(input);
    });

    it('strips HTML when stripHtml is true', () => {
        const input = '<p>Hello, <strong>World</strong>!</p>';
        const config: PreprocessingConfig = { stripHtml: true };
        const result = preprocess(input, config);
        expect(result).toBe('Hello, World!');
    });

    it('strips HTML with custom options', () => {
        const input = '<h1>Title</h1><p>Content</p>';
        const config: PreprocessingConfig = {
            stripHtml: {
                preserveStructure: true,
            },
        };
        const result = preprocess(input, config);
        expect(result).toContain('# Title');
    });
});

describe('preprocessWithDetails', () => {
    it('returns unprocessed result when no config', () => {
        const input = '<p>Hello</p>';
        const result = preprocessWithDetails(input, undefined);
        expect(result).toEqual({
            text: input,
            wasProcessed: false,
            originalLength: input.length,
            processedLength: input.length,
        });
    });

    it('returns unprocessed result when config is empty', () => {
        const input = '<p>Hello</p>';
        const result = preprocessWithDetails(input, {});
        expect(result).toEqual({
            text: input,
            wasProcessed: false,
            originalLength: input.length,
            processedLength: input.length,
        });
    });

    it('returns processed result with correct metadata', () => {
        const input = '<p>Hello, <strong>World</strong>!</p>';
        const result = preprocessWithDetails(input, { stripHtml: true });
        expect(result.text).toBe('Hello, World!');
        expect(result.wasProcessed).toBe(true);
        expect(result.originalLength).toBe(input.length);
        expect(result.processedLength).toBe('Hello, World!'.length);
    });

    it('sets wasProcessed to false when content unchanged', () => {
        const input = 'Plain text without HTML';
        const result = preprocessWithDetails(input, { stripHtml: true });
        expect(result.text).toBe(input);
        expect(result.wasProcessed).toBe(false);
    });
});
