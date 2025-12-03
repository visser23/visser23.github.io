/**
 * Work Leave Planner - Storage Module
 * Handles localStorage persistence with validation
 */

const Storage = (function() {
    const STORAGE_KEY = 'workLeavePlanner_v1';

    // Default data structure
    const defaultData = {
        version: '1.1',
        settings: {
            leaveAllowance: 25,
            yearStartMonth: 0,
            region: 'england'
        },
        schoolHolidays: [],
        leaveDays: [],
        blockedDays: [],
        partnerLeaveDays: [],
        partnerName: '',
        lastModified: null
    };

    /**
     * Check if localStorage is available
     * @returns {boolean} True if localStorage is available
     */
    function isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Load data from localStorage
     * @returns {Object} Stored data or defaults
     */
    function load() {
        if (!isAvailable()) {
            console.warn('localStorage not available, using defaults');
            return { ...defaultData };
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                return { ...defaultData };
            }

            const data = JSON.parse(stored);
            
            // Validate and merge with defaults
            return {
                ...defaultData,
                ...data,
                settings: {
                    ...defaultData.settings,
                    ...(data.settings || {})
                }
            };
        } catch (e) {
            console.error('Error loading data:', e);
            return { ...defaultData };
        }
    }

    /**
     * Save data to localStorage
     * @param {Object} data - Data to save
     * @returns {boolean} True if save was successful
     */
    function save(data) {
        if (!isAvailable()) {
            console.warn('localStorage not available, cannot save');
            return false;
        }

        try {
            const toSave = {
                ...data,
                lastModified: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    }

    /**
     * Update specific settings
     * @param {Object} newSettings - Settings to update
     * @returns {boolean} True if save was successful
     */
    function updateSettings(newSettings) {
        const data = load();
        data.settings = {
            ...data.settings,
            ...newSettings
        };
        return save(data);
    }

    /**
     * Get a specific setting
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    function getSetting(key) {
        const data = load();
        return data.settings[key];
    }

    /**
     * Clear all stored data
     * @returns {boolean} True if clear was successful
     */
    function clear() {
        if (!isAvailable()) {
            return false;
        }

        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Error clearing data:', e);
            return false;
        }
    }

    /**
     * Export data as JSON string
     * @returns {string} JSON string of all data
     */
    function exportData() {
        const data = load();
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import data from JSON string
     * @param {string} jsonString - JSON string to import
     * @returns {boolean} True if import was successful
     */
    function importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Basic validation
            if (!data.version || !data.settings) {
                throw new Error('Invalid data format');
            }
            
            return save(data);
        } catch (e) {
            console.error('Error importing data:', e);
            return false;
        }
    }

    // Public API
    return {
        isAvailable,
        load,
        save,
        updateSettings,
        getSetting,
        clear,
        exportData,
        importData
    };
})();

