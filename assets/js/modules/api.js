/**
 * Satu Ramadhan - API Module
 * Aladhan API handler with fallback system
 * Supports multiple endpoints with auto-failover
 */

const SaturaAPI = (function () {
    'use strict';

    // Current active endpoint index
    let currentEndpointIndex = 0;

    // Track endpoint health
    const endpointHealth = {};

    // ===========================================
    // PRIVATE HELPER FUNCTIONS
    // ===========================================

    /**
     * Initialize endpoint health tracking
     */
    function initEndpointHealth() {
        SaturaConfig.API.endpoints.forEach((endpoint, index) => {
            endpointHealth[index] = {
                failures: 0,
                lastFailure: null,
                isHealthy: true
            };
        });
    }

    /**
     * Mark endpoint as failed
     * @param {number} index - Endpoint index
     */
    function markEndpointFailed(index) {
        if (!endpointHealth[index]) return;

        endpointHealth[index].failures++;
        endpointHealth[index].lastFailure = Date.now();

        if (endpointHealth[index].failures >= SaturaConfig.API.retryAttempts) {
            endpointHealth[index].isHealthy = false;
            SaturaConfig.log(`Endpoint ${index} marked as unhealthy after ${endpointHealth[index].failures} failures`);
        }
    }

    /**
     * Mark endpoint as successful
     * @param {number} index - Endpoint index
     */
    function markEndpointSuccess(index) {
        if (!endpointHealth[index]) return;

        endpointHealth[index].failures = 0;
        endpointHealth[index].isHealthy = true;
    }

    /**
     * Get next available healthy endpoint
     * @returns {number} - Index of next healthy endpoint
     */
    function getNextHealthyEndpoint() {
        const endpoints = SaturaConfig.API.endpoints;

        // Try to find a healthy endpoint starting from current
        for (let i = 0; i < endpoints.length; i++) {
            const index = (currentEndpointIndex + i) % endpoints.length;
            if (endpointHealth[index]?.isHealthy !== false) {
                return index;
            }
        }

        // If all unhealthy, reset and start from beginning
        initEndpointHealth();
        return 0;
    }

    /**
     * Build URL with query parameters
     * @param {string} baseUrl - Base URL
     * @param {string} path - API path
     * @param {Object} params - Query parameters
     * @returns {string} - Complete URL
     */
    function buildUrl(baseUrl, path, params = {}) {
        // Ensure baseUrl ends without slash and path starts with slash
        const cleanBase = baseUrl.replace(/\/$/, '');
        const cleanPath = path.startsWith('/') ? path : '/' + path;

        const fullUrl = cleanBase + cleanPath;
        const url = new URL(fullUrl);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });

        return url.toString();
    }

    /**
     * Fetch with timeout
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @param {number} timeout - Timeout in ms
     * @returns {Promise} - Fetch promise
     */
    function fetchWithTimeout(url, options = {}, timeout = SaturaConfig.API.timeout) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
        ]);
    }

    /**
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===========================================
    // CORE API FUNCTIONS
    // ===========================================

    /**
     * Fetch from API with automatic fallback to backup endpoints
     * @param {string} path - API path (e.g., '/timings')
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - API response data
     */
    /**
     * Fetch from API with automatic fallback to backup endpoints
     * @param {string} path - API path (e.g., '/timings')
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - API response data
     */
    async function fetchWithFallback(path, params = {}) {
        // OPTIMIZATION: Removed fast-fail when offline to allow Service Worker to handle cache
        // if (!navigator.onLine) {
        //     SaturaConfig.log('[API] Offline - skipping network request');
        //     throw new Error('Device is offline');
        // }

        const endpoints = SaturaConfig.API.endpoints;
        let lastError = null;

        // Start from the last successful endpoint
        const startIndex = getNextHealthyEndpoint();

        // OPTIMIZATION: Reduce attempts when connection is slow
        const maxEndpoints = Math.min(2, endpoints.length); // Try max 2 endpoints

        for (let attempt = 0; attempt < maxEndpoints; attempt++) {
            const endpointIndex = (startIndex + attempt) % endpoints.length;
            const baseUrl = endpoints[endpointIndex];

            SaturaConfig.log(`Trying endpoint ${endpointIndex}: ${baseUrl}`);

            // OPTIMIZATION: Reduce retries to 1
            try {
                const url = buildUrl(baseUrl, path, params);
                SaturaConfig.log(`Fetching: ${url}`);

                const response = await fetchWithTimeout(url, {}, 5000); // 5s timeout

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // Check if API returned success
                if (data.code !== 200 || data.status !== 'OK') {
                    throw new Error(`API Error: ${data.status || 'Unknown error'}`);
                }

                // Success - update current endpoint
                currentEndpointIndex = endpointIndex;
                markEndpointSuccess(endpointIndex);

                SaturaConfig.log(`Success from endpoint ${endpointIndex}`);
                return data;

            } catch (error) {
                lastError = error;
                SaturaConfig.log(`Failed for endpoint ${endpointIndex}: ${error.message}`);
                markEndpointFailed(endpointIndex);
            }
        }

        // All endpoints failed
        SaturaConfig.error('All API endpoints failed', lastError);
        throw new Error(`All API endpoints failed: ${lastError?.message || 'Unknown error'}`);
    }

    // ===========================================
    // PRAYER TIMES API
    // ===========================================

    /**
     * Get prayer times for a specific date and location
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {Date|string} date - Date (optional, defaults to today)
     * @returns {Promise<Object>} - Prayer times data
     */
    async function getPrayerTimes(latitude, longitude, date = null) {
        const targetDate = date ? new Date(date) : new Date();

        // Round coordinates to 4 decimal places (approx 11m) to improve cache hit rate
        const lat = Number(latitude).toFixed(4);
        const lng = Number(longitude).toFixed(4);

        const params = {
            latitude: lat,
            longitude: lng,
            method: SaturaConfig.API.method,
            // Format: DD-MM-YYYY
            date: formatDateForAPI(targetDate)
        };

        const response = await fetchWithFallback(
            SaturaConfig.API.paths.timings + '/' + formatDateForAPI(targetDate),
            { latitude: lat, longitude: lng, method: SaturaConfig.API.method }
        );

        return response.data;
    }

    /**
     * Get prayer times using timestamp
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {number} timestamp - Unix timestamp (optional)
     * @returns {Promise<Object>} - Prayer times data
     */
    async function getPrayerTimesByTimestamp(latitude, longitude, timestamp = null) {
        const ts = timestamp || Math.floor(Date.now() / 1000);

        // Round coordinates to 4 decimal places
        const lat = Number(latitude).toFixed(4);
        const lng = Number(longitude).toFixed(4);

        const params = {
            latitude: lat,
            longitude: lng,
            method: SaturaConfig.API.method
        };

        const response = await fetchWithFallback(
            SaturaConfig.API.paths.timings + '/' + ts,
            params
        );

        return response.data;
    }

    /**
     * Get monthly prayer calendar
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {number} month - Month (1-12)
     * @param {number} year - Year (e.g., 2026)
     * @returns {Promise<Object>} - Monthly calendar data
     */
    async function getMonthlyCalendar(latitude, longitude, month, year) {
        // Round coordinates to 4 decimal places
        const lat = Number(latitude).toFixed(4);
        const lng = Number(longitude).toFixed(4);

        const params = {
            latitude: lat,
            longitude: lng,
            method: SaturaConfig.API.method,
            month: month,
            year: year
        };

        const response = await fetchWithFallback(
            SaturaConfig.API.paths.calendar + '/' + year + '/' + month,
            { latitude: lat, longitude: lng, method: SaturaConfig.API.method }
        );

        return response.data;
    }

    /**
     * Get Hijri calendar for a month
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @param {number} month - Hijri month (1-12)
     * @param {number} year - Hijri year (e.g., 1447)
     * @returns {Promise<Object>} - Hijri calendar data
     */
    async function getHijriCalendar(latitude, longitude, month, year) {
        // Round coordinates to 4 decimal places
        const lat = Number(latitude).toFixed(4);
        const lng = Number(longitude).toFixed(4);

        const params = {
            latitude: lat,
            longitude: lng,
            method: SaturaConfig.API.method
        };

        const response = await fetchWithFallback(
            SaturaConfig.API.paths.hijriCalendar + '/' + year + '/' + month,
            params
        );

        return response.data;
    }

    // ===========================================
    // DATE CONVERSION API
    // ===========================================

    /**
     * Convert Gregorian date to Hijri
     * @param {Date|string} date - Gregorian date
     * @returns {Promise<Object>} - Hijri date data
     */
    async function gregorianToHijri(date) {
        const targetDate = date ? new Date(date) : new Date();
        const dateString = formatDateForAPI(targetDate);

        const response = await fetchWithFallback(
            SaturaConfig.API.paths.gregorianToHijri + '/' + dateString,
            {}
        );

        return response.data;
    }

    /**
     * Convert Hijri date to Gregorian
     * @param {string} date - Hijri date in DD-MM-YYYY format
     * @returns {Promise<Object>} - Gregorian date data
     */
    async function hijriToGregorian(date) {
        const response = await fetchWithFallback(
            SaturaConfig.API.paths.hijriToGregorian + '/' + date,
            {}
        );

        return response.data;
    }

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    /**
     * Format date for API (DD-MM-YYYY)
     * @param {Date} date - Date object
     * @returns {string} - Formatted date string
     */
    function formatDateForAPI(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    /**
     * Parse time string (HH:MM) to Date object
     * @param {string} timeString - Time in HH:MM format
     * @param {Date} baseDate - Base date (optional)
     * @returns {Date} - Date object with the specified time
     */
    function parseTimeString(timeString, baseDate = null) {
        const [hours, minutes] = timeString.split(':').map(Number);
        const date = baseDate ? new Date(baseDate) : new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    /**
     * Calculate Imsak time from Fajr
     * @param {string} fajrTime - Fajr time in HH:MM format
     * @returns {string} - Imsak time in HH:MM format
     */
    function calculateImsak(fajrTime) {
        const fajrDate = parseTimeString(fajrTime);
        fajrDate.setMinutes(fajrDate.getMinutes() + SaturaConfig.PRAYER.imsakOffset);

        const hours = String(fajrDate.getHours()).padStart(2, '0');
        const minutes = String(fajrDate.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    /**
     * Get current endpoint status
     * @returns {Object} - Endpoint health status
     */
    function getEndpointStatus() {
        return {
            current: currentEndpointIndex,
            endpoints: SaturaConfig.API.endpoints.map((url, index) => ({
                url,
                index,
                ...endpointHealth[index]
            }))
        };
    }

    /**
     * Reset all endpoints health status
     */
    function resetEndpoints() {
        initEndpointHealth();
        currentEndpointIndex = 0;
        SaturaConfig.log('All endpoints reset to healthy state');
    }

    // Initialize on load
    initEndpointHealth();

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        // Core
        fetchWithFallback,

        // Prayer Times
        getPrayerTimes,
        getPrayerTimesByTimestamp,
        getMonthlyCalendar,
        getHijriCalendar,

        // Date Conversion
        gregorianToHijri,
        hijriToGregorian,

        // Utilities
        formatDateForAPI,
        parseTimeString,
        calculateImsak,

        // Endpoint Management
        getEndpointStatus,
        resetEndpoints
    };
})();

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaAPI;
}
