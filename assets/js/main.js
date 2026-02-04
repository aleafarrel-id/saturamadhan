/**
 * Satu Ramadhan - Main UI Controller
 * Handles UI interactions, navigation, and schedule rendering
 */

(function () {
    'use strict';

    // Ramadhan config - loaded from database/ramadhan.json
    let ramadhanConfig = null;

    /**
     * Load Ramadhan configuration from external JSON
     * This allows yearly updates without code changes
     * @returns {Promise<Object>} - Ramadhan config
     */
    async function loadRamadhanConfig() {
        if (ramadhanConfig) return ramadhanConfig;

        try {
            const response = await fetch('./database/ramadhan.json');
            if (!response.ok) throw new Error('Failed to load ramadhan.json');

            const data = await response.json();
            ramadhanConfig = data;
            return data;
        } catch (error) {
            console.error('[Main] Failed to load Ramadhan config:', error);

            // Fallback: Get accurate Hijri year from Aladhan API
            let hijriYear = new Date().getFullYear() + 579; // Last resort fallback

            try {
                const hijriData = await SaturaAPI.gregorianToHijri(new Date());
                if (hijriData && hijriData.hijri && hijriData.hijri.year) {
                    hijriYear = parseInt(hijriData.hijri.year);
                }
            } catch (apiError) {
                console.error('[Main] Failed to get Hijri year from API:', apiError);
            }

            ramadhanConfig = {
                tahunHijriah: hijriYear,
                tahunMasehi: new Date().getFullYear(),
                tanggalSatuRamadhan: {
                    muhammadiyah: null,
                    nu: null
                }
            };
            return ramadhanConfig;
        }
    }

    /**
     * Get Ramadhan start date for organization
     * @param {string} org - 'muhammadiyah' or 'nu'
     * @returns {Date|null} - Start date or null if not configured
     */
    function getRamadhanStartDate(org) {
        if (!ramadhanConfig || !ramadhanConfig.tanggalSatuRamadhan) {
            return null;
        }

        const dateStr = ramadhanConfig.tanggalSatuRamadhan[org];
        if (!dateStr) return null;

        // Parse YYYY-MM-DD format
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
    }

    // State
    let provincesData = [];
    let regenciesData = [];
    let selectedProvinceId = null;
    let monthlySchedule = [];
    let scheduleExpanded = false;
    let tomorrowSchedule = null;

    // Notification stack management
    let activeNotifications = [];
    const NOTIFICATION_GAP = 10;
    const NOTIFICATION_HEIGHT = 60;
    const NOTIFICATION_TOP_OFFSET = 90;

    // Format time - remove timezone suffix like (WIB)
    function formatTime(timeStr) {
        if (!timeStr) return '-';
        return timeStr.split(' ')[0]; // Remove anything after space (timezone)
    }

    // DOM Elements
    const elements = {};

    function cacheElements() {
        const ids = [
            'locationName', 'currentLocationText', 'countdownPrayerName',
            'countdownHours', 'countdownMinutes', 'countdownSeconds',
            'prayerTimesGrid', 'scheduleTableBody', 'hijriMonth', 'hijriYear',
            'loadingOverlay', 'headerTime', 'headerDate',
            'provinceDropdown', 'provinceTrigger', 'provinceOptions',
            'regencyDropdown', 'regencyTrigger', 'regencyOptions',
            'toggleSchedule', 'scheduleWrapper',
            'countdownSkeleton', 'countdownCard', 'prayerTimesSkeleton'
        ];
        ids.forEach(id => elements[id] = document.getElementById(id));
    }

    // Clock
    function updateClock() {
        const now = new Date();
        const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

        if (elements.headerTime) elements.headerTime.textContent = time;
        if (elements.headerDate) elements.headerDate.textContent = date;
    }

    // Navigation
    function setupNavigation() {
        const pages = document.querySelectorAll('.page');
        const navLinks = document.querySelectorAll('[data-page], [data-goto]');

        function showPage(pageId) {
            pages.forEach(p => p.classList.remove('page--active'));
            const page = document.getElementById(`page-${pageId}`);
            if (page) page.classList.add('page--active');

            document.querySelectorAll('.nav__link').forEach(l => {
                l.classList.toggle('nav__link--active', l.dataset.page === pageId);
            });

            if (pageId === 'pengaturan') loadProvinces();
        }

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                showPage(link.dataset.page || link.dataset.goto);
            });
        });
    }

    // Mobile menu
    function setupMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const nav = document.getElementById('headerNav');
        const header = document.querySelector('.header');

        if (toggle && nav) {
            // Toggle menu on button click
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                nav.classList.toggle('is-active');
                const icon = toggle.querySelector('i');
                icon.classList.toggle('bx-menu');
                icon.classList.toggle('bx-x');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (nav.classList.contains('is-active')) {
                    // Check if click is outside the nav and toggle button
                    if (!nav.contains(e.target) && !toggle.contains(e.target)) {
                        nav.classList.remove('is-active');
                        const icon = toggle.querySelector('i');
                        icon.classList.remove('bx-x');
                        icon.classList.add('bx-menu');
                    }
                }
            });

            // Close menu when clicking a nav link
            nav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    nav.classList.remove('is-active');
                    const icon = toggle.querySelector('i');
                    icon.classList.remove('bx-x');
                    icon.classList.add('bx-menu');
                });
            });
        }
    }

    // Custom dropdown
    function setupCustomDropdown(dropdown, trigger, options, onSelect) {
        if (!dropdown || !trigger || !options) return;

        trigger.addEventListener('click', () => {
            if (!dropdown.classList.contains('custom-select--disabled')) {
                dropdown.classList.toggle('custom-select--open');
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('custom-select--open');
            }
        });
    }

    // Load provinces
    async function loadProvinces() {
        if (provincesData.length > 0) return;

        try {
            provincesData = await SaturaDatabase.getProvinces();
            renderProvinceOptions();
        } catch (err) {
            console.error('Failed to load provinces:', err);
        }
    }

    function renderProvinceOptions() {
        if (!elements.provinceOptions) return;

        elements.provinceOptions.innerHTML = provincesData.map(p => `
            <div class="custom-select__option" data-value="${p.id}" data-name="${p.name}">
                ${p.name}
            </div>
        `).join('');

        elements.provinceOptions.querySelectorAll('.custom-select__option').forEach(opt => {
            opt.addEventListener('click', () => selectProvince(opt.dataset.value, opt.dataset.name));
        });
    }

    async function selectProvince(id, name) {
        selectedProvinceId = id;

        // Update trigger text
        elements.provinceTrigger.querySelector('span').textContent = name;
        elements.provinceDropdown.classList.remove('custom-select--open');

        // Enable regency dropdown
        elements.regencyDropdown.classList.remove('custom-select--disabled');
        elements.regencyTrigger.querySelector('span').textContent = '-- Pilih Kabupaten/Kota --';

        // Load regencies
        try {
            regenciesData = await SaturaDatabase.getRegenciesByProvince(id);
            renderRegencyOptions();
        } catch (err) {
            console.error('Failed to load regencies:', err);
        }
    }

    function renderRegencyOptions() {
        if (!elements.regencyOptions) return;

        elements.regencyOptions.innerHTML = regenciesData.map(r => `
            <div class="custom-select__option" data-value="${r.id}" data-name="${r.name}" data-lat="${r.latitude}" data-lng="${r.longitude}">
                ${r.name}
            </div>
        `).join('');

        elements.regencyOptions.querySelectorAll('.custom-select__option').forEach(opt => {
            opt.addEventListener('click', () => {
                selectRegency(opt.dataset.name, parseFloat(opt.dataset.lat), parseFloat(opt.dataset.lng));
            });
        });
    }

    async function selectRegency(name, lat, lng) {
        // Prevent location change when offline - data can't be updated
        if (!navigator.onLine) {
            showNotification('Tidak dapat mengubah lokasi saat offline.', 'error');
            elements.regencyDropdown.classList.remove('custom-select--open');
            return;
        }

        elements.regencyTrigger.querySelector('span').textContent = name;
        elements.regencyDropdown.classList.remove('custom-select--open');

        if (lat && lng) {
            showLoading();
            try {
                await setLocationAndRefresh(lat, lng, name);
                showNotification('Lokasi berhasil diatur: ' + name, 'success');
            } catch (err) {
                console.error('Failed to set location:', err);
                showNotification('Gagal mengubah lokasi. Silakan coba lagi.', 'error');
            } finally {
                hideLoading();
            }
        }
    }

    // GPS
    async function detectGPS() {
        // Prevent GPS detection when offline - data can't be updated
        if (!navigator.onLine) {
            showNotification('Tidak dapat menggunakan GPS saat offline.', 'error');
            return;
        }

        showLoading();
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000
                });
            });

            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            const nearest = await SaturaDatabase.findNearestRegency(lat, lng);
            const name = nearest ? nearest.name : 'Lokasi GPS';

            await setLocationAndRefresh(lat, lng, name);
            hideLoading();
            showNotification('Lokasi GPS berhasil: ' + name, 'success');
        } catch (err) {
            hideLoading();
            console.error('GPS error:', err);
            showNotification('GPS gagal. Silakan pilih lokasi manual.', 'error');
        }
    }

    async function setLocationAndRefresh(lat, lng, name) {
        // IMPORTANT: Update SaturaLocation module's internal state
        // This is critical for fetchTodaySchedule() to use the correct coordinates
        await SaturaLocation.setLocationByCoordinates(lat, lng);

        // Also save to our local storage for display purposes
        SaturaStorage.set('user_location', { latitude: lat, longitude: lng, name: name });
        updateLocationDisplay(name);

        try {
            // Now refreshPrayerTimes will use the updated coordinates from SaturaLocation
            await SaturaApp.refreshPrayerTimes();
            await loadMonthlySchedule(lat, lng);
            // Pre-fetch tomorrow's schedule for countdown after Isya
            await fetchTomorrowSchedule(lat, lng);
        } catch (err) {
            console.error('Failed to refresh:', err);
            throw err; // Re-throw so caller can handle
        }
    }

    function updateLocationDisplay(name) {
        if (elements.locationName) elements.locationName.textContent = name;
        if (elements.currentLocationText) elements.currentLocationText.textContent = name;
    }

    // Fetch tomorrow's schedule for countdown after Isya
    async function fetchTomorrowSchedule(lat, lng) {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const response = await SaturaAPI.getPrayerTimes(lat, lng, tomorrow);
            tomorrowSchedule = response;
            return response;
        } catch (err) {
            console.error('Failed to fetch tomorrow schedule:', err);
            return null;
        }
    }

    // Monthly schedule
    async function loadMonthlySchedule(lat, lng) {
        const org = SaturaStorage.get('organization') || 'nu';
        const startDate = getRamadhanStartDate(org);
        if (!startDate) return;

        try {
            // Ramadhan spans two months (Feb-Mar), need to fetch both
            const year = startDate.getFullYear();
            const month1 = startDate.getMonth() + 1; // February (2)
            const month2 = month1 === 12 ? 1 : month1 + 1; // March (3)
            const year2 = month1 === 12 ? year + 1 : year;

            // Fetch both months in parallel
            const [response1, response2] = await Promise.all([
                SaturaAPI.getMonthlyCalendar(lat, lng, month1, year),
                SaturaAPI.getMonthlyCalendar(lat, lng, month2, year2)
            ]);

            // Combine both months' data
            monthlySchedule = [...(response1 || []), ...(response2 || [])];

            renderMonthlySchedule();
        } catch (err) {
            console.error('Failed to load monthly schedule:', err);
        }
    }

    function renderMonthlySchedule() {
        const tbody = elements.scheduleTableBody;
        if (!tbody) return;

        const org = SaturaStorage.get('organization') || 'nu';
        const startDate = getRamadhanStartDate(org);
        if (!startDate) return;
        const today = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        let html = '';

        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const isToday = date.toDateString() === today.toDateString();
            const dayName = days[date.getDay()];
            const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const ramadhanDay = i + 1;

            // Find matching schedule data
            const scheduleData = monthlySchedule.find(s => {
                if (!s?.date?.gregorian?.date) return false;
                const [d, m, y] = s.date.gregorian.date.split('-');
                const schedDate = new Date(y, m - 1, d);
                return schedDate.toDateString() === date.toDateString();
            });

            const timings = scheduleData?.timings || {};

            html += `
                <tr class="${isToday ? 'is-today' : ''}">
                    <td>${ramadhanDay}</td>
                    <td>${dateStr}</td>
                    <td class="time-primary">${formatTime(timings.Imsak)}</td>
                    <td>${formatTime(timings.Fajr)}</td>
                    <td>${formatTime(timings.Sunrise)}</td>
                    <td>${formatTime(timings.Dhuhr)}</td>
                    <td>${formatTime(timings.Asr)}</td>
                    <td class="time-accent">${formatTime(timings.Maghrib)}</td>
                    <td>${formatTime(timings.Isha)}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html;

        // Also render mobile cards
        renderMobileScheduleCards();
    }

    // Render schedule as cards for mobile
    function renderMobileScheduleCards() {
        const cardsContainer = document.getElementById('mobileScheduleCards');
        if (!cardsContainer) return;

        const org = SaturaStorage.get('organization') || 'nu';
        const startDate = getRamadhanStartDate(org);
        if (!startDate) return;
        const today = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        let html = '';

        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const isToday = date.toDateString() === today.toDateString();
            const dayName = days[date.getDay()];
            const dateStr = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            const ramadhanDay = i + 1;

            // Find matching schedule data
            const scheduleData = monthlySchedule.find(s => {
                if (!s?.date?.gregorian?.date) return false;
                const [d, m, y] = s.date.gregorian.date.split('-');
                const schedDate = new Date(y, m - 1, d);
                return schedDate.toDateString() === date.toDateString();
            });

            const timings = scheduleData?.timings || {};

            html += `
                <div class="schedule-card ${isToday ? 'is-today' : ''}">
                    <div class="schedule-card__header">
                        <div class="schedule-card__header-content">
                            <span class="schedule-card__day">Hari ${ramadhanDay}</span>
                            <span class="schedule-card__date">${dateStr}</span>
                        </div>
                        ${isToday ? '<span class="schedule-card__badge">Hari Ini</span>' : ''}
                    </div>
                    <div class="schedule-card__body">
                        <div class="schedule-card__grid">
                            <div class="schedule-time-box schedule-time-box--imsak">
                                <span class="schedule-time-box__label">Imsak</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Imsak)}</span>
                            </div>
                            <div class="schedule-time-box">
                                <span class="schedule-time-box__label">Subuh</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Fajr)}</span>
                            </div>
                            <div class="schedule-time-box">
                                <span class="schedule-time-box__label">Terbit</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Sunrise)}</span>
                            </div>
                            <div class="schedule-time-box">
                                <span class="schedule-time-box__label">Dzuhur</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Dhuhr)}</span>
                            </div>
                            <div class="schedule-time-box">
                                <span class="schedule-time-box__label">Ashar</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Asr)}</span>
                            </div>
                            <div class="schedule-time-box schedule-time-box--maghrib">
                                <span class="schedule-time-box__label">Maghrib</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Maghrib)}</span>
                            </div>
                            <div class="schedule-time-box">
                                <span class="schedule-time-box__label">Isya</span>
                                <span class="schedule-time-box__value">${formatTime(timings.Isha)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        cardsContainer.innerHTML = html;
    }

    // Schedule expand/collapse
    function setupScheduleToggle() {
        const toggle = elements.toggleSchedule;
        const wrapper = elements.scheduleWrapper;

        if (!toggle || !wrapper) return;

        toggle.addEventListener('click', () => {
            scheduleExpanded = !scheduleExpanded;
            wrapper.classList.toggle('schedule__wrapper--collapsed', !scheduleExpanded);

            const icon = toggle.querySelector('i');
            icon.classList.toggle('bx-chevron-down', !scheduleExpanded);
            icon.classList.toggle('bx-chevron-up', scheduleExpanded);

            toggle.querySelector('span').textContent = scheduleExpanded ? 'Sembunyikan Jadwal' : 'Lihat Jadwal Lengkap';
        });
    }

    // Prayer times grid
    function updatePrayerTimesGrid(times) {
        const grid = elements.prayerTimesGrid;
        if (!grid || !times || !times.length) return;

        // Hide skeleton
        if (elements.prayerTimesSkeleton) {
            elements.prayerTimesSkeleton.classList.add('hidden');
            elements.prayerTimesSkeleton.style.display = 'none';
        }
        grid.classList.remove('hidden');
        grid.style.display = '';

        const nextPrayer = SaturaApp.getNextPrayer();

        // Icon Mapping
        const iconMap = {
            'imsak': 'moon-stars.svg',
            'fajr': 'sun-fog.svg',
            'sunrise': 'sun-rise.svg',
            'dhuhr': 'sun.svg',
            'asr': 'cloud-sun.svg',
            'maghrib': 'sun-set.svg',
            'isha': 'moon.svg'
        };

        grid.innerHTML = times.map(prayer => {
            const iconFile = iconMap[prayer.key] || 'sun.svg';

            return `
            <div class="prayer-time-item ${nextPrayer?.key === prayer.key ? 'is-next' : ''}">
                <div class="prayer-time-item__icon">
                    <img src="assets/icon/${iconFile}" alt="${prayer.name}" loading="lazy">
                </div>
                <div class="prayer-time-item__content">
                    <div class="prayer-time-item__name">${prayer.name}</div>
                    <div class="prayer-time-item__time">${prayer.time || '--:--'}</div>
                </div>
            </div>
        `}).join('');
    }

    function updateHeroDate(dateInfo) {
        if (!dateInfo?.hijri) return;

        const hijri = dateInfo.hijri;
        if (elements.hijriMonth) elements.hijriMonth.textContent = hijri.month?.en || 'Ramadhan';
        if (elements.hijriYear) elements.hijriYear.textContent = hijri.year + ' H';
    }

    // Check if current time is after Isya
    function isAfterIsya() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Get today's schedule
        const todaySchedule = SaturaPrayer.getStatus();
        if (!todaySchedule?.hasSchedule) return false;

        const orderedTimes = SaturaApp.getOrderedTimes();
        const isyaTime = orderedTimes.find(t => t.key === 'isha');

        if (!isyaTime?.time) return false;

        const [hours, minutes] = isyaTime.time.split(':').map(Number);
        const isyaMinutes = hours * 60 + minutes;

        return currentMinutes > isyaMinutes;
    }

    // Update schedule title based on time
    function updateScheduleTitle() {
        const titleEl = document.querySelector('.prayer-times-title');
        if (!titleEl) return;

        const now = new Date();
        const currentHour = now.getHours();

        // After Isya (check if all prayers passed) and before midnight
        if (isAfterIsya() && currentHour < 24) {
            // Get tomorrow's date
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);

            const dateStr = tomorrow.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            titleEl.innerHTML = `Jadwal untuk Besok <span class="tomorrow-date">${dateStr}</span>`;
        } else {
            titleEl.textContent = 'Jadwal Hari Ini';
        }
    }

    // Enhanced countdown update with tomorrow's Imsak support
    function updateCountdown(nextPrayer) {
        if (!nextPrayer) return;

        // Update schedule title
        updateScheduleTitle();

        // Hide skeleton
        if (elements.countdownSkeleton) {
            elements.countdownSkeleton.classList.add('hidden');
            elements.countdownSkeleton.style.display = 'none';
        }
        if (elements.countdownCard) {
            elements.countdownCard.classList.remove('hidden');
            elements.countdownCard.style.display = ''; // Ensure visible
        }

        if (elements.countdownPrayerName) {
            elements.countdownPrayerName.textContent = nextPrayer.name || '-';
        }

        // If it's tomorrow's prayer and no remaining time calculated, calculate it
        if (!nextPrayer.isToday && nextPrayer.key === 'imsak' && tomorrowSchedule) {
            const tomorrowImsak = tomorrowSchedule.timings?.Imsak;
            if (tomorrowImsak) {
                const remaining = calculateCountdownToTomorrow(tomorrowImsak);
                if (remaining) {
                    if (elements.countdownHours) elements.countdownHours.textContent = String(remaining.hours).padStart(2, '0');
                    if (elements.countdownMinutes) elements.countdownMinutes.textContent = String(remaining.minutes).padStart(2, '0');
                    if (elements.countdownSeconds) elements.countdownSeconds.textContent = String(remaining.seconds).padStart(2, '0');
                    return;
                }
            }
        }

        if (nextPrayer.remaining) {
            const { hours, minutes, seconds } = nextPrayer.remaining;
            if (elements.countdownHours) elements.countdownHours.textContent = String(hours).padStart(2, '0');
            if (elements.countdownMinutes) elements.countdownMinutes.textContent = String(minutes).padStart(2, '0');
            if (elements.countdownSeconds) elements.countdownSeconds.textContent = String(seconds).padStart(2, '0');
        }
    }

    // Calculate countdown to tomorrow's time
    function calculateCountdownToTomorrow(timeStr) {
        if (!timeStr) return null;

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Parse time string (format: "HH:MM" or "HH:MM (WIB)")
        const cleanTime = timeStr.split(' ')[0];
        const [hours, minutes] = cleanTime.split(':').map(Number);

        tomorrow.setHours(hours, minutes, 0, 0);

        const diff = tomorrow - now;

        if (diff <= 0) return null;

        return {
            total: diff,
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000)
        };
    }

    // Organization change
    function setupOrganization() {
        document.querySelectorAll('input[name="organization"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                SaturaStorage.set('organization', e.target.value);
                const title = e.target.parentElement.querySelector('.settings__option-title').textContent;
                showNotification('Organisasi diubah: ' + title, 'success');

                // Reload schedule with new start date
                const loc = SaturaStorage.get('user_location');
                if (loc?.latitude && loc?.longitude) {
                    await loadMonthlySchedule(loc.latitude, loc.longitude);
                }
            });
        });

        const saved = SaturaStorage.get('organization') || 'nu';
        const radio = document.querySelector(`input[name="organization"][value="${saved}"]`);
        if (radio) radio.checked = true;
    }

    // Utilities
    function showLoading() {
        elements.loadingOverlay?.classList.remove('hidden');
    }

    function hideLoading() {
        elements.loadingOverlay?.classList.add('hidden');
    }

    // Enhanced notification with stacking support
    function showNotification(message, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `notification notification--${type}`;
        notif.textContent = message;

        // Calculate position based on existing notifications
        const topPosition = NOTIFICATION_TOP_OFFSET + (activeNotifications.length * (NOTIFICATION_HEIGHT + NOTIFICATION_GAP));
        notif.style.top = topPosition + 'px';

        document.body.appendChild(notif);
        activeNotifications.push(notif);

        // Animate in
        setTimeout(() => notif.classList.add('is-visible'), 10);

        // Remove after delay
        setTimeout(() => {
            notif.classList.remove('is-visible');
            setTimeout(() => {
                // Remove from active list
                const index = activeNotifications.indexOf(notif);
                if (index > -1) {
                    activeNotifications.splice(index, 1);
                }
                notif.remove();

                // Reposition remaining notifications
                repositionNotifications();
            }, 300);
        }, 3000);
    }

    // Reposition notifications after one is removed
    function repositionNotifications() {
        activeNotifications.forEach((notif, index) => {
            const newTop = NOTIFICATION_TOP_OFFSET + (index * (NOTIFICATION_HEIGHT + NOTIFICATION_GAP));
            notif.style.top = newTop + 'px';
        });
    }

    // Back to top
    function setupBackToTop() {
        document.getElementById('backToTop')?.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // PWA Install Prompt
    function setupPWAInstall() {
        let deferredPrompt;
        const footerInstallBtn = document.getElementById('footerInstallBtn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });

        if (footerInstallBtn) {
            footerInstallBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    deferredPrompt = null;
                } else {
                    showNotification('Aplikasi sudah terpasang atau browser tidak mendukung.', 'info');
                }
            });
        }

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            showNotification('Aplikasi berhasil dipasang!', 'success');
        });
    }

    // Initialize
    async function init() {
        // Load Ramadhan configuration first
        await loadRamadhanConfig();

        cacheElements();
        setupNavigation();
        setupMobileMenu();
        setupOrganization();
        setupScheduleToggle();
        setupBackToTop();
        setupPWAInstall();

        // Update dynamic year elements from Ramadhan config
        if (ramadhanConfig) {
            const tahun = ramadhanConfig.tahunHijriah;

            // Hero badge - Hijri year
            const hijriYear = document.getElementById('hijriYear');
            if (hijriYear) {
                hijriYear.textContent = `${tahun} H`;
            }

            // Schedule title
            const scheduleTitle = document.getElementById('scheduleTitle');
            if (scheduleTitle) {
                scheduleTitle.textContent = `Jadwal Ramadhan ${tahun} H`;
            }

            // Organization description
            const orgDesc = document.getElementById('orgDescription');
            if (orgDesc) {
                orgDesc.textContent = `Pilih organisasi untuk menentukan awal Ramadhan ${tahun} H`;
            }

            // Organization start dates
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                const [year, month, day] = dateStr.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                return `${day} ${months[month - 1]} ${year}`;
            };

            const muhammadiyahDateEl = document.getElementById('muhammadiyahDate');
            if (muhammadiyahDateEl && ramadhanConfig.tanggalSatuRamadhan?.muhammadiyah) {
                muhammadiyahDateEl.textContent = `1 Ramadhan = ${formatDate(ramadhanConfig.tanggalSatuRamadhan.muhammadiyah)}`;
            }

            const nuDateEl = document.getElementById('nuDate');
            if (nuDateEl && ramadhanConfig.tanggalSatuRamadhan?.nu) {
                nuDateEl.textContent = `1 Ramadhan = ${formatDate(ramadhanConfig.tanggalSatuRamadhan.nu)}`;
            }
        }

        // Initialize footer with author info and social links
        try {
            const author = SaturaConfig.AUTHOR;
            const year = new Date().getFullYear();

            // Copyright
            const copyrightEl = document.getElementById('footerCopyright');
            if (copyrightEl) {
                copyrightEl.innerHTML = `&copy; ${year} <span class="footer__highlight" onclick="window.open('${author.website}', '_blank')" style="cursor: pointer; color: var(--clr-accent-500); font-weight: bold;">${author.copyright}</span>. All rights reserved.`;
            }

            // Social Links
            const socialContainer = document.querySelector('.footer__social');
            if (socialContainer && author.social) {
                socialContainer.innerHTML = ''; // Clear
                Object.keys(author.social).forEach(key => {
                    const social = author.social[key];
                    if (social && social.url) {
                        const link = document.createElement('a');
                        link.href = social.url;
                        link.target = '_blank';
                        link.className = 'footer__social-link';
                        link.innerHTML = `<i class='bx bxl-${key}'></i>`;
                        socialContainer.appendChild(link);
                    }
                });
            }
        } catch (e) {
            console.error("Footer init failed:", e);
        }

        // Setup custom dropdowns
        setupCustomDropdown(elements.provinceDropdown, elements.provinceTrigger, elements.provinceOptions);
        setupCustomDropdown(elements.regencyDropdown, elements.regencyTrigger, elements.regencyOptions);

        // GPS button
        document.getElementById('useGpsBtn')?.addEventListener('click', detectGPS);

        // Start clock
        updateClock();
        setInterval(updateClock, 1000);

        // Load saved location
        const savedLoc = SaturaStorage.get('user_location');
        if (savedLoc?.name) {
            updateLocationDisplay(savedLoc.name);
        }

        // Register event listeners
        SaturaApp.on('onPrayerTimesFetched', (schedule) => {
            const times = SaturaApp.getOrderedTimes();
            updatePrayerTimesGrid(times);
            updateHeroDate(schedule?.date);
        });

        SaturaApp.on('onNextPrayerUpdate', updateCountdown);

        SaturaApp.on('onLocationChange', () => {
            const loc = SaturaStorage.get('user_location');
            if (loc?.name) updateLocationDisplay(loc.name);
        });

        // Initialize app
        try {
            await SaturaApp.init();

            // Auto detect GPS if no location
            const currentLoc = SaturaStorage.get('user_location');
            if (!currentLoc) {
                detectGPS();
            } else if (currentLoc.latitude && currentLoc.longitude) {
                await loadMonthlySchedule(currentLoc.latitude, currentLoc.longitude);
                // Pre-fetch tomorrow's schedule
                await fetchTomorrowSchedule(currentLoc.latitude, currentLoc.longitude);
            }
        } catch (err) {
            console.error('Init failed:', err);
        }
    }

    // Initialize immediately since loader already waits for DOM
    // Check document.readyState to handle both scenarios
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready, initialize immediately
        init();
    }
})();
