/**
 * Work Leave Planner - Bank Holidays Module
 * Algorithmic calculation of UK Bank Holidays for all regions
 * 
 * Regions supported:
 * - england (England & Wales)
 * - scotland
 * - northern-ireland
 * 
 * Business rules implemented per UK Government guidance.
 * Ad-hoc holidays (coronations, jubilees, etc.) can be added in bankHolidaysAdHoc.json
 */

const BankHolidays = (function() {
    // Cache for calculated holidays (year-region -> holidays map)
    let cache = {};

    // Ad-hoc holidays loaded from config (set via loadAdHocHolidays)
    let adHocHolidays = {};

    /**
     * Region display names
     */
    const regionNames = {
        'england': 'England & Wales',
        'scotland': 'Scotland',
        'northern-ireland': 'Northern Ireland'
    };

    /**
     * Calculate Easter Sunday for a given year using the Anonymous Gregorian algorithm
     * (Meeus/Jones/Butcher algorithm)
     * @param {number} year - Full year
     * @returns {Date} Easter Sunday date
     */
    function calculateEasterSunday(year) {
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
        const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        
        return new Date(year, month, day);
    }

    /**
     * Get the substitute day when a holiday falls on a weekend
     * @param {Date} date - The original holiday date
     * @returns {Date} The substitute date (Monday after the weekend)
     */
    function getSubstituteDay(date) {
        const day = date.getDay();
        if (day === 6) { // Saturday -> Monday
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 2);
        } else if (day === 0) { // Sunday -> Monday
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        }
        return date; // Not a weekend
    }

    /**
     * Check if a date falls on a weekend
     * @param {Date} date - Date to check
     * @returns {boolean} True if Saturday or Sunday
     */
    function isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    }

    /**
     * Get the first occurrence of a specific weekday in a month
     * @param {number} year - Full year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Day of week (0=Sunday, 1=Monday, etc.)
     * @returns {Date} First occurrence of that weekday
     */
    function getFirstWeekdayOfMonth(year, month, weekday) {
        const first = new Date(year, month, 1);
        const firstDay = first.getDay();
        const diff = (weekday - firstDay + 7) % 7;
        return new Date(year, month, 1 + diff);
    }

    /**
     * Get the last occurrence of a specific weekday in a month
     * @param {number} year - Full year
     * @param {number} month - Month (0-11)
     * @param {number} weekday - Day of week (0=Sunday, 1=Monday, etc.)
     * @returns {Date} Last occurrence of that weekday
     */
    function getLastWeekdayOfMonth(year, month, weekday) {
        // Start from last day of month and work backwards
        const lastDay = new Date(year, month + 1, 0);
        const lastDayWeekday = lastDay.getDay();
        const diff = (lastDayWeekday - weekday + 7) % 7;
        return new Date(year, month + 1, -diff);
    }

    /**
     * Format a Date to ISO string (YYYY-MM-DD)
     * @param {Date} date - Date to format
     * @returns {string} ISO date string
     */
    function toISOString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Calculate Christmas and Boxing Day with proper substitute logic
     * @param {number} year - Full year
     * @returns {Array} Array of holiday objects
     */
    function calculateChristmasHolidays(year) {
        const christmas = new Date(year, 11, 25); // Dec 25
        const boxingDay = new Date(year, 11, 26); // Dec 26
        const christmasDay = christmas.getDay();
        
        const holidays = [];
        
        // Christmas Day rules
        if (christmasDay === 6) {
            // Saturday: Christmas substitute = Monday 27th
            holidays.push({
                date: toISOString(new Date(year, 11, 27)),
                name: 'Christmas Day (substitute)'
            });
        } else if (christmasDay === 0) {
            // Sunday: Christmas substitute = Tuesday 27th
            holidays.push({
                date: toISOString(new Date(year, 11, 27)),
                name: 'Christmas Day (substitute)'
            });
        } else {
            holidays.push({
                date: toISOString(christmas),
                name: 'Christmas Day'
            });
        }
        
        // Boxing Day rules
        if (christmasDay === 5) {
            // Christmas is Friday, Boxing Day is Saturday: substitute = Monday 28th
            holidays.push({
                date: toISOString(new Date(year, 11, 28)),
                name: 'Boxing Day (substitute)'
            });
        } else if (christmasDay === 6) {
            // Christmas is Saturday: Boxing Day substitute = Tuesday 28th
            holidays.push({
                date: toISOString(new Date(year, 11, 28)),
                name: 'Boxing Day (substitute)'
            });
        } else if (christmasDay === 0) {
            // Christmas is Sunday, Boxing Day is Monday: Boxing Day stays on Monday 26th
            holidays.push({
                date: toISOString(boxingDay),
                name: 'Boxing Day'
            });
        } else {
            holidays.push({
                date: toISOString(boxingDay),
                name: 'Boxing Day'
            });
        }
        
        return holidays;
    }

    /**
     * Calculate all bank holidays for a specific year and region
     * @param {number} year - Full year
     * @param {string} region - 'england', 'scotland', or 'northern-ireland'
     * @returns {Array} Array of holiday objects { date, name }
     */
    function calculateHolidays(year, region) {
        const holidays = [];
        
        // === NEW YEAR'S DAY (All regions) ===
        const newYear = new Date(year, 0, 1);
        const newYearSub = getSubstituteDay(newYear);
        if (isWeekend(newYear)) {
            holidays.push({
                date: toISOString(newYearSub),
                name: "New Year's Day (substitute)"
            });
        } else {
            holidays.push({
                date: toISOString(newYear),
                name: "New Year's Day"
            });
        }
        
        // === 2ND JANUARY (Scotland only) ===
        if (region === 'scotland') {
            const jan2 = new Date(year, 0, 2);
            const jan2Sub = getSubstituteDay(jan2);
            
            // Special case: if both Jan 1 and Jan 2 fall on weekend
            // Jan 1 Sat -> Mon 3rd, Jan 2 Sun -> Tue 4th
            // Jan 1 Sun -> Mon 3rd, Jan 2 Mon -> stays Jan 2nd
            // Jan 1 Fri -> stays, Jan 2 Sat -> Mon 4th
            
            if (isWeekend(jan2)) {
                // If New Year's Day substitute is already on Monday, 2nd Jan goes to Tuesday
                if (toISOString(newYearSub) === toISOString(jan2Sub)) {
                    holidays.push({
                        date: toISOString(new Date(year, 0, jan2Sub.getDate() + 1)),
                        name: '2nd January (substitute)'
                    });
                } else {
                    holidays.push({
                        date: toISOString(jan2Sub),
                        name: '2nd January (substitute)'
                    });
                }
            } else {
                holidays.push({
                    date: toISOString(jan2),
                    name: '2nd January'
                });
            }
        }
        
        // === ST PATRICK'S DAY (Northern Ireland only) ===
        if (region === 'northern-ireland') {
            const stPatricks = new Date(year, 2, 17); // March 17
            const stPatricksSub = getSubstituteDay(stPatricks);
            if (isWeekend(stPatricks)) {
                holidays.push({
                    date: toISOString(stPatricksSub),
                    name: "St Patrick's Day (substitute)"
                });
            } else {
                holidays.push({
                    date: toISOString(stPatricks),
                    name: "St Patrick's Day"
                });
            }
        }
        
        // === EASTER (Good Friday - all regions, Easter Monday - not Scotland) ===
        const easterSunday = calculateEasterSunday(year);
        
        // Good Friday (2 days before Easter Sunday)
        const goodFriday = new Date(easterSunday);
        goodFriday.setDate(easterSunday.getDate() - 2);
        holidays.push({
            date: toISOString(goodFriday),
            name: 'Good Friday'
        });
        
        // Easter Monday (1 day after Easter Sunday) - NOT a bank holiday in Scotland
        if (region !== 'scotland') {
            const easterMonday = new Date(easterSunday);
            easterMonday.setDate(easterSunday.getDate() + 1);
            holidays.push({
                date: toISOString(easterMonday),
                name: 'Easter Monday'
            });
        }
        
        // === EARLY MAY BANK HOLIDAY (First Monday of May - all regions) ===
        const earlyMay = getFirstWeekdayOfMonth(year, 4, 1); // May, Monday
        holidays.push({
            date: toISOString(earlyMay),
            name: 'Early May Bank Holiday'
        });
        
        // === SPRING BANK HOLIDAY (Last Monday of May - all regions) ===
        const springBank = getLastWeekdayOfMonth(year, 4, 1); // May, Monday
        holidays.push({
            date: toISOString(springBank),
            name: 'Spring Bank Holiday'
        });
        
        // === BATTLE OF THE BOYNE (Northern Ireland only - 12 July) ===
        if (region === 'northern-ireland') {
            const boyne = new Date(year, 6, 12); // July 12
            const boyneSub = getSubstituteDay(boyne);
            if (isWeekend(boyne)) {
                holidays.push({
                    date: toISOString(boyneSub),
                    name: 'Battle of the Boyne (substitute)'
                });
            } else {
                holidays.push({
                    date: toISOString(boyne),
                    name: 'Battle of the Boyne'
                });
            }
        }
        
        // === SUMMER BANK HOLIDAY ===
        // Scotland: First Monday of August
        // England, Wales, Northern Ireland: Last Monday of August
        if (region === 'scotland') {
            const summerScotland = getFirstWeekdayOfMonth(year, 7, 1); // August, Monday
            holidays.push({
                date: toISOString(summerScotland),
                name: 'Summer Bank Holiday'
            });
        } else {
            const summerEngland = getLastWeekdayOfMonth(year, 7, 1); // August, Monday
            holidays.push({
                date: toISOString(summerEngland),
                name: 'Summer Bank Holiday'
            });
        }
        
        // === ST ANDREW'S DAY (Scotland only - 30 November) ===
        if (region === 'scotland') {
            const stAndrews = new Date(year, 10, 30); // November 30
            const stAndrewsSub = getSubstituteDay(stAndrews);
            if (isWeekend(stAndrews)) {
                holidays.push({
                    date: toISOString(stAndrewsSub),
                    name: "St Andrew's Day (substitute)"
                });
            } else {
                holidays.push({
                    date: toISOString(stAndrews),
                    name: "St Andrew's Day"
                });
            }
        }
        
        // === CHRISTMAS & BOXING DAY (All regions) ===
        const christmasHols = calculateChristmasHolidays(year);
        holidays.push(...christmasHols);
        
        // === AD-HOC HOLIDAYS (from config) ===
        if (adHocHolidays[year]) {
            const regionAdHoc = adHocHolidays[year].filter(h => 
                !h.regions || h.regions.includes(region)
            );
            holidays.push(...regionAdHoc.map(h => ({ date: h.date, name: h.name })));
        }
        
        // Sort by date
        holidays.sort((a, b) => a.date.localeCompare(b.date));
        
        return holidays;
    }

    /**
     * Get bank holidays for a year and region (cached)
     * @param {number} year - Full year
     * @param {string} region - 'england', 'scotland', or 'northern-ireland'
     * @returns {Array} Array of holiday objects
     */
    function getForYear(year, region = 'england') {
        const cacheKey = `${year}-${region}`;
        
        if (!cache[cacheKey]) {
            cache[cacheKey] = calculateHolidays(year, region);
        }
        
        return cache[cacheKey];
    }

    /**
     * Check if a date is a bank holiday
     * @param {string} dateString - ISO date string (YYYY-MM-DD)
     * @param {string} region - Region identifier
     * @returns {boolean} True if bank holiday
     */
    function isHoliday(dateString, region = 'england') {
        const year = parseInt(dateString.substring(0, 4), 10);
        const holidays = getForYear(year, region);
        return holidays.some(h => h.date === dateString);
    }

    /**
     * Get the name of a bank holiday
     * @param {string} dateString - ISO date string (YYYY-MM-DD)
     * @param {string} region - Region identifier
     * @returns {string|null} Holiday name or null
     */
    function getHolidayName(dateString, region = 'england') {
        const year = parseInt(dateString.substring(0, 4), 10);
        const holidays = getForYear(year, region);
        const holiday = holidays.find(h => h.date === dateString);
        return holiday ? holiday.name : null;
    }

    /**
     * Get available regions
     * @returns {string[]} Array of region identifiers
     */
    function getRegions() {
        return Object.keys(regionNames);
    }

    /**
     * Get human-readable region name
     * @param {string} region - Region identifier
     * @returns {string} Human-readable name
     */
    function getRegionDisplayName(region) {
        return regionNames[region] || region;
    }

    /**
     * Load ad-hoc holidays from configuration
     * @param {Object} config - Object with year keys, each containing array of holidays
     * Example: { 2022: [{ date: '2022-06-03', name: 'Platinum Jubilee', regions: ['england', 'scotland', 'northern-ireland'] }] }
     */
    function loadAdHocHolidays(config) {
        adHocHolidays = config || {};
        cache = {}; // Clear cache when ad-hoc holidays change
    }

    /**
     * Clear the calculation cache
     */
    function clearCache() {
        cache = {};
    }

    /**
     * Get Easter Sunday date for a year (utility for external use)
     * @param {number} year - Full year
     * @returns {string} ISO date string
     */
    function getEasterSunday(year) {
        return toISOString(calculateEasterSunday(year));
    }

    // Public API
    return {
        getForYear,
        isHoliday,
        getHolidayName,
        getRegions,
        getRegionDisplayName,
        loadAdHocHolidays,
        clearCache,
        getEasterSunday
    };
})();
