/**
 * Work Leave Planner - Calendar Module
 * Handles calendar rendering and interactions
 */

const Calendar = (function() {
    // Private state
    let containerEl = null;
    let currentYear = DateUtils.getCurrentYear();
    let startMonth = 0; // January by default
    let currentRegion = 'england'; // Default region for bank holidays
    
    // Event callbacks
    let onDayClickCallback = null;

    /**
     * Initialize the calendar
     * @param {HTMLElement} container - The container element for the calendar
     * @param {Object} options - Configuration options
     */
    function init(container, options = {}) {
        containerEl = container;
        
        if (options.year) {
            currentYear = options.year;
        }
        if (options.startMonth !== undefined) {
            startMonth = options.startMonth;
        }
        if (options.region) {
            currentRegion = options.region;
        }
        
        render();
    }

    /**
     * Render the full 12-month calendar
     */
    function render() {
        if (!containerEl) {
            console.error('Calendar container not initialized');
            return;
        }

        containerEl.innerHTML = '';
        
        // Render 12 months starting from startMonth
        for (let i = 0; i < 12; i++) {
            const monthIndex = (startMonth + i) % 12;
            const yearOffset = Math.floor((startMonth + i) / 12);
            const displayYear = currentYear + yearOffset;
            
            const monthCard = createMonthCard(displayYear, monthIndex);
            containerEl.appendChild(monthCard);
        }
    }

    /**
     * Create a month card element
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @returns {HTMLElement} Month card element
     */
    function createMonthCard(year, month) {
        const card = document.createElement('div');
        card.className = 'month-card';
        card.dataset.year = year;
        card.dataset.month = month;

        // Month header
        const header = document.createElement('div');
        header.className = 'month-header';
        
        const monthName = document.createElement('h2');
        monthName.className = 'month-name';
        const monthNames = DateUtils.getMonthNames();
        monthName.textContent = `${monthNames[month]} ${year}`;
        
        header.appendChild(monthName);
        card.appendChild(header);

        // Weekday labels
        const weekdayLabels = createWeekdayLabels();
        card.appendChild(weekdayLabels);

        // Days grid
        const daysGrid = createDaysGrid(year, month);
        card.appendChild(daysGrid);

        return card;
    }

    /**
     * Create weekday labels row
     * @returns {HTMLElement} Weekday labels element
     */
    function createWeekdayLabels() {
        const container = document.createElement('div');
        container.className = 'weekday-labels';
        
        const weekdays = DateUtils.getWeekdayNames();
        
        weekdays.forEach((day, index) => {
            const label = document.createElement('span');
            label.className = 'weekday-label';
            
            // Mark Saturday (index 5) and Sunday (index 6) as weekend
            if (index >= 5) {
                label.classList.add('weekday-label--weekend');
            }
            
            label.textContent = day;
            container.appendChild(label);
        });

        return container;
    }

    /**
     * Create the days grid for a month
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @returns {HTMLElement} Days grid element
     */
    function createDaysGrid(year, month) {
        const grid = document.createElement('div');
        grid.className = 'days-grid';

        const daysInMonth = DateUtils.getDaysInMonth(year, month);
        const firstDayOffset = DateUtils.getFirstDayOfMonth(year, month);

        // Add empty cells for days before the first of the month
        for (let i = 0; i < firstDayOffset; i++) {
            const emptyCell = createDayCell(null, year, month);
            grid.appendChild(emptyCell);
        }

        // Add day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = createDayCell(day, year, month);
            grid.appendChild(dayCell);
        }

        return grid;
    }

    /**
     * Create a single day cell
     * @param {number|null} day - Day number or null for empty cell
     * @param {number} year - Full year
     * @param {number} month - Month index (0-11)
     * @returns {HTMLElement} Day cell element
     */
    function createDayCell(day, year, month) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';

        if (day === null) {
            cell.classList.add('day-cell--empty');
            return cell;
        }

        const dateString = DateUtils.toISODateString(year, month, day);

        // Store date data
        cell.dataset.date = dateString;
        cell.dataset.year = year;
        cell.dataset.month = month;
        cell.dataset.day = day;

        // Add day number
        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        // Check if weekend
        if (DateUtils.isWeekend(year, month, day)) {
            cell.classList.add('day-cell--weekend');
        }

        // Check if today
        if (DateUtils.isToday(year, month, day)) {
            cell.classList.add('day-cell--today');
        }

        // Check if bank holiday
        if (typeof BankHolidays !== 'undefined') {
            const holidayName = BankHolidays.getHolidayName(dateString, currentRegion);
            if (holidayName) {
                cell.classList.add('day-cell--bank-holiday');
                cell.dataset.tooltip = holidayName;
                cell.dataset.holidayName = holidayName;
            }
        }

        // Build ARIA label
        let ariaLabel = DateUtils.formatDateLong(year, month, day);
        if (cell.dataset.holidayName) {
            ariaLabel += `, ${cell.dataset.holidayName}`;
        }
        if (cell.classList.contains('day-cell--weekend')) {
            ariaLabel += ', weekend';
        }

        // Add ARIA label and keyboard accessibility
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', ariaLabel);
        cell.setAttribute('tabindex', '0'); // Make focusable

        return cell;
    }

    /**
     * Set the current year and re-render
     * @param {number} year - Full year
     */
    function setYear(year) {
        currentYear = year;
        render();
    }

    /**
     * Get the current year
     * @returns {number} Current year
     */
    function getYear() {
        return currentYear;
    }

    /**
     * Navigate to next year
     */
    function nextYear() {
        setYear(currentYear + 1);
    }

    /**
     * Navigate to previous year
     */
    function prevYear() {
        setYear(currentYear - 1);
    }

    /**
     * Set the start month for the leave year
     * @param {number} month - Month index (0-11)
     */
    function setStartMonth(month) {
        startMonth = month;
        render();
    }

    /**
     * Set the region for bank holidays and re-render
     * @param {string} region - 'england' or 'scotland'
     */
    function setRegion(region) {
        if (region !== currentRegion) {
            currentRegion = region;
            render();
        }
    }

    /**
     * Get the current region
     * @returns {string} Current region
     */
    function getRegion() {
        return currentRegion;
    }

    /**
     * Get a day cell element by date
     * @param {string} dateString - ISO date string
     * @returns {HTMLElement|null} Day cell element
     */
    function getDayCell(dateString) {
        return containerEl?.querySelector(`[data-date="${dateString}"]`) || null;
    }

    /**
     * Add a CSS class to a day cell
     * @param {string} dateString - ISO date string
     * @param {string} className - CSS class to add
     */
    function addDayClass(dateString, className) {
        const cell = getDayCell(dateString);
        if (cell) {
            cell.classList.add(className);
        }
    }

    /**
     * Remove a CSS class from a day cell
     * @param {string} dateString - ISO date string
     * @param {string} className - CSS class to remove
     */
    function removeDayClass(dateString, className) {
        const cell = getDayCell(dateString);
        if (cell) {
            cell.classList.remove(className);
        }
    }

    /**
     * Set tooltip on a day cell
     * @param {string} dateString - ISO date string
     * @param {string} tooltip - Tooltip text
     */
    function setDayTooltip(dateString, tooltip) {
        const cell = getDayCell(dateString);
        if (cell) {
            cell.dataset.tooltip = tooltip;
        }
    }

    /**
     * Register a callback for day click events
     * @param {Function} callback - Function to call when a day is clicked
     */
    function onDayClick(callback) {
        onDayClickCallback = callback;
        
        // Add event listener using event delegation
        if (containerEl) {
            containerEl.addEventListener('click', handleDayClick);
        }
    }

    /**
     * Handle day click events
     * @param {Event} event - Click event
     */
    function handleDayClick(event) {
        const dayCell = event.target.closest('.day-cell');
        
        if (!dayCell || dayCell.classList.contains('day-cell--empty')) {
            return;
        }

        const dateString = dayCell.dataset.date;
        
        if (onDayClickCallback && dateString) {
            onDayClickCallback({
                date: dateString,
                year: parseInt(dayCell.dataset.year, 10),
                month: parseInt(dayCell.dataset.month, 10),
                day: parseInt(dayCell.dataset.day, 10),
                element: dayCell,
                isWeekend: dayCell.classList.contains('day-cell--weekend'),
                isToday: dayCell.classList.contains('day-cell--today'),
                isBankHoliday: dayCell.classList.contains('day-cell--bank-holiday'),
                holidayName: dayCell.dataset.holidayName || null
            });
        }
    }

    /**
     * Destroy the calendar and clean up
     */
    function destroy() {
        if (containerEl) {
            containerEl.removeEventListener('click', handleDayClick);
            containerEl.innerHTML = '';
        }
        containerEl = null;
        onDayClickCallback = null;
    }

    // Public API
    return {
        init,
        render,
        setYear,
        getYear,
        nextYear,
        prevYear,
        setStartMonth,
        setRegion,
        getRegion,
        getDayCell,
        addDayClass,
        removeDayClass,
        setDayTooltip,
        onDayClick,
        destroy
    };
})();
