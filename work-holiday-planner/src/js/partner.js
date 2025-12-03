/**
 * Partner Sharing Module
 * Handles URL-based stateless plan sharing between partners
 */
const Partner = (function() {
    'use strict';

    // Partner data state
    let partnerData = null;
    let isViewingPartner = false;

    /**
     * Compress and encode data for URL
     * @param {Object} data - Data to encode
     * @returns {string} URL-safe compressed string
     */
    function encodeData(data) {
        try {
            const json = JSON.stringify(data);
            // Use LZString's URI-safe encoding
            const compressed = LZString.compressToEncodedURIComponent(json);
            return compressed;
        } catch (e) {
            console.error('Failed to encode partner data:', e);
            return null;
        }
    }

    /**
     * Decode and decompress data from URL
     * @param {string} encoded - Encoded string from URL
     * @returns {Object|null} Decoded data or null if invalid
     */
    function decodeData(encoded) {
        try {
            const json = LZString.decompressFromEncodedURIComponent(encoded);
            if (!json) {
                console.warn('Failed to decompress partner data');
                return null;
            }
            const data = JSON.parse(json);
            return validatePartnerData(data) ? data : null;
        } catch (e) {
            console.error('Failed to decode partner data:', e);
            return null;
        }
    }

    /**
     * Validate partner data structure
     * @param {Object} data - Data to validate
     * @returns {boolean} True if valid
     */
    function validatePartnerData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.name || typeof data.name !== 'string') return false;
        if (!Array.isArray(data.leaveDays)) return false;
        // Validate date format for each entry
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const validDates = data.leaveDays.every(d => dateRegex.test(d));
        return validDates;
    }

    /**
     * Generate shareable URL with current plan data
     * @param {string} partnerName - Name to identify this partner's data
     * @param {Array} leaveDays - Array of ISO date strings for leave
     * @returns {string} Full shareable URL
     */
    function generateShareURL(partnerName, leaveDays) {
        const data = {
            name: partnerName,
            leaveDays: leaveDays,
            created: new Date().toISOString()
        };

        const encoded = encodeData(data);
        if (!encoded) return null;

        // Use hash fragment so data isn't sent to server
        const url = new URL(window.location.href);
        url.hash = '';
        url.search = '';
        return `${url.origin}${url.pathname}#partner=${encoded}`;
    }

    /**
     * Parse partner data from current URL
     * @returns {Object|null} Partner data or null if none
     */
    function parseFromURL() {
        const hash = window.location.hash;
        if (!hash || !hash.startsWith('#partner=')) {
            return null;
        }

        const encoded = hash.substring('#partner='.length);
        return decodeData(encoded);
    }

    /**
     * Load partner data from URL if present
     * @returns {Object|null} Partner data or null
     */
    function loadFromURL() {
        partnerData = parseFromURL();
        isViewingPartner = partnerData !== null;
        return partnerData;
    }

    /**
     * Get current partner data
     * @returns {Object|null} Partner data or null
     */
    function getPartnerData() {
        return partnerData;
    }

    /**
     * Check if viewing partner overlay
     * @returns {boolean} True if partner data is loaded
     */
    function hasPartnerData() {
        return isViewingPartner;
    }

    /**
     * Clear partner data and remove from URL
     */
    function clearPartnerData() {
        partnerData = null;
        isViewingPartner = false;
        // Remove hash from URL without page reload
        const url = new URL(window.location.href);
        url.hash = '';
        window.history.replaceState({}, document.title, url.pathname);
    }

    /**
     * Copy URL to clipboard
     * @param {string} url - URL to copy
     * @returns {Promise<boolean>} Success status
     */
    async function copyToClipboard(url) {
        try {
            await navigator.clipboard.writeText(url);
            return true;
        } catch (e) {
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (e2) {
                console.error('Failed to copy to clipboard:', e2);
                return false;
            }
        }
    }

    // Public API
    return {
        encodeData,
        decodeData,
        generateShareURL,
        parseFromURL,
        loadFromURL,
        getPartnerData,
        hasPartnerData,
        clearPartnerData,
        copyToClipboard
    };
})();

