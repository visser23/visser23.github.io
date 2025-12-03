/**
 * School Holiday Patterns Module
 * Algorithmically generates typical UK school holiday dates
 * 
 * Note: These are estimates based on common patterns. Actual dates
 * vary by Local Authority and should be verified with your school.
 */
const SchoolHolidayPatterns = (function() {
    'use strict';

    /**
     * Get the Nth occurrence of a weekday in a month
     * @param {number} year - Full year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Day of week (0=Sun, 1=Mon, etc.)
     * @param {number} n - Which occurrence (1=first, 2=second, etc.)
     * @returns {Date} The date
     */
    function getNthWeekdayOfMonth(year, month, weekday, n) {
        const firstDay = new Date(year, month, 1);
        let dayOffset = weekday - firstDay.getDay();
        if (dayOffset < 0) dayOffset += 7;
        const firstOccurrence = 1 + dayOffset;
        const nthOccurrence = firstOccurrence + (n - 1) * 7;
        return new Date(year, month, nthOccurrence);
    }

    /**
     * Get the last occurrence of a weekday in a month
     * @param {number} year - Full year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Day of week (0=Sun, 1=Mon, etc.)
     * @returns {Date} The date
     */
    function getLastWeekdayOfMonth(year, month, weekday) {
        const lastDay = new Date(year, month + 1, 0);
        let dayOffset = lastDay.getDay() - weekday;
        if (dayOffset < 0) dayOffset += 7;
        return new Date(year, month + 1, -dayOffset);
    }

    /**
     * Calculate Easter Sunday using Meeus/Jones/Butcher algorithm
     * @param {number} year - Full year
     * @returns {Date} Easter Sunday date
     */
    function calculateEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    /**
     * Add days to a date
     * @param {Date} date - Starting date
     * @param {number} days - Days to add (can be negative)
     * @returns {Date} New date
     */
    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Get the Monday of the week containing a date
     * @param {Date} date - Any date
     * @returns {Date} Monday of that week
     */
    function getMondayOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    /**
     * Get the Monday of a specific ISO week number
     * @param {number} year - Year
     * @param {number} week - Week number (1-52)
     * @returns {Date} Monday of that week
     */
    function getWeekStart(year, week) {
        const jan4 = new Date(year, 0, 4);
        const jan4Monday = getMondayOfWeek(jan4);
        return addDays(jan4Monday, (week - 1) * 7);
    }

    /**
     * Adjust date to nearest weekday (for term start/end)
     * @param {Date} date - Date to adjust
     * @param {string} direction - 'forward' or 'backward'
     * @returns {Date} Adjusted date
     */
    function adjustToWeekday(date, direction = 'forward') {
        const d = new Date(date);
        const day = d.getDay();
        if (day === 0) { // Sunday
            d.setDate(d.getDate() + (direction === 'forward' ? 1 : -2));
        } else if (day === 6) { // Saturday
            d.setDate(d.getDate() + (direction === 'forward' ? 2 : -1));
        }
        return d;
    }

    /**
     * Generate all dates in a range (inclusive)
     * @param {Date} start - Start date
     * @param {Date} end - End date
     * @returns {Array<string>} Array of ISO date strings
     */
    function getDateRange(start, end) {
        const dates = [];
        const current = new Date(start);
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    /**
     * Generate school holidays for an academic year
     * @param {number} academicYear - Starting year (e.g., 2025 for 2025/26)
     * @param {string} region - 'england', 'scotland', or 'northern-ireland'
     * @returns {Object} Holiday periods with dates
     */
    function generateHolidays(academicYear, region = 'england') {
        const holidays = [];
        const year1 = academicYear;      // Sept-Dec
        const year2 = academicYear + 1;  // Jan-Aug

        // Regional adjustments
        const isScotland = region === 'scotland';

        // ============================================
        // 1. OCTOBER HALF-TERM
        // ============================================
        // England/Wales/NI: Week containing last Monday of October
        // Scotland: Usually 2nd week of October (different pattern)
        let octHalfStart, octHalfEnd;
        
        if (isScotland) {
            // Scotland: Usually mid-October, around 2nd Monday
            octHalfStart = getNthWeekdayOfMonth(year1, 9, 1, 2); // 2nd Monday of Oct
        } else {
            // England/Wales/NI: Last Monday of October
            octHalfStart = getLastWeekdayOfMonth(year1, 9, 1); // Last Monday of Oct
        }
        octHalfEnd = addDays(octHalfStart, 4); // Mon-Fri

        holidays.push({
            name: 'October Half-Term',
            start: octHalfStart,
            end: octHalfEnd,
            dates: getDateRange(octHalfStart, octHalfEnd)
        });

        // ============================================
        // 2. CHRISTMAS HOLIDAYS
        // ============================================
        // Typically: ~Dec 20 to ~Jan 3
        // Adjust to end on a Friday and start on a Monday
        let xmasStart = new Date(year1, 11, 20); // Dec 20
        let xmasEnd = new Date(year2, 0, 3);     // Jan 3

        // Find the Friday before/on Dec 20 for term end (so holiday starts Saturday)
        // Actually, we want school holidays to be the days OFF
        // Term typically ends Fri Dec 20ish, holidays start Sat Dec 21
        // For simplicity, include the full fortnight
        xmasStart = adjustToWeekday(new Date(year1, 11, 21), 'backward');
        if (xmasStart.getDay() !== 6) {
            // Find the Saturday
            const dayOfWeek = xmasStart.getDay();
            const daysToSat = (6 - dayOfWeek + 7) % 7;
            xmasStart = addDays(xmasStart, daysToSat - 7); // Go back to previous Sat
        }
        // Actually, simpler: Dec 23 to Jan 3 is typical
        xmasStart = new Date(year1, 11, 23);
        xmasEnd = new Date(year2, 0, 3);
        
        // Adjust end to nearest Sunday (return on Monday)
        while (xmasEnd.getDay() !== 0) {
            xmasEnd = addDays(xmasEnd, 1);
        }

        holidays.push({
            name: 'Christmas Holidays',
            start: xmasStart,
            end: xmasEnd,
            dates: getDateRange(xmasStart, xmasEnd)
        });

        // ============================================
        // 3. FEBRUARY HALF-TERM
        // ============================================
        // Scotland: Usually week 7 (mid-Feb)
        // England/Wales/NI: Usually week 8 (later Feb)
        const febWeek = isScotland ? 7 : 8;
        const febHalfStart = getWeekStart(year2, febWeek);
        const febHalfEnd = addDays(febHalfStart, 4);

        holidays.push({
            name: 'February Half-Term',
            start: febHalfStart,
            end: febHalfEnd,
            dates: getDateRange(febHalfStart, febHalfEnd)
        });

        // ============================================
        // 4. EASTER HOLIDAYS
        // ============================================
        // 2 weeks, anchored around Easter Sunday
        // Typically: Week before Easter + Easter week
        const easterSunday = calculateEaster(year2);
        const goodFriday = addDays(easterSunday, -2);
        
        // Easter holidays usually start the Saturday before Good Friday week
        // and end the Sunday after Easter (or the Friday)
        let easterStart = getMondayOfWeek(goodFriday);
        easterStart = addDays(easterStart, -2); // Saturday before
        let easterEnd = addDays(easterSunday, 7); // Sunday after Easter week
        
        // Actually common pattern: 2 weeks total
        // Start: Saturday before Palm Sunday week OR Mon of Holy Week
        // Let's use: Mon 9 days before Easter to Fri after Easter (2 weeks)
        easterStart = addDays(easterSunday, -13); // ~2 Saturdays before
        easterEnd = addDays(easterSunday, 7);     // Week after Easter Sun

        holidays.push({
            name: 'Easter Holidays',
            start: easterStart,
            end: easterEnd,
            dates: getDateRange(easterStart, easterEnd)
        });

        // ============================================
        // 5. MAY HALF-TERM
        // ============================================
        // Week containing the last Monday of May (Spring Bank Holiday)
        const lastMonMay = getLastWeekdayOfMonth(year2, 4, 1); // Last Mon of May
        const mayHalfStart = lastMonMay;
        const mayHalfEnd = addDays(lastMonMay, 4);

        holidays.push({
            name: 'May Half-Term',
            start: mayHalfStart,
            end: mayHalfEnd,
            dates: getDateRange(mayHalfStart, mayHalfEnd)
        });

        // ============================================
        // 6. SUMMER HOLIDAYS
        // ============================================
        // Scotland: Late June to mid-August (~7 weeks)
        // England/Wales/NI: Late July to early September (~6 weeks)
        let summerStart, summerEnd;

        if (isScotland) {
            // Scotland: ~Last week of June to ~mid August
            summerStart = new Date(year2, 5, 28); // June 28
            summerEnd = new Date(year2, 7, 15);   // Aug 15
        } else {
            // England/Wales/NI: ~July 20 to ~Sept 3
            summerStart = new Date(year2, 6, 20); // July 20
            summerEnd = new Date(year2, 8, 3);    // Sept 3
        }

        // Adjust to sensible boundaries
        summerStart = adjustToWeekday(summerStart, 'backward');
        // Summer ends when school starts, so end on Sunday before term
        while (summerEnd.getDay() !== 0) {
            summerEnd = addDays(summerEnd, 1);
        }

        holidays.push({
            name: 'Summer Holidays',
            start: summerStart,
            end: summerEnd,
            dates: getDateRange(summerStart, summerEnd)
        });

        return {
            academicYear: `${year1}/${year2.toString().slice(-2)}`,
            region: region,
            holidays: holidays,
            disclaimer: 'These dates are estimates based on typical UK school patterns. Actual dates vary by Local Authority. Please verify with your school or council.'
        };
    }

    /**
     * Get all holiday dates as a flat array
     * @param {Object} holidayData - Output from generateHolidays()
     * @returns {Array<string>} All ISO date strings
     */
    function getAllDates(holidayData) {
        return holidayData.holidays.flatMap(h => h.dates);
    }

    /**
     * Format a date for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted string e.g., "Mon 27 Oct"
     */
    function formatDate(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
    }

    /**
     * Format a date range for display
     * @param {Date} start - Start date
     * @param {Date} end - End date
     * @returns {string} Formatted range e.g., "Mon 27 Oct - Fri 31 Oct 2025"
     */
    function formatDateRange(start, end) {
        const startStr = formatDate(start);
        const endStr = formatDate(end);
        const year = end.getFullYear();
        return `${startStr} - ${endStr} ${year}`;
    }

    /**
     * Get available academic years (current and next 2)
     * @returns {Array<{value: number, label: string}>} Year options
     */
    function getAvailableYears() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Academic year starts in September
        // If we're Sept+, current academic year is this year
        // If before Sept, current academic year started last year
        const academicYearStart = currentMonth >= 8 ? currentYear : currentYear - 1;
        
        return [
            { value: academicYearStart, label: `${academicYearStart}/${(academicYearStart + 1).toString().slice(-2)}` },
            { value: academicYearStart + 1, label: `${academicYearStart + 1}/${(academicYearStart + 2).toString().slice(-2)}` },
            { value: academicYearStart + 2, label: `${academicYearStart + 2}/${(academicYearStart + 3).toString().slice(-2)}` }
        ];
    }

    /**
     * Get region display name
     * @param {string} region - Region code
     * @returns {string} Display name
     */
    function getRegionDisplayName(region) {
        const names = {
            'england': 'England & Wales',
            'scotland': 'Scotland',
            'northern-ireland': 'Northern Ireland'
        };
        return names[region] || region;
    }

    // Public API
    return {
        generateHolidays,
        getAllDates,
        formatDate,
        formatDateRange,
        getAvailableYears,
        getRegionDisplayName,
        calculateEaster
    };
})();

