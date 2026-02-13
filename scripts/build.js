#!/usr/bin/env node

/**
 * Satu Ramadhan - Production Build Script
 * 
 * Generates a self-contained dist/ folder with:
 * - Minified & bundled CSS (18 files → 1)
 * - Minified & bundled JS  (9 modules → 1)
 * - Modified loader.js (loads single bundle)
 * - Modified sw.js (updated cache paths + minified)
 * - Modified index.html (references dist assets)
 * - Symlinks to shared assets (fonts, icons, vendor, database, favicon)
 * 
 * NO source files are modified.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ============================================================
// CSS files in import order (from style.css @import)
// ============================================================
const CSS_FILES = [
    'assets/css/base/_variables.css',
    'assets/css/base/_fonts.css',
    'assets/css/base/_reset.css',
    'assets/css/base/_typography.css',
    'assets/css/layout/_container.css',
    'assets/css/components/_header.css',
    'assets/css/components/_hero.css',
    'assets/css/components/_countdown.css',
    'assets/css/components/_schedule.css',
    'assets/css/components/_location.css',
    'assets/css/components/_modal.css',
    'assets/css/components/_buttons.css',
    'assets/css/components/_footer.css',
    'assets/css/components/_animations.css',
    'assets/css/components/_settings.css',
    'assets/css/components/_skeleton.css',
    'assets/css/components/_splash.css',
];

// The tail of style.css (after all @imports)
const CSS_TAIL = `
/* Remove highlight on tap */
* {
    -webkit-tap-highlight-color: transparent;
}
`;

// ============================================================
// JS modules in load order (from loader.js MODULES array)
// ============================================================
const JS_MODULES = [
    'assets/js/modules/config.js',
    'assets/js/modules/storage.js',
    'assets/js/modules/api.js',
    'assets/js/modules/database.js',
    'assets/js/modules/location.js',
    'assets/js/modules/prayer.js',
    'assets/js/modules/ui.js',
    'assets/js/app.js',
    'assets/js/main.js',
];

// ============================================================
// HELPERS
// ============================================================

function fileSize(filePath) {
    return fs.statSync(filePath).size;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    return kb.toFixed(1) + ' KB';
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function createSymlink(target, linkPath) {
    // Remove existing symlink/file
    try {
        const stat = fs.lstatSync(linkPath);
        if (stat) fs.rmSync(linkPath, { recursive: true });
    } catch (e) { /* doesn't exist */ }

    // Create relative symlink
    const relTarget = path.relative(path.dirname(linkPath), target);
    fs.symlinkSync(relTarget, linkPath);
}

// ============================================================
// STEP 1: Clean dist/
// ============================================================
function cleanDist() {
    console.log('🧹 Cleaning dist/...');
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true });
    }
    ensureDir(DIST);
    ensureDir(path.join(DIST, 'css'));
    ensureDir(path.join(DIST, 'js'));
    ensureDir(path.join(DIST, 'assets'));
}

// ============================================================
// STEP 2: Bundle & minify CSS
// ============================================================
async function buildCSS() {
    console.log('🎨 Bundling CSS...');

    // Read and concatenate all CSS files
    let combined = '';
    let totalOriginal = 0;

    for (const file of CSS_FILES) {
        const filePath = path.join(ROOT, file);
        let content = fs.readFileSync(filePath, 'utf8');
        totalOriginal += fileSize(filePath);
        combined += `/* === ${path.basename(file)} === */\n${content}\n\n`;
    }

    // Add the tail from style.css
    combined += CSS_TAIL;
    // Add original style.css size
    totalOriginal += fileSize(path.join(ROOT, 'assets/css/style.css'));

    // Fix font paths: CSS files reference fonts as ../../font/ (relative to assets/css/base/)
    // In dist/css/style.min.css, we need ../assets/font/
    combined = combined.replace(
        /url\(['"]?\.\.\/\.\.\/font\//g,
        "url('../assets/font/"
    );

    // Write temporary combined file for esbuild
    const tmpPath = path.join(DIST, '_tmp_combined.css');
    fs.writeFileSync(tmpPath, combined);

    // Minify with esbuild
    const result = await esbuild.build({
        entryPoints: [tmpPath],
        outfile: path.join(DIST, 'css', 'style.min.css'),
        minify: true,
        bundle: false, // Already concatenated
        logLevel: 'silent',
    });

    // Cleanup tmp
    fs.unlinkSync(tmpPath);

    const minSize = fileSize(path.join(DIST, 'css', 'style.min.css'));
    console.log(`   📦 CSS: ${formatBytes(totalOriginal)} → ${formatBytes(minSize)} (${Math.round((1 - minSize / totalOriginal) * 100)}% smaller)`);
}

// ============================================================
// STEP 3: Bundle & minify JS modules
// ============================================================
async function buildJS() {
    console.log('⚡ Bundling JS...');

    // Concatenate all JS modules in order
    let combined = '';
    let totalOriginal = 0;

    for (const file of JS_MODULES) {
        const filePath = path.join(ROOT, file);
        const content = fs.readFileSync(filePath, 'utf8');
        totalOriginal += fileSize(filePath);
        combined += `// === ${path.basename(file)} ===\n${content}\n\n`;
    }

    // Write temporary file
    const tmpPath = path.join(DIST, '_tmp_combined.js');
    fs.writeFileSync(tmpPath, combined);

    // Minify with esbuild
    await esbuild.build({
        entryPoints: [tmpPath],
        outfile: path.join(DIST, 'js', 'app.min.js'),
        minify: true,
        bundle: false,
        logLevel: 'silent',
    });

    fs.unlinkSync(tmpPath);

    const minSize = fileSize(path.join(DIST, 'js', 'app.min.js'));
    console.log(`   📦 JS:  ${formatBytes(totalOriginal)} → ${formatBytes(minSize)} (${Math.round((1 - minSize / totalOriginal) * 100)}% smaller)`);
}

