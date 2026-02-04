/**
 * Satura Ramadhan - Module Loader
 * Dynamic script loading with premium splash screen
 * Handles cache version checking and auto-refresh
 */

(function () {
    'use strict';

    // App version - increment when deploying updates
    const APP_VERSION = '1.1.3';
    const VERSION_KEY = 'satura_app_version';

    // Splash screen elements
    let splashScreen = null;
    let progressBar = null;
    let statusText = null;

    // Loading progress tracking
    let loadedModules = 0;
    const MODULES = [
        { src: 'assets/js/modules/config.js', name: 'Konfigurasi' },
        { src: 'assets/js/modules/storage.js', name: 'Penyimpanan' },
        { src: 'assets/js/modules/api.js', name: 'API' },
        { src: 'assets/js/modules/database.js', name: 'Database' },
        { src: 'assets/js/modules/location.js', name: 'Lokasi' },
        { src: 'assets/js/modules/prayer.js', name: 'Waktu Sholat' },
        { src: 'assets/js/modules/ui.js', name: 'Antarmuka' },
        { src: 'assets/js/app.js', name: 'Aplikasi' },
        { src: 'assets/js/main.js', name: 'Inisialisasi' }
    ];

    /**
     * Initialize splash screen elements
     */
    function initSplash() {
        splashScreen = document.getElementById('splashScreen');
        progressBar = document.getElementById('splashProgressBar');
        statusText = document.getElementById('splashStatus');

        // Lock body scroll
        document.body.classList.add('splash-active');

        console.log('[Loader] Splash screen initialized');
    }

    /**
     * Update splash screen progress
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} status - Status message
     */
    function updateProgress(progress, status) {
        if (progressBar) {
            progressBar.style.width = Math.min(progress, 100) + '%';
        }
        if (statusText && status) {
            statusText.textContent = status;
        }
    }

    /**
     * Hide splash screen with animation
     */
    function hideSplash() {
        if (splashScreen) {
            splashScreen.classList.add('splash--hidden');

            // Unlock body scroll
            document.body.classList.remove('splash-active');

            // Remove splash from DOM after animation
            setTimeout(() => {
                if (splashScreen && splashScreen.parentNode) {
                    splashScreen.parentNode.removeChild(splashScreen);
                }
            }, 500);

            console.log('[Loader] Splash screen hidden');
        }
    }

    /**
     * Load a single script and update progress
     * @param {Object} module - Module object with src and name
     * @param {number} index - Module index
     * @returns {Promise}
     */
    function loadScript(module, index) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = module.src;
            script.async = false;

            script.onload = () => {
                loadedModules++;
                const progress = (loadedModules / MODULES.length) * 80; // 80% for modules
                updateProgress(progress, `Memuat ${module.name}...`);
                resolve();
            };

            script.onerror = () => reject(new Error(`Failed to load: ${module.src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Load all modules sequentially with progress tracking
     */
    async function loadModules() {
        updateProgress(5, 'Memulai...');

        for (let i = 0; i < MODULES.length; i++) {
            try {
                await loadScript(MODULES[i], i);
            } catch (error) {
                console.error('[Loader] Error loading module:', error);
                throw error;
            }
        }

        console.log('[Loader] All modules loaded successfully');
    }

    /**
     * Check if app version has changed and refresh if needed
     */
    function checkVersionAndRefresh() {
        try {
            const storedVersion = localStorage.getItem(VERSION_KEY);

            if (storedVersion && storedVersion !== APP_VERSION) {
                console.log(`[Loader] Version changed: ${storedVersion} → ${APP_VERSION}`);
                updateProgress(5, 'Memperbarui cache...');

                // Clear old caches
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => {
                            if (name.startsWith('satura-')) {
                                caches.delete(name);
                            }
                        });
                    });
                }

                localStorage.setItem(VERSION_KEY, APP_VERSION);
                window.location.reload(true);
                return true;
            }

            if (!storedVersion) {
                localStorage.setItem(VERSION_KEY, APP_VERSION);
            }

            return false;
        } catch (e) {
            console.error('[Loader] Version check failed:', e);
            return false;
        }
    }

    /**
     * Check for service worker updates
     */
    function checkForUpdates() {
        if (!navigator.onLine) return;

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration) {
                    registration.update();
                }
            });
        }
    }

    /**
     * Handle online event
     */
    function handleOnline() {
        console.log('[Loader] Back online, checking for updates...');
        checkForUpdates();
        checkVersionAndRefresh();
    }

    /**
     * Wait for app initialization
     */
    function waitForAppReady() {
        return new Promise((resolve) => {
            updateProgress(85, 'Menyiapkan data...');

            // Check if SaturaApp exists and has the on method
            if (typeof SaturaApp !== 'undefined' && SaturaApp.on) {
                SaturaApp.on('onReady', () => {
                    updateProgress(100, 'Selesai!');
                    setTimeout(resolve, 300); // Small delay for visual feedback
                });

                SaturaApp.on('onPrayerTimesFetched', () => {
                    updateProgress(95, 'Hampir selesai...');
                });
            } else {
                // Fallback if SaturaApp is not ready
                updateProgress(100, 'Selesai!');
                setTimeout(resolve, 500);
            }
        });
    }

    /**
     * Initialize loader
     */
    async function init() {
        console.log(`[Loader] Initializing Satura Ramadhan v${APP_VERSION}`);

        // Initialize splash screen
        initSplash();

        // Check version first
        if (checkVersionAndRefresh()) {
            return;
        }

        // Listen for online event
        window.addEventListener('online', handleOnline);

        // Periodic update checks
        setInterval(() => {
            if (navigator.onLine) checkForUpdates();
        }, 5 * 60 * 1000);

        try {
            // Load all modules
            await loadModules();

            // Wait for app to be ready
            await waitForAppReady();

            // Hide splash screen
            hideSplash();

        } catch (error) {
            console.error('[Loader] Failed to load:', error);
            updateProgress(0, 'Gagal memuat aplikasi');

            // Show error message in splash
            if (statusText) {
                statusText.innerHTML = `
                    <span style="color: #ff6b6b;">Gagal memuat aplikasi</span><br>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--clr-accent-500); border: none; border-radius: 8px; color: white; cursor: pointer;">
                        Coba Lagi
                    </button>
                `;
            }
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose hideSplash for manual control if needed
    window.SaturaLoader = {
        hideSplash,
        updateProgress
    };
})();
