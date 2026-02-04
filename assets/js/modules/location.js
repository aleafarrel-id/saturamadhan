/**
 * Satu Ramadhan - Location Module
 * Geolocation and user location management handler
 * GPS with fallback to manual location from database
 */

const SaturaLocation = (function () {
    'use strict';

    // Current location state
    let currentLocation = null;
    let locationSource = null; // 'gps', 'manual', 'default'

    // ===========================================
    // GPS FUNCTIONS
    // ===========================================

    /**
     * Check if geolocation is supported
     * @returns {boolean}
     */
    function isGeolocationSupported() {
        return 'geolocation' in navigator;
    }

    /**
     * Get current GPS position
     * @returns {Promise<GeolocationPosition>}
     */
    function getGPSPosition() {
        return new Promise((resolve, reject) => {
            if (!isGeolocationSupported()) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                SaturaConfig.LOCATION.geoOptions
            );
        });
    }

    /**
     * Get current coordinates from GPS
     * @returns {Promise<Object>} - Object with latitude and longitude
     */
    async function getGPSCoordinates() {
        try {
            const position = await getGPSPosition();

            const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };

            SaturaConfig.log('GPS coordinates obtained:', coords);
            return coords;

        } catch (error) {
            SaturaConfig.log('GPS error:', error.message);
            throw error;
        }
    }

    /**
     * Watch position for continuous updates
     * @param {Function} onSuccess - Callback on position update
     * @param {Function} onError - Callback on error
     * @returns {number} - Watch ID (use to stop watching)
     */
    function watchPosition(onSuccess, onError) {
        if (!isGeolocationSupported()) {
            onError(new Error('Geolocation is not supported'));
            return null;
        }

        return navigator.geolocation.watchPosition(
            (position) => {
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                onSuccess(coords);
            },
            onError,
            SaturaConfig.LOCATION.geoOptions
        );
    }

    /**
     * Stop watching position
     * @param {number} watchId - Watch ID from watchPosition
     */
    function clearWatch(watchId) {
        if (watchId !== null && isGeolocationSupported()) {
            navigator.geolocation.clearWatch(watchId);
        }
    }

    // ===========================================
    // LOCATION DETECTION
    // ===========================================

    /**
     * Detect current location using GPS and match to database
     * @returns {Promise<Object>} - Location data with regency and province
     */
    async function detectLocation() {
        try {
            SaturaConfig.log('Attempting to detect location via GPS...');

            // Get GPS coordinates
            const coords = await getGPSCoordinates();

            // Find nearest location from database
            const location = await SaturaDatabase.findNearestLocation(
                coords.latitude,
                coords.longitude
            );

            if (location.regency) {
                currentLocation = {
                    ...location,
                    source: 'gps',
                    gpsCoordinates: coords,
                    timestamp: Date.now()
                };
                locationSource = 'gps';

                SaturaConfig.log('Location detected via GPS:', currentLocation);

                // Save to storage
                await saveLocation(currentLocation);

                return currentLocation;
            } else {
                throw new Error('Could not match GPS coordinates to any location in database');
            }

        } catch (error) {
            SaturaConfig.log('GPS detection failed:', error.message);
            throw error;
        }
    }

    /**
     * Get location with fallback strategy
     * Priority: 1. GPS -> 2. Saved Location -> 3. Default Location
     * @returns {Promise<Object>} - Location data
     */
    async function getLocation() {
        // Return cached location if available
        if (currentLocation) {
            return currentLocation;
        }

        // Try GPS first
        try {
            return await detectLocation();
        } catch (gpsError) {
            SaturaConfig.log('GPS failed, trying saved location...');
        }

        // Try saved location
        const savedLocation = await getSavedLocation();
        if (savedLocation) {
            currentLocation = savedLocation;
            locationSource = savedLocation.source || 'manual';
            SaturaConfig.log('Using saved location:', currentLocation);
            return currentLocation;
        }

        // Fallback to default
        SaturaConfig.log('Using default location');
        return await setDefaultLocation();
    }

    /**
     * Set location to default (configured in config.js)
     * @returns {Promise<Object>} - Default location data
     */
    async function setDefaultLocation() {
        const defaultConfig = SaturaConfig.LOCATION.default;

        // Get full location data from database
        const location = await SaturaDatabase.getLocationByRegencyId(defaultConfig.regencyId);

        if (location) {
            currentLocation = {
                ...location,
                source: 'default',
                timestamp: Date.now()
            };
        } else {
            // Use config defaults directly
            currentLocation = {
                regency: {
                    id: defaultConfig.regencyId,
                    name: defaultConfig.regencyName,
                    latitude: defaultConfig.latitude,
                    longitude: defaultConfig.longitude,
                    province_id: defaultConfig.provinceId
                },
                province: {
                    id: defaultConfig.provinceId,
                    name: defaultConfig.provinceName,
                    latitude: defaultConfig.latitude,
                    longitude: defaultConfig.longitude
                },
                coordinates: {
                    latitude: defaultConfig.latitude,
                    longitude: defaultConfig.longitude
                },
                source: 'default',
                timestamp: Date.now()
            };
        }

        locationSource = 'default';
        return currentLocation;
    }

    // ===========================================
    // MANUAL LOCATION SELECTION
    // ===========================================

    /**
     * Set location manually by regency ID
     * @param {string} regencyId - Regency ID from database
     * @returns {Promise<Object>} - Location data
     */
    async function setLocationByRegencyId(regencyId) {
        const location = await SaturaDatabase.getLocationByRegencyId(regencyId);

        if (!location) {
            throw new Error(`Regency not found: ${regencyId}`);
        }

        currentLocation = {
            ...location,
            source: 'manual',
            timestamp: Date.now()
        };
        locationSource = 'manual';

        // Save to storage
        await saveLocation(currentLocation);

        SaturaConfig.log('Location set manually:', currentLocation);
        return currentLocation;
    }

    /**
     * Set location manually by province ID (uses province center)
     * @param {string} provinceId - Province ID from database
     * @returns {Promise<Object>} - Location data
     */
    async function setLocationByProvinceId(provinceId) {
        const province = await SaturaDatabase.getProvinceById(provinceId);

        if (!province) {
            throw new Error(`Province not found: ${provinceId}`);
        }

        currentLocation = {
            regency: null,
            province: province,
            coordinates: {
                latitude: province.latitude,
                longitude: province.longitude
            },
            source: 'manual',
            timestamp: Date.now()
        };
        locationSource = 'manual';

        // Save to storage
        await saveLocation(currentLocation);

        SaturaConfig.log('Location set by province:', currentLocation);
        return currentLocation;
    }

    /**
     * Set location by custom coordinates
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     * @returns {Promise<Object>} - Location data
     */
    async function setLocationByCoordinates(latitude, longitude) {
        const location = await SaturaDatabase.findNearestLocation(latitude, longitude);

        currentLocation = {
            ...location,
            customCoordinates: { latitude, longitude },
            source: 'manual',
            timestamp: Date.now()
        };
        locationSource = 'manual';

        // Save to storage
        await saveLocation(currentLocation);

        SaturaConfig.log('Location set by coordinates:', currentLocation);
        return currentLocation;
    }

    // ===========================================
    // STORAGE FUNCTIONS
    // ===========================================

    /**
     * Save location to localStorage
     * @param {Object} location - Location data to save
     */
    async function saveLocation(location) {
        try {
            const dataToSave = {
                regencyId: location.regency?.id || null,
                provinceId: location.province?.id || null,
                coordinates: location.coordinates,
                source: location.source,
                timestamp: location.timestamp
            };

            localStorage.setItem(
                SaturaConfig.CACHE.keys.userLocation,
                JSON.stringify(dataToSave)
            );

            SaturaConfig.log('Location saved to storage');
        } catch (error) {
            SaturaConfig.error('Failed to save location:', error);
        }
    }

    /**
     * Get saved location from localStorage
     * @returns {Promise<Object|null>} - Saved location or null
     */
    async function getSavedLocation() {
        try {
            const saved = localStorage.getItem(SaturaConfig.CACHE.keys.userLocation);

            if (!saved) {
                return null;
            }

            const data = JSON.parse(saved);

            // Reconstruct full location from database
            if (data.regencyId) {
                const location = await SaturaDatabase.getLocationByRegencyId(data.regencyId);
                if (location) {
                    return {
                        ...location,
                        source: data.source,
                        timestamp: data.timestamp
                    };
                }
            } else if (data.provinceId) {
                const province = await SaturaDatabase.getProvinceById(data.provinceId);
                if (province) {
                    return {
                        regency: null,
                        province: province,
                        coordinates: data.coordinates,
                        source: data.source,
                        timestamp: data.timestamp
                    };
                }
            }

            return null;

        } catch (error) {
            SaturaConfig.error('Failed to get saved location:', error);
            return null;
        }
    }

    /**
     * Clear saved location
     */
    function clearSavedLocation() {
        try {
            localStorage.removeItem(SaturaConfig.CACHE.keys.userLocation);
            currentLocation = null;
            locationSource = null;
            SaturaConfig.log('Saved location cleared');
        } catch (error) {
            SaturaConfig.error('Failed to clear saved location:', error);
        }
    }

    /**
     * Get saved location synchronously (for fast startup)
     * Returns minimal data without async database reconstruction
     * This is much faster than getSavedLocation() for initial app load
     * @returns {Object|null} - Saved location with coordinates or null
     */
    function getSavedLocationSync() {
        try {
            const saved = localStorage.getItem(SaturaConfig.CACHE.keys.userLocation);
            if (!saved) return null;

            const data = JSON.parse(saved);

            // Return minimal location data with coordinates
            if (data.coordinates && data.coordinates.latitude && data.coordinates.longitude) {
                return {
                    coordinates: data.coordinates,
                    source: data.source || 'cached',
                    regency: data.regencyId ? { id: data.regencyId, name: null } : null,
                    province: data.provinceId ? { id: data.provinceId, name: null } : null,
                    timestamp: data.timestamp
                };
            }
            return null;
        } catch (e) {
            SaturaConfig.error('Failed to get saved location sync:', e);
            return null;
        }
    }

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    /**
     * Get current location status
     * @returns {Object} - Status object
     */
    function getStatus() {
        return {
            hasLocation: currentLocation !== null,
            source: locationSource,
            geolocationSupported: isGeolocationSupported(),
            location: currentLocation ? {
                regencyName: currentLocation.regency?.name,
                provinceName: currentLocation.province?.name,
                coordinates: currentLocation.coordinates,
                source: currentLocation.source
            } : null
        };
    }

    /**
     * Get current location (cached)
     * @returns {Object|null} - Current location or null
     */
    function getCurrentLocation() {
        return currentLocation;
    }

    /**
     * Get coordinates for API calls
     * @returns {Object|null} - Object with latitude and longitude
     */
    function getCoordinates() {
        if (!currentLocation) {
            return null;
        }

        return currentLocation.coordinates || {
            latitude: currentLocation.regency?.latitude || currentLocation.province?.latitude,
            longitude: currentLocation.regency?.longitude || currentLocation.province?.longitude
        };
    }

    /**
     * Get display name for current location
     * @returns {string} - Display name
     */
    function getDisplayName() {
        if (!currentLocation) {
            return 'Lokasi belum diatur';
        }

        const regency = currentLocation.regency?.name;
        const province = currentLocation.province?.name;

        if (regency && province) {
            return `${regency}, ${province}`;
        } else if (regency) {
            return regency;
        } else if (province) {
            return province;
        }

        return 'Lokasi tidak diketahui';
    }

    /**
     * Refresh location (re-detect via GPS or reload saved)
     * @param {boolean} forceGPS - Force GPS detection
     * @returns {Promise<Object>} - Updated location
     */
    async function refreshLocation(forceGPS = false) {
        if (forceGPS) {
            currentLocation = null;
            return await detectLocation();
        }

        currentLocation = null;
        return await getLocation();
    }

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        // GPS
        isGeolocationSupported,
        getGPSCoordinates,
        watchPosition,
        clearWatch,

        // Detection
        detectLocation,
        getLocation,
        setDefaultLocation,

        // Manual Selection
        setLocationByRegencyId,
        setLocationByProvinceId,
        setLocationByCoordinates,

        // Storage
        saveLocation,
        getSavedLocation,
        getSavedLocationSync,
        clearSavedLocation,

        // Utility
        getStatus,
        getCurrentLocation,
        getCoordinates,
        getDisplayName,
        refreshLocation
    };
})();

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaLocation;
}
