export const APP = {
  name: 'Satu Ramadhan',
  packageName: 'com.saturamadhan.mobile',
  developer: 'Alea Farrel',
  year: 2026,
};

export const LINKS = {
  playStore: 'https://play.google.com/store/apps/details?id=com.saturamadhan.mobile',
  liveDemo: 'https://saturamadhan-web.pages.dev/',
  privacyPolicy: 'https://saturamadhan-policy.afarrel.workers.dev/',
  contactEmail: {
    user: 'aleafarrel.dev',
    domain: 'gmail.com'
  },
};

export const NAV_ITEMS = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Al-Quran', href: '#quran' },
  { label: 'Privasi', href: '#privasi' },
  { label: 'Download', href: '#download' },
];

export const FEATURES = [
  {
    id: 'waktu-shalat',
    num: '01',
    eyebrow: 'Waktu Shalat',
    icon: 'bx-time-five',
    title: 'Waktu Shalat <em>Akurat Real-Time</em>',
    desc: 'Waktu shalat yang tepat berdasarkan GPS lokasi Anda. Didukung API Aladhan dengan metode perhitungan NU, Muhammadiyah, dan lainnya.',
    bullets: [
      'Deteksi lokasi otomatis via GPS',
      'Pilih metode perhitungan sesuai madzhab',
      'Countdown real-time ke shalat berikutnya',
      'Tampilan jadwal grid & list yang elegan',
    ],
    images: ['1.webp', '2.webp'],
  },
  {
    id: 'jadwal',
    num: '02',
    eyebrow: 'Jadwal & Notifikasi',
    icon: 'bx-bell',
    title: 'Adzan & Pengingat <em>Tepat Waktu</em>',
    desc: 'Jadwal shalat lengkap satu bulan penuh dengan notifikasi Adzan otomatis. Ekspor jadwal Imsakiyah siap cetak.',
    bullets: [
      'Notifikasi Adzan otomatis tiap waktu shalat',
      'Pilih suara Adzan (Makkah, Madinah, dll.)',
      'Jadwal imsakiyah satu bulan penuh',
      'Generate & simpan jadwal siap cetak',
    ],
    images: ['3.webp', '4.webp'],
  },
  {
    id: 'quran',
    num: '03',
    eyebrow: 'Al-Quran Digital',
    icon: 'bx-book-open',
    title: 'Al-Quran dengan <em>Tajwid Berwarna</em>',
    desc: 'Baca Al-Quran lengkap 30 Juz dengan Tajwid berwarna, transliterasi Latin, dan terjemahan Bahasa Indonesia.',
    bullets: [
      'Tajwid otomatis dengan kode warna standar',
      'Terjemahan & transliterasi Latin per ayat',
      'Putar audio tilawah per ayat',
      'Bookmark ayat favorit, cari surah & ayat',
    ],
    images: ['7.webp'],
  },
  {
    id: 'kiblat',
    num: '04',
    eyebrow: 'Arah Kiblat',
    icon: 'bx-compass',
    title: 'Kompas Kiblat <em>Live & Akurat</em>',
    desc: 'Arah Kiblat presisi dengan kompas live berbasis sensor perangkat. Peta interaktif menampilkan rute ke Ka\'bah.',
    bullets: [
      'Kompas Kiblat real-time berbasis sensor',
      'Peta visual rute ke Ka\'bah',
      'Derajat arah Kiblat yang presisi',
    ],
    images: ['5.webp'],
  },
  {
    id: 'tasbih',
    num: '05',
    eyebrow: 'Tasbih Digital',
    icon: 'bx-radio-circle-marked',
    title: 'Zikir dengan <em>Tasbih Digital</em>',
    desc: 'Tasbih digital elegan dengan animasi manik-manik 3D yang realistis. Lacak hitungan zikir dan simpan sesi harian.',
    bullets: [
      'Animasi manik tasbih 3D yang indah',
      'Simpan & kelola sesi zikir harian',
      'Atur target hitungan dan putaran',
      'Kaligrafi Arab untuk setiap zikir',
    ],
    images: ['6.webp'],
  },
  {
    id: 'kustomisasi',
    num: '06',
    eyebrow: 'Kustomisasi',
    icon: 'bx-cog',
    title: 'Sesuaikan <em>Segalanya</em>',
    desc: 'Tema, bahasa, metode perhitungan, suara adzan — semua bisa disesuaikan sesuai preferensi Anda.',
    bullets: [
      'Pilih tema tampilan (Teal/Dark)',
      'Bahasa Indonesia & English',
      'Pilih awal puasa (NU/Muhammadiyah)',
      'Kustomisasi suara adzan & notifikasi',
    ],
    images: ['8.webp'],
  },
];

export const PRIVACY_CARDS = [
  {
    icon: 'bx-lock-alt',
    title: 'Tanpa Data Server',
    desc: 'Semua preferensi disimpan lokal di perangkat Anda. Tidak ada server yang menyimpan data.',
  },
  {
    icon: 'bxs-shield',
    title: 'Tanpa Iklan',
    desc: 'Tidak ada SDK iklan. Nikmati pengalaman beribadah yang khusyuk tanpa gangguan iklan.',
  },
  {
    icon: 'bx-map-pin',
    title: 'Lokasi Aman',
    desc: 'GPS hanya untuk waktu shalat dan Kiblat. Koordinat tidak pernah disimpan.',
  },
];
