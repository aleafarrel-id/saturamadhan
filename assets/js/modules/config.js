/**
 * Satu Ramadhan - Configuration Module
 * Application configuration in a single file
 */

const SaturaConfig = (function () {
    'use strict';

    // ===========================================
    // API CONFIGURATION
    // ===========================================
    const API = {
        // API endpoints dengan prioritas (primary -> fallback)
        endpoints: [
            'https://api.aladhan.com/v1',
            'https://aladhan.api.islamic.network/v1',
            'https://aladhan.api.alislam.ru/v1'
        ],

        // Calculation method untuk Indonesia
        // Method 20 = Kementerian Agama Republik Indonesia
        method: 20,

        // Request timeout dalam milliseconds
        timeout: 10000,

        // Jumlah retry sebelum switch ke endpoint berikutnya
        retryAttempts: 2,

        // Delay antar retry (milliseconds)
        retryDelay: 1000,

        // API paths
        paths: {
            timings: '/timings',           // Get prayer times by date
            timingsByAddress: '/timingsByAddress',
            calendar: '/calendar',          // Get monthly calendar
            calendarByAddress: '/calendarByAddress',
            hijriCalendar: '/hijriCalendar',
            gregorianToHijri: '/gToH',     // Gregorian to Hijri conversion
            hijriToGregorian: '/hToG',     // Hijri to Gregorian conversion
            currentDate: '/currentDate',
            currentTime: '/currentTime',
            currentTimestamp: '/currentTimestamp'
        }
    };

    // ===========================================
    // PRAYER TIME CONFIGURATION
    // ===========================================
    const PRAYER = {
        // Offset waktu imsak dari Subuh (dalam menit)
        // Negatif berarti sebelum Subuh
        imsakOffset: -10,

        // Nama waktu sholat untuk display (Bahasa Indonesia)
        names: {
            imsak: 'Imsak',
            fajr: 'Subuh',
            sunrise: 'Terbit',
            dhuhr: 'Dzuhur',
            asr: 'Ashar',
            sunset: 'Maghrib',
            maghrib: 'Maghrib',
            isha: 'Isya',
            midnight: 'Tengah Malam'
        },

        // Mapping dari API response ke nama lokal
        apiMapping: {
            'Imsak': 'imsak',
            'Fajr': 'fajr',
            'Sunrise': 'sunrise',
            'Dhuhr': 'dhuhr',
            'Asr': 'asr',
            'Sunset': 'sunset',
            'Maghrib': 'maghrib',
            'Isha': 'isha',
            'Midnight': 'midnight'
        },

        // Urutan waktu sholat untuk display
        displayOrder: ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'],

        // Waktu sholat wajib (untuk highlight)
        obligatory: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],

        // Waktu penting saat Ramadhan
        ramadhanImportant: ['imsak', 'fajr', 'maghrib']
    };

    // ===========================================
    // CACHE CONFIGURATION
    // ===========================================
    const CACHE = {
        // Nama cache untuk Service Worker
        names: {
            static: 'satura-static-v1',
            api: 'satura-api-v1',
            database: 'satura-db-v1'
        },

        // Durasi cache dalam milliseconds
        duration: {
            prayerTimes: 24 * 60 * 60 * 1000,    // 24 jam
            hijriDate: 24 * 60 * 60 * 1000,      // 24 jam
            location: 7 * 24 * 60 * 60 * 1000,   // 7 hari
            database: 30 * 24 * 60 * 60 * 1000   // 30 hari
        },

        // LocalStorage keys
        keys: {
            userLocation: 'satura_user_location',
            prayerCache: 'satura_prayer_cache',
            settings: 'satura_settings',
            lastUpdate: 'satura_last_update'
        }
    };

    // ===========================================
    // LOCATION CONFIGURATION
    // ===========================================
    const LOCATION = {
        // Default location jika GPS tidak tersedia dan user belum set lokasi
        // Jakarta sebagai default
        default: {
            provinceId: '31',
            provinceName: 'DKI Jakarta',
            regencyId: '3171',
            regencyName: 'Kota Jakarta Pusat',
            latitude: -6.186486,
            longitude: 106.834091
        },

        // Geolocation options
        geoOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000  // 5 menit
        },

        // Timezone default (WIB)
        defaultTimezone: 'Asia/Jakarta'
    };

    // ===========================================
    // DATABASE CONFIGURATION
    // ===========================================
    const DATABASE = {
        // Path ke file database (relatif dari root)
        paths: {
            provinces: './database/province.json',
            regencies: './database/regency.json',
            ramadhan: './database/ramadhan.json'
        },

        // Field names dalam database
        fields: {
            province: {
                id: 'id',
                name: 'name',
                latitude: 'latitude',
                longitude: 'longitude'
            },
            regency: {
                id: 'id',
                provinceId: 'province_id',
                name: 'name',
                latitude: 'latitude',
                longitude: 'longitude'
            }
        }
    };

    // ===========================================
    // APP CONFIGURATION
    // ===========================================
    const APP = {
        name: 'Satu Ramadhan',
        shortName: 'Satu Ramadhan',
        version: '1.0.0',
        description: 'Jadwal Sholat & Imsak Ramadhan',

        // Debug mode - set true untuk development
        debug: false,

        // Update interval untuk countdown (milliseconds)
        countdownInterval: 1000,

        // Date format
        dateFormat: {
            display: 'DD MMMM YYYY',
            api: 'DD-MM-YYYY'
        },

        // Time format (24 jam)
        timeFormat: 'HH:mm'
    };

    // ===========================================
    // AUTHOR / CREDENTIALS CONFIGURATION
    // ===========================================
    const AUTHOR = {
        name: 'Alea Farrel',
        copyright: 'Alea Farrel',
        website: 'https://aleafarrel-id.github.io/',
        social: {
            github: {
                url: 'https://github.com/aleafarrel-id',
                username: 'aleafarrel-id'
            },
            instagram: {
                url: 'https://instagram.com/alea_farrel',
                username: 'alea_farrel'
            }
        }
    };

    // ===========================================
    // HIJRI CALENDAR CONFIGURATION
    // ===========================================
    const HIJRI = {
        // Nama bulan Hijriah
        months: [
            'Muharram',
            'Safar',
            'Rabiul Awal',
            'Rabiul Akhir',
            'Jumadil Awal',
            'Jumadil Akhir',
            'Rajab',
            'Sya\'ban',
            'Ramadhan',
            'Syawal',
            'Dzulqa\'dah',
            'Dzulhijjah'
        ],

        // Nama hari dalam bahasa Arab
        days: {
            'Sunday': 'Ahad',
            'Monday': 'Senin',
            'Tuesday': 'Selasa',
            'Wednesday': 'Rabu',
            'Thursday': 'Kamis',
            'Friday': 'Jumat',
            'Saturday': 'Sabtu'
        },

        // Bulan Ramadhan (index 0-based = 8, 1-based = 9)
        ramadhanMonth: 9
    };

    // ===========================================
    // PUBLIC API
    // ===========================================
    return {
        API,
        PRAYER,
        CACHE,
        LOCATION,
        DATABASE,
        APP,
        HIJRI,
        AUTHOR,

        // Helper untuk mendapatkan API endpoint berdasarkan index
        getApiEndpoint: function (index = 0) {
            return this.API.endpoints[index] || this.API.endpoints[0];
        },

        // Helper untuk mendapatkan semua API endpoints
        getAllApiEndpoints: function () {
            return [...this.API.endpoints];
        },

        // Helper untuk cek apakah debug mode
        isDebug: function () {
            return this.APP.debug;
        },

        // Helper untuk log jika debug mode
        log: function (...args) {
            if (this.isDebug()) {
                console.log('[Satura]', ...args);
            }
        },

        // Helper untuk error log
        error: function (...args) {
            console.error('[Satura Error]', ...args);
        }
    };
})();

// Export untuk module system (jika digunakan)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SaturaConfig;
}
