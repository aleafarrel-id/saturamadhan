/**
 * Satu Ramadhan - Main Application
 * Entry point and coordinator for all modules
 * Backend logic without UI
 */

const SaturaApp = (function () {
    'use strict';

    // App state
    let isInitialized = false;
    let isOnline = navigator.onLine;
    let countdownInterval = null;

    // Event callbacks (untuk UI nanti)
    const callbacks = {
        onReady: [],
        onLocationChange: [],
        onPrayerTimesFetched: [],
        onNextPrayerUpdate: [],
        onOnlineStatusChange: [],
        onError: []
    };

    // ===========================================
    // INITIALIZATION
    // ===========================================

    /**
     * Initialize the application
     * @returns {Promise<Object>} - Initialization result
     */
    async function init() {
        if (isInitialized) {
            SaturaConfig.log('App already initialized');
            return getStatus();
        }

        SaturaConfig.log('Initializing Satu Ramadhan...');

        try {
            // OPTIMIZATION: Parallel initialization for non-dependent tasks
            // SW registration and DB preload can happen simultaneously
            const [swResult] = await Promise.all([
                registerServiceWorker(),
                SaturaDatabase.preload()
            ]);

            // Setup online/offline listener early
            setupOnlineListener();

            // OPTIMIZATION: Try to show cached data immediately
            // OPTIMIZATION: Try to show cached data immediately and initialize prayer module
            const cachedSchedule = SaturaPrayer.initFromCache();
            if (cachedSchedule) {
                SaturaConfig.log('Showing cached schedule while fetching fresh data');
                triggerCallbacks('onPrayerTimesFetched', cachedSchedule);
            }

            // OPTIMIZATION: Initialize location WITHOUT GPS first (use cached/default)
            // This prevents GPS permission dialog from appearing during splash screen
            const location = await initializeLocationFast();

            // Fetch fresh prayer times in background (non-blocking if cached)
            initializePrayerTimes().then(schedule => {
                if (schedule) {
                    triggerCallbacks('onPrayerTimesFetched', schedule);
                }
            }).catch(err => {
                SaturaConfig.log('Background fetch failed, using cached data:', err.message);
            });

            // Start countdown timer immediately
            startCountdown();

            // Mark as initialized
            isInitialized = true;

            // Trigger ready callbacks
            const status = getStatus();
            triggerCallbacks('onReady', status);

            // AFTER splash is hidden, try GPS detection if no location source is GPS
            // Delay to ensure splash animation completes and user can interact with permission
            setTimeout(() => {
                retryGPSDetection();
            }, 1500);

            SaturaConfig.log('Initialization complete', status);
            return status;

        } catch (error) {
            SaturaConfig.error('Initialization failed:', error);
            triggerCallbacks('onError', error);
            throw error;
        }
    }

    /**
     * Load cached prayer schedule from storage
     * @returns {Object|null} - Cached schedule or null
     */


    /**
     * Register service worker for PWA
     */
    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            SaturaConfig.log('Service Worker not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register(
                './sw.js',
                { scope: './' }
            );

            SaturaConfig.log('Service Worker registered:', registration.scope);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        SaturaConfig.log('New version available');
                        triggerCallbacks('onUpdateAvailable', registration);
                    }
                });
            });

            return registration;

        } catch (error) {
            SaturaConfig.error('Service Worker registration failed:', error);
        }
    }

    /**
     * Initialize location with fallback strategy
     */
    async function initializeLocation() {
        try {
            const location = await SaturaLocation.getLocation();
            SaturaConfig.log('Location initialized:', SaturaLocation.getDisplayName());
            triggerCallbacks('onLocationChange', location);
            return location;
        } catch (error) {
            SaturaConfig.error('Location initialization failed:', error);
            // Use default location
            const defaultLocation = await SaturaLocation.setDefaultLocation();
            triggerCallbacks('onLocationChange', defaultLocation);
            return defaultLocation;
        }
    }

    /**
     * Initialize location WITHOUT GPS (fast, for splash screen)
     * Uses cached location or default, skips GPS to avoid permission dialog during splash
     */
    async function initializeLocationFast() {
        try {
            // Try to get saved location first (skip GPS)
            const savedLocation = await SaturaLocation.getSavedLocation();
            if (savedLocation) {
                SaturaConfig.log('Using saved location (fast init):', savedLocation);
                triggerCallbacks('onLocationChange', savedLocation);
                return savedLocation;
            }

            // Fallback to default location
            SaturaConfig.log('No saved location, using default (fast init)');
            const defaultLocation = await SaturaLocation.setDefaultLocation();
            triggerCallbacks('onLocationChange', defaultLocation);
            return defaultLocation;

        } catch (error) {
            SaturaConfig.error('Fast location initialization failed:', error);
            const defaultLocation = await SaturaLocation.setDefaultLocation();
            triggerCallbacks('onLocationChange', defaultLocation);
            return defaultLocation;
        }
    }

    /**
     * Retry GPS detection after splash screen is hidden
     * This allows user to interact with GPS permission dialog
     */
    async function retryGPSDetection() {
        try {
            // Check if we already have GPS location
            const currentLocation = SaturaLocation.getCurrentLocation();
            if (currentLocation && currentLocation.source === 'gps') {
                SaturaConfig.log('Already have GPS location, skipping retry');
                return;
            }

            // Check if user has explicitly set manual location
            if (currentLocation && currentLocation.source === 'manual') {
                SaturaConfig.log('User has manual location, skipping GPS retry');
                return;
            }

            SaturaConfig.log('Attempting GPS detection after splash...');

            // Try to detect location via GPS
            const gpsLocation = await SaturaLocation.detectLocation();

            if (gpsLocation) {
                SaturaConfig.log('GPS location obtained:', SaturaLocation.getDisplayName());
                triggerCallbacks('onLocationChange', gpsLocation);

                // Refresh prayer times with new location
                initializePrayerTimes().catch(err => {
                    SaturaConfig.log('Failed to refresh prayer times with GPS location:', err.message);
                });
            }
        } catch (error) {
            // GPS failed, but it's okay - we already have cached/default location
            SaturaConfig.log('GPS retry failed (this is normal if user denied):', error.message);
        }
    }

    /**
     * Initialize prayer times
     */
    async function initializePrayerTimes() {
        try {
            const schedule = await SaturaPrayer.fetchTodaySchedule();
            SaturaConfig.log('Prayer times fetched');
            triggerCallbacks('onPrayerTimesFetched', schedule);
            return schedule;
        } catch (error) {
            SaturaConfig.error('Failed to fetch prayer times:', error);
            throw error;
        }
    }

    // ===========================================
    // COUNTDOWN TIMER
    // ===========================================

    /**
     * Start the countdown timer
     */
    function startCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        countdownInterval = setInterval(() => {
            const nextPrayer = SaturaPrayer.getNextPrayer();
            if (nextPrayer) {
                triggerCallbacks('onNextPrayerUpdate', nextPrayer);
            }
        }, SaturaConfig.APP.countdownInterval);

        SaturaConfig.log('Countdown timer started');
    }

    /**
     * Stop the countdown timer
     */
    function stopCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }

    // ===========================================
    // ONLINE/OFFLINE HANDLING
    // ===========================================

    /**
     * Setup online/offline event listeners
     */
    function setupOnlineListener() {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    }

    /**
     * Handle coming online
     */
    async function handleOnline() {
        isOnline = true;
        SaturaConfig.log('App is online');
        triggerCallbacks('onOnlineStatusChange', true);

        // Refresh prayer times
        try {
            await SaturaPrayer.fetchTodaySchedule(true);
        } catch (error) {
            SaturaConfig.error('Failed to refresh after coming online:', error);
        }
    }

    /**
     * Handle going offline
     */
    function handleOffline() {
        isOnline = false;
        SaturaConfig.log('App is offline');
        triggerCallbacks('onOnlineStatusChange', false);
    }

    // ===========================================
    // LOCATION MANAGEMENT
    // ===========================================

    /**
     * Change location by GPS detection
     * @returns {Promise<Object>} - New location
     */
    async function detectAndSetLocation() {
        try {
            const location = await SaturaLocation.detectLocation();
            await refreshPrayerTimes();
            triggerCallbacks('onLocationChange', location);
            return location;
        } catch (error) {
            SaturaConfig.error('Failed to detect location:', error);
            throw error;
        }
    }

    /**
     * Set location manually by regency
     * @param {string} regencyId - Regency ID
     * @returns {Promise<Object>} - New location
     */
    async function setLocation(regencyId) {
        try {
            const location = await SaturaLocation.setLocationByRegencyId(regencyId);
            await refreshPrayerTimes();
            triggerCallbacks('onLocationChange', location);
            return location;
        } catch (error) {
            SaturaConfig.error('Failed to set location:', error);
            throw error;
        }
    }

    /**
     * Set location by province
     * @param {string} provinceId - Province ID
     * @returns {Promise<Object>} - New location
     */
    async function setLocationByProvince(provinceId) {
        try {
            const location = await SaturaLocation.setLocationByProvinceId(provinceId);
            await refreshPrayerTimes();
            triggerCallbacks('onLocationChange', location);
            return location;
        } catch (error) {
            SaturaConfig.error('Failed to set location by province:', error);
            throw error;
        }
    }

    // ===========================================
    // PRAYER TIMES MANAGEMENT
    // ===========================================

    /**
     * Refresh prayer times from API
     * @returns {Promise<Object>} - Updated schedule
     */
    async function refreshPrayerTimes() {
        try {
            const schedule = await SaturaPrayer.fetchTodaySchedule(true);
            triggerCallbacks('onPrayerTimesFetched', schedule);
            return schedule;
        } catch (error) {
            SaturaConfig.error('Failed to refresh prayer times:', error);
            throw error;
        }
    }

    /**
     * Get today's prayer schedule
     * @returns {Promise<Object>} - Prayer schedule
     */
    async function getPrayerSchedule() {
        return await SaturaPrayer.fetchTodaySchedule();
    }

    /**
     * Get prayer schedule for a specific date
     * @param {Date|string} date - Target date
     * @returns {Promise<Object>} - Prayer schedule
     */
    async function getPrayerScheduleForDate(date) {
        return await SaturaPrayer.fetchScheduleForDate(date);
    }

    /**
     * Get monthly prayer calendar
     * @param {number} month - Month (1-12)
     * @param {number} year - Year
     * @returns {Promise<Array>} - Monthly schedule
     */
    async function getMonthlySchedule(month, year) {
        return await SaturaPrayer.fetchMonthlySchedule(month, year);
    }

    // ===========================================
    // DATA ACCESS HELPERS
    // ===========================================

    /**
     * Get next prayer info
     * @returns {Object|null} - Next prayer
     */
    function getNextPrayer() {
        return SaturaPrayer.getNextPrayer();
    }

    /**
     * Get current prayer info
     * @returns {Object|null} - Current prayer
     */
    function getCurrentPrayer() {
        return SaturaPrayer.getCurrentPrayer();
    }

    /**
     * Get ordered prayer times for display
     * @returns {Array} - Ordered prayer times
     */
    function getOrderedTimes() {
        return SaturaPrayer.getOrderedTimes();
    }

    /**
     * Get Ramadhan-specific times (Imsak, Berbuka)
     * @returns {Object|null} - Ramadhan times
     */
    function getRamadhanTimes() {
        return SaturaPrayer.getRamadhanTimes();
    }

    /**
     * Check if current month is Ramadhan
     * @returns {boolean}
     */
    function isRamadhan() {
        return SaturaPrayer.isRamadhan();
    }

    /**
     * Get current location display name
     * @returns {string}
     */
    function getLocationName() {
        return SaturaLocation.getDisplayName();
    }

    /**
     * Search locations
     * @param {string} query - Search query
     * @returns {Promise<Object>} - Search results
     */
    async function searchLocations(query) {
        return await SaturaDatabase.searchAll(query);
    }

    /**
     * Get all provinces
     * @returns {Promise<Array>} - Provinces
     */
    async function getProvinces() {
        return await SaturaDatabase.getProvinces();
    }

    /**
     * Get regencies by province
     * @param {string} provinceId - Province ID
     * @returns {Promise<Array>} - Regencies
     */
    async function getRegenciesByProvince(provinceId) {
        return await SaturaDatabase.getRegenciesByProvince(provinceId);
    }

    // ===========================================
    // CALLBACK MANAGEMENT
    // ===========================================

    /**
     * Register callback for events
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    function on(event, callback) {
        if (callbacks[event]) {
            callbacks[event].push(callback);
        }
    }

    /**
     * Unregister callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    function off(event, callback) {
        if (callbacks[event]) {
            const index = callbacks[event].indexOf(callback);
            if (index > -1) {
                callbacks[event].splice(index, 1);
            }
        }
    }

    /**
     * Trigger callbacks for an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to callbacks
     */
    function triggerCallbacks(event, data) {
        if (callbacks[event]) {
            callbacks[event].forEach(cb => {
                try {
                    cb(data);
                } catch (error) {
                    SaturaConfig.error(`Callback error for ${event}:`, error);
                }
            });
        }
    }

    // ===========================================
    // STATUS & UTILITY
    // ===========================================

    /**
     * Get complete app status
     * @returns {Object} - App status
     */
    function getStatus() {
        return {
            app: {
                name: SaturaConfig.APP.name,
                version: SaturaConfig.APP.version,
                initialized: isInitialized,
                online: isOnline
            },
            location: SaturaLocation.getStatus(),
            prayer: SaturaPrayer.getStatus(),
            api: SaturaAPI.getEndpointStatus(),
            database: SaturaDatabase.getStatus(),
            storage: SaturaStorage.getStorageInfo()
        };
    }

    /**
     * Clear all cached data
     */
    function clearCache() {
        SaturaPrayer.clearCache();
        SaturaStorage.clearPrayerCache();
        SaturaConfig.log('All cache cleared');
    }

    /**
     * Reset app to initial state
     */
    function reset() {
        stopCountdown();
        SaturaStorage.clearAll();
        SaturaLocation.clearSavedLocation();
        isInitialized = false;
        SaturaConfig.log('App reset to initial state');
    }

    /**
     * Export all data for backup
     * @returns {Object}
     */
    function exportData() {
        return SaturaStorage.exportData();
    }

    /**
     * Import data from backup
     * @param {Object} data - Data to import
     */
    function importData(data) {
        SaturaStorage.importData(data);
    }

    // ===========================================
    // DEBUG HELPERS
    // ===========================================

    /**
     * Test API connectivity
     * @returns {Promise<Object>} - Test results
     */
    async function testAPI() {
        const results = {
            endpoints: [],
            success: false
        };

        const coords = SaturaLocation.getCoordinates() || SaturaConfig.LOCATION.default;

        for (let i = 0; i < SaturaConfig.API.endpoints.length; i++) {
            const endpoint = SaturaConfig.API.endpoints[i];
            const startTime = Date.now();

            try {
                const response = await fetch(
                    `${endpoint}/timings?latitude=${coords.latitude}&longitude=${coords.longitude}&method=${SaturaConfig.API.method}`
                );
                const data = await response.json();
                const duration = Date.now() - startTime;

                results.endpoints.push({
                    url: endpoint,
                    success: data.code === 200,
                    duration: duration,
                    status: response.status
                });

                if (data.code === 200) {
                    results.success = true;
                }

            } catch (error) {
                results.endpoints.push({
                    url: endpoint,
                    success: false,
                    error: error.message,
                    duration: Date.now() - startTime
                });
            }
        }

        return results;
    }

    /**
     * Get debug information
     * @returns {Object}
     */
    function getDebugInfo() {
        return {
            status: getStatus(),
            config: {
                api: SaturaConfig.API,
                prayer: SaturaConfig.PRAYER,
                cache: SaturaConfig.CACHE,
                location: SaturaConfig.LOCATION
            },
            environment: {
                userAgent: navigator.userAgent,
                online: navigator.onLine,
                language: navigator.language,
                cookiesEnabled: navigator.cookieEnabled,
                serviceWorker: 'serviceWorker' in navigator,
                geolocation: 'geolocation' in navigator
            }
        };
    }

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        // Initialization
        init,

        // Location
        detectAndSetLocation,
        setLocation,
        setLocationByProvince,
        getLocationName,
        searchLocations,
        getProvinces,
        getRegenciesByProvince,

        // Prayer Times
        refreshPrayerTimes,
        getPrayerSchedule,
        getPrayerScheduleForDate,
        getMonthlySchedule,
        getNextPrayer,
        getCurrentPrayer,
        getOrderedTimes,
        getRamadhanTimes,
        isRamadhan,

        // Countdown
        startCountdown,
        stopCountdown,

        // Events
        on,
        off,

        // Utility
        getStatus,
        clearCache,
        reset,
        exportData,
        importData,

        // Debug
        testAPI,
        getDebugInfo,

        // Direct module access
        modules: {
            Config: SaturaConfig,
            API: SaturaAPI,
            Database: SaturaDatabase,
            Location: SaturaLocation,
            Prayer: SaturaPrayer,
            Storage: SaturaStorage
        }
    };
})();

// Auto-initialize when DOM is ready (optional - dapat dinonaktifkan)
// document.addEventListener('DOMContentLoaded', () => SaturaApp.init());

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaApp;
}

// Make available globally
window.SaturaApp = SaturaApp;