// ============================================================
// STEP 4: Generate modified loader.js
// ============================================================
async function buildLoader() {
    console.log('🔄 Building loader.js...');

    let loaderContent = fs.readFileSync(path.join(ROOT, 'assets/js/loader.js'), 'utf8');
    const originalSize = fileSize(path.join(ROOT, 'assets/js/loader.js'));

    // Replace the MODULES array to point to single bundle
    const modulesRegex = /const MODULES = \[[\s\S]*?\];/;
    const newModules = `const MODULES = [
        { src: 'js/app.min.js', name: 'Aplikasi' }
    ];`;
    loaderContent = loaderContent.replace(modulesRegex, newModules);

    // Write temporary file
    const tmpPath = path.join(DIST, '_tmp_loader.js');
    fs.writeFileSync(tmpPath, loaderContent);

    // Minify
    await esbuild.build({
        entryPoints: [tmpPath],
        outfile: path.join(DIST, 'js', 'loader.js'),
        minify: true,
        bundle: false,
        logLevel: 'silent',
    });

    fs.unlinkSync(tmpPath);

    const minSize = fileSize(path.join(DIST, 'js', 'loader.js'));
    console.log(`   📦 Loader: ${formatBytes(originalSize)} → ${formatBytes(minSize)}`);
}

// ============================================================
// STEP 5: Generate modified sw.js
// ============================================================
async function buildSW() {
    console.log('🔧 Building sw.js...');

    let swContent = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const originalSize = fileSize(path.join(ROOT, 'sw.js'));

    // Increment cache version
    swContent = swContent.replace(
        /const CACHE_VERSION = '[^']*'/,
        "const CACHE_VERSION = 'v25-dist'"
    );

    // Replace STATIC_ASSETS with production paths
    const staticAssetsRegex = /const STATIC_ASSETS = \[[\s\S]*?\];/;
    const newStaticAssets = `const STATIC_ASSETS = [
    '/saturamadhan/dist/',
    '/saturamadhan/dist/index.html',
    '/saturamadhan/dist/manifest.json',

    // CSS - Minified bundle
    '/saturamadhan/dist/css/style.min.css',

    // Vendor CSS (not bundled - has its own font references)
    '/saturamadhan/dist/assets/vendor/boxicons/css/boxicons.min.css',

    // Icons - Prayer Times
    '/saturamadhan/dist/assets/icon/cloud-sun.svg',
    '/saturamadhan/dist/assets/icon/moon-stars.svg',
    '/saturamadhan/dist/assets/icon/moon.svg',
    '/saturamadhan/dist/assets/icon/sun-fog.svg',
    '/saturamadhan/dist/assets/icon/sun-rise.svg',
    '/saturamadhan/dist/assets/icon/sun-set.svg',
    '/saturamadhan/dist/assets/icon/sun.svg',

    // Fonts - Poppins
    '/saturamadhan/dist/assets/font/poppins/Poppins-Light.ttf',
    '/saturamadhan/dist/assets/font/poppins/Poppins-Regular.ttf',
    '/saturamadhan/dist/assets/font/poppins/Poppins-Medium.ttf',
    '/saturamadhan/dist/assets/font/poppins/Poppins-SemiBold.ttf',
    '/saturamadhan/dist/assets/font/poppins/Poppins-Bold.ttf',

    // Fonts - Amiri
    '/saturamadhan/dist/assets/font/amiri/Amiri-Regular.ttf',
    '/saturamadhan/dist/assets/font/amiri/Amiri-Bold.ttf',

    // Fonts - Boxicons
    '/saturamadhan/dist/assets/vendor/boxicons/fonts/boxicons.woff2',
    '/saturamadhan/dist/assets/vendor/boxicons/fonts/boxicons.woff',
    '/saturamadhan/dist/assets/vendor/boxicons/fonts/boxicons.ttf',

    // JS - Loader and Bundle
    '/saturamadhan/dist/js/loader.js',
    '/saturamadhan/dist/js/app.min.js',
];`;

    swContent = swContent.replace(staticAssetsRegex, newStaticAssets);

    // Update DATABASE_ASSETS paths
    swContent = swContent.replace(
        /const DATABASE_ASSETS = \[[\s\S]*?\];/,
        `const DATABASE_ASSETS = [
    '/saturamadhan/dist/database/province.json',
    '/saturamadhan/dist/database/regency.json',
    '/saturamadhan/dist/database/ramadhan.json'
];`
    );

    // Update favicon paths in push notification handler
    swContent = swContent.replace(
        /icon: '\/saturamadhan\/assets\/favicon\/favicon\.png'/g,
        "icon: '/saturamadhan/dist/assets/favicon/favicon.png'"
    );
    swContent = swContent.replace(
        /badge: '\/saturamadhan\/assets\/favicon\/favicon\.png'/g,
        "badge: '/saturamadhan/dist/assets/favicon/favicon.png'"
    );

    // Update offline fallback path
    swContent = swContent.replace(
        /return caches\.match\('\/saturamadhan\/index\.html'\)/g,
        "return caches.match('/saturamadhan/dist/index.html')"
    );

    // Update client URL check for notification click
    swContent = swContent.replace(
        /clients\.openWindow\('\/saturamadhan\/'\)/g,
        "clients.openWindow('/saturamadhan/dist/')"
    );

    // Write temporary file
    const tmpPath = path.join(DIST, '_tmp_sw.js');
    fs.writeFileSync(tmpPath, swContent);

    // Minify
    await esbuild.build({
        entryPoints: [tmpPath],
        outfile: path.join(DIST, 'sw.js'),
        minify: true,
        bundle: false,
        logLevel: 'silent',
    });

    fs.unlinkSync(tmpPath);

    const minSize = fileSize(path.join(DIST, 'sw.js'));
    console.log(`   📦 SW:  ${formatBytes(originalSize)} → ${formatBytes(minSize)}`);
}

