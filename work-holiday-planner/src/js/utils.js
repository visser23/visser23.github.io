/**
 * Work Leave Planner - Utility Functions
 * Date manipulation and helper functions
 */

const DateUtils = {
    /**
     * Get month names array
     * @returns {string[]} Array of month names
     */
    getMonthNames() {
        return [
            'January', 'February', 'March', 'April', 
            'May', 'June', 'July', 'August',
            'September', 'October', 'November', 'December'
        ];
    },

    /**
     * Get short month names array
     * @returns {string[]} Array of short month names
     */
    getMonthNamesShort() {
        return [
            'Jan', 'Feb', 'Mar', 'Apr', 
            'May', 'Jun', 'Jul', 'Aug',
            'Sep', 'Oct', 'Nov', 'Dec'
        ];
    },

    /**
     * Get weekday names starting from Monday
     * @returns {string[]} Array of weekday names
     */
    getWeekdayNames() {
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    },

    /**
     * Get the number of days in a given month
     * @param {number} year - Full year (e.g., 2025)
     * @param {number} month - Month index (0-11)
     * @returns {number} Number of days in the month
     */
    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    },

    /**
     * Get the day of week for the first day of a month (Monday = 0, Sunday = 6)
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @returns {number} Day of week (0 = Monday, 6 = Sunday)
     */
    getFirstDayOfMonth(year, month) {
        const day = new Date(year, month, 1).getDay();
        // Convert from Sunday = 0 to Monday = 0
        return day === 0 ? 6 : day - 1;
    },

    /**
     * Check if a date is a weekend (Saturday or Sunday)
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @param {number} day - Day of month (1-31)
     * @returns {boolean} True if weekend
     */
    isWeekend(year, month, day) {
        const dayOfWeek = new Date(year, month, day).getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
    },

    /**
     * Check if a date is today
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @param {number} day - Day of month (1-31)
     * @returns {boolean} True if today
     */
    isToday(year, month, day) {
        const today = new Date();
        return (
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day
        );
    },

    /**
     * Format a date to ISO string (YYYY-MM-DD)
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @param {number} day - Day of month (1-31)
     * @returns {string} ISO date string
     */
    toISODateString(year, month, day) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
    },

    /**
     * Parse an ISO date string to components
     * @param {string} dateString - ISO date string (YYYY-MM-DD)
     * @returns {{year: number, month: number, day: number}} Date components
     */
    parseISODateString(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return { year, month: month - 1, day };
    },

    /**
     * Get current year
     * @returns {number} Current full year
     */
    getCurrentYear() {
        return new Date().getFullYear();
    },

    /**
     * Get current month
     * @returns {number} Current month index (0-11)
     */
    getCurrentMonth() {
        return new Date().getMonth();
    },

    /**
     * Check if a year is a leap year
     * @param {number} year - Full year
     * @returns {boolean} True if leap year
     */
    isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    },

    /**
     * Get an array of years for navigation (current year +/- 2)
     * @returns {number[]} Array of years
     */
    getNavigableYears() {
        const currentYear = this.getCurrentYear();
        return [
            currentYear - 2,
            currentYear - 1,
            currentYear,
            currentYear + 1,
            currentYear + 2
        ];
    },

    /**
     * Format a date for display (e.g., "Monday, 21 July 2025")
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @param {number} day - Day of month (1-31)
     * @returns {string} Formatted date string
     */
    formatDateLong(year, month, day) {
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Format a date for short display (e.g., "21 Jul")
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @param {number} day - Day of month (1-31)
     * @returns {string} Formatted date string
     */
    formatDateShort(year, month, day) {
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short'
        });
    }
};

// Freeze the object to prevent modifications
Object.freeze(DateUtils);

