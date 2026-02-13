/**
 * Satu Ramadhan - Prayer Times Module
 * Prayer times and imsak handler
 * Includes caching and time calculations
 */

const SaturaPrayer = (function () {
    'use strict';

    // Cached prayer times
    let todaySchedule = null;
    let scheduleDate = null;

    // ===========================================
    // PRAYER TIMES FETCHING
    // ===========================================

    /**
     * Fetch prayer times for today
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<Object>} - Today's prayer schedule
     */
    async function fetchTodaySchedule(forceRefresh = false) {
        const today = new Date();
        const todayString = formatDate(today);

        // Return cached if available and same day
        if (!forceRefresh && todaySchedule && scheduleDate === todayString) {
            SaturaConfig.log('Returning cached schedule for', todayString);
            return todaySchedule;
        }

        // Try localStorage cache first
        if (!forceRefresh) {
            const cached = getCachedScheduleSync(todayString);
            if (cached) {
                todaySchedule = cached;
                scheduleDate = todayString;
                SaturaConfig.log('Using localStorage cache for', todayString);
                return todaySchedule;
            }
        }

        // Get location
        const location = await SaturaLocation.getLocation();
        const coords = SaturaLocation.getCoordinates();

        if (!coords) {
            throw new Error('Location not available');
        }

        // Fetch from API
        SaturaConfig.log('Fetching prayer times from API...');
        const data = await SaturaAPI.getPrayerTimes(
            coords.latitude,
            coords.longitude,
            today
        );

        // Process and store
        todaySchedule = processApiResponse(data, location);
        scheduleDate = todayString;

        // Cache to storage
        await cacheSchedule(todayString, todaySchedule);

        SaturaConfig.log('Prayer schedule fetched:', todaySchedule);
        return todaySchedule;
    }

    /**
     * Get cached schedule synchronously from localStorage
     * @param {string} dateString - Date string (YYYY-MM-DD)
     * @returns {Object|null} - Cached schedule or null
     */
    function getCachedScheduleSync(dateString) {
        try {
            const key = `${SaturaConfig.CACHE.keys.prayerCache}_${dateString}`;
            // SaturaStorage.get() handles TTL expiration automatically
            // When offline, we want to use any cached data regardless of TTL
            if (!navigator.onLine) {
                // Bypass TTL check when offline by reading raw localStorage
                const stored = localStorage.getItem(key);
                if (!stored) return null;
                const data = JSON.parse(stored);
                return data.value !== undefined ? data.value : null;
            }
            return SaturaStorage.get(key);
        } catch (e) {
            return null;
        }
    }

    /**
     * Initialize from cache immediately (for offline/fast startup)
     * This populates internal state without async operations
     * @returns {Object|null} - Cached schedule or null
     */
    function initFromCache() {
        const today = new Date();
        const todayString = formatDate(today);

        const cached = getCachedScheduleSync(todayString);
        if (cached) {
            todaySchedule = cached;
            scheduleDate = todayString;
            SaturaConfig.log('Prayer module initialized from cache');
            return cached;
        }
        return null;
    }

    /**
     * Fetch prayer times for a specific date
     * @param {Date|string} date - Target date
     * @returns {Promise<Object>} - Prayer schedule for the date
     */
    async function fetchScheduleForDate(date) {
        const targetDate = new Date(date);
        const dateString = formatDate(targetDate);

        // Try cache first
        const cached = await getCachedSchedule(dateString);
        if (cached) {
            return cached;
        }

        // Get location
        const coords = SaturaLocation.getCoordinates();
        if (!coords) {
            throw new Error('Location not available');
        }

        // Fetch from API
        const data = await SaturaAPI.getPrayerTimes(
            coords.latitude,
            coords.longitude,
            targetDate
        );

        const location = SaturaLocation.getCurrentLocation();
        const schedule = processApiResponse(data, location);

        // Cache
        await cacheSchedule(dateString, schedule);

        return schedule;
    }

    /**
     * Fetch monthly prayer calendar
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Promise<Array>} - Array of daily schedules
     */
    async function fetchMonthlySchedule(month, year) {
        const coords = SaturaLocation.getCoordinates();
        if (!coords) {
            throw new Error('Location not available');
        }

        const data = await SaturaAPI.getMonthlyCalendar(
            coords.latitude,
            coords.longitude,
            month,
            year
        );

        const location = SaturaLocation.getCurrentLocation();

        // Process each day
        return data.map(dayData => processApiResponse(dayData, location));
    }

    // ===========================================
    // DATA PROCESSING
    // ===========================================

    /**
     * Process API response into standardized format
     * @param {Object} data - API response data
     * @param {Object} location - Current location
     * @returns {Object} - Processed prayer schedule
     */
    function processApiResponse(data, location) {
        const timings = data.timings || {};
        const dateInfo = data.date || {};

        // Map API timings to our format
        const prayerTimes = {};

        Object.entries(SaturaConfig.PRAYER.apiMapping).forEach(([apiKey, localKey]) => {
            if (timings[apiKey]) {
                // Sanitize timezone suffix e.g. "04:32 (WIB)" → "04:32"
                const cleanTime = String(timings[apiKey]).split(' ')[0];
                prayerTimes[localKey] = {
                    time: cleanTime,
                    name: SaturaConfig.PRAYER.names[localKey],
                    apiKey: apiKey
                };
            }
        });

        // Handle Imsak — API data is prioritized, calculation is fallback only
        if (prayerTimes.imsak) {
            prayerTimes.imsak.source = 'api';
        } else if (prayerTimes.fajr) {
            const calculatedImsak = SaturaAPI.calculateImsak(prayerTimes.fajr.time);
            prayerTimes.imsak = {
                time: calculatedImsak,
                name: SaturaConfig.PRAYER.names.imsak,
                calculated: true,
                source: 'calculated'
            };
            SaturaConfig.log('Imsak calculated from Fajr (API did not provide Imsak)');
        }

        // Build schedule object
        return {
            date: {
                gregorian: dateInfo.gregorian || null,
                hijri: dateInfo.hijri || null,
                readable: dateInfo.readable || formatDateReadable(new Date()),
                timestamp: dateInfo.timestamp || Math.floor(Date.now() / 1000)
            },
            location: {
                name: location?.regency?.name || location?.province?.name || 'Unknown',
                province: location?.province?.name || null,
                coordinates: SaturaLocation.getCoordinates()
            },
            timings: prayerTimes,
            meta: data.meta || null,
            fetchedAt: Date.now()
        };
    }

    /**
     * Get prayer times as ordered array for display
     * @param {Object} schedule - Prayer schedule (optional, uses cached)
     * @returns {Array} - Ordered array of prayer times
     */
    function getOrderedTimes(schedule = null) {
        const source = schedule || todaySchedule;
        if (!source || !source.timings) {
            return [];
        }

        return SaturaConfig.PRAYER.displayOrder
            .filter(key => source.timings[key])
            .map(key => ({
                key: key,
                ...source.timings[key],
                isObligatory: SaturaConfig.PRAYER.obligatory.includes(key),
                isRamadhanImportant: SaturaConfig.PRAYER.ramadhanImportant.includes(key)
            }));
    }

    // ===========================================
    // IMSAK CALCULATION
    // ===========================================

    /**
     * Get Imsak time from schedule
     * @param {Object} schedule - Prayer schedule (optional)
     * @returns {string|null} - Imsak time
     */
    function getImsakTime(schedule = null) {
        const source = schedule || todaySchedule;
        return source?.timings?.imsak?.time || null;
    }

    /**
     * Calculate Imsak from Subuh/Fajr time
     * @param {string} fajrTime - Fajr time in HH:MM format
     * @returns {string} - Imsak time
     */
    function calculateImsak(fajrTime) {
        return SaturaAPI.calculateImsak(fajrTime);
    }

    // ===========================================
    // NEXT PRAYER & COUNTDOWN
    // ===========================================

    /**
     * Get the next prayer from current time
     * @param {Object} schedule - Prayer schedule (optional)
     * @returns {Object|null} - Next prayer info
     */
    function getNextPrayer(schedule = null) {
        const source = schedule || todaySchedule;
        if (!source || !source.timings) {
            return null;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const orderedPrayers = SaturaConfig.PRAYER.displayOrder;

        for (const key of orderedPrayers) {
            const prayer = source.timings[key];
            if (!prayer) continue;

            const prayerMinutes = timeToMinutes(prayer.time);

            if (prayerMinutes > currentMinutes) {
                return {
                    key: key,
                    name: prayer.name,
                    time: prayer.time,
                    remaining: calculateTimeRemaining(prayer.time),
                    isToday: true
                };
            }
        }

        // All prayers passed, next is tomorrow's Imsak
        // Calculate countdown to tomorrow's Imsak
        const tomorrowImsak = source.timings.imsak?.time || source.timings.fajr?.time;
        let remaining = null;

        if (tomorrowImsak) {
            remaining = calculateTimeRemainingToTomorrow(tomorrowImsak);
        }

        return {
            key: 'imsak',
            name: SaturaConfig.PRAYER.names.imsak,
            time: tomorrowImsak || null,
            remaining: remaining,
            isToday: false,
            note: 'Besok'
        };
    }

    /**
     * Calculate countdown to a time tomorrow
     * @param {string} targetTime - Target time in HH:MM format
     * @returns {Object} - Countdown object with hours, minutes, seconds
     */
    function calculateTimeRemainingToTomorrow(targetTime) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Parse time string (remove timezone info like "(WIB)")
        const cleanTime = targetTime.split(' ')[0];
        const [hours, minutes] = cleanTime.split(':').map(Number);

        tomorrow.setHours(hours, minutes, 0, 0);

        const diff = tomorrow - now;

        if (diff <= 0) return null;

        return {
            total: diff,
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000),
            formatted: formatCountdown(diff)
        };
    }

    /**
     * Get current prayer (the one we're currently in)
     * @param {Object} schedule - Prayer schedule (optional)
     * @returns {Object|null} - Current prayer info
     */
    function getCurrentPrayer(schedule = null) {
        const source = schedule || todaySchedule;
        if (!source || !source.timings) {
            return null;
        }

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const orderedPrayers = SaturaConfig.PRAYER.displayOrder;
        let currentPrayer = null;

        for (const key of orderedPrayers) {
            const prayer = source.timings[key];
            if (!prayer) continue;

            const prayerMinutes = timeToMinutes(prayer.time);

            if (prayerMinutes <= currentMinutes) {
                currentPrayer = {
                    key: key,
                    name: prayer.name,
                    time: prayer.time,
                    startedAgo: calculateTimeElapsed(prayer.time)
                };
            }
        }

        return currentPrayer;
    }

    /**
     * Calculate countdown to a specific time
     * @param {string} targetTime - Target time in HH:MM format
     * @returns {Object} - Countdown object with hours, minutes, seconds
     */
    function calculateTimeRemaining(targetTime) {
        const now = new Date();
        const target = parseTime(targetTime);

        if (target <= now) {
            // Target is tomorrow
            target.setDate(target.getDate() + 1);
        }

        const diff = target - now;

        return {
            total: diff,
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000),
            formatted: formatCountdown(diff)
        };
    }

    /**
     * Calculate time elapsed since a time
     * @param {string} pastTime - Past time in HH:MM format
     * @returns {Object} - Elapsed time object
     */
    function calculateTimeElapsed(pastTime) {
        const now = new Date();
        const past = parseTime(pastTime);

        if (past > now) {
            // Time is tomorrow (from yesterday)
            past.setDate(past.getDate() - 1);
        }

        const diff = now - past;

        return {
            total: diff,
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            formatted: formatElapsed(diff)
        };
    }

    // ===========================================
    // RAMADHAN SPECIFIC
    // ===========================================

    /**
     * Check if current month is Ramadhan
     * @param {Object} schedule - Prayer schedule (optional)
     * @returns {boolean}
     */
    function isRamadhan(schedule = null) {
        const source = schedule || todaySchedule;
        if (!source?.date?.hijri) {
            return false;
        }

        const hijriMonth = source.date.hijri.month?.number;
        return hijriMonth === SaturaConfig.HIJRI.ramadhanMonth;
    }

    /**
     * Get Ramadhan-specific info (Sahur/Berbuka times)
     * @param {Object} schedule - Prayer schedule (optional)
     * @returns {Object} - Ramadhan times
     */
    function getRamadhanTimes(schedule = null) {
        const source = schedule || todaySchedule;
        if (!source?.timings) {
            return null;
        }

        return {
            sahur: {
                start: null, // Usually midnight
                end: source.timings.imsak?.time || null,
                name: 'Sahur'
            },
            imsak: {
                time: source.timings.imsak?.time || null,
                name: 'Imsak'
            },
            berbuka: {
                time: source.timings.maghrib?.time || null,
                name: 'Berbuka Puasa'
            }
        };
    }

    /**
     * Cache schedule to localStorage via SaturaStorage
     * @param {string} dateString - Date string key
     * @param {Object} schedule - Schedule to cache
     */
    async function cacheSchedule(dateString, schedule) {
        try {
            const cacheKey = `${SaturaConfig.CACHE.keys.prayerCache}_${dateString}`;
            SaturaStorage.set(cacheKey, schedule, SaturaConfig.CACHE.duration.prayerTimes);
            SaturaConfig.log('Cached schedule for', dateString);

            // Clean expired entries across all storage
            SaturaStorage.cleanExpired();

        } catch (error) {
            SaturaConfig.error('Failed to cache schedule:', error);
        }
    }

    /**
     * Get cached schedule from localStorage via SaturaStorage
     * @param {string} dateString - Date string key
     * @returns {Object|null} - Cached schedule or null
     */
    async function getCachedSchedule(dateString) {
        try {
            const cacheKey = `${SaturaConfig.CACHE.keys.prayerCache}_${dateString}`;
            const cached = SaturaStorage.get(cacheKey);

            if (cached) {
                SaturaConfig.log('Found cached schedule for', dateString);
            }
            return cached;

        } catch (error) {
            SaturaConfig.error('Failed to get cached schedule:', error);
            return null;
        }
    }

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date - Date object
     * @returns {string} - Formatted date
     */
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format date as readable string
     * @param {Date} date - Date object
     * @returns {string} - Readable date
     */
    function formatDateReadable(date) {
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    /**
     * Parse time string to Date
     * @param {string} timeString - Time in HH:MM format
     * @param {Date} baseDate - Base date (optional)
     * @returns {Date}
     */
    function parseTime(timeString, baseDate = null) {
        const [hours, minutes] = timeString.split(':').map(Number);
        const date = baseDate ? new Date(baseDate) : new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    /**
     * Convert time string to minutes
     * @param {string} timeString - Time in HH:MM format
     * @returns {number} - Total minutes
     */
    function timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Format countdown for display
     * @param {number} ms - Milliseconds
     * @returns {string} - Formatted countdown
     */
    function formatCountdown(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours} jam ${minutes} menit`;
        } else if (minutes > 0) {
            return `${minutes} menit ${seconds} detik`;
        } else {
            return `${seconds} detik`;
        }
    }

    /**
     * Format elapsed time for display
     * @param {number} ms - Milliseconds
     * @returns {string} - Formatted elapsed time
     */
    function formatElapsed(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours} jam ${minutes} menit yang lalu`;
        } else {
            return `${minutes} menit yang lalu`;
        }
    }

    /**
     * Get status of prayer module
     * @returns {Object} - Status object
     */
    function getStatus() {
        return {
            hasSchedule: todaySchedule !== null,
            scheduleDate: scheduleDate,
            location: SaturaLocation.getDisplayName(),
            nextPrayer: getNextPrayer(),
            isRamadhan: isRamadhan()
        };
    }

    /**
     * Clear all cached schedules
     */
    function clearCache() {
        todaySchedule = null;
        scheduleDate = null;

        SaturaStorage.clearByPrefix(SaturaConfig.CACHE.keys.prayerCache);
        SaturaConfig.log('Prayer cache cleared');
    }

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        // Fetching
        fetchTodaySchedule,
        fetchScheduleForDate,
        fetchMonthlySchedule,
        initFromCache,

        // Data Access
        getOrderedTimes,
        getImsakTime,
        calculateImsak,

        // Next Prayer & Countdown
        getNextPrayer,
        getCurrentPrayer,
        calculateTimeRemaining,
        calculateTimeElapsed,

        // Ramadhan
        isRamadhan,
        getRamadhanTimes,

        // Cache
        cacheSchedule,
        getCachedSchedule,
        clearCache,

        // Utility
        getStatus,
        parseTime,
        formatDate,
        formatDateReadable
    };
})();

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaPrayer;
}