// ============================================================
// STEP 6: Generate modified index.html
// ============================================================
function buildHTML() {
    console.log('📄 Building index.html...');

    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // Update CSS reference: style.css → css/style.min.css
    html = html.replace(
        '<link rel="stylesheet" href="assets/css/style.css">',
        '<link rel="stylesheet" href="css/style.min.css">'
    );

    // Update boxicons CSS reference  
    html = html.replace(
        'href="assets/vendor/boxicons/css/boxicons.min.css"',
        'href="assets/vendor/boxicons/css/boxicons.min.css"'
    );

    // Update JS reference: assets/js/loader.js → js/loader.js
    html = html.replace(
        '<script src="assets/js/loader.js"></script>',
        '<script src="js/loader.js"></script>'
    );

    // Update favicon references to use symlinked assets
    // These already point to assets/favicon/ which will be symlinked — no change needed

    fs.writeFileSync(path.join(DIST, 'index.html'), html);
    console.log(`   ✅ index.html generated`);
}

// ============================================================
// STEP 7: Copy static files
// ============================================================
function copyStaticFiles() {
    console.log('📋 Copying static files...');

    const filesToCopy = ['manifest.json', 'robots.txt', 'sitemap.xml'];

    for (const file of filesToCopy) {
        const src = path.join(ROOT, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(DIST, file));
            console.log(`   ✅ ${file}`);
        }
    }
}

