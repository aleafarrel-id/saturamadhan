/**
 * Satu Ramadhan - Database Module
 * Local database handler for province.json and regency.json
 * Provides load, search, and filter functions for regional data
 */

const SaturaDatabase = (function () {
    'use strict';

    // Cache untuk data database
    let provincesCache = null;
    let regenciesCache = null;
    let isLoading = false;
    let loadPromise = null;

    // ===========================================
    // DATA LOADING FUNCTIONS
    // ===========================================

    /**
     * Load provinces data from JSON file
     * @returns {Promise<Array>} - Array of provinces
     */
    async function loadProvinces() {
        if (provincesCache) {
            return provincesCache;
        }

        try {
            SaturaConfig.log('Loading provinces database...');
            // Add cache-busting to ensure fresh data
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(SaturaConfig.DATABASE.paths.provinces + cacheBuster);

            if (!response.ok) {
                throw new Error(`Failed to load provinces: ${response.status}`);
            }

            provincesCache = await response.json();
            SaturaConfig.log(`Loaded ${provincesCache.length} provinces`);
            return provincesCache;

        } catch (error) {
            SaturaConfig.error('Error loading provinces:', error);
            throw error;
        }
    }

    /**
     * Load regencies data from JSON file
     * @returns {Promise<Array>} - Array of regencies
     */
    async function loadRegencies() {
        if (regenciesCache) {
            return regenciesCache;
        }

        try {
            SaturaConfig.log('Loading regencies database...');
            // Add cache-busting to ensure fresh data
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(SaturaConfig.DATABASE.paths.regencies + cacheBuster);

            if (!response.ok) {
                throw new Error(`Failed to load regencies: ${response.status}`);
            }

            regenciesCache = await response.json();
            SaturaConfig.log(`Loaded ${regenciesCache.length} regencies`);
            return regenciesCache;

        } catch (error) {
            SaturaConfig.error('Error loading regencies:', error);
            throw error;
        }
    }

    /**
     * Load all database files
     * @returns {Promise<Object>} - Object containing provinces and regencies
     */
    async function loadAll() {
        // Prevent multiple simultaneous loads
        if (loadPromise) {
            return loadPromise;
        }

        if (provincesCache && regenciesCache) {
            return {
                provinces: provincesCache,
                regencies: regenciesCache
            };
        }

        isLoading = true;
        loadPromise = Promise.all([
            loadProvinces(),
            loadRegencies()
        ]).then(([provinces, regencies]) => {
            isLoading = false;
            loadPromise = null;
            return { provinces, regencies };
        }).catch(error => {
            isLoading = false;
            loadPromise = null;
            throw error;
        });

        return loadPromise;
    }

    // ===========================================
    // PROVINCE FUNCTIONS
    // ===========================================

    /**
     * Get all provinces
     * @returns {Promise<Array>} - Array of provinces
     */
    async function getProvinces() {
        return await loadProvinces();
    }

    /**
     * Get province by ID
     * @param {string} id - Province ID
     * @returns {Promise<Object|null>} - Province object or null
     */
    async function getProvinceById(id) {
        const provinces = await loadProvinces();
        return provinces.find(p => p.id === id) || null;
    }

    /**
     * Get province by name (case-insensitive)
     * @param {string} name - Province name
     * @returns {Promise<Object|null>} - Province object or null
     */
    async function getProvinceByName(name) {
        const provinces = await loadProvinces();
        const searchName = name.toLowerCase();
        return provinces.find(p => p.name.toLowerCase() === searchName) || null;
    }

    // ===========================================
    // REGENCY FUNCTIONS
    // ===========================================

    /**
     * Get all regencies
     * @returns {Promise<Array>} - Array of regencies
     */
    async function getRegencies() {
        return await loadRegencies();
    }

    /**
     * Get regency by ID
     * @param {string} id - Regency ID
     * @returns {Promise<Object|null>} - Regency object or null
     */
    async function getRegencyById(id) {
        const regencies = await loadRegencies();
        return regencies.find(r => r.id === id) || null;
    }

    /**
     * Get regency by name (case-insensitive)
     * @param {string} name - Regency name
     * @returns {Promise<Object|null>} - Regency object or null
     */
    async function getRegencyByName(name) {
        const regencies = await loadRegencies();
        const searchName = name.toLowerCase();
        return regencies.find(r => r.name.toLowerCase() === searchName) || null;
    }

    /**
     * Get all regencies in a province
     * @param {string} provinceId - Province ID
     * @returns {Promise<Array>} - Array of regencies in the province
     */
    async function getRegenciesByProvince(provinceId) {
        const regencies = await loadRegencies();
        return regencies.filter(r => r.province_id === provinceId);
    }

    // ===========================================
    // SEARCH FUNCTIONS
    // ===========================================

    /**
     * Search provinces by name
     * @param {string} query - Search query
     * @returns {Promise<Array>} - Matching provinces
     */
    async function searchProvinces(query) {
        if (!query || query.length < 2) {
            return [];
        }

        const provinces = await loadProvinces();
        const searchQuery = query.toLowerCase();

        return provinces.filter(p =>
            p.name.toLowerCase().includes(searchQuery)
        );
    }

    /**
     * Search regencies by name
     * @param {string} query - Search query
     * @param {string} provinceId - Optional province ID to filter
     * @returns {Promise<Array>} - Matching regencies
     */
    async function searchRegencies(query, provinceId = null) {
        if (!query || query.length < 2) {
            return [];
        }

        const regencies = await loadRegencies();
        const searchQuery = query.toLowerCase();

        let results = regencies.filter(r =>
            r.name.toLowerCase().includes(searchQuery)
        );

        if (provinceId) {
            results = results.filter(r => r.province_id === provinceId);
        }

        return results;
    }

    /**
     * Search all locations (provinces and regencies)
     * @param {string} query - Search query
     * @returns {Promise<Object>} - Object with provinces and regencies arrays
     */
    async function searchAll(query) {
        const [provinces, regencies] = await Promise.all([
            searchProvinces(query),
            searchRegencies(query)
        ]);

        return { provinces, regencies };
    }

    // ===========================================
    // LOCATION/COORDINATE FUNCTIONS
    // ===========================================

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - Latitude 1
     * @param {number} lng1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lng2 - Longitude 2
     * @returns {number} - Distance in kilometers
     */
    function calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = toRadians(lat2 - lat1);
        const dLng = toRadians(lng2 - lng1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Degrees
     * @returns {number} - Radians
     */
    function toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Find the nearest regency to given coordinates
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @returns {Promise<Object>} - Nearest regency with distance
     */
    async function findNearestRegency(latitude, longitude) {
        const regencies = await loadRegencies();

        let nearest = null;
        let minDistance = Infinity;

        for (const regency of regencies) {
            // Skip regencies without coordinates
            if (!regency.latitude || !regency.longitude) {
                continue;
            }

            const distance = calculateDistance(
                latitude, longitude,
                regency.latitude, regency.longitude
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearest = {
                    ...regency,
                    distance: Math.round(distance * 100) / 100 // Round to 2 decimals
                };
            }
        }

        if (nearest) {
            SaturaConfig.log(`Nearest regency: ${nearest.name} (${nearest.distance} km)`);
        }

        return nearest;
    }

    /**
     * Find the nearest province to given coordinates
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @returns {Promise<Object>} - Nearest province with distance
     */
    async function findNearestProvince(latitude, longitude) {
        const provinces = await loadProvinces();

        let nearest = null;
        let minDistance = Infinity;

        for (const province of provinces) {
            if (!province.latitude || !province.longitude) {
                continue;
            }

            const distance = calculateDistance(
                latitude, longitude,
                province.latitude, province.longitude
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearest = {
                    ...province,
                    distance: Math.round(distance * 100) / 100
                };
            }
        }

        return nearest;
    }

    /**
     * Find nearest location (regency and province) from coordinates
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @returns {Promise<Object>} - Object with regency and province data
     */
    async function findNearestLocation(latitude, longitude) {
        const [regency, provinces] = await Promise.all([
            findNearestRegency(latitude, longitude),
            loadProvinces()
        ]);

        let province = null;
        if (regency) {
            province = provinces.find(p => p.id === regency.province_id) || null;
        }

        return {
            regency,
            province,
            coordinates: {
                latitude,
                longitude
            }
        };
    }

    /**
     * Get location data by regency ID (includes province)
     * @param {string} regencyId - Regency ID
     * @returns {Promise<Object|null>} - Location data or null
     */
    async function getLocationByRegencyId(regencyId) {
        const regency = await getRegencyById(regencyId);

        if (!regency) {
            return null;
        }

        const province = await getProvinceById(regency.province_id);

        return {
            regency,
            province,
            coordinates: {
                latitude: regency.latitude,
                longitude: regency.longitude
            }
        };
    }

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    /**
     * Get database loading status
     * @returns {Object} - Status object
     */
    function getStatus() {
        return {
            isLoading,
            provincesLoaded: provincesCache !== null,
            regenciesLoaded: regenciesCache !== null,
            provincesCount: provincesCache?.length || 0,
            regenciesCount: regenciesCache?.length || 0
        };
    }

    /**
     * Clear cached data (force reload)
     */
    function clearCache() {
        provincesCache = null;
        regenciesCache = null;
        loadPromise = null;
        SaturaConfig.log('Database cache cleared');
    }

    /**
     * Preload all database files
     * @returns {Promise<void>}
     */
    async function preload() {
        await loadAll();
        SaturaConfig.log('Database preloaded successfully');
    }

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        // Loading
        loadAll,
        preload,

        // Provinces
        getProvinces,
        getProvinceById,
        getProvinceByName,

        // Regencies
        getRegencies,
        getRegencyById,
        getRegencyByName,
        getRegenciesByProvince,

        // Search
        searchProvinces,
        searchRegencies,
        searchAll,

        // Location/Coordinates
        calculateDistance,
        findNearestRegency,
        findNearestProvince,
        findNearestLocation,
        getLocationByRegencyId,

        // Utility
        getStatus,
        clearCache
    };
})();

// Export untuk module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaDatabase;
}
