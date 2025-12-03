/**
 * Work Leave Planner - Export Module
 * Handles print summary and iCal export functionality
 */

const Export = (function() {
    
    /**
     * Generate print-friendly HTML summary
     * @param {Object} data - Leave data object
     * @returns {string} HTML string for print
     */
    function generatePrintHTML(data) {
        const {
            year,
            region,
            leaveAllowance,
            leaveDays,
            schoolHolidays,
            blockedDays = new Set(),
            regionDisplayName
        } = data;

        // Sort leave days
        const sortedLeave = [...leaveDays].sort();
        const sortedSchool = [...schoolHolidays].sort();
        const sortedBlocked = [...blockedDays].sort();
        
        // Calculate stats
        const remaining = leaveAllowance - sortedLeave.length;
        
        // Check if any leave days fall on bank holidays
        const bankHolidaysInLeave = sortedLeave.filter(dateStr => {
            if (typeof BankHolidays !== 'undefined') {
                return BankHolidays.getHolidayName(dateStr, region) !== null;
            }
            return false;
        });

        // Group leave by month
        const leaveByMonth = groupByMonth(sortedLeave);
        
        // Format date for display
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            });
        };

        let html = `
            <div class="print-header">
                <h1 class="print-title">Work Leave Plan ${year}</h1>
                <p class="print-subtitle">Bank Holidays: ${regionDisplayName} | Generated: ${new Date().toLocaleDateString('en-GB')}</p>
            </div>
            
            <div class="print-summary">
                <table class="print-summary-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Days</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Annual Leave Allowance</td>
                            <td>${leaveAllowance}</td>
                        </tr>
                        <tr>
                            <td>Leave Days Booked</td>
                            <td>${sortedLeave.length}</td>
                        </tr>
                        <tr>
                            <td>Remaining</td>
                            <td>${remaining}</td>
                        </tr>
                        <tr>
                            <td>School Holiday Days Marked</td>
                            <td>${sortedSchool.length}</td>
                        </tr>
                        ${sortedBlocked.length > 0 ? `
                        <tr>
                            <td style="color: #ea580c;">Non-bookable Days</td>
                            <td style="color: #ea580c;">${sortedBlocked.length}</td>
                        </tr>
                        ` : ''}
                        ${bankHolidaysInLeave.length > 0 ? `
                        <tr>
                            <td style="color: #b45309;">Bank Holidays in Leave (may not need)</td>
                            <td style="color: #b45309;">${bankHolidaysInLeave.length}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;

        // Leave dates section - group into ranges
        if (sortedLeave.length > 0) {
            const ranges = groupIntoRanges(sortedLeave);
            
            html += `
                <div class="print-leave-list">
                    <h2 class="print-section-title">Booked Leave Periods</h2>
                    <table class="print-leave-table">
                        <thead>
                            <tr>
                                <th>From</th>
                                <th>To</th>
                                <th>Days</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            ranges.forEach(range => {
                const formatted = formatRange(range);
                // Check if any day in this range is a bank holiday
                const rangeHasBankHoliday = sortedLeave
                    .filter(d => d >= range.start && d <= range.end)
                    .some(d => bankHolidaysInLeave.includes(d));
                
                const warningStyle = rangeHasBankHoliday ? ' style="color: #b45309;"' : '';
                const warningMark = rangeHasBankHoliday ? ' *' : '';
                
                if (formatted.isSingleDay) {
                    html += `
                        <tr${warningStyle}>
                            <td colspan="2">${formatted.start}${warningMark}</td>
                            <td>1</td>
                        </tr>
                    `;
                } else {
                    html += `
                        <tr${warningStyle}>
                            <td>${formatted.start}${warningMark}</td>
                            <td>${formatted.end}</td>
                            <td>${formatted.days}</td>
                        </tr>
                    `;
                }
            });
            
            html += `
                        </tbody>
                    </table>
                    ${bankHolidaysInLeave.length > 0 ? '<p style="font-size: 9pt; color: #666; margin-top: 10pt;">* Period includes bank holiday(s) - check if leave is required</p>' : ''}
                </div>
            `;
        }

        return html;
    }

    /**
     * Group dates by month
     * @param {Array} dates - Array of ISO date strings
     * @returns {Object} Dates grouped by month
     */
    function groupByMonth(dates) {
        const months = {};
        dates.forEach(dateStr => {
            const date = new Date(dateStr);
            const monthKey = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            if (!months[monthKey]) {
                months[monthKey] = [];
            }
            months[monthKey].push(dateStr);
        });
        return months;
    }

    /**
     * Group consecutive dates into ranges (excluding weekends)
     * @param {Array} dates - Array of ISO date strings (sorted)
     * @returns {Array} Array of range objects {start, end, days}
     */
    function groupIntoRanges(dates) {
        if (dates.length === 0) return [];
        
        const ranges = [];
        let currentRange = { start: dates[0], end: dates[0], days: 1 };
        
        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            
            // Calculate expected next working day (skip weekends)
            const expectedNext = new Date(prevDate);
            expectedNext.setDate(expectedNext.getDate() + 1);
            
            // Skip over weekend days
            while (expectedNext.getDay() === 0 || expectedNext.getDay() === 6) {
                expectedNext.setDate(expectedNext.getDate() + 1);
            }
            
            // Check if current date is the expected next working day
            const currDateStr = dates[i];
            const expectedNextStr = expectedNext.toISOString().split('T')[0];
            
            if (currDateStr === expectedNextStr) {
                // Consecutive - extend current range
                currentRange.end = dates[i];
                currentRange.days++;
            } else {
                // Gap found - save current range and start new one
                ranges.push(currentRange);
                currentRange = { start: dates[i], end: dates[i], days: 1 };
            }
        }
        
        // Don't forget the last range
        ranges.push(currentRange);
        
        return ranges;
    }

    /**
     * Format a date range for display
     * @param {Object} range - Range object {start, end, days}
     * @returns {Object} Formatted range with display strings
     */
    function formatRange(range) {
        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        
        const formatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
        
        return {
            start: startDate.toLocaleDateString('en-GB', formatOptions),
            end: endDate.toLocaleDateString('en-GB', formatOptions),
            days: range.days,
            isSingleDay: range.start === range.end
        };
    }

    /**
     * Open print dialog with summary
     * @param {Object} data - Leave data object
     */
    function printSummary(data) {
        const printContainer = document.getElementById('print-container');
        if (!printContainer) {
            console.error('Print container not found');
            return;
        }

        // Generate and insert print HTML
        printContainer.innerHTML = generatePrintHTML(data);
        
        // Small delay to ensure DOM is updated
        setTimeout(() => {
            window.print();
        }, 100);
    }

    /**
     * Generate iCal (.ics) file content
     * @param {Object} data - Leave data object
     * @param {Object} options - Export options
     * @returns {string} iCal file content
     */
    function generateICalContent(data, options = {}) {
        const { year, leaveDays, schoolHolidays = new Set() } = data;
        const { includeLeave = true, includeSchool = false } = options;
        
        const sortedLeave = includeLeave ? [...leaveDays].sort() : [];
        const sortedSchool = includeSchool ? [...schoolHolidays].sort() : [];
        
        // iCal header
        let ical = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Work Leave Planner//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:Work Leave ${year}`,
            'X-WR-TIMEZONE:Europe/London'
        ];

        // Generate UID timestamp
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        // Add each leave day as an all-day event
        sortedLeave.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            
            // Format dates for iCal (YYYYMMDD for all-day events)
            const startDate = dateStr.replace(/-/g, '');
            const endDate = nextDay.toISOString().split('T')[0].replace(/-/g, '');
            
            // Create unique ID
            const uid = `leave-${startDate}-${index}@workleaveplanner`;
            
            // Format date for description
            const formattedDate = date.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            ical.push(
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${timestamp}`,
                `DTSTART;VALUE=DATE:${startDate}`,
                `DTEND;VALUE=DATE:${endDate}`,
                'SUMMARY:Annual Leave',
                `DESCRIPTION:Booked annual leave - ${formattedDate}`,
                'TRANSP:OPAQUE',
                'STATUS:CONFIRMED',
                'END:VEVENT'
            );
        });
        
        // Add school holidays as all-day events
        sortedSchool.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            
            // Format dates for iCal (YYYYMMDD for all-day events)
            const startDate = dateStr.replace(/-/g, '');
            const endDate = nextDay.toISOString().split('T')[0].replace(/-/g, '');
            
            // Create unique ID
            const uid = `school-${startDate}-${index}@workleaveplanner`;
            
            // Format date for description
            const formattedDate = date.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            ical.push(
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${timestamp}`,
                `DTSTART;VALUE=DATE:${startDate}`,
                `DTEND;VALUE=DATE:${endDate}`,
                'SUMMARY:School Holiday',
                `DESCRIPTION:School holiday - ${formattedDate}`,
                'TRANSP:TRANSPARENT',
                'STATUS:CONFIRMED',
                'END:VEVENT'
            );
        });

        // iCal footer
        ical.push('END:VCALENDAR');

        return ical.join('\r\n');
    }

    /**
     * Download iCal file
     * @param {Object} data - Leave data object
     * @param {Object} options - Export options { includeLeave, includeSchool }
     */
    function downloadICal(data, options = {}) {
        const { year, leaveDays, schoolHolidays = new Set() } = data;
        const { includeLeave = true, includeSchool = false } = options;
        
        const leaveCount = includeLeave ? leaveDays.size : 0;
        const schoolCount = includeSchool ? schoolHolidays.size : 0;
        
        if (leaveCount === 0 && schoolCount === 0) {
            console.warn('No events to export');
            return false;
        }

        const icalContent = generateICalContent(data, options);
        const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `work-leave-${year}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        console.log(`iCal exported: ${leaveCount} leave days, ${schoolCount} school holidays`);
        return true;
    }

    /**
     * Export all data as JSON
     * @param {Object} data - Complete app data
     */
    function exportJSON(data) {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: {
                settings: data.settings,
                schoolHolidays: [...data.schoolHolidays],
                leaveDays: [...data.leaveDays],
                blockedDays: data.blockedDays ? [...data.blockedDays] : []
            }
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `work-leave-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log('Data exported successfully');
    }

    /**
     * Import data from JSON file
     * @param {File} file - JSON file to import
     * @returns {Promise<Object>} Imported data
     */
    function importJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    
                    // Validate structure
                    if (!imported.data || !imported.version) {
                        throw new Error('Invalid backup file format');
                    }
                    
                    resolve(imported.data);
                } catch (err) {
                    reject(new Error('Failed to parse backup file: ' + err.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    // Public API
    return {
        printSummary,
        downloadICal,
        exportJSON,
        importJSON,
        generatePrintHTML,
        generateICalContent
    };
})();

