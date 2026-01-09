/**
 * HTML preprocessing module
 * Strips HTML tags and noise from input text before extraction
 */

import { parse, HTMLElement } from 'node-html-parser';
import type { HtmlStripOptions, PreprocessingConfig } from './types.js';

/**
 * Default selectors to remove from HTML
 * These typically contain non-content elements
 */
const DEFAULT_REMOVE_SELECTORS = [
    'script',
    'style',
    'nav',
    'footer',
    'header',
    'aside',
    'noscript',
    'iframe',
    'svg',
    'canvas',
    'form',
    // Common ad and tracking selectors
    '[class*="ad-"]',
    '[class*="advertisement"]',
    '[class*="cookie"]',
    '[class*="subscribe"]',
    '[class*="newsletter"]',
    '[class*="popup"]',
    '[class*="modal"]',
    '[class*="banner"]',
    '[id*="ad-"]',
    '[id*="advertisement"]',
    '[id*="cookie"]',
];

/**
 * Elements that should preserve their semantic meaning
 * when preserveStructure is enabled
 */
const SEMANTIC_ELEMENTS = {
    headings: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    lists: ['ul', 'ol', 'li'],
    containers: ['article', 'main', 'section', 'div', 'body', 'html'],
    blocks: ['p', 'blockquote'],
    inline: ['strong', 'b', 'em', 'i', 'a', 'code'],
};

/**
 * Resolves preprocessing options to concrete HtmlStripOptions
 */
export function resolveHtmlStripOptions(
    config: boolean | HtmlStripOptions | undefined
): HtmlStripOptions | null {
    if (!config) {
        return null;
    }

    if (config === true) {
        // Default options when stripHtml: true
        return {
            extractText: true,
            preserveStructure: false,
            removeSelectors: [],
            maxLength: undefined,
        };
    }

    return {
        extractText: config.extractText ?? true,
        preserveStructure: config.preserveStructure ?? false,
        removeSelectors: config.removeSelectors ?? [],
        maxLength: config.maxLength,
    };
}

/**
 * Removes elements matching the specified selectors
 */
function removeElements(root: HTMLElement, selectors: string[]): void {
    const allSelectors = [...DEFAULT_REMOVE_SELECTORS, ...selectors];
    
    for (const selector of allSelectors) {
        try {
            const elements = root.querySelectorAll(selector);
            for (const el of elements) {
                el.remove();
            }
        } catch {
            // Invalid selector, skip silently
            // This can happen with complex CSS selectors not supported by node-html-parser
        }
    }
}

/**
 * Converts semantic HTML elements to markdown-like text
 */
