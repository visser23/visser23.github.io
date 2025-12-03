/**
 * Work Leave Planner - Main Application
 * Entry point and application orchestration
 */

const App = (function() {
    // DOM Elements
    let yearDisplay = null;
    let prevYearBtn = null;
    let nextYearBtn = null;
    let calendarContainer = null;
    let settingsBtn = null;
    let regionSelect = null;
    let modeSchoolHolidaysBtn = null;
    let modeBookLeaveBtn = null;
    let modeBlockDaysBtn = null;
    let modePartnerLeaveBtn = null;
    let clearSelectionBtn = null;
    let instructionText = null;
    
    // Leave summary DOM elements
    let leaveAllowanceInput = null;
    let leaveBookedCount = null;
    let leaveRemainingCount = null;
    let leaveProgressBar = null;
    let leaveSummary = null;
    
    // Settings modal DOM elements
    let settingsModal = null;
    let settingsCloseBtn = null;
    let yearStartSelect = null;
    let exportDataBtn = null;
    let importDataBtn = null;
    let importFileInput = null;
    let clearAllDataBtn = null;
    
    // Help modal DOM elements
    let helpModal = null;
    let helpBtn = null;
    let helpCloseBtn = null;
    
    // Export buttons
    let exportPrintBtn = null;
    let exportICalBtn = null;
    
    // Partner sharing DOM elements
    let sharePartnerBtn = null;
    let shareModal = null;
    let shareCloseBtn = null;
    let partnerNameInput = null;
    let generateShareUrlBtn = null;
    let shareUrlContainer = null;
    let shareUrlOutput = null;
    let copyUrlBtn = null;
    let shareUrlCopied = null;
    let shareStats = null;
    let shareLeaveCount = null;
    
    // Import partner modal DOM elements
    let importPartnerModal = null;
    let importCloseBtn = null;
    let importPartnerNameEl = null;
    let importLeaveCountEl = null;
    let importAcceptBtn = null;
    let importSkipBtn = null;
    
    // Export help modal DOM elements
    let exportHelpModal = null;
    let exportHelpCloseBtn = null;
    
    // Support toast DOM elements
    let supportToast = null;
    let supportToastCloseBtn = null;
    
    // Suggest holidays modal DOM elements
    let suggestHolidaysBtn = null;
    let suggestHolidaysModal = null;
    let suggestCloseBtn = null;
    let suggestYearSelect = null;
    let suggestRegionSelect = null;
    let suggestPreviewList = null;
    let suggestPreviewTotal = null;
    let suggestCancelBtn = null;
    let suggestApplyBtn = null;

    // Application state
    let currentRegion = 'england';
    let currentMode = 'school-holidays'; // 'school-holidays', 'book-leave', 'block-days', or 'partner-leave'
    let schoolHolidays = new Set(); // Set of ISO date strings
    let leaveDays = new Set(); // Set of ISO date strings for booked leave
    let blockedDays = new Set(); // Set of ISO date strings for non-bookable days
    let partnerLeaveDays = new Set(); // Set of ISO date strings for partner's leave
    let partnerName = ''; // Partner's name for display
    let leaveAllowance = 25; // Default annual leave allowance
    let yearStartMonth = 0; // 0 = January (default), 3 = April, etc.
    
    // Drag selection state
    let isDragging = false;
    let dragStartDate = null;
    let dragAction = null; // 'add' or 'remove'

    // Mode instructions
    const modeInstructions = {
        'school-holidays': 'Click or drag to mark school holiday periods. These help you see when you need time off.',
        'book-leave': 'Click or drag to book your leave days. Your remaining allowance will update automatically.',
        'block-days': 'Click or drag to mark non-bookable days (work events, team leave, etc).',
        'partner-leave': "Click or drag to mark your partner's leave days. Use 'Share with Partner' to exchange plans."
    };

    /**
     * Initialize the application
     */
    async function init() {
        // Cache DOM elements
        yearDisplay = document.getElementById('year-display');
        prevYearBtn = document.getElementById('prev-year-btn');
        nextYearBtn = document.getElementById('next-year-btn');
        calendarContainer = document.getElementById('calendar-container');
        settingsBtn = document.getElementById('settings-btn');
        regionSelect = document.getElementById('region-select');
        modeSchoolHolidaysBtn = document.getElementById('mode-school-holidays');
        modeBookLeaveBtn = document.getElementById('mode-book-leave');
        modeBlockDaysBtn = document.getElementById('mode-block-days');
        modePartnerLeaveBtn = document.getElementById('mode-partner-leave');
        clearSelectionBtn = document.getElementById('clear-selection-btn');
        instructionText = document.getElementById('instruction-text');
        
        // Leave summary DOM elements
        leaveAllowanceInput = document.getElementById('leave-allowance-input');
        leaveBookedCount = document.getElementById('leave-booked-count');
        leaveRemainingCount = document.getElementById('leave-remaining-count');
        leaveProgressBar = document.getElementById('leave-progress-bar');
        leaveSummary = document.getElementById('leave-summary');
        
        // Settings modal DOM elements
        settingsModal = document.getElementById('settings-modal');
        settingsCloseBtn = document.getElementById('settings-close');
        yearStartSelect = document.getElementById('year-start-select');
        exportDataBtn = document.getElementById('export-data-btn');
        importDataBtn = document.getElementById('import-data-btn');
        importFileInput = document.getElementById('import-file-input');
        clearAllDataBtn = document.getElementById('clear-all-data-btn');
        
        // Help modal DOM elements
        helpModal = document.getElementById('help-modal');
        helpBtn = document.getElementById('help-btn');
        helpCloseBtn = document.getElementById('help-close');
        
        // Export buttons
        exportPrintBtn = document.getElementById('export-print-btn');
        exportICalBtn = document.getElementById('export-ical-btn');
        
        // Partner sharing DOM elements
        sharePartnerBtn = document.getElementById('share-partner-btn');
        shareModal = document.getElementById('share-modal');
        shareCloseBtn = document.getElementById('share-close');
        partnerNameInput = document.getElementById('partner-name-input');
        generateShareUrlBtn = document.getElementById('generate-share-url-btn');
        shareUrlContainer = document.getElementById('share-url-container');
        shareUrlOutput = document.getElementById('share-url-output');
        copyUrlBtn = document.getElementById('copy-url-btn');
        shareUrlCopied = document.getElementById('share-url-copied');
        shareStats = document.getElementById('share-stats');
        shareLeaveCount = document.getElementById('share-leave-count');
        
        // Import partner modal DOM elements
        importPartnerModal = document.getElementById('import-partner-modal');
        importCloseBtn = document.getElementById('import-close');
        importPartnerNameEl = document.getElementById('import-partner-name');
        importLeaveCountEl = document.getElementById('import-leave-count');
        importAcceptBtn = document.getElementById('import-accept-btn');
        importSkipBtn = document.getElementById('import-skip-btn');
        
        // Export help modal DOM elements
        exportHelpModal = document.getElementById('export-help-modal');
        exportHelpCloseBtn = document.getElementById('export-help-close');
        
        // Support toast DOM elements
        supportToast = document.getElementById('support-toast');
        supportToastCloseBtn = document.getElementById('support-toast-close');
        
        // Suggest holidays modal DOM elements
        suggestHolidaysBtn = document.getElementById('suggest-holidays-btn');
        suggestHolidaysModal = document.getElementById('suggest-holidays-modal');
        suggestCloseBtn = document.getElementById('suggest-close');
        suggestYearSelect = document.getElementById('suggest-year');
        suggestRegionSelect = document.getElementById('suggest-region');
        suggestPreviewList = document.getElementById('suggest-preview-list');
        suggestPreviewTotal = document.getElementById('suggest-preview-total');
        suggestCancelBtn = document.getElementById('suggest-cancel');
        suggestApplyBtn = document.getElementById('suggest-apply');

        // Load ad-hoc bank holidays first
        await loadAdHocHolidays();

        // Load saved settings and data
        loadSettings();
        loadSchoolHolidays();
        loadLeaveDays();
        loadBlockedDays();
        loadPartnerLeaveDays();

        // Initialize calendar with saved region and year start
        Calendar.init(calendarContainer, {
            year: DateUtils.getCurrentYear(),
            startMonth: yearStartMonth,
            region: currentRegion
        });

        // Apply initial mode
        applyMode();

        // Render saved data
        renderSchoolHolidays();
        renderLeaveDays();
        renderBlockedDays();
        renderPartnerLeaveDays();
        updateLeaveCounter();

        // Update year display
        updateYearDisplay();

        // Bind event handlers
        bindEvents();

        // Check for partner data in URL
        checkForPartnerData();

        // Log initialization
        console.log('Work Leave Planner initialized');
        console.log(`Region: ${BankHolidays.getRegionDisplayName(currentRegion)}`);
        console.log(`Mode: ${currentMode}`);
        console.log(`School holidays loaded: ${schoolHolidays.size}`);
        console.log(`Leave days loaded: ${leaveDays.size}`);
        console.log(`Blocked days loaded: ${blockedDays.size}`);
        console.log(`Leave allowance: ${leaveAllowance}`);
        console.log(`Partner data: ${Partner.hasPartnerData() ? 'Yes' : 'No'}`);
    }

    /**
     * Load settings from storage
     */
    function loadSettings() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const savedRegion = Storage.getSetting('region');
            const validRegions = ['england', 'scotland', 'northern-ireland'];
            if (savedRegion && validRegions.includes(savedRegion)) {
                currentRegion = savedRegion;
            }
            
            // Load leave allowance
            const savedAllowance = Storage.getSetting('leaveAllowance');
            if (savedAllowance !== null && !isNaN(savedAllowance)) {
                leaveAllowance = parseInt(savedAllowance, 10);
            }
            
            // Load year start month
            const savedYearStart = Storage.getSetting('yearStartMonth');
            if (savedYearStart !== null && !isNaN(savedYearStart)) {
                yearStartMonth = parseInt(savedYearStart, 10);
            }
        }

        // Update region select to match saved value
        if (regionSelect) {
            regionSelect.value = currentRegion;
        }
        
        // Update leave allowance input
        if (leaveAllowanceInput) {
            leaveAllowanceInput.value = leaveAllowance;
        }
        
        // Update year start select
        if (yearStartSelect) {
            yearStartSelect.value = yearStartMonth.toString();
        }
    }

    /**
     * Load school holidays from storage
     */
    function loadSchoolHolidays() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const data = Storage.load();
            if (data.schoolHolidays && Array.isArray(data.schoolHolidays)) {
                schoolHolidays = new Set(data.schoolHolidays);
            }
        }
    }

    /**
     * Save school holidays to storage
     */
    function saveSchoolHolidays() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const data = Storage.load();
            data.schoolHolidays = Array.from(schoolHolidays);
            Storage.save(data);
        }
    }

    /**
     * Load leave days from storage
     */
    function loadLeaveDays() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const data = Storage.load();
            if (data.leaveDays && Array.isArray(data.leaveDays)) {
                leaveDays = new Set(data.leaveDays);
            }
        }
    }

    /**
     * Save leave days to storage
     */
    function saveLeaveDays() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const data = Storage.load();
            data.leaveDays = Array.from(leaveDays);
            Storage.save(data);
        }
    }

    /**
     * Load blocked days from storage
     */
    function loadBlockedDays() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const data = Storage.load();
            if (data.blockedDays && Array.isArray(data.blockedDays)) {
                blockedDays = new Set(data.blockedDays);
            }
        }
    }

    /**
     * Save blocked days to storage
     */
    function saveBlockedDays() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            const data = Storage.load();
            data.blockedDays = Array.from(blockedDays);
            Storage.save(data);
        }
    }

    /**
     * Render blocked days on the calendar
     */
    function renderBlockedDays() {
        // Clear existing blocked day classes
        const existingBlocked = document.querySelectorAll('.day-cell--blocked');
        existingBlocked.forEach(cell => cell.classList.remove('day-cell--blocked'));
        
        // Add blocked day class to each blocked date
        blockedDays.forEach(dateStr => {
            Calendar.addDayClass(dateStr, 'day-cell--blocked');
        });
    }

    /**
     * Toggle a blocked day
     * @param {string} dateString - ISO date string
     * @param {boolean} isBlocked - Whether to set as blocked
     */
    function toggleBlockedDay(dateString, isBlocked) {
        if (isBlocked) {
            blockedDays.add(dateString);
            Calendar.addDayClass(dateString, 'day-cell--blocked');
        } else {
            blockedDays.delete(dateString);
            Calendar.removeDayClass(dateString, 'day-cell--blocked');
        }
    }

    /**
     * Load ad-hoc bank holidays from config file
     */
    async function loadAdHocHolidays() {
        try {
            const response = await fetch('src/data/bankHolidaysAdHoc.json');
            if (response.ok) {
                const config = await response.json();
                // Remove comment fields
                const cleanConfig = {};
                Object.keys(config).forEach(key => {
                    if (!key.startsWith('_')) {
                        cleanConfig[key] = config[key];
                    }
                });
                BankHolidays.loadAdHocHolidays(cleanConfig);
                console.log('Ad-hoc bank holidays loaded');
            }
        } catch (e) {
            console.log('No ad-hoc bank holidays config found (this is normal)');
        }
    }

    /**
     * Save current settings to storage
     */
    function saveSettings() {
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            Storage.updateSettings({
                region: currentRegion
            });
        }
    }

    /**
     * Bind event handlers
     */
    function bindEvents() {
        // Year navigation
        if (prevYearBtn) {
            prevYearBtn.addEventListener('click', handlePrevYear);
        }
        
        if (nextYearBtn) {
            nextYearBtn.addEventListener('click', handleNextYear);
        }

        // Region selector
        if (regionSelect) {
            regionSelect.addEventListener('change', handleRegionChange);
        }

        // Mode toggle buttons
        if (modeSchoolHolidaysBtn) {
            modeSchoolHolidaysBtn.addEventListener('click', () => setMode('school-holidays'));
        }
        if (modeBookLeaveBtn) {
            modeBookLeaveBtn.addEventListener('click', () => setMode('book-leave'));
        }
        if (modeBlockDaysBtn) {
            modeBlockDaysBtn.addEventListener('click', () => setMode('block-days'));
        }

        // Clear selection button
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', handleClearSelection);
        }

        // Settings button
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openSettingsModal);
        }
        
        // Settings modal close
        if (settingsCloseBtn) {
            settingsCloseBtn.addEventListener('click', closeSettingsModal);
        }
        
        // Help button
        if (helpBtn) {
            helpBtn.addEventListener('click', openHelpModal);
        }
        
        // Help modal close
        if (helpCloseBtn) {
            helpCloseBtn.addEventListener('click', closeHelpModal);
        }
        
        // Help modal backdrop click
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    closeHelpModal();
                }
            });
        }
        
        // Partner share button
        if (sharePartnerBtn) {
            sharePartnerBtn.addEventListener('click', openShareModal);
        }
        
        // Partner share modal close
        if (shareCloseBtn) {
            shareCloseBtn.addEventListener('click', closeShareModal);
        }
        
        // Share modal backdrop click
        if (shareModal) {
            shareModal.addEventListener('click', (e) => {
                if (e.target === shareModal) {
                    closeShareModal();
                }
            });
        }
        
        // Copy URL button
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', handleCopyShareUrl);
        }
        
        // Partner leave mode button
        if (modePartnerLeaveBtn) {
            modePartnerLeaveBtn.addEventListener('click', () => setMode('partner-leave'));
        }
        
        // Import modal buttons
        if (importCloseBtn) {
            importCloseBtn.addEventListener('click', closeImportModal);
        }
        if (importAcceptBtn) {
            importAcceptBtn.addEventListener('click', handleImportPartnerData);
        }
        if (importSkipBtn) {
            importSkipBtn.addEventListener('click', closeImportModal);
        }
        if (importPartnerModal) {
            importPartnerModal.addEventListener('click', (e) => {
                if (e.target === importPartnerModal) {
                    closeImportModal();
                }
            });
        }
        
        // Export help modal close
        if (exportHelpCloseBtn) {
            exportHelpCloseBtn.addEventListener('click', closeExportHelpModal);
        }
        if (exportHelpModal) {
            exportHelpModal.addEventListener('click', (e) => {
                if (e.target === exportHelpModal) {
                    closeExportHelpModal();
                }
            });
        }
        
        // Support toast close
        if (supportToastCloseBtn) {
            supportToastCloseBtn.addEventListener('click', hideSupportToast);
        }
        
        // Suggest holidays modal
        if (suggestHolidaysBtn) {
            suggestHolidaysBtn.addEventListener('click', openSuggestHolidaysModal);
        }
        if (suggestCloseBtn) {
            suggestCloseBtn.addEventListener('click', closeSuggestHolidaysModal);
        }
        if (suggestCancelBtn) {
            suggestCancelBtn.addEventListener('click', closeSuggestHolidaysModal);
        }
        if (suggestApplyBtn) {
            suggestApplyBtn.addEventListener('click', applySuggestedHolidays);
        }
        if (suggestYearSelect) {
            suggestYearSelect.addEventListener('change', updateSuggestPreview);
        }
        if (suggestRegionSelect) {
            suggestRegionSelect.addEventListener('change', updateSuggestPreview);
        }
        if (suggestHolidaysModal) {
            suggestHolidaysModal.addEventListener('click', (e) => {
                if (e.target === suggestHolidaysModal) {
                    closeSuggestHolidaysModal();
                }
            });
        }
        
        // Close modal on overlay click
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    closeSettingsModal();
                }
            });
        }
        
        // Year start selector
        if (yearStartSelect) {
            yearStartSelect.addEventListener('change', handleYearStartChange);
        }
        
        // Data management buttons
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', handleExportData);
        }
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => importFileInput?.click());
        }
        if (importFileInput) {
            importFileInput.addEventListener('change', handleImportData);
        }
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', handleClearAllData);
        }
        
        // Export buttons
        if (exportPrintBtn) {
            exportPrintBtn.addEventListener('click', handlePrintSummary);
        }
        if (exportICalBtn) {
            exportICalBtn.addEventListener('click', handleExportICal);
        }
        
        // Leave allowance input
        if (leaveAllowanceInput) {
            leaveAllowanceInput.addEventListener('change', handleLeaveAllowanceChange);
            leaveAllowanceInput.addEventListener('blur', handleLeaveAllowanceChange);
        }

        // Day click handler (now via delegation in calendar container)
        if (calendarContainer) {
            calendarContainer.addEventListener('mousedown', handleDragStart);
            calendarContainer.addEventListener('mouseover', handleDragMove);
            calendarContainer.addEventListener('mouseup', handleDragEnd);
            calendarContainer.addEventListener('mouseleave', handleDragEnd);
            
            // Touch support
            calendarContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
            calendarContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
            calendarContainer.addEventListener('touchend', handleTouchEnd);
        }

        // Keyboard navigation for year
        document.addEventListener('keydown', handleKeyDown);
    }

    /**
     * Apply the current mode to the UI
     */
    function applyMode() {
        // Update toggle buttons
        const allModeButtons = [modeSchoolHolidaysBtn, modeBookLeaveBtn, modeBlockDaysBtn, modePartnerLeaveBtn];
        allModeButtons.forEach(btn => {
            if (btn) {
                btn.classList.remove('mode-toggle-btn--active');
                btn.setAttribute('aria-selected', 'false');
            }
        });
        
        // Activate the current mode button
        if (currentMode === 'school-holidays' && modeSchoolHolidaysBtn) {
            modeSchoolHolidaysBtn.classList.add('mode-toggle-btn--active');
            modeSchoolHolidaysBtn.setAttribute('aria-selected', 'true');
        } else if (currentMode === 'book-leave' && modeBookLeaveBtn) {
            modeBookLeaveBtn.classList.add('mode-toggle-btn--active');
            modeBookLeaveBtn.setAttribute('aria-selected', 'true');
        } else if (currentMode === 'block-days' && modeBlockDaysBtn) {
            modeBlockDaysBtn.classList.add('mode-toggle-btn--active');
            modeBlockDaysBtn.setAttribute('aria-selected', 'true');
        } else if (currentMode === 'partner-leave' && modePartnerLeaveBtn) {
            modePartnerLeaveBtn.classList.add('mode-toggle-btn--active');
            modePartnerLeaveBtn.setAttribute('aria-selected', 'true');
        }

        // Update calendar container class
        if (calendarContainer) {
            calendarContainer.classList.remove(
                'calendar-container--mode-school-holidays', 
                'calendar-container--mode-book-leave',
                'calendar-container--mode-block-days',
                'calendar-container--mode-partner-leave'
            );
            calendarContainer.classList.add(`calendar-container--mode-${currentMode}`);
        }

        // Update instruction text
        if (instructionText) {
            instructionText.textContent = modeInstructions[currentMode];
        }

        // Update clear button text based on mode
        if (clearSelectionBtn) {
            const clearLabels = {
                'school-holidays': 'Clear School Holidays',
                'book-leave': 'Clear Leave',
                'block-days': 'Clear Blocked Days',
                'partner-leave': "Clear Partner's Leave"
            };
            clearSelectionBtn.textContent = clearLabels[currentMode];
        }
        
        // Show/hide Suggest Holidays button (only in school-holidays mode)
        if (suggestHolidaysBtn) {
            suggestHolidaysBtn.hidden = currentMode !== 'school-holidays';
        }
    }

    /**
     * Set the current mode
     * @param {string} mode - 'school-holidays', 'book-leave', 'block-days', or 'partner-leave'
     */
    function setMode(mode) {
        const validModes = ['school-holidays', 'book-leave', 'block-days', 'partner-leave'];
        if (mode !== currentMode && validModes.includes(mode)) {
            currentMode = mode;
            applyMode();
            console.log(`Mode changed to: ${mode}`);
        }
    }

    /**
     * Render school holidays on the calendar
     */
    function renderSchoolHolidays() {
        // First, remove all existing school holiday classes
        const allDays = calendarContainer.querySelectorAll('.day-cell--school-holiday');
        allDays.forEach(cell => cell.classList.remove('day-cell--school-holiday'));

        // Then add class to school holiday dates
        schoolHolidays.forEach(dateString => {
            const cell = Calendar.getDayCell(dateString);
            if (cell) {
                cell.classList.add('day-cell--school-holiday');
            }
        });
    }

    /**
     * Render leave days on the calendar
     */
    function renderLeaveDays() {
        // First, remove all existing leave day classes
        const allDays = calendarContainer.querySelectorAll('.day-cell--leave');
        allDays.forEach(cell => cell.classList.remove('day-cell--leave'));

        // Then add class to leave day dates
        leaveDays.forEach(dateString => {
            const cell = Calendar.getDayCell(dateString);
            if (cell) {
                cell.classList.add('day-cell--leave');
            }
        });
    }

    /**
     * Update the leave counter display
     */
    function updateLeaveCounter() {
        const booked = leaveDays.size;
        const remaining = leaveAllowance - booked;
        
        // Update displayed values
        if (leaveBookedCount) {
            leaveBookedCount.textContent = booked;
        }
        
        if (leaveRemainingCount) {
            leaveRemainingCount.textContent = remaining;
            
            // Update styling based on remaining
            const remainingItem = leaveRemainingCount.closest('.leave-counter-item');
            if (remainingItem) {
                remainingItem.classList.remove('leave-counter-item--warning', 'leave-counter-item--danger');
                if (remaining < 0) {
                    remainingItem.classList.add('leave-counter-item--danger');
                } else if (remaining <= 5) {
                    remainingItem.classList.add('leave-counter-item--warning');
                }
            }
        }
        
        // Update progress bar
        if (leaveProgressBar && leaveSummary) {
            const percentage = leaveAllowance > 0 ? Math.min((booked / leaveAllowance) * 100, 100) : 0;
            leaveProgressBar.style.width = `${percentage}%`;
            
            // Update progress bar ARIA attributes for accessibility
            const progressContainer = leaveProgressBar.parentElement;
            progressContainer.setAttribute('aria-valuenow', Math.round(percentage));
            progressContainer.setAttribute('aria-valuetext', `${booked} of ${leaveAllowance} days used`);
            
            progressContainer.classList.remove('leave-progress--warning', 'leave-progress--danger', 'leave-progress--over');
            
            if (remaining < 0) {
                progressContainer.classList.add('leave-progress--over');
            } else if (remaining <= 3) {
                progressContainer.classList.add('leave-progress--danger');
            } else if (remaining <= 5) {
                progressContainer.classList.add('leave-progress--warning');
            }
        }
    }

    /**
     * Toggle leave day for a date
     * @param {string} dateString - ISO date string
     * @param {boolean} forceAdd - Force add (true), force remove (false), or toggle (undefined)
     * @returns {boolean} Whether the date is now a leave day
     */
    function toggleLeaveDay(dateString, forceAdd) {
        const cell = Calendar.getDayCell(dateString);
        if (!cell) return false;

        // Don't allow selection of weekends
        if (cell.classList.contains('day-cell--weekend')) {
            return leaveDays.has(dateString);
        }

        let isNowLeave;
        
        if (forceAdd === true) {
            // Check if it's a bank holiday and warn
            if (cell.classList.contains('day-cell--bank-holiday') && !leaveDays.has(dateString)) {
                const holidayName = cell.dataset.tooltip || 'Bank Holiday';
                if (!confirm(`${holidayName} is a bank holiday. You may not need to use annual leave for this day. Book it anyway?`)) {
                    return false;
                }
            }
            
            leaveDays.add(dateString);
            cell.classList.add('day-cell--leave');
            isNowLeave = true;
        } else if (forceAdd === false) {
            leaveDays.delete(dateString);
            cell.classList.remove('day-cell--leave');
            isNowLeave = false;
        } else {
            // Toggle
            if (leaveDays.has(dateString)) {
                leaveDays.delete(dateString);
                cell.classList.remove('day-cell--leave');
                isNowLeave = false;
            } else {
                // Check if it's a bank holiday and warn
                if (cell.classList.contains('day-cell--bank-holiday')) {
                    const holidayName = cell.dataset.tooltip || 'Bank Holiday';
                    if (!confirm(`${holidayName} is a bank holiday. You may not need to use annual leave for this day. Book it anyway?`)) {
                        return false;
                    }
                }
                
                leaveDays.add(dateString);
                cell.classList.add('day-cell--leave');
                isNowLeave = true;
            }
        }

        return isNowLeave;
    }

    /**
     * Handle leave allowance input change
     */
    function handleLeaveAllowanceChange() {
        const value = parseInt(leaveAllowanceInput.value, 10);
        
        if (!isNaN(value) && value >= 0 && value <= 99) {
            leaveAllowance = value;
            updateLeaveCounter();
            
            // Save to storage
            if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
                Storage.updateSettings({ leaveAllowance: leaveAllowance });
            }
            
            // Check for over-allocation warning
            if (leaveDays.size > leaveAllowance) {
                console.warn(`Warning: You have booked ${leaveDays.size} days but only have ${leaveAllowance} days allowance.`);
            }
        } else {
            // Reset to valid value
            leaveAllowanceInput.value = leaveAllowance;
        }
    }

    /**
     * Toggle school holiday for a date
     * @param {string} dateString - ISO date string
     * @param {boolean} forceAdd - Force add (true), force remove (false), or toggle (undefined)
     * @returns {boolean} Whether the date is now a school holiday
     */
    function toggleSchoolHoliday(dateString, forceAdd) {
        const cell = Calendar.getDayCell(dateString);
        if (!cell) return false;

        let isNowHoliday;
        
        if (forceAdd === true) {
            schoolHolidays.add(dateString);
            cell.classList.add('day-cell--school-holiday');
            isNowHoliday = true;
        } else if (forceAdd === false) {
            schoolHolidays.delete(dateString);
            cell.classList.remove('day-cell--school-holiday');
            isNowHoliday = false;
        } else {
            // Toggle
            if (schoolHolidays.has(dateString)) {
                schoolHolidays.delete(dateString);
                cell.classList.remove('day-cell--school-holiday');
                isNowHoliday = false;
            } else {
                schoolHolidays.add(dateString);
                cell.classList.add('day-cell--school-holiday');
                isNowHoliday = true;
            }
        }

        return isNowHoliday;
    }

    /**
     * Get day cell from mouse/touch event
     * @param {Event} event - Mouse or touch event
     * @returns {HTMLElement|null} Day cell element or null
     */
    function getDayCellFromEvent(event) {
        const target = event.target.closest('.day-cell');
        if (target && !target.classList.contains('day-cell--empty')) {
            return target;
        }
        return null;
    }

    /**
     * Handle drag start (mousedown)
     * @param {MouseEvent} event - Mouse event
     */
    function handleDragStart(event) {
        if (event.button !== 0) return; // Only left click

        const cell = getDayCellFromEvent(event);
        if (!cell) return;
        
        const dateString = cell.dataset.date;
        if (!dateString) return;

        if (currentMode === 'school-holidays') {
            isDragging = true;
            dragStartDate = dateString;
            
            // Determine if we're adding or removing based on initial cell state
            const wasHoliday = schoolHolidays.has(dragStartDate);
            dragAction = wasHoliday ? 'remove' : 'add';
            
            // Apply action to start cell
            toggleSchoolHoliday(dragStartDate, !wasHoliday);
            
            // Add dragging class
            calendarContainer.classList.add('calendar-container--dragging');
            cell.classList.add('day-cell--drag-start');

            event.preventDefault();
        } else if (currentMode === 'book-leave') {
            // Don't allow selection of weekends
            if (cell.classList.contains('day-cell--weekend')) {
                return;
            }
            
            isDragging = true;
            dragStartDate = dateString;
            
            // Determine if we're adding or removing based on initial cell state
            const wasLeave = leaveDays.has(dragStartDate);
            dragAction = wasLeave ? 'remove' : 'add';
            
            // Apply action to start cell (for adding, check warnings)
            if (dragAction === 'add') {
                // Check for blocked day warning
                if (blockedDays.has(dateString)) {
                    if (!confirm('This day is marked as non-bookable (work event/team leave). Book leave anyway?')) {
                        isDragging = false;
                        return;
                    }
                }
                // Check for bank holiday warning
                if (cell.classList.contains('day-cell--bank-holiday')) {
                    const holidayName = cell.dataset.tooltip || 'Bank Holiday';
                    if (!confirm(`${holidayName} is a bank holiday. You may not need to use annual leave for this day. Book it anyway?`)) {
                        isDragging = false;
                        return;
                    }
                }
            }
            
            toggleLeaveDay(dragStartDate, !wasLeave);
            updateLeaveCounter();
            
            // Add dragging class
            calendarContainer.classList.add('calendar-container--dragging');
            cell.classList.add('day-cell--drag-start');

            event.preventDefault();
        } else if (currentMode === 'block-days') {
            isDragging = true;
            dragStartDate = dateString;
            
            // Determine if we're adding or removing based on initial cell state
            const wasBlocked = blockedDays.has(dragStartDate);
            dragAction = wasBlocked ? 'remove' : 'add';
            
            // Apply action to start cell
            toggleBlockedDay(dragStartDate, !wasBlocked);
            
            // Add dragging class
            calendarContainer.classList.add('calendar-container--dragging');
            cell.classList.add('day-cell--drag-start');

            event.preventDefault();
        } else if (currentMode === 'partner-leave') {
            isDragging = true;
            dragStartDate = dateString;
            
            // Determine if we're adding or removing based on initial cell state
            const wasPartnerLeave = partnerLeaveDays.has(dragStartDate);
            dragAction = wasPartnerLeave ? 'remove' : 'add';
            
            // Apply action to start cell
            togglePartnerLeaveDay(dragStartDate, !wasPartnerLeave);
            
            // Add dragging class
            calendarContainer.classList.add('calendar-container--dragging');
            cell.classList.add('day-cell--drag-start');

            event.preventDefault();
        }
    }

    /**
     * Handle drag move (mouseover while dragging)
     * @param {MouseEvent} event - Mouse event
     */
    function handleDragMove(event) {
        if (!isDragging) return;

        const cell = getDayCellFromEvent(event);
        if (!cell) return;

        const dateString = cell.dataset.date;
        if (!dateString) return;

        if (currentMode === 'school-holidays') {
            // Apply consistent action based on drag start
            const shouldBeHoliday = dragAction === 'add';
            const isCurrentlyHoliday = schoolHolidays.has(dateString);
            
            if (shouldBeHoliday !== isCurrentlyHoliday) {
                toggleSchoolHoliday(dateString, shouldBeHoliday);
            }
        } else if (currentMode === 'book-leave') {
            // Don't allow selection of weekends
            if (cell.classList.contains('day-cell--weekend')) {
                return;
            }
            
            // Skip bank holiday warning during drag (only warn on first click)
            const shouldBeLeave = dragAction === 'add';
            const isCurrentlyLeave = leaveDays.has(dateString);
            
            if (shouldBeLeave !== isCurrentlyLeave) {
                // Direct toggle without warning during drag
                if (shouldBeLeave) {
                    leaveDays.add(dateString);
                    cell.classList.add('day-cell--leave');
                } else {
                    leaveDays.delete(dateString);
                    cell.classList.remove('day-cell--leave');
                }
                updateLeaveCounter();
            }
        } else if (currentMode === 'block-days') {
            // Apply consistent action based on drag start
            const shouldBeBlocked = dragAction === 'add';
            const isCurrentlyBlocked = blockedDays.has(dateString);
            
            if (shouldBeBlocked !== isCurrentlyBlocked) {
                toggleBlockedDay(dateString, shouldBeBlocked);
            }
        } else if (currentMode === 'partner-leave') {
            // Apply consistent action based on drag start
            const shouldBePartnerLeave = dragAction === 'add';
            const isCurrentlyPartnerLeave = partnerLeaveDays.has(dateString);
            
            if (shouldBePartnerLeave !== isCurrentlyPartnerLeave) {
                togglePartnerLeaveDay(dateString, shouldBePartnerLeave);
            }
        }
    }

    /**
     * Handle drag end (mouseup)
     * @param {MouseEvent} event - Mouse event
     */
    function handleDragEnd(event) {
        if (!isDragging) return;

        isDragging = false;
        dragStartDate = null;
        dragAction = null;

        // Remove dragging classes
        calendarContainer.classList.remove('calendar-container--dragging');
        const dragStarts = calendarContainer.querySelectorAll('.day-cell--drag-start');
        dragStarts.forEach(el => el.classList.remove('day-cell--drag-start'));

        // Save to storage based on current mode
        if (currentMode === 'school-holidays') {
            saveSchoolHolidays();
            console.log(`School holidays saved: ${schoolHolidays.size} days`);
        } else if (currentMode === 'book-leave') {
            saveLeaveDays();
            console.log(`Leave days saved: ${leaveDays.size} days`);
            
            // Check for over-allocation after drag ends
            if (leaveDays.size > leaveAllowance) {
                alert(`Warning: You have booked ${leaveDays.size} days but only have ${leaveAllowance} days allowance.`);
            }
        } else if (currentMode === 'block-days') {
            saveBlockedDays();
            console.log(`Blocked days saved: ${blockedDays.size} days`);
        } else if (currentMode === 'partner-leave') {
            savePartnerLeaveDays();
            console.log(`Partner leave days saved: ${partnerLeaveDays.size} days`);
        }
    }

    /**
     * Handle touch start
     * @param {TouchEvent} event - Touch event
     */
    function handleTouchStart(event) {
        const touch = event.touches[0];
        const cell = document.elementFromPoint(touch.clientX, touch.clientY);
        const dayCell = cell?.closest('.day-cell');
        
        if (!dayCell || dayCell.classList.contains('day-cell--empty')) return;
        
        const dateString = dayCell.dataset.date;
        if (!dateString) return;

        if (currentMode === 'school-holidays') {
            isDragging = true;
            dragStartDate = dateString;
            
            const wasHoliday = schoolHolidays.has(dragStartDate);
            dragAction = wasHoliday ? 'remove' : 'add';
            
            toggleSchoolHoliday(dragStartDate, !wasHoliday);
            calendarContainer.classList.add('calendar-container--dragging');
            dayCell.classList.add('day-cell--drag-start');
            
            event.preventDefault();
        } else if (currentMode === 'book-leave') {
            // Don't allow selection of weekends
            if (dayCell.classList.contains('day-cell--weekend')) {
                return;
            }
            
            isDragging = true;
            dragStartDate = dateString;
            
            const wasLeave = leaveDays.has(dragStartDate);
            dragAction = wasLeave ? 'remove' : 'add';
            
            // Check bank holiday warning
            if (dragAction === 'add' && dayCell.classList.contains('day-cell--bank-holiday')) {
                const holidayName = dayCell.dataset.tooltip || 'Bank Holiday';
                if (!confirm(`${holidayName} is a bank holiday. You may not need to use annual leave for this day. Book it anyway?`)) {
                    isDragging = false;
                    return;
                }
            }
            
            toggleLeaveDay(dragStartDate, !wasLeave);
            updateLeaveCounter();
            calendarContainer.classList.add('calendar-container--dragging');
            dayCell.classList.add('day-cell--drag-start');
            
            event.preventDefault();
        }
    }

    /**
     * Handle touch move
     * @param {TouchEvent} event - Touch event
     */
    function handleTouchMove(event) {
        if (!isDragging) return;
        
        const touch = event.touches[0];
        const cell = document.elementFromPoint(touch.clientX, touch.clientY);
        const dayCell = cell?.closest('.day-cell');
        
        if (!dayCell || dayCell.classList.contains('day-cell--empty')) return;
        
        const dateString = dayCell.dataset.date;
        if (!dateString) return;

        if (currentMode === 'school-holidays') {
            const shouldBeHoliday = dragAction === 'add';
            const isCurrentlyHoliday = schoolHolidays.has(dateString);
            
            if (shouldBeHoliday !== isCurrentlyHoliday) {
                toggleSchoolHoliday(dateString, shouldBeHoliday);
            }
        } else if (currentMode === 'book-leave') {
            // Don't allow selection of weekends
            if (dayCell.classList.contains('day-cell--weekend')) {
                return;
            }
            
            const shouldBeLeave = dragAction === 'add';
            const isCurrentlyLeave = leaveDays.has(dateString);
            
            if (shouldBeLeave !== isCurrentlyLeave) {
                if (shouldBeLeave) {
                    leaveDays.add(dateString);
                    dayCell.classList.add('day-cell--leave');
                } else {
                    leaveDays.delete(dateString);
                    dayCell.classList.remove('day-cell--leave');
                }
                updateLeaveCounter();
            }
        }
        
        event.preventDefault();
    }

    /**
     * Handle touch end
     * @param {TouchEvent} event - Touch event
     */
    function handleTouchEnd(event) {
        handleDragEnd(event);
    }

    /**
     * Handle clear selection button
     */
    function handleClearSelection() {
        if (currentMode === 'school-holidays') {
            if (schoolHolidays.size === 0) {
                console.log('No school holidays to clear');
                return;
            }
            
            // Confirm before clearing
            const count = schoolHolidays.size;
            if (confirm(`Clear all ${count} school holiday days?`)) {
                schoolHolidays.clear();
                renderSchoolHolidays();
                saveSchoolHolidays();
                console.log('School holidays cleared');
            }
        } else if (currentMode === 'book-leave') {
            if (leaveDays.size === 0) {
                console.log('No leave days to clear');
                return;
            }
            
            // Confirm before clearing
            const count = leaveDays.size;
            if (confirm(`Clear all ${count} booked leave days?`)) {
                leaveDays.clear();
                renderLeaveDays();
                saveLeaveDays();
                updateLeaveCounter();
                console.log('Leave days cleared');
            }
        } else if (currentMode === 'block-days') {
            if (blockedDays.size === 0) {
                console.log('No blocked days to clear');
                return;
            }
            
            // Confirm before clearing
            const count = blockedDays.size;
            if (confirm(`Clear all ${count} blocked days?`)) {
                blockedDays.clear();
                renderBlockedDays();
                saveBlockedDays();
                console.log('Blocked days cleared');
            }
        } else if (currentMode === 'partner-leave') {
            if (partnerLeaveDays.size === 0) {
                console.log('No partner leave days to clear');
                return;
            }
            
            // Confirm before clearing
            const count = partnerLeaveDays.size;
            if (confirm(`Clear all ${count} partner leave days?`)) {
                partnerLeaveDays.clear();
                partnerName = '';
                renderPartnerLeaveDays();
                savePartnerLeaveDays();
                console.log('Partner leave days cleared');
            }
        }
    }

    /**
     * Update the year display
     */
    function updateYearDisplay() {
        if (yearDisplay) {
            yearDisplay.textContent = Calendar.getYear();
        }
    }

    /**
     * Handle previous year button click
     */
    function handlePrevYear() {
        Calendar.prevYear();
        updateYearDisplay();
        renderSchoolHolidays();
        renderLeaveDays();
        renderBlockedDays();
        renderPartnerLeaveDays();
    }

    /**
     * Handle next year button click
     */
    function handleNextYear() {
        Calendar.nextYear();
        updateYearDisplay();
        renderSchoolHolidays();
        renderLeaveDays();
        renderBlockedDays();
    }

    /**
     * Handle region selection change
     * @param {Event} event - Change event
     */
    function handleRegionChange(event) {
        const newRegion = event.target.value;
        
        if (newRegion !== currentRegion) {
            currentRegion = newRegion;
            Calendar.setRegion(newRegion);
            saveSettings();
            renderSchoolHolidays();
            renderLeaveDays();
            renderBlockedDays();
            
            console.log(`Region changed to: ${BankHolidays.getRegionDisplayName(newRegion)}`);
        }
    }

    /**
     * Open settings modal
     */
    function openSettingsModal() {
        if (settingsModal) {
            settingsModal.hidden = false;
            document.body.style.overflow = 'hidden';
            // Focus the close button for accessibility
            settingsCloseBtn?.focus();
        }
    }

    /**
     * Close settings modal
     */
    function closeSettingsModal() {
        if (settingsModal) {
            settingsModal.hidden = true;
            document.body.style.overflow = '';
            // Return focus to settings button
            settingsBtn?.focus();
        }
    }

    /**
     * Open help modal
     */
    function openHelpModal() {
        if (helpModal) {
            helpModal.hidden = false;
            document.body.style.overflow = 'hidden';
            // Focus the close button for accessibility
            helpCloseBtn?.focus();
        }
    }

    /**
     * Close help modal
     */
    function closeHelpModal() {
        if (helpModal) {
            helpModal.hidden = true;
            document.body.style.overflow = '';
            // Return focus to help button
            helpBtn?.focus();
        }
    }

    /**
     * Open share modal
     */
    function openShareModal() {
        if (shareModal) {
            // Reset modal state
            if (shareUrlCopied) shareUrlCopied.hidden = true;
            
            // Update leave count in intro text
            if (shareLeaveCount) shareLeaveCount.textContent = leaveDays.size;
            
            // Auto-generate the share URL
            generateShareUrl();
            
            shareModal.hidden = false;
            document.body.style.overflow = 'hidden';
            // Focus the name input
            partnerNameInput?.focus();
            
            // Update URL when name changes
            if (partnerNameInput) {
                partnerNameInput.addEventListener('input', generateShareUrl);
            }
        }
    }
    
    /**
     * Generate share URL (called on modal open and name input change)
     */
    function generateShareUrl() {
        const name = partnerNameInput?.value.trim() || 'Partner';
        
        const url = Partner.generateShareURL(name, Array.from(leaveDays));
        
        if (url && shareUrlOutput) {
            shareUrlOutput.value = url;
        }
    }

    /**
     * Close share modal
     */
    function closeShareModal() {
        if (shareModal) {
            shareModal.hidden = true;
            document.body.style.overflow = '';
            // Return focus to share button
            sharePartnerBtn?.focus();
        }
    }

    /**
     * Handle generate share URL button
     */
    // handleGenerateShareUrl removed - now auto-generates on modal open

    /**
     * Handle copy share URL button
     */
    async function handleCopyShareUrl() {
        const url = shareUrlOutput?.value;
        if (!url) return;
        
        const success = await Partner.copyToClipboard(url);
        
        if (success && shareUrlCopied) {
            shareUrlCopied.hidden = false;
            // Hide after 3 seconds
            setTimeout(() => {
                shareUrlCopied.hidden = true;
            }, 3000);
            
            // Show support toast after a short delay
            setTimeout(showSupportToast, 1500);
        }
    }

    /**
     * Handle clear partner data button
     */
    function handleClearPartnerData() {
        Partner.clearPartnerData();
        hidePartnerOverlay();
        // Re-render to clear partner styles
        Calendar.render();
        renderSchoolHolidays();
        renderLeaveDays();
        renderBlockedDays();
    }


    /**
     * Check for partner data in URL and load if present
     */
    function checkForPartnerData() {
        const partnerData = Partner.loadFromURL();
        
        if (partnerData) {
            console.log('Partner data found in URL:', partnerData.name, partnerData.leaveDays.length, 'days');
            // Store for import and show modal
            pendingPartnerImport = partnerData;
            openImportModal(partnerData);
        }
    }

    // Pending partner import data
    let pendingPartnerImport = null;

    /**
     * Open import partner modal
     * @param {Object} partnerData - Partner data to import
     */
    function openImportModal(partnerData) {
        if (importPartnerModal) {
            if (importPartnerNameEl) importPartnerNameEl.textContent = partnerData.name || 'Your partner';
            if (importLeaveCountEl) importLeaveCountEl.textContent = partnerData.leaveDays.length;
            
            importPartnerModal.hidden = false;
            document.body.style.overflow = 'hidden';
            importAcceptBtn?.focus();
        }
    }

    /**
     * Close import partner modal
     */
    function closeImportModal() {
        if (importPartnerModal) {
            importPartnerModal.hidden = true;
            document.body.style.overflow = '';
            // Clear URL hash
            Partner.clearPartnerData();
        }
        pendingPartnerImport = null;
    }

    /**
     * Open export help modal
     */
    function openExportHelpModal() {
        if (exportHelpModal) {
            exportHelpModal.hidden = false;
            document.body.style.overflow = 'hidden';
            exportHelpCloseBtn?.focus();
        }
    }

    /**
     * Close export help modal
     */
    function closeExportHelpModal() {
        if (exportHelpModal) {
            exportHelpModal.hidden = true;
            document.body.style.overflow = '';
        }
    }

    /**
     * Show support toast
     */
    function showSupportToast() {
        // Only show if not shown in this session
        const shown = sessionStorage.getItem('supportToastShown');
        if (shown) return;
        
        if (supportToast) {
            supportToast.hidden = false;
            // Auto-hide after 10 seconds
            setTimeout(hideSupportToast, 10000);
            sessionStorage.setItem('supportToastShown', 'true');
        }
    }

    /**
     * Hide support toast
     */
    function hideSupportToast() {
        if (supportToast) {
            supportToast.hidden = true;
        }
    }

    // =========================================================================
    // Suggest School Holidays Modal
    // =========================================================================

    /**
     * Open suggest holidays modal
     */
    function openSuggestHolidaysModal() {
        if (!suggestHolidaysModal) return;
        
        // Populate year options
        if (suggestYearSelect) {
            const years = SchoolHolidayPatterns.getAvailableYears();
            suggestYearSelect.innerHTML = years.map(y => 
                `<option value="${y.value}">${y.label}</option>`
            ).join('');
        }
        
        // Set region to match current app region
        if (suggestRegionSelect) {
            suggestRegionSelect.value = currentRegion;
        }
        
        // Generate initial preview
        updateSuggestPreview();
        
        // Show modal
        suggestHolidaysModal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close suggest holidays modal
     */
    function closeSuggestHolidaysModal() {
        if (suggestHolidaysModal) {
            suggestHolidaysModal.hidden = true;
            document.body.style.overflow = '';
        }
    }

    /**
     * Update the preview in the suggest holidays modal
     */
    function updateSuggestPreview() {
        if (!suggestYearSelect || !suggestRegionSelect || !suggestPreviewList) return;
        
        const year = parseInt(suggestYearSelect.value);
        const region = suggestRegionSelect.value;
        
        // Generate holidays
        const holidayData = SchoolHolidayPatterns.generateHolidays(year, region);
        
        // Build preview list
        suggestPreviewList.innerHTML = holidayData.holidays.map(h => `
            <li>
                <span class="holiday-name">${h.name}</span>
                <span class="holiday-dates">${SchoolHolidayPatterns.formatDateRange(h.start, h.end)}</span>
            </li>
        `).join('');
        
        // Show total days
        const allDates = SchoolHolidayPatterns.getAllDates(holidayData);
        if (suggestPreviewTotal) {
            suggestPreviewTotal.textContent = `${allDates.length} days total`;
        }
    }

    /**
     * Apply suggested holidays to the calendar
     */
    function applySuggestedHolidays() {
        if (!suggestYearSelect || !suggestRegionSelect) return;
        
        const year = parseInt(suggestYearSelect.value);
        const region = suggestRegionSelect.value;
        
        // Generate holidays
        const holidayData = SchoolHolidayPatterns.generateHolidays(year, region);
        const allDates = SchoolHolidayPatterns.getAllDates(holidayData);
        
        // Add to school holidays set
        allDates.forEach(date => schoolHolidays.add(date));
        
        // Save to storage
        Storage.save('schoolHolidays', Array.from(schoolHolidays));
        
        // Re-render school holidays on calendar
        renderSchoolHolidays();
        
        // Close modal
        closeSuggestHolidaysModal();
        
        console.log(`Applied ${allDates.length} suggested school holiday days for ${holidayData.academicYear}`);
    }

    /**
     * Handle importing partner data
     */
    function handleImportPartnerData() {
        if (!pendingPartnerImport) {
            closeImportModal();
            return;
        }

        // Import partner's leave days
        partnerLeaveDays.clear();
        pendingPartnerImport.leaveDays.forEach(d => partnerLeaveDays.add(d));
        partnerName = pendingPartnerImport.name || 'Partner';
        
        // Save to storage
        savePartnerLeaveDays();
        
        // Render on calendar
        renderPartnerLeaveDays();
        
        // Close modal and clear URL
        closeImportModal();
        
        // Show confirmation
        alert(`Imported ${partnerLeaveDays.size} leave days from ${partnerName}!`);
    }

    /**
     * Toggle partner leave day
     * @param {string} dateString - ISO date string
     * @param {boolean} forceAdd - Force add (true), force remove (false), or toggle (undefined)
     */
    function togglePartnerLeaveDay(dateString, forceAdd) {
        const cell = Calendar.getDayCell(dateString);
        if (!cell) return false;

        const hasDay = partnerLeaveDays.has(dateString);
        const shouldAdd = forceAdd !== undefined ? forceAdd : !hasDay;

        if (shouldAdd && !hasDay) {
            partnerLeaveDays.add(dateString);
            cell.classList.add('day-cell--partner-leave');
        } else if (!shouldAdd && hasDay) {
            partnerLeaveDays.delete(dateString);
            cell.classList.remove('day-cell--partner-leave');
        }

        return shouldAdd;
    }

    /**
     * Render partner leave days on calendar
     */
    function renderPartnerLeaveDays() {
        // Clear existing
        document.querySelectorAll('.day-cell--partner-leave').forEach(cell => {
            cell.classList.remove('day-cell--partner-leave');
        });

        // Add partner leave styling
        partnerLeaveDays.forEach(dateString => {
            const cell = Calendar.getDayCell(dateString);
            if (cell) {
                cell.classList.add('day-cell--partner-leave');
            }
        });
    }

    /**
     * Save partner leave days to storage
     */
    function savePartnerLeaveDays() {
        const data = Storage.load();
        data.partnerLeaveDays = Array.from(partnerLeaveDays);
        data.partnerName = partnerName;
        Storage.save(data);
    }

    /**
     * Load partner leave days from storage
     */
    function loadPartnerLeaveDays() {
        const data = Storage.load();
        partnerLeaveDays.clear();
        if (data.partnerLeaveDays && Array.isArray(data.partnerLeaveDays)) {
            data.partnerLeaveDays.forEach(d => partnerLeaveDays.add(d));
        }
        partnerName = data.partnerName || '';
    }

    /**
     * Handle year start month change
     */
    function handleYearStartChange() {
        const newStartMonth = parseInt(yearStartSelect.value, 10);
        
        if (!isNaN(newStartMonth) && newStartMonth >= 0 && newStartMonth <= 11) {
            yearStartMonth = newStartMonth;
            
            // Save to storage
            if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
                Storage.updateSettings({ yearStartMonth: yearStartMonth });
            }
            
            // Re-render calendar with new start month
            Calendar.setStartMonth(yearStartMonth);
            renderSchoolHolidays();
            renderLeaveDays();
            renderBlockedDays();
            
            console.log(`Year start changed to: ${getMonthName(yearStartMonth)}`);
        }
    }

    /**
     * Get month name from index
     * @param {number} monthIndex - 0-11
     * @returns {string} Month name
     */
    function getMonthName(monthIndex) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[monthIndex] || 'January';
    }

    /**
     * Handle export data button
     */
    function handleExportData() {
        const data = {
            settings: {
                region: currentRegion,
                leaveAllowance: leaveAllowance,
                yearStartMonth: yearStartMonth
            },
            schoolHolidays: schoolHolidays,
            leaveDays: leaveDays,
            blockedDays: blockedDays
        };
        
        Export.exportJSON(data);
    }

    /**
     * Handle import data
     */
    async function handleImportData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const imported = await Export.importJSON(file);
            
            // Confirm before overwriting
            if (!confirm('This will replace all your current data. Continue?')) {
                event.target.value = '';
                return;
            }
            
            // Apply imported data
            if (imported.settings) {
                if (imported.settings.region) {
                    currentRegion = imported.settings.region;
                    if (regionSelect) regionSelect.value = currentRegion;
                    Calendar.setRegion(currentRegion);
                }
                if (imported.settings.leaveAllowance !== undefined) {
                    leaveAllowance = imported.settings.leaveAllowance;
                    if (leaveAllowanceInput) leaveAllowanceInput.value = leaveAllowance;
                }
                if (imported.settings.yearStartMonth !== undefined) {
                    yearStartMonth = imported.settings.yearStartMonth;
                    if (yearStartSelect) yearStartSelect.value = yearStartMonth.toString();
                    Calendar.setStartMonth(yearStartMonth);
                }
            }
            
            if (imported.schoolHolidays) {
                schoolHolidays = new Set(imported.schoolHolidays);
            }
            
            if (imported.leaveDays) {
                leaveDays = new Set(imported.leaveDays);
            }
            
            if (imported.blockedDays) {
                blockedDays = new Set(imported.blockedDays);
            }
            
            // Re-render and save
            renderSchoolHolidays();
            renderLeaveDays();
            renderBlockedDays();
            updateLeaveCounter();
            saveSchoolHolidays();
            saveLeaveDays();
            saveBlockedDays();
            
            if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
                Storage.updateSettings({
                    region: currentRegion,
                    leaveAllowance: leaveAllowance,
                    yearStartMonth: yearStartMonth
                });
            }
            
            alert('Data imported successfully!');
            closeSettingsModal();
            
        } catch (err) {
            alert('Failed to import data: ' + err.message);
        }
        
        // Reset file input
        event.target.value = '';
    }

    /**
     * Handle clear all data
     */
    function handleClearAllData() {
        if (!confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
            return;
        }
        
        if (!confirm('This will delete all your school holidays, leave bookings, and settings. Really continue?')) {
            return;
        }
        
        // Clear all data
        schoolHolidays.clear();
        leaveDays.clear();
        blockedDays.clear();
        leaveAllowance = 25;
        yearStartMonth = 0;
        currentRegion = 'england';
        
        // Update UI
        if (regionSelect) regionSelect.value = 'england';
        if (leaveAllowanceInput) leaveAllowanceInput.value = 25;
        if (yearStartSelect) yearStartSelect.value = '0';
        
        // Re-render
        Calendar.setRegion('england');
        Calendar.setStartMonth(0);
        renderSchoolHolidays();
        renderLeaveDays();
        renderBlockedDays();
        updateLeaveCounter();
        
        // Clear storage
        if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
            Storage.clear();
        }
        
        alert('All data has been cleared.');
        closeSettingsModal();
    }

    /**
     * Handle print summary button
     */
    function handlePrintSummary() {
        const data = {
            year: Calendar.getYear(),
            region: currentRegion,
            regionDisplayName: BankHolidays.getRegionDisplayName(currentRegion),
            leaveAllowance: leaveAllowance,
            leaveDays: leaveDays,
            schoolHolidays: schoolHolidays,
            blockedDays: blockedDays
        };
        
        Export.printSummary(data);
        
        // Show support toast after a short delay
        setTimeout(showSupportToast, 2000);
    }

    /**
     * Handle export to iCal
     */
    function handleExportICal() {
        const data = {
            year: Calendar.getYear(),
            leaveDays: leaveDays
        };
        
        Export.downloadICal(data);
        
        // Show help modal with import instructions
        openExportHelpModal();
    }

    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    function handleKeyDown(event) {
        // Only handle if not in an input field
        if (event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA' ||
            event.target.tagName === 'SELECT') {
            return;
        }

        // Handle day cell keyboard activation
        if (event.target.classList.contains('day-cell') && 
            !event.target.classList.contains('day-cell--empty')) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleDayCellKeyPress(event.target);
                return;
            }
        }

        switch (event.key) {
            case 'ArrowLeft':
                if (event.ctrlKey || event.metaKey) {
                    handlePrevYear();
                    event.preventDefault();
                }
                break;
            case 'ArrowRight':
                if (event.ctrlKey || event.metaKey) {
                    handleNextYear();
                    event.preventDefault();
                }
                break;
            case '1':
                if (event.altKey) {
                    setMode('school-holidays');
                    event.preventDefault();
                }
                break;
            case '2':
                if (event.altKey) {
                    setMode('book-leave');
                    event.preventDefault();
                }
                break;
            case '3':
                if (event.altKey) {
                    setMode('block-days');
                    event.preventDefault();
                }
                break;
            case 'Escape':
                // Close modals if open
                if (settingsModal && !settingsModal.hidden) {
                    closeSettingsModal();
                    event.preventDefault();
                } else if (helpModal && !helpModal.hidden) {
                    closeHelpModal();
                    event.preventDefault();
                } else if (shareModal && !shareModal.hidden) {
                    closeShareModal();
                    event.preventDefault();
                }
                break;
            case '?':
                // Open help modal
                openHelpModal();
                event.preventDefault();
                break;
        }
    }

    /**
     * Handle keyboard press on day cell (Enter or Space)
     * @param {HTMLElement} cell - Day cell element
     */
    function handleDayCellKeyPress(cell) {
        const dateString = cell.dataset.date;
        if (!dateString) return;

        if (currentMode === 'school-holidays') {
            const wasHoliday = schoolHolidays.has(dateString);
            toggleSchoolHoliday(dateString, !wasHoliday);
            saveSchoolHolidays();
        } else if (currentMode === 'book-leave') {
            // Skip weekends
            if (cell.classList.contains('day-cell--weekend')) {
                return;
            }
            
            const wasLeave = leaveDays.has(dateString);
            
            // Check warnings for adding
            if (!wasLeave) {
                if (blockedDays.has(dateString)) {
                    if (!confirm('This day is marked as non-bookable. Book leave anyway?')) {
                        return;
                    }
                }
                if (cell.classList.contains('day-cell--bank-holiday')) {
                    const holidayName = cell.dataset.tooltip || 'Bank Holiday';
                    if (!confirm(`${holidayName} is a bank holiday. Book it anyway?`)) {
                        return;
                    }
                }
            }
            
            toggleLeaveDay(dateString, !wasLeave);
            updateLeaveCounter();
            saveLeaveDays();
        } else if (currentMode === 'block-days') {
            const wasBlocked = blockedDays.has(dateString);
            toggleBlockedDay(dateString, !wasBlocked);
            saveBlockedDays();
        } else if (currentMode === 'partner-leave') {
            const wasPartnerLeave = partnerLeaveDays.has(dateString);
            togglePartnerLeaveDay(dateString, !wasPartnerLeave);
            savePartnerLeaveDays();
        }
    }

    /**
     * Get current region
     * @returns {string} Current region
     */
    function getRegion() {
        return currentRegion;
    }

    /**
     * Set region programmatically
     * @param {string} region - Region to set
     */
    function setRegion(region) {
        const validRegions = ['england', 'scotland', 'northern-ireland'];
        if (validRegions.includes(region)) {
            currentRegion = region;
            
            if (regionSelect) {
                regionSelect.value = region;
            }
            
            Calendar.setRegion(region);
            saveSettings();
            renderSchoolHolidays();
            renderLeaveDays();
        }
    }

    /**
     * Get current mode
     * @returns {string} Current mode
     */
    function getMode() {
        return currentMode;
    }

    /**
     * Get school holidays
     * @returns {Set} Set of school holiday date strings
     */
    function getSchoolHolidays() {
        return new Set(schoolHolidays);
    }

    /**
     * Get leave days
     * @returns {Set} Set of leave day date strings
     */
    function getLeaveDays() {
        return new Set(leaveDays);
    }

    /**
     * Get leave allowance
     * @returns {number} Leave allowance
     */
    function getLeaveAllowance() {
        return leaveAllowance;
    }

    /**
     * Set leave allowance programmatically
     * @param {number} allowance - New allowance
     */
    function setLeaveAllowance(allowance) {
        if (!isNaN(allowance) && allowance >= 0 && allowance <= 99) {
            leaveAllowance = allowance;
            if (leaveAllowanceInput) {
                leaveAllowanceInput.value = allowance;
            }
            updateLeaveCounter();
            if (typeof Storage !== 'undefined' && Storage.isAvailable()) {
                Storage.updateSettings({ leaveAllowance: allowance });
            }
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        init,
        getYear: () => Calendar.getYear(),
        setYear: (year) => {
            Calendar.setYear(year);
            updateYearDisplay();
            renderSchoolHolidays();
            renderLeaveDays();
        },
        getRegion,
        setRegion,
        getMode,
        setMode,
        getSchoolHolidays,
        getLeaveDays,
        getLeaveAllowance,
        setLeaveAllowance
    };
})();
