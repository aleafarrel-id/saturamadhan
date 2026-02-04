/**
 * Satu Ramadhan - Storage Module
 * Centralized storage management for localStorage and data persistence
 * LocalStorage wrapper with error handling and expiration
 */

const SaturaStorage = (function () {
    'use strict';

    // ===========================================
    // CORE STORAGE FUNCTIONS
    // ===========================================

    /**
     * Check if localStorage is available
     * @returns {boolean}
     */
    function isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Set item to localStorage with optional expiration
     * @param {string} key - Storage key
     * @param {*} value - Value to store (will be JSON stringified)
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    function set(key, value, ttl = null) {
        if (!isAvailable()) {
            SaturaConfig.error('localStorage is not available');
            return false;
        }

        try {
            const data = {
                value: value,
                timestamp: Date.now(),
                ttl: ttl
            };

            localStorage.setItem(key, JSON.stringify(data));
            return true;

        } catch (error) {
            SaturaConfig.error(`Failed to set ${key}:`, error);

            // Try to free up space if quota exceeded
            if (error.name === 'QuotaExceededError') {
                cleanExpired();
                try {
                    localStorage.setItem(key, JSON.stringify({
                        value: value,
                        timestamp: Date.now(),
                        ttl: ttl
                    }));
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return false;
        }
    }

    /**
     * Get item from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found or expired
     * @returns {*} - Stored value or default
     */
    function get(key, defaultValue = null) {
        if (!isAvailable()) {
            return defaultValue;
        }

        try {
            const stored = localStorage.getItem(key);

            if (!stored) {
                return defaultValue;
            }

            const data = JSON.parse(stored);

            // Check expiration
            if (data.ttl && (Date.now() - data.timestamp > data.ttl)) {
                localStorage.removeItem(key);
                return defaultValue;
            }

            return data.value;

        } catch (error) {
            SaturaConfig.error(`Failed to get ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     */
    function remove(key) {
        if (!isAvailable()) return;

        try {
            localStorage.removeItem(key);
        } catch (error) {
            SaturaConfig.error(`Failed to remove ${key}:`, error);
        }
    }

    /**
     * Check if key exists and is not expired
     * @param {string} key - Storage key
     * @returns {boolean}
     */
    function has(key) {
        return get(key) !== null;
    }

    /**
     * Clear all items with specific prefix
     * @param {string} prefix - Key prefix to match
     */
    function clearByPrefix(prefix) {
        if (!isAvailable()) return;

        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        SaturaConfig.log(`Cleared ${keysToRemove.length} items with prefix: ${prefix}`);
    }

    /**
     * Clean all expired items
     */
    function cleanExpired() {
        if (!isAvailable()) return;

        const now = Date.now();
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            try {
                const stored = localStorage.getItem(key);
                if (!stored) continue;

                const data = JSON.parse(stored);
                if (data.ttl && (now - data.timestamp > data.ttl)) {
                    keysToRemove.push(key);
                }
            } catch (e) {
                // Skip non-JSON items
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        if (keysToRemove.length > 0) {
            SaturaConfig.log(`Cleaned ${keysToRemove.length} expired items`);
        }
    }

    // ===========================================
    // USER SETTINGS
    // ===========================================

    /**
     * Save user settings
     * @param {Object} settings - Settings object
     */
    function saveSettings(settings) {
        const currentSettings = getSettings();
        const merged = { ...currentSettings, ...settings };

        set(
            SaturaConfig.CACHE.keys.settings,
            merged,
            SaturaConfig.CACHE.duration.location // Long-lived
        );

        SaturaConfig.log('Settings saved:', merged);
    }

    /**
     * Get user settings
     * @returns {Object} - Settings object
     */
    function getSettings() {
        return get(SaturaConfig.CACHE.keys.settings, {
            theme: 'auto',
            notifications: false,
            calculationMethod: SaturaConfig.API.method,
            language: 'id'
        });
    }

    /**
     * Get specific setting
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value
     * @returns {*} - Setting value
     */
    function getSetting(key, defaultValue = null) {
        const settings = getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    /**
     * Set specific setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    function setSetting(key, value) {
        saveSettings({ [key]: value });
    }

    // ===========================================
    // LOCATION STORAGE
    // ===========================================

    /**
     * Save user location
     * @param {Object} location - Location data
     */
    function saveLocation(location) {
        set(
            SaturaConfig.CACHE.keys.userLocation,
            {
                regencyId: location.regency?.id || null,
                provinceId: location.province?.id || null,
                coordinates: location.coordinates,
                source: location.source,
                savedAt: Date.now()
            },
            SaturaConfig.CACHE.duration.location
        );
    }

    /**
     * Get saved location
     * @returns {Object|null} - Saved location data
     */
    function getLocation() {
        return get(SaturaConfig.CACHE.keys.userLocation, null);
    }

    /**
     * Clear saved location
     */
    function clearLocation() {
        remove(SaturaConfig.CACHE.keys.userLocation);
    }

    // ===========================================
    // PRAYER CACHE STORAGE
    // ===========================================

    /**
     * Save prayer times cache
     * @param {string} dateKey - Date key (YYYY-MM-DD)
     * @param {Object} schedule - Prayer schedule
     */
    function savePrayerCache(dateKey, schedule) {
        const key = `${SaturaConfig.CACHE.keys.prayerCache}_${dateKey}`;
        set(key, schedule, SaturaConfig.CACHE.duration.prayerTimes);
    }

    /**
     * Get prayer times cache
     * @param {string} dateKey - Date key (YYYY-MM-DD)
     * @returns {Object|null} - Cached schedule
     */
    function getPrayerCache(dateKey) {
        const key = `${SaturaConfig.CACHE.keys.prayerCache}_${dateKey}`;
        return get(key, null);
    }

    /**
     * Clear all prayer cache
     */
    function clearPrayerCache() {
        clearByPrefix(SaturaConfig.CACHE.keys.prayerCache);
    }

    // ===========================================
    // LAST UPDATE TRACKING
    // ===========================================

    /**
     * Set last update timestamp
     * @param {string} type - Update type (e.g., 'prayer', 'location')
     */
    function setLastUpdate(type) {
        const updates = get(SaturaConfig.CACHE.keys.lastUpdate, {});
        updates[type] = Date.now();
        set(SaturaConfig.CACHE.keys.lastUpdate, updates);
    }

    /**
     * Get last update timestamp
     * @param {string} type - Update type
     * @returns {number|null} - Timestamp or null
     */
    function getLastUpdate(type) {
        const updates = get(SaturaConfig.CACHE.keys.lastUpdate, {});
        return updates[type] || null;
    }

    /**
     * Check if update is needed
     * @param {string} type - Update type
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {boolean}
     */
    function needsUpdate(type, maxAge) {
        const lastUpdate = getLastUpdate(type);
        if (!lastUpdate) return true;
        return (Date.now() - lastUpdate) > maxAge;
    }

    // ===========================================
    // STORAGE INFO & MANAGEMENT
    // ===========================================

    /**
     * Get storage usage info
     * @returns {Object} - Storage info
     */
    function getStorageInfo() {
        if (!isAvailable()) {
            return { available: false };
        }

        let totalSize = 0;
        let itemCount = 0;
        const items = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            const value = localStorage.getItem(key);
            const size = (key.length + (value?.length || 0)) * 2; // UTF-16

            totalSize += size;
            itemCount++;

            // Track Satura-specific items
            if (key.startsWith('satura_')) {
                items[key] = {
                    size: size,
                    sizeKB: Math.round(size / 1024 * 100) / 100
                };
            }
        }

        return {
            available: true,
            totalBytes: totalSize,
            totalKB: Math.round(totalSize / 1024 * 100) / 100,
            itemCount: itemCount,
            saturaItems: items
        };
    }

    /**
     * Clear all Satura-related storage
     */
    function clearAll() {
        clearByPrefix('satura_');
        SaturaConfig.log('All Satura storage cleared');
    }

    /**
     * Export all stored data (for backup)
     * @returns {Object} - All stored data
     */
    function exportData() {
        if (!isAvailable()) return null;

        const data = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('satura_')) continue;

            try {
                data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                data[key] = localStorage.getItem(key);
            }
        }

        return data;
    }

    /**
     * Import data (for restore)
     * @param {Object} data - Data to import
     */
    function importData(data) {
        if (!isAvailable() || !data) return;

        Object.entries(data).forEach(([key, value]) => {
            if (key.startsWith('satura_')) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        });

        SaturaConfig.log('Data imported successfully');
    }

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        // Core
        isAvailable,
        set,
        get,
        remove,
        has,
        clearByPrefix,
        cleanExpired,

        // Settings
        saveSettings,
        getSettings,
        getSetting,
        setSetting,

        // Location
        saveLocation,
        getLocation,
        clearLocation,

        // Prayer Cache
        savePrayerCache,
        getPrayerCache,
        clearPrayerCache,

        // Last Update
        setLastUpdate,
        getLastUpdate,
        needsUpdate,

        // Management
        getStorageInfo,
        clearAll,
        exportData,
        importData
    };
})();

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaStorage;
}
