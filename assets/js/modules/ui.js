/**
 * Satu Ramadhan - UI Module
 * Handler untuk user interface dan DOM manipulation
 */

const SaturaUI = (function () {
    'use strict';

    // DOM Elements Cache
    const elements = {};

    // State
    let isInitialized = false;
    let currentModal = null;

    // Security: escape HTML entities to prevent XSS
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const s = String(str);
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    // ===========================================
    // INITIALIZATION
    // ===========================================

    /**
     * Initialize UI module
     */
    function init() {
        if (isInitialized) return;

        cacheElements();
        bindEvents();
        setupMobileMenu();
        setupFooter(); // Add footer setup

        isInitialized = true;
        SaturaConfig.log('UI module initialized');

        // SAFETY: Force hide skeletons after 5 seconds max to prevent stuck loading state
        setTimeout(() => {
            if (document.getElementById('prayerTimesSkeleton') && !document.getElementById('prayerTimesSkeleton').classList.contains('hidden')) {
                hideSkeletons();
                SaturaConfig.log('Safety timeout: Skeletons forced hidden');
            }
        }, 5000);
    }

    /**
     * Setup footer content dynamically
     */
    function setupFooter() {
        const author = SaturaConfig.AUTHOR;
        const currentYear = new Date().getFullYear();

        // 1. Update Copyright
        const copyrightEl = document.getElementById('footerCopyright');
        if (copyrightEl) {
            copyrightEl.textContent = '';
            copyrightEl.appendChild(document.createTextNode(`\u00A9 ${currentYear} `));
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'footer__highlight';
            highlightSpan.textContent = author.copyright;
            highlightSpan.style.cursor = 'pointer';
            highlightSpan.setAttribute('title', 'Kunjungi Portofolio');
            highlightSpan.addEventListener('click', () => window.open(author.website, '_blank', 'noopener,noreferrer'));
            copyrightEl.appendChild(highlightSpan);
            copyrightEl.appendChild(document.createTextNode('. All rights reserved.'));
        }

        // 2. Update Social Links
        const socialContainer = document.querySelector('.footer__social');
        if (socialContainer && author.social) {
            socialContainer.innerHTML = ''; // Clear existing

            // Generate based on config
            Object.keys(author.social).forEach(key => {
                const social = author.social[key];
                if (social && social.url) {
                    const link = document.createElement('a');
                    link.href = social.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'footer__social-link';
                    link.setAttribute('aria-label', key);

                    // Map key to boxicon class
                    let iconClass = 'bx bxl-globe'; // default
                    if (key === 'github') iconClass = 'bx bxl-github';
                    if (key === 'instagram') iconClass = 'bx bxl-instagram';
                    if (key === 'twitter') iconClass = 'bx bxl-twitter';
                    if (key === 'linkedin') iconClass = 'bx bxl-linkedin';

                    const icon = document.createElement('i');
                    icon.className = iconClass;
                    link.appendChild(icon);
                    socialContainer.appendChild(link);
                }
            });
        }
    }

    /**
     * Cache DOM elements for performance
     */
    function cacheElements() {
        elements.app = document.getElementById('app');
        elements.header = document.getElementById('header');
        elements.menuToggle = document.getElementById('menuToggle');
        elements.headerNav = document.getElementById('headerNav');

        // Hero
        elements.heroTitle = document.getElementById('heroTitle');
        elements.heroSubtitle = document.getElementById('heroSubtitle');
        elements.heroBadge = document.getElementById('heroBadge');

        // Location
        elements.locationName = document.getElementById('locationName');
        elements.locationBtn = document.getElementById('locationBtn');

        // Schedule
        elements.scheduleTableBody = document.getElementById('scheduleTableBody');

        // Countdown
        elements.countdownCard = document.getElementById('countdownCard');
        elements.countdownSkeleton = document.getElementById('countdownSkeleton');
        elements.countdownPrayerName = document.getElementById('countdownPrayerName');
        elements.countdownHours = document.getElementById('countdownHours');
        elements.countdownMinutes = document.getElementById('countdownMinutes');
        elements.countdownSeconds = document.getElementById('countdownSeconds');

        // Modal
        elements.locationModal = document.getElementById('locationModal');
        elements.modalClose = document.querySelectorAll('.modal__close, .modal__backdrop');
        elements.provinceSelect = document.getElementById('provinceSelect');
        elements.regencyList = document.getElementById('regencyList');
        elements.searchLocation = document.getElementById('searchLocation');

        // Loading & Status
        elements.loadingOverlay = document.getElementById('loadingOverlay');
        elements.statusIndicator = document.getElementById('statusIndicator');

        // Skeletons
        elements.prayerTimesSkeleton = document.getElementById('prayerTimesSkeleton');
        elements.prayerTimesGrid = document.getElementById('prayerTimesGrid');
    }

    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Location button
        if (elements.locationBtn) {
            elements.locationBtn.addEventListener('click', openLocationModal);
        }

        // Modal close
        elements.modalClose?.forEach(el => {
            el.addEventListener('click', closeModal);
        });

        // Province select
        if (elements.provinceSelect) {
            elements.provinceSelect.addEventListener('change', handleProvinceChange);
        }

        // Search location
        if (elements.searchLocation) {
            elements.searchLocation.addEventListener('input', debounce(handleSearchLocation, 300));
        }

        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && currentModal) {
                closeModal();
            }
        });
    }

    /**
     * Setup mobile menu functionality
     */
    function setupMobileMenu() {
        if (!elements.menuToggle) return;

        elements.menuToggle.addEventListener('click', () => {
            elements.headerNav?.classList.toggle('is-active');
            const icon = elements.menuToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('bx-menu');
                icon.classList.toggle('bx-x');
            }
        });

        // Close menu when clicking nav links
        const navLinks = document.querySelectorAll('.nav__link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                elements.headerNav?.classList.remove('is-active');
            });
        });
    }

    // ===========================================
    // DISPLAY FUNCTIONS
    // ===========================================

    /**
     * Update location display
     * @param {string} name - Location name
     */
    function updateLocation(name) {
        if (elements.locationName) {
            elements.locationName.textContent = name || 'Pilih Lokasi';
        }
    }

    /**
     * Update prayer schedule table
     * @param {Array} times - Ordered prayer times array
     * @param {Object} schedule - Full schedule object
     */
    function updateScheduleTable(times, schedule) {
        if (!elements.scheduleTableBody || !times) return;

        // Clear existing rows
        elements.scheduleTableBody.innerHTML = '';

        // Get today's date info
        const dateInfo = schedule?.date || {};
        const hijriDay = dateInfo.hijri?.day || '-';
        const gregorianDate = formatGregorianDate(dateInfo.gregorian?.date);
        const dayName = getDayName(new Date());

        // Create single row for today
        const row = document.createElement('tr');
        row.classList.add('is-today', 'animate-fade-in');

        // Find key times
        const imsak = times.find(t => t.key === 'imsak');
        const fajr = times.find(t => t.key === 'fajr');
        const sunrise = times.find(t => t.key === 'sunrise');
        const maghrib = times.find(t => t.key === 'maghrib');

        // Escape helper for security
        const esc = (s) => {
            if (s === null || s === undefined) return '';
            const d = document.createElement('div');
            d.textContent = String(s);
            return d.innerHTML;
        };

        row.innerHTML = `
            <td class="text-accent font-bold">${esc(hijriDay)}</td>
            <td>${esc(gregorianDate)}</td>
            <td>${esc(dayName)}</td>
            <td class="time-primary">${esc(imsak?.time || fajr?.time || '-')}</td>
            <td class="time-primary">${esc(sunrise?.time || '-')}</td>
            <td class="time-accent font-bold">${esc(maghrib?.time || '-')}</td>
        `;

        elements.scheduleTableBody.appendChild(row);

        // If we have weekly data, add more rows (for future implementation)
    }

    /**
     * Update full prayer times display
     * @param {Array} times - Ordered prayer times
     */
    function updatePrayerTimes(times) {
        if (!times) return;

        // HIDE SKELETON logic must be robust
        if (elements.prayerTimesSkeleton) {
            elements.prayerTimesSkeleton.classList.add('hidden');
            elements.prayerTimesSkeleton.style.display = 'none'; // Force style hide as backup
        }
        if (elements.prayerTimesGrid) {
            elements.prayerTimesGrid.classList.remove('hidden');
            elements.prayerTimesGrid.style.display = ''; // Ensure grid is visible
        }

        // Always rebuild grid when updating to ensure structure matches
        const html = times.map(prayer => `
            <div id="prayer-${escapeHTML(prayer.key)}" class="prayer-time-item ${prayer.isNext ? 'is-next' : ''}">
                <div class="prayer-time-item__name">${escapeHTML(prayer.name)}</div>
                <div class="prayer-time-item__time">${escapeHTML(prayer.time)}</div>
            </div>
        `).join('');
        elements.prayerTimesGrid.innerHTML = html;
    }

    /**
     * Update countdown display
     * @param {Object} nextPrayer - Next prayer info
     */
    function updateCountdown(nextPrayer) {
        if (!nextPrayer) return;

        // Hide skeleton, show card
        if (elements.countdownSkeleton) {
            elements.countdownSkeleton.classList.add('hidden');
            elements.countdownSkeleton.style.display = 'none'; // Force style hide
        }
        if (elements.countdownCard) elements.countdownCard.classList.remove('hidden');

        // Update prayer name
        if (elements.countdownPrayerName) {
            elements.countdownPrayerName.textContent = nextPrayer.name || '-';
        }

        // Update timer
        if (nextPrayer.remaining) {
            const { hours, minutes, seconds } = nextPrayer.remaining;

            if (elements.countdownHours) {
                elements.countdownHours.textContent = String(hours).padStart(2, '0');
            }
            if (elements.countdownMinutes) {
                elements.countdownMinutes.textContent = String(minutes).padStart(2, '0');
            }
            if (elements.countdownSeconds) {
                elements.countdownSeconds.textContent = String(seconds).padStart(2, '0');
            }
        } else {
            // Tomorrow's prayer
            if (elements.countdownHours) elements.countdownHours.textContent = '--';
            if (elements.countdownMinutes) elements.countdownMinutes.textContent = '--';
            if (elements.countdownSeconds) elements.countdownSeconds.textContent = '--';
        }
    }

    /**
     * Update hero section with date info
     * @param {Object} dateInfo - Date information
     */
    function updateHeroDate(dateInfo) {
        if (!dateInfo) return;

        // Update badge with Hijri date
        if (elements.heroBadge && dateInfo.hijri) {
            const hijri = dateInfo.hijri;
            const isRamadhan = hijri.month?.number === 9;

            if (isRamadhan) {
                elements.heroBadge.textContent = '';
                elements.heroBadge.appendChild(document.createTextNode('Ramadhan'));
                elements.heroBadge.appendChild(document.createElement('br'));
                elements.heroBadge.appendChild(document.createTextNode(`${hijri.year} H`));
            } else {
                elements.heroBadge.textContent = '';
                elements.heroBadge.appendChild(document.createTextNode(hijri.month?.en || ''));
                elements.heroBadge.appendChild(document.createElement('br'));
                elements.heroBadge.appendChild(document.createTextNode(`${hijri.year} H`));
            }
        }
    }

    // ===========================================
    // MODAL FUNCTIONS
    // ===========================================

    /**
     * Open location modal
     */
    async function openLocationModal() {
        if (!elements.locationModal) return;

        currentModal = elements.locationModal;
        elements.locationModal.classList.add('is-active');
        document.body.style.overflow = 'hidden';

        // Load provinces
        await loadProvinces();
    }

    /**
     * Close current modal
     */
    function closeModal() {
        if (!currentModal) return;

        currentModal.classList.remove('is-active');
        document.body.style.overflow = '';
        currentModal = null;
    }

    /**
     * Load provinces into select
     */
    async function loadProvinces() {
        if (!elements.provinceSelect) return;

        try {
            const provinces = await SaturaApp.getProvinces();

            elements.provinceSelect.innerHTML = '<option value="">-- Pilih Provinsi --</option>';

            provinces.forEach(province => {
                const option = document.createElement('option');
                option.value = province.id;
                option.textContent = province.name;
                elements.provinceSelect.appendChild(option);
            });

        } catch (error) {
            SaturaConfig.error('Failed to load provinces:', error);
        }
    }

    /**
     * Handle province change
     */
    async function handleProvinceChange(e) {
        const provinceId = e.target.value;
        if (!provinceId || !elements.regencyList) return;

        try {
            showLoading(elements.regencyList);

            const regencies = await SaturaApp.getRegenciesByProvince(provinceId);

            elements.regencyList.innerHTML = '';

            regencies.forEach(regency => {
                const item = createRegencyItem(regency);
                elements.regencyList.appendChild(item);
            });

        } catch (error) {
            SaturaConfig.error('Failed to load regencies:', error);
            elements.regencyList.innerHTML = '<p class="text-muted text-center">Gagal memuat data</p>';
        }
    }

    /**
     * Handle location search
     */
    async function handleSearchLocation(e) {
        const query = e.target.value.trim();
        if (!query || query.length < 2 || !elements.regencyList) return;

        try {
            const results = await SaturaApp.searchLocations(query);

            elements.regencyList.innerHTML = '';

            // Show regencies
            results.regencies.forEach(regency => {
                const item = createRegencyItem(regency, true);
                elements.regencyList.appendChild(item);
            });

            if (results.regencies.length === 0) {
                elements.regencyList.innerHTML = '<p class="text-muted text-center p-md">Tidak ada hasil</p>';
            }

        } catch (error) {
            SaturaConfig.error('Search failed:', error);
        }
    }

    /**
     * Create regency list item
     */
    function createRegencyItem(regency, showProvince = false) {
        const item = document.createElement('div');
        item.className = 'location-selector__item';
        item.dataset.regencyId = regency.id;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'location-selector__item-name';
        nameDiv.textContent = regency.name;
        item.appendChild(nameDiv);

        if (showProvince) {
            const provDiv = document.createElement('div');
            provDiv.className = 'location-selector__item-province';
            provDiv.textContent = regency.province_name || '';
            item.appendChild(provDiv);
        }

        item.addEventListener('click', () => selectRegency(regency.id));

        return item;
    }

    /**
     * Select a regency
     */
    async function selectRegency(regencyId) {
        try {
            showLoading();

            await SaturaApp.setLocation(regencyId);
            closeModal();

            hideLoading();

        } catch (error) {
            SaturaConfig.error('Failed to set location:', error);
            hideLoading();
            showNotification('Gagal mengatur lokasi', 'error');
        }
    }

    // ===========================================
    // LOADING & NOTIFICATIONS
    // ===========================================

    /**
     * Show loading overlay
     */
    function showLoading(target = null) {
        if (target) {
            target.textContent = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'flex justify-center items-center p-lg';
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            wrapper.appendChild(spinner);
            target.appendChild(wrapper);
            return;
        }

        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.remove('hidden');
        }
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.add('hidden');
        }
    }

    /**
     * Show notification toast
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('is-visible'), 10);

        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('is-visible');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Update online status indicator
     */
    function updateOnlineStatus(isOnline) {
        if (elements.statusIndicator) {
            elements.statusIndicator.classList.toggle('is-online', isOnline);
            elements.statusIndicator.classList.toggle('is-offline', !isOnline);
        }

        if (!isOnline) {
            showNotification('Anda sedang offline. Data yang ditampilkan mungkin tidak terkini.', 'warning');
        }
    }

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    /**
     * Format gregorian date
     */
    function formatGregorianDate(dateStr) {
        if (!dateStr) {
            const now = new Date();
            return `${now.getDate()} ${getMonthName(now.getMonth())}`;
        }

        // Parse DD-MM-YYYY format
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            return `${day} ${getMonthName(month)}`;
        }

        return dateStr;
    }

    /**
     * Get month name in Indonesian
     */
    function getMonthName(monthIndex) {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[monthIndex] || '';
    }

    /**
     * Get day name in Indonesian
     */
    function getDayName(date) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[date.getDay()];
    }

    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Show skeletons (for initial load or refresh)
     */
    function showSkeletons() {
        if (elements.countdownSkeleton) {
            elements.countdownSkeleton.classList.remove('hidden');
            elements.countdownSkeleton.style.display = '';
        }
        if (elements.countdownCard) {
            elements.countdownCard.classList.add('hidden');
            elements.countdownCard.style.display = 'none';
        }

        if (elements.prayerTimesSkeleton) {
            elements.prayerTimesSkeleton.classList.remove('hidden');
            elements.prayerTimesSkeleton.style.display = '';
        }
        if (elements.prayerTimesGrid) {
            elements.prayerTimesGrid.classList.add('hidden');
            elements.prayerTimesGrid.style.display = 'none';
        }
    }

    /**
     * Hide skeletons manually
     */
    function hideSkeletons() {
        if (elements.countdownSkeleton) {
            elements.countdownSkeleton.classList.add('hidden');
            elements.countdownSkeleton.style.display = 'none';
        }
        if (elements.countdownCard) {
            elements.countdownCard.classList.remove('hidden');
            elements.countdownCard.style.display = '';
        }

        if (elements.prayerTimesSkeleton) {
            elements.prayerTimesSkeleton.classList.add('hidden');
            elements.prayerTimesSkeleton.style.display = 'none';
        }
        if (elements.prayerTimesGrid) {
            elements.prayerTimesGrid.classList.remove('hidden');
            elements.prayerTimesGrid.style.display = '';
        }
    }


    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        init,

        // Display
        updateLocation,
        updateScheduleTable,
        updatePrayerTimes,
        updateCountdown,
        updateHeroDate,
        setupFooter,

        // Skeletons
        showSkeletons,
        hideSkeletons,

        // Modal
        openLocationModal,
        closeModal,

        // Loading & Notifications
        showLoading,
        hideLoading,
        showNotification,
        updateOnlineStatus,

        // Utility
        formatGregorianDate,
        getDayName,
        getMonthName
    };
})();

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaUI;
}