// ============================================================
// STEP 8: Create symlinks to shared assets
// ============================================================
function createSymlinks() {
    console.log('🔗 Creating symlinks...');

    const links = [
        { target: path.join(ROOT, 'assets', 'favicon'), link: path.join(DIST, 'assets', 'favicon') },
        { target: path.join(ROOT, 'assets', 'font'), link: path.join(DIST, 'assets', 'font') },
        { target: path.join(ROOT, 'assets', 'icon'), link: path.join(DIST, 'assets', 'icon') },
        { target: path.join(ROOT, 'assets', 'vendor'), link: path.join(DIST, 'assets', 'vendor') },
        { target: path.join(ROOT, 'database'), link: path.join(DIST, 'database') },
    ];

    for (const { target, link } of links) {
        createSymlink(target, link);
        console.log(`   🔗 ${path.relative(DIST, link)} → ${path.relative(DIST, target)}`);
    }
}

// ============================================================
// STEP 9: Print summary
// ============================================================
function printSummary() {
    console.log('\n📊 Build Summary:');
    console.log('─'.repeat(50));

    const distFiles = [
        'css/style.min.css',
        'js/app.min.js',
        'js/loader.js',
        'sw.js',
        'index.html',
        'manifest.json',
    ];

    let totalDist = 0;
    for (const file of distFiles) {
        const filePath = path.join(DIST, file);
        if (fs.existsSync(filePath)) {
            const size = fileSize(filePath);
            totalDist += size;
            console.log(`   ${file.padEnd(25)} ${formatBytes(size).padStart(10)}`);
        }
    }

    console.log('─'.repeat(50));
    console.log(`   ${'Total (tanpa vendor)'.padEnd(25)} ${formatBytes(totalDist).padStart(10)}`);

    // Original totals
    const originalSizes = {
        css: CSS_FILES.reduce((sum, f) => sum + fileSize(path.join(ROOT, f)), 0) + fileSize(path.join(ROOT, 'assets/css/style.css')),
        js: JS_MODULES.reduce((sum, f) => sum + fileSize(path.join(ROOT, f)), 0),
        loader: fileSize(path.join(ROOT, 'assets/js/loader.js')),
        sw: fileSize(path.join(ROOT, 'sw.js')),
        html: fileSize(path.join(ROOT, 'index.html')),
    };
    const totalOriginal = Object.values(originalSizes).reduce((a, b) => a + b, 0);

    console.log(`\n   Ukuran asli: ${formatBytes(totalOriginal)}`);
    console.log(`   Ukuran dist: ${formatBytes(totalDist)}`);
    console.log(`   Penghematan: ${formatBytes(totalOriginal - totalDist)} (${Math.round((1 - totalDist / totalOriginal) * 100)}%)`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('🚀 Satu Ramadhan - Production Build');
    console.log('═'.repeat(50));
    console.log('');

    try {
        cleanDist();
        await buildCSS();
        await buildJS();
        await buildLoader();
        await buildSW();
        buildHTML();
        copyStaticFiles();
        createSymlinks();
        printSummary();

        console.log('\n✅ Build selesai! Folder dist/ siap digunakan.');
        console.log('   Jalankan dari web server untuk menguji.');
    } catch (error) {
        console.error('\n❌ Build gagal:', error.message);
        process.exit(1);
    }
}

main();