function convertToStructuredText(root: HTMLElement): string {
    const lines: string[] = [];
    
    function processNode(node: HTMLElement | null, depth: number = 0): void {
        if (!node) return;
        
        const tagName = node.tagName?.toLowerCase() || '';
        
        // Handle headings
        if (SEMANTIC_ELEMENTS.headings.includes(tagName)) {
            const level = parseInt(tagName[1], 10);
            const prefix = '#'.repeat(level) + ' ';
            const text = node.text.trim();
            if (text) {
                lines.push('');
                lines.push(prefix + text);
                lines.push('');
            }
            return;
        }
        
        // Handle list items
        if (tagName === 'li') {
            const parent = node.parentNode as HTMLElement | null;
            const parentTag = parent?.tagName?.toLowerCase();
            const prefix = parentTag === 'ol' ? '1. ' : '- ';
            const text = node.text.trim();
            if (text) {
                lines.push(prefix + text);
            }
            return;
        }
        
        // Handle lists container
        if (tagName === 'ul' || tagName === 'ol') {
            lines.push('');
            for (const child of node.childNodes) {
                if (child instanceof HTMLElement) {
                    processNode(child, depth + 1);
                }
            }
            lines.push('');
            return;
        }
        
        // Handle blockquotes
        if (tagName === 'blockquote') {
            const text = node.text.trim();
            if (text) {
                lines.push('');
                lines.push('> ' + text.replace(/\n/g, '\n> '));
                lines.push('');
            }
            return;
        }
        
        // Handle code blocks
        if (tagName === 'pre' || tagName === 'code') {
            const text = node.text.trim();
            if (text) {
                lines.push('');
                lines.push('```');
                lines.push(text);
                lines.push('```');
                lines.push('');
            }
            return;
        }
        
        // Handle paragraphs and other block elements
        if (SEMANTIC_ELEMENTS.blocks.includes(tagName)) {
            const text = node.text.trim();
            if (text) {
                lines.push('');
                lines.push(text);
                lines.push('');
            }
            return;
        }
        
        // Handle container elements - recurse into children
        if (SEMANTIC_ELEMENTS.containers.includes(tagName) || !tagName) {
            for (const child of node.childNodes) {
                if (child instanceof HTMLElement) {
                    processNode(child, depth);
                } else if (child.nodeType === 3) {
                    // Text node
                    const text = child.text.trim();
                    if (text) {
                        lines.push(text);
                    }
                }
            }
            return;
        }
        
        // Recursively process children for any other elements
        for (const child of node.childNodes) {
            if (child instanceof HTMLElement) {
                processNode(child, depth);
            } else if (child.nodeType === 3) {
                // Text node
                const text = child.text.trim();
                if (text) {
                    lines.push(text);
                }
            }
        }
    }
    
    processNode(root);
    
    // Clean up multiple blank lines
    return lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Extracts plain text from HTML, preserving meaningful whitespace
 */
function extractPlainText(root: HTMLElement): string {
    // Get raw text
    let text = root.text;
    
    // Clean up whitespace while preserving paragraph breaks
    text = text
        // Replace multiple spaces with single space
        .replace(/[ \t]+/g, ' ')
        // Replace multiple newlines with double newline (paragraph break)
        .replace(/\n\s*\n/g, '\n\n')
        // Remove leading/trailing whitespace from each line
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        // Remove more than two consecutive newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    return text;
}

/**
 * Strips HTML from input text according to options
 */
export function stripHtml(input: string, options: HtmlStripOptions): string {
    // Quick check: if no HTML-like content, return as-is
    if (!input.includes('<') || !input.includes('>')) {
        return options.maxLength ? input.slice(0, options.maxLength) : input;
    }
    
    // Parse HTML
    const root = parse(input, {
        lowerCaseTagName: true,
        comment: false, // Remove comments
        blockTextElements: {
            script: true,
            noscript: true,
            style: true,
            pre: true,
        },
    });
    
    // Remove unwanted elements
    removeElements(root, options.removeSelectors || []);
    
    // Extract text based on options
    let result: string;
    
    if (options.preserveStructure) {
        result = convertToStructuredText(root);
    } else {
        result = extractPlainText(root);
    }
    
    // Apply max length if specified
    if (options.maxLength && result.length > options.maxLength) {
        result = result.slice(0, options.maxLength);
        // Try to break at a word boundary
        const lastSpace = result.lastIndexOf(' ');
        if (lastSpace > options.maxLength * 0.8) {
            result = result.slice(0, lastSpace) + '...';
        } else {
            result += '...';
        }
    }
    
    return result;
}

/**
 * Preprocesses input text according to configuration
 */
export function preprocess(input: string, config: PreprocessingConfig): string {
    let result = input;
    
    // Handle HTML stripping
    if (config.stripHtml) {
        const options = resolveHtmlStripOptions(config.stripHtml);
        if (options) {
            result = stripHtml(result, options);
        }
    }
    
    return result;
}

/**
 * Result of preprocessing
 */
export interface PreprocessResult {
    /** The preprocessed text */
    text: string;
    /** Whether preprocessing was applied */
    wasProcessed: boolean;
    /** Original input length */
    originalLength: number;
    /** Processed text length */
    processedLength: number;
}

/**
 * Preprocesses input with detailed result information
 */
export function preprocessWithDetails(
    input: string,
    config: PreprocessingConfig | undefined
): PreprocessResult {
    if (!config || (!config.stripHtml)) {
        return {
            text: input,
            wasProcessed: false,
            originalLength: input.length,
            processedLength: input.length,
        };
    }
    
    const processed = preprocess(input, config);
    
    return {
        text: processed,
        wasProcessed: processed !== input,
        originalLength: input.length,
        processedLength: processed.length,
    };
}
