// Shared by the maintained TypeScript source and the newer deployed application.
export function withTimeout(promise, milliseconds, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

const cameraPromises = new WeakMap();
export function cameraReady(app) {
  if (!cameraPromises.has(app)) {
    cameraPromises.set(app, new Promise((resolve, reject) => {
      app.webcam.on('webcamstarted', resolve);
      app.webcam.on('webcamerror', reject);
    }));
  }
  return withTimeout(cameraPromises.get(app), 30000,
    'Kamera belum merespons. Izinkan kamera di pengaturan situs, lalu muat ulang halaman.');
}

export function gpsHelp(error) {
  if (!window.isSecureContext) return 'Lokasi membutuhkan HTTPS. Buka alamat situs HTTPS secara langsung.';
  const policy = document.permissionsPolicy ?? document.featurePolicy;
  if (policy?.allowsFeature('geolocation') === false) {
    return 'Lokasi diblokir kebijakan halaman. Buka situs langsung di tab browser.';
  }
  if (error?.code === 1) {
    return 'Akses lokasi belum tersedia. Periksa izin lokasi situs dan layanan lokasi perangkat. Di iPhone, periksa Layanan Lokasi untuk Safari/Chrome. Setelah diizinkan, tekan Coba GPS lagi.';
  }
  if (error?.code === 3) return 'Lokasi belum ditemukan. Coba di area terbuka, lalu tekan Coba GPS lagi.';
  return 'Lokasi belum tersedia. Aktifkan layanan lokasi perangkat, lalu tekan Coba GPS lagi.';
}

export function gpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 2, message: 'GPS tidak didukung browser ini' });
      return;
    }
    // The native timeout does not include time spent waiting for permission.
    const timer = setTimeout(() => reject({ code: 3, message: 'Permintaan lokasi belum merespons' }), 25000);
    const finish = callback => value => { clearTimeout(timer); callback(value); };
    try {
      navigator.geolocation.getCurrentPosition(finish(resolve), finish(reject), {
        enableHighAccuracy: true, maximumAge: 0, timeout: 20000
      });
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}
