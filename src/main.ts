import { cameraReady, withTimeout, gpsPosition, gpsHelp } from './permission-support.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { App } from 'locar';
import type { GpsReceivedEvent } from 'locar';
import { LOCATIONS, type ArLocation } from './locations';
import './styles.css';

type CurrentPosition = {
  longitude: number;
  latitude: number;
  accuracy?: number;
};

type Coordinates = {
  longitude: number;
  latitude: number;
};

type CharacterAsset = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

type CharacterInstance = {
  object: THREE.Group;
  mixer?: THREE.AnimationMixer;
};

type ActiveMarker = {
  object: THREE.Group;
  location: ArLocation;
  mixer?: THREE.AnimationMixer;
  positionLocked: boolean;
};

type MotionSensorReading = {
  source: string;
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  absolute?: boolean;
  at: number;
};

type StartupPermissions = {
  gpsPosition: GeolocationPosition | null;
  gpsError: unknown;
  motionError: unknown;
  audioError: unknown;
  microphoneError: unknown;
};

type SensorPermissionResult = 'granted' | 'denied';

type SensorPermissionConstructor = {
  requestPermission?: () => Promise<SensorPermissionResult>;
};

const CHARACTER_MODEL_URL = new URL(
  './models/karakter_anim_fix.mobile.glb',
  import.meta.url
).href;
const CHARACTER_HEIGHT_METERS = 5;
const VISIBLE_RADIUS_METERS = 50;
const MIN_DISPLAY_DISTANCE_METERS = 10;
const TARGET_ELEVATION_METERS = 0.8;
const LOCK_NEARBY_OBJECTS_TO_START_VIEW = true;
const LOCKED_VIEW_DISTANCE_METERS = 6.5;
const LOCKED_VIEW_VERTICAL_OFFSET_METERS = -1.05;
const LOCKED_VIEW_SPACING_METERS = 3.2;
const SCREEN_FALLBACK_DISTANCE_METERS = 7.4;
const SCREEN_FALLBACK_VERTICAL_OFFSET_METERS = -2.2;
const SCREEN_FALLBACK_SCALE = 0.98;
const MAX_RENDER_PIXEL_RATIO = 2.5;
const MOTION_SENSOR_DIAGNOSTIC_DELAY_MS = 2500;
const ANDROID_SENSOR_START_TIMEOUT_MS = 1600;
const GPS_PERMISSION_DENIED = 1;
const GPS_POSITION_UNAVAILABLE = 2;
const GPS_TIMEOUT = 3;
const BUILD_VERSION = '0.1.1 (20261027-instiki-1)';

const canvas = getElement<HTMLCanvasElement>('#glscene');
const startButton = getElement<HTMLButtonElement>('#start-ar');
const screen3dButton = getElement<HTMLButtonElement>('#screen-3d');
const entryScreen = getElement<HTMLElement>('#entry-screen');
const entryStatus = getElement<HTMLElement>('#entry-status');
const locationsDrawer = getElement<HTMLDetailsElement>('.locations-drawer');
const statusPill = getElement<HTMLDivElement>('#ar-status');
const gpsMode = getElement<HTMLElement>('#gps-mode');
const gpsAccuracy = getElement<HTMLElement>('#gps-accuracy');
const objectCount = getElement<HTMLElement>('#object-count');
const locationList = getElement<HTMLOListElement>('#location-list');
const gpsDebug = getElement<HTMLParagraphElement>('#gps-debug');
const locationInfo = getElement<HTMLElement>('#location-info');
const locationInfoTitle = getElement<HTMLElement>('#location-info-title');
const locationInfoDescription = getElement<HTMLElement>(
  '#location-info-description'
);

let app: App | null = null;
let locar: Awaited<ReturnType<App['start']>> | null = null;
let isStarting = false;
let cameraNeedsReload = false;
let characterPromise: Promise<CharacterAsset> | null = null;
let animationStarted = false;
let audioContext: AudioContext | null = null;
let latestPosition: CurrentPosition | null = null;
let locationSyncPromise: Promise<void> | null = null;
let syncRevision = 0;
let syncedRevision = 0;
let gpsWatchId: number | null = null;
let androidMotionSensorStarted = false;
let androidMotionSensorStartupFinished = false;
let latestMotionSensorReading: MotionSensorReading | null = null;
let motionSensorReadyResolvers: Array<() => void> = [];
let screenFallbackMarker: ActiveMarker | null = null;
let screenFallbackActive = false;
let screenFallbackAvailable = false;

const activeMarkers = new Map<string, ActiveMarker>();
const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();

updateActiveObjectCount();
renderLocationList();
setStatus('idle', 'Siap');
updateScreenFallbackButtonVisibility();
console.info(`IKARI build ${BUILD_VERSION}`);

startButton.addEventListener('click', () => {
  void startAr();
});

screen3dButton.addEventListener('click', () => {
  void toggleScreen3dFallback();
});

window.addEventListener('resize', () => {
  syncRenderQuality();
  syncAndroidScreenOrientation();
  canvas.style.width = '100%';
  canvas.style.height = '100%';
});

window.addEventListener('orientationchange', () => {
  syncAndroidScreenOrientation();
});

window.screen.orientation?.addEventListener('change', () => {
  syncAndroidScreenOrientation();
});

function createArApp() {
  if (app) {
    return app;
  }

  const activeApp = new App({
    cameraOptions: {
      hFov: 80,
      near: 0.001,
      far: 1600
    },
    canvas,
    gpsOptions: {
      gpsMinDistance: 0,
      gpsMinAccuracy: 300
    },
    deviceOrientationOptions: {
      enabled: true,
      enablePermissionDialog: false,
      smoothingFactor: 0.48,
      orientationChangeThreshold: 0
    }
  });
  app = activeApp;

  setupSceneLighting(activeApp.scene);
  syncRenderQuality();
  activeApp.renderer.outputColorSpace = THREE.SRGBColorSpace;
  activeApp.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  activeApp.renderer.toneMappingExposure = 1.15;

  return activeApp;
}

async function requestStartupPermissions(): Promise<void> {
  const motion = withTimeout(requestMotionSensorPermission(), 10000, 'Sensor gerak belum merespons')
    .catch((error: unknown) => { console.info(error); showScreenFallbackButton(); });
  const audio = withTimeout(unlockAudioPlayback(), 3000, 'Audio belum aktif')
    .catch((error: unknown) => console.info(error));
  await Promise.all([motion, audio]);
}

async function requestMotionSensorPermission() {
  const orientationConstructor =
    window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & SensorPermissionConstructor)
      | undefined;
  const motionConstructor =
    window.DeviceMotionEvent as
      | (typeof DeviceMotionEvent & SensorPermissionConstructor)
      | undefined;
  const requests: Array<Promise<SensorPermissionResult>> = [];

  if (typeof orientationConstructor?.requestPermission === 'function') {
    requests.push(orientationConstructor.requestPermission());
  }

  if (typeof motionConstructor?.requestPermission === 'function') {
    requests.push(motionConstructor.requestPermission());
  }

  const results = await Promise.all(requests);
  if (results.some((result) => result !== 'granted')) {
    throw new Error('Izin motion sensor ditolak');
  }
}

async function unlockAudioPlayback() {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Audio tidak didukung browser ini');
  }

  audioContext ??= new AudioContextConstructor();
  if (audioContext.state !== 'running') {
    await audioContext.resume();
  }
}

async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Mic tidak didukung browser ini');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function showStartupPermissionWarnings(permissions: StartupPermissions) {
  const warnings = [
    permissionWarning('GPS', permissions.gpsError),
    permissionWarning('Motion', permissions.motionError),
    permissionWarning('Audio', permissions.audioError),
    permissionWarning('Mic', permissions.microphoneError)
  ].filter(Boolean);

  if (warnings.length === 0) {
    setGpsDebug(null);
    return;
  }

  setGpsDebug(`Izin belum lengkap: ${warnings.join(', ')}`);

  if (permissions.gpsError || permissions.motionError) {
    showScreenFallbackButton();
  }
}

function permissionWarning(name: string, error: unknown) {
  return error ? `${name} ${errorMessage(error, 'gagal')}` : '';
}

async function startAr() {
  if (cameraNeedsReload) { window.location.reload(); return; }
  if (isStarting) {
    return;
  }

  isStarting = true;
  startButton.disabled = true;
  entryStatus.textContent = 'Requesting permissions';

  try {
    const activeApp = createArApp();
    prepareAndroidMotionSensors();
    void requestStartupPermissions();

    if (!locar) {
      setStatus('loading', 'Membuka kamera');
      entryStatus.textContent = 'Opening camera';
      const startedLocar = await Promise.all([activeApp.start(), cameraReady(activeApp)]).then(([result]) => result);
      locar = startedLocar;
      revealCameraFeed();
      attachGpsListeners(startedLocar);
      startAnimation();
      await waitForAndroidMotionSensorReadiness();
    }

    entryScreen.hidden = true;
    activateRealGps();
  } catch (error) {
    setStatus('error', errorMessage(error, 'AR gagal dimulai'));
    entryStatus.textContent = errorMessage(error, 'AR failed');
    gpsMode.textContent = 'Gagal';
    cameraNeedsReload = true;
    entryStatus.textContent += ' Muat ulang halaman untuk mencoba kamera lagi.';
    showScreenFallbackButton();
  } finally {
    startButton.disabled = false;
    isStarting = false;
  }
}

function attachGpsListeners(activeLocar: NonNullable<typeof locar>) {
  activeLocar.on('gpsupdate', (event: GpsReceivedEvent) => {
    handleGpsPosition(activeLocar, event.position, 'GPS aktif');
  });

  activeLocar.on('gpserror', (error: GeolocationPositionError) => {
    setStatus('error', gpsErrorMessage(error));
    gpsMode.textContent = 'GPS error';
    showScreenFallbackButton();
  });
}

function activateRealGps(
  gpsWarmupPosition: GeolocationPosition | null = null,
  gpsWarmupError: unknown = null
) {
  if (!locar) {
    return;
  }

  removeScreenFallbackMarker();
  clearActiveMarkers();
  setStatus('loading', 'Mencari GPS');
  gpsMode.textContent = 'Mencari posisi';
  gpsAccuracy.textContent = '-';
  locationsDrawer.open = false;

  if (gpsWarmupPosition) {
    publishGpsPosition(locar, gpsWarmupPosition);
  }

  if (gpsWarmupError) {
    setStatus('loading', gpsErrorMessage(gpsWarmupError));
    void showGpsDiagnostic(gpsWarmupError);
  }

  startRealGpsWatch(locar);
}

async function toggleScreen3dFallback() {
  if (screenFallbackActive) {
    screen3dButton.disabled = true;

    try {
      removeScreenFallbackMarker();
      updateScreenFallbackButtonVisibility();
      await resumeGpsAfterScreenFallback();
    } finally {
      screen3dButton.disabled = false;
      updateScreenFallbackButtonVisibility();
    }

    return;
  }

  screen3dButton.disabled = true;
  setStatus('loading', 'Memuat 3D layar');

  try {
    removeScreenFallbackMarker();
    clearActiveMarkers();
    stopRealGpsWatch();
    locar?.stopGps();

    const characterAsset = await loadCharacter();
    const location = selectScreenFallbackLocation();
    const marker = createLocationMarker(location, characterAsset);
    marker.object.name = `${location.name} screen fallback`;
    marker.object.scale.multiplyScalar(SCREEN_FALLBACK_SCALE);
    marker.positionLocked = true;
    prepareScreenFallbackMarker(marker.object);
    attachScreenFallbackMarker(marker.object);

    screenFallbackMarker = marker;
    screenFallbackActive = true;
    startAnimation();
    positionScreenFallbackMarker(marker.object);
    setStatus('active', '3D layar');
    gpsMode.textContent = 'Mode layar';
    gpsAccuracy.textContent = '-';
    locationsDrawer.open = false;
    updateActiveObjectCount();
    updateLocationInfo(location);
  } catch (error) {
    setStatus('error', errorMessage(error, '3D gagal dimuat'));
  } finally {
    screen3dButton.disabled = false;
    updateScreenFallbackButtonVisibility();
  }
}

async function resumeGpsAfterScreenFallback() {
  if (!locar) {
    setStatus('idle', 'Siap');
    gpsMode.textContent = 'Belum aktif';
    gpsAccuracy.textContent = '-';
    return;
  }

  setStatus('loading', 'Mencari GPS');
  gpsMode.textContent = 'Mencari posisi';
  gpsAccuracy.textContent = '-';
  locationsDrawer.open = false;

  try {
    const position = await requestGpsWarmup();
    publishGpsPosition(locar, position);
  } catch (error) {
    setStatus('loading', gpsErrorMessage(error));
    void showGpsDiagnostic(error);
  }

  startRealGpsWatch(locar);
}

function selectScreenFallbackLocation() {
  const activeLocation = activeMarkers.values().next().value?.location;
  if (activeLocation) {
    return activeLocation;
  }

  const currentPosition = latestPosition;
  if (!currentPosition) {
    return LOCATIONS[0];
  }

  return LOCATIONS.reduce((closest, location) => {
    const closestDistance = haversineDistance(currentPosition, closest);
    const locationDistance = haversineDistance(currentPosition, location);
    return locationDistance < closestDistance ? location : closest;
  }, LOCATIONS[0]);
}

function removeScreenFallbackMarker() {
  if (!screenFallbackMarker) {
    screenFallbackActive = false;
    updateActiveObjectCount();
    return;
  }

  screenFallbackMarker.mixer?.stopAllAction();
  screenFallbackMarker.object.removeFromParent();
  disposeMarkerShell(screenFallbackMarker.object);
  screenFallbackMarker = null;
  screenFallbackActive = false;
  updateActiveObjectCount();
  updateLocationInfo(null);
}

function prepareScreenFallbackMarker(marker: THREE.Group) {
  const label = marker.getObjectByName('location-label');
  if (label) {
    label.visible = false;
  }
}

function attachScreenFallbackMarker(marker: THREE.Group) {
  const activeApp = createArApp();
  if (!activeApp.camera.parent) {
    activeApp.scene.add(activeApp.camera);
  }

  activeApp.camera.add(marker);
  positionScreenFallbackMarker(marker);
}

function revealCameraFeed() {
  for (const video of document.querySelectorAll<HTMLVideoElement>('body > video')) {
    video.style.position = 'fixed';
    video.style.inset = '0';
    video.style.zIndex = '0';
    video.style.width = '100vw';
    video.style.height = '100dvh';
    video.style.objectFit = 'cover';
    video.style.background = '#000';
    video.style.pointerEvents = 'none';
  }
}

function prepareAndroidMotionSensors() {
  if (!isAndroidDevice()) {
    return;
  }

  syncAndroidScreenOrientation();

  if (androidMotionSensorStarted) {
    return;
  }

  androidMotionSensorStarted = true;
  window.addEventListener('deviceorientationabsolute', handleDeviceOrientation);
  window.addEventListener('deviceorientation', handleDeviceOrientation);
  window.addEventListener('devicemotion', handleDeviceMotion);

  window.setTimeout(() => {
    if (hasUsableOrientationSample() || !isAndroidDevice()) {
      return;
    }

    const message =
      'Sensor gerak Android belum memberi data. Aktifkan Motion sensors di izin situs browser.';
    console.info(message);
    setGpsDebug(message);
    showScreenFallbackButton();
  }, MOTION_SENSOR_DIAGNOSTIC_DELAY_MS);
}

function handleDeviceOrientation(event: DeviceOrientationEvent) {
  latestMotionSensorReading = {
    source: event.type,
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    absolute: event.absolute,
    at: performance.now()
  };
  syncAndroidScreenOrientation();
  hideScreenFallbackButtonIfSupported();
  resolveMotionSensorReadiness();
  lockPendingMarkersInStartView();
}

function handleDeviceMotion(event: DeviceMotionEvent) {
  if (latestMotionSensorReading) {
    return;
  }

  latestMotionSensorReading = {
    source: event.type,
    at: performance.now()
  };
  syncAndroidScreenOrientation();
  updateScreenFallbackButtonVisibility();
}

function syncAndroidScreenOrientation() {
  if (!isAndroidDevice()) {
    return;
  }

  const controls = app?.deviceOrientationControls;
  if (!controls) {
    return;
  }

  controls.screenOrientation = getScreenAngleDegrees();
}

function getScreenAngleDegrees() {
  const modernAngle = window.screen.orientation?.angle;
  if (typeof modernAngle === 'number') {
    return modernAngle;
  }

  const legacyWindow = window as Window & { orientation?: number };
  return typeof legacyWindow.orientation === 'number'
    ? legacyWindow.orientation
    : 0;
}

function waitForAndroidMotionSensorReadiness() {
  if (!isAndroidDevice() || hasUsableOrientationSample()) {
    androidMotionSensorStartupFinished = true;
    return Promise.resolve();
  }

  setStatus('loading', 'Kalibrasi sensor');

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      resolveMotionSensorReadiness(resolve);
    }, ANDROID_SENSOR_START_TIMEOUT_MS);

    motionSensorReadyResolvers.push(() => {
      window.clearTimeout(timeoutId);
      resolve();
    });
  }).then(() => {
    androidMotionSensorStartupFinished = true;
    updateScreenFallbackButtonVisibility();
    lockPendingMarkersInStartView();
  });
}

function resolveMotionSensorReadiness(singleResolver?: () => void) {
  if (singleResolver) {
    singleResolver();
  }

  const resolvers = motionSensorReadyResolvers;
  motionSensorReadyResolvers = [];

  for (const resolver of resolvers) {
    resolver();
  }
}

function hasUsableOrientationSample() {
  const controlsOrientation = app?.deviceOrientationControls?.deviceOrientation;
  if (
    typeof controlsOrientation?.alpha === 'number' ||
    typeof controlsOrientation?.beta === 'number' ||
    typeof controlsOrientation?.gamma === 'number'
  ) {
    return true;
  }

  return (
    typeof latestMotionSensorReading?.alpha === 'number' ||
    typeof latestMotionSensorReading?.beta === 'number' ||
    typeof latestMotionSensorReading?.gamma === 'number'
  );
}

function lockPendingMarkersInStartView() {
  if (!locar) {
    return;
  }

  let index = 0;
  for (const marker of activeMarkers.values()) {
    if (!marker.positionLocked) {
      lockMarkerInStartView(marker.object, index);
      marker.positionLocked = true;
      marker.object.visible = true;
    }
    index += 1;
  }
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent);
}

function isMotionSensorApiAvailable() {
  return (
    typeof window.DeviceOrientationEvent !== 'undefined' ||
    typeof window.DeviceMotionEvent !== 'undefined'
  );
}

function showScreenFallbackButton() {
  screenFallbackAvailable = true;
  screen3dButton.hidden = false;
  screen3dButton.disabled = false;
  screen3dButton.textContent = screenFallbackActive
    ? 'Sembunyikan 3D'
    : 'Tampilkan 3D';
}

function hideScreenFallbackButtonIfSupported() {
  if (!hasUsableOrientationSample() || screenFallbackActive) {
    updateScreenFallbackButtonVisibility();
    return;
  }

  screenFallbackAvailable = false;
  screen3dButton.hidden = true;
}

function updateScreenFallbackButtonVisibility() {
  if (
    isAndroidDevice() &&
    androidMotionSensorStartupFinished &&
    !hasUsableOrientationSample()
  ) {
    screenFallbackAvailable = true;
  }

  if (!isMotionSensorApiAvailable()) {
    screenFallbackAvailable = true;
  }

  const shouldShow =
    screenFallbackActive ||
    screenFallbackAvailable;

  screen3dButton.hidden = !shouldShow;
  screen3dButton.textContent = screenFallbackActive
    ? 'Sembunyikan 3D'
    : 'Tampilkan 3D';
}

function requestGpsWarmup() {
  return gpsPosition();
}

function startRealGpsWatch(activeLocar: NonNullable<typeof locar>) {
  if (!navigator.geolocation) {
    setStatus('error', 'GPS tidak didukung');
    gpsMode.textContent = 'GPS error';
    return;
  }

  stopRealGpsWatch();
  gpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      publishGpsPosition(activeLocar, position);
    },
    (error) => {
      setStatus('error', gpsErrorMessage(error));
      gpsMode.textContent = 'GPS error';
      void showGpsDiagnostic(error);
      showScreenFallbackButton();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30000
    }
  );
}

function stopRealGpsWatch() {
  if (gpsWatchId === null || !navigator.geolocation) {
    gpsWatchId = null;
    return;
  }

  navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = null;
}

function publishGpsPosition(
  activeLocar: NonNullable<typeof locar>,
  position: GeolocationPosition
) {
  if (LOCK_NEARBY_OBJECTS_TO_START_VIEW) {
    handleGpsPosition(activeLocar, position, 'GPS aktif');
    return;
  }

  activeLocar.fakeGps(
    position.coords.longitude,
    position.coords.latitude,
    null,
    position.coords.accuracy ?? 0
  );
}

function handleGpsPosition(
  activeLocar: NonNullable<typeof locar>,
  position: GeolocationPosition,
  mode: string
) {
  const currentPosition = {
    longitude: position.coords.longitude,
    latitude: position.coords.latitude,
    accuracy: position.coords.accuracy
  };

  updatePositionInfo(currentPosition, mode);
  gpsRetry.hidden = true;
  setGpsDebug(null);
  setStatus('active', 'AR aktif');
  void queueLocationSync(activeLocar, currentPosition);
}

function queueLocationSync(activeLocar: NonNullable<typeof locar>, position: CurrentPosition) {
  latestPosition = position;
  syncRevision += 1;

  locationSyncPromise ??= runLocationSyncQueue(activeLocar);
  return locationSyncPromise;
}

async function runLocationSyncQueue(activeLocar: NonNullable<typeof locar>) {
  try {
    while (syncedRevision < syncRevision) {
      const revision = syncRevision;
      await syncLocationObjects(activeLocar);
      syncedRevision = revision;
    }
  } catch (error) {
    setStatus('error', errorMessage(error, 'Objek gagal dimuat'));
  } finally {
    locationSyncPromise = null;
  }
}

async function syncLocationObjects(activeLocar: NonNullable<typeof locar>) {
  const currentPosition = latestPosition;
  if (!currentPosition) {
    return;
  }

  const locationDistances = LOCATIONS.map((location) => ({
    location,
    distance: haversineDistance(currentPosition, location)
  }));

  const nearbyLocationIds = new Set(
    locationDistances
      .filter(({ distance }) => distance <= VISIBLE_RADIUS_METERS)
      .map(({ location }) => location.id)
  );

  for (const [locationId, marker] of activeMarkers.entries()) {
    if (!nearbyLocationIds.has(locationId)) {
      removeLocationMarker(locationId, marker);
    } else {
      positionLocationMarker(activeLocar, marker, currentPosition);
    }
  }

  const locationsToAdd = locationDistances
    .filter(({ location, distance }) => {
      return distance <= VISIBLE_RADIUS_METERS && !activeMarkers.has(location.id);
    })
    .map(({ location }) => location);

  if (locationsToAdd.length > 0) {
    setStatus('loading', 'Memuat karakter');
    const characterAsset = await loadCharacter();

    for (const location of locationsToAdd) {
      if (!latestPosition) {
        break;
      }

      const distance = haversineDistance(latestPosition, location);
      if (distance > VISIBLE_RADIUS_METERS || activeMarkers.has(location.id)) {
        continue;
      }

      const marker = createLocationMarker(location, characterAsset);
      activeLocar.scene.add(marker.object);
      positionLocationMarker(activeLocar, marker, latestPosition);
      activeMarkers.set(location.id, marker);
    }
  }

  updateActiveObjectCount();
  updateClosestLocationInfo(locationDistances);
  setStatus('active', `${activeMarkers.size} objek dekat`);
}

function loadCharacter() {
  characterPromise ??= gltfLoader
    .loadAsync(CHARACTER_MODEL_URL)
    .then((gltf) => ({
      scene: gltf.scene,
      animations: preserveRestPoseOffsets(gltf.scene, gltf.animations)
    }))
    .catch((error) => {
      characterPromise = null;
      throw error;
    });

  return characterPromise;
}

function preserveRestPoseOffsets(
  scene: THREE.Group,
  clips: THREE.AnimationClip[]
) {
  const hips =
    scene.getObjectByName('mixamorigHips') ??
    scene.getObjectByName('mixamorig:Hips');
  if (!hips) {
    return clips;
  }

  const restPosition = hips.position.clone();
  return clips.map((clip) => {
    const fixedClip = clip.clone();

    for (const track of fixedClip.tracks) {
      if (
        track instanceof THREE.VectorKeyframeTrack &&
        track.name.replaceAll(':', '').includes('mixamorigHips') &&
        track.name.endsWith('.position')
      ) {
        const values = track.values;
        for (let index = 0; index < values.length; index += 3) {
          values[index] = restPosition.x;
          values[index + 1] += restPosition.y;
          values[index + 2] = restPosition.z;
        }
      }
    }

    return fixedClip;
  });
}

function createLocationMarker(
  location: ArLocation,
  characterAsset: CharacterAsset
): ActiveMarker {
  const group = new THREE.Group();
  group.name = location.name;
  group.scale.setScalar(location.scale);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.95, 0.065, 10, 72),
    basicMaterial(location.accent)
  );
  ring.name = 'location-ring';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  ring.userData.disposeOnRemove = true;
  group.add(ring);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 1.06, 0.28, 32),
    basicMaterial(0x202725)
  );
  base.position.y = 0.14;
  base.userData.disposeOnRemove = true;
  group.add(base);

  const halo = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.18, 0.035, 48),
    new THREE.MeshBasicMaterial({
      color: location.accent,
      transparent: true,
      opacity: 0.36
    })
  );
  halo.position.y = 0.3;
  halo.userData.disposeOnRemove = true;
  group.add(halo);

  const character = createCharacterInstance(characterAsset);
  character.object.position.y = 0.28;
  group.add(character.object);

  const label = createLabelSprite(location.name, location.category, location.accent);
  label.position.y = 6.35;
  group.add(label);

  return {
    object: group,
    location,
    mixer: character.mixer,
    positionLocked: false
  };
}

function positionLocationMarker(
  activeLocar: NonNullable<typeof locar>,
  marker: ActiveMarker,
  currentPosition: CurrentPosition
) {
  if (marker.positionLocked) {
    return;
  }

  if (LOCK_NEARBY_OBJECTS_TO_START_VIEW) {
    if (
      isAndroidDevice() &&
      !androidMotionSensorStartupFinished &&
      !hasUsableOrientationSample()
    ) {
      marker.object.visible = false;
      setStatus('loading', 'Kalibrasi sensor');
      return;
    }

    lockMarkerInStartView(marker.object, activeMarkers.size);
    marker.positionLocked = true;
    marker.object.visible = true;
    return;
  }

  const displayCoordinates = displayCoordinatesForLocation(
    currentPosition,
    marker.location
  );
  const [x, z] = activeLocar.lonLatToWorldCoords(
    displayCoordinates.longitude,
    displayCoordinates.latitude
  );

  marker.object.position.set(
    x,
    marker.location.altitude + TARGET_ELEVATION_METERS,
    z
  );
  marker.positionLocked = true;
}

function displayCoordinatesForLocation(
  currentPosition: CurrentPosition,
  location: ArLocation
): Coordinates {
  const distance = haversineDistance(currentPosition, location);
  if (distance >= MIN_DISPLAY_DISTANCE_METERS) {
    return location;
  }

  const bearing =
    distance > 0.5 ? bearingTo(currentPosition, location) : 0;
  return destinationPoint(
    currentPosition,
    MIN_DISPLAY_DISTANCE_METERS,
    bearing
  );
}

function createCharacterInstance(characterAsset: CharacterAsset): CharacterInstance {
  const wrapper = new THREE.Group();
  wrapper.name = 'character-wrapper';

  const model = cloneSkeleton(characterAsset.scene) as THREE.Group;

  model.traverse((object) => {
    if ('isMesh' in object || 'isSkinnedMesh' in object) {
      const mesh = object as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.visible = true;
      makeCharacterMaterialVisible(mesh);
    }
  });

  const normalized = normalizeModel(model, CHARACTER_HEIGHT_METERS);
  wrapper.add(model);

  if (!normalized) {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.4, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff4f4f })
    );
    fallback.position.y = 1.2;
    fallback.userData.disposeOnRemove = true;
    wrapper.add(fallback);
  }

  let mixer: THREE.AnimationMixer | undefined;
  if (characterAsset.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(characterAsset.animations[0]).play();
  }

  return {
    object: wrapper,
    mixer
  };
}

function normalizeModel(model: THREE.Object3D, targetHeight: number) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) {
    return false;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) {
    return false;
  }

  const scale = targetHeight / Math.max(size.y, 0.001);

  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return true;
}

function makeCharacterMaterialVisible(mesh: THREE.Mesh) {
  const sourceMaterials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  const visibleMaterials = sourceMaterials.map((item) => {
    const texture =
      item instanceof THREE.MeshBasicMaterial ||
      item instanceof THREE.MeshStandardMaterial ||
      item instanceof THREE.MeshPhongMaterial ||
      item instanceof THREE.MeshLambertMaterial
        ? item.map
        : null;
    if (texture) {
      sharpenTexture(texture);
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: texture ?? null,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      depthTest: true,
      depthWrite: true
    });
    material.name = 'character-visible-material';
    material.needsUpdate = true;
    return material;
  });

  mesh.material = Array.isArray(mesh.material)
    ? visibleMaterials
    : visibleMaterials[0];
}

function sharpenTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  const maxAnisotropy =
    app?.renderer.capabilities.getMaxAnisotropy() ?? 1;
  texture.anisotropy = Math.min(
    maxAnisotropy,
    8
  );
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
}

function tuneMaterial(material: THREE.Material | THREE.Material[]) {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    if (item instanceof THREE.MeshStandardMaterial) {
      const texture = item.map;
      item.color.set(0xffffff);
      item.metalness = 0;
      item.roughness = 0.65;
      item.map = texture;
    }

    item.side = THREE.DoubleSide;
    item.transparent = false;
    item.opacity = 1;
    item.depthTest = true;
    item.depthWrite = true;
    item.needsUpdate = true;
  }
}

function setupSceneLighting(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 1.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(4, 8, 5);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9fd8ff, 0.65);
  fillLight.position.set(-5, 4, -3);
  scene.add(fillLight);
}

function createLabelSprite(name: string, category: string, accent: number) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 768;
  textureCanvas.height = 256;

  const context = textureCanvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D tidak tersedia');
  }

  context.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  context.fillStyle = 'rgba(13, 18, 17, 0.82)';
  roundedRect(context, 24, 34, 720, 170, 30);
  context.fill();

  context.fillStyle = `#${accent.toString(16).padStart(6, '0')}`;
  roundedRect(context, 52, 64, 90, 18, 9);
  context.fill();

  context.fillStyle = '#f6f3ec';
  context.font = '700 52px Arial, sans-serif';
  context.fillText(name, 52, 138);

  context.fillStyle = '#c6d5ce';
  context.font = '500 30px Arial, sans-serif';
  context.fillText(category, 52, 178);

  const texture = new THREE.CanvasTexture(textureCanvas);
  sharpenTexture(texture);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = 'location-label';
  sprite.scale.set(10.4, 3.45, 1);
  sprite.renderOrder = 10;
  sprite.userData.disposeOnRemove = true;
  return sprite;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function basicMaterial(color: number) {
  return new THREE.MeshBasicMaterial({ color });
}

function syncRenderQuality() {
  if (!app) {
    return;
  }

  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    MAX_RENDER_PIXEL_RATIO
  );

  app.renderer.setPixelRatio(pixelRatio);
  app.renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function startAnimation() {
  if (animationStarted) {
    return;
  }

  animationStarted = true;
  clock.start();

  const animate = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    if (screenFallbackMarker) {
      screenFallbackMarker.mixer?.update(delta);
      positionScreenFallbackMarker(screenFallbackMarker.object);
    }

    for (const marker of activeMarkers.values()) {
      marker.mixer?.update(delta);
      const ring = marker.object.getObjectByName('location-ring');
      if (ring) {
        ring.rotation.z = time * 0.22;
      }
    }

    requestAnimationFrame(animate);
  };

  animate();
}

function positionScreenFallbackMarker(marker: THREE.Group) {
  marker.position.set(
    0,
    SCREEN_FALLBACK_VERTICAL_OFFSET_METERS,
    -SCREEN_FALLBACK_DISTANCE_METERS
  );

  marker.rotation.set(0, 0, 0);
}

function lockMarkerInStartView(
  marker: THREE.Group,
  index: number
) {
  const activeApp = createArApp();
  const forward = getStableHorizontalForward();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const xOffset = index * LOCKED_VIEW_SPACING_METERS;

  activeApp.camera.updateMatrixWorld(true);
  marker.position
    .copy(activeApp.camera.position)
    .addScaledVector(forward, LOCKED_VIEW_DISTANCE_METERS)
    .addScaledVector(right, xOffset);
  marker.position.y += LOCKED_VIEW_VERTICAL_OFFSET_METERS;

  marker.rotation.set(
    0,
    Math.atan2(forward.x, forward.z) + Math.PI,
    0
  );
}

function getStableHorizontalForward() {
  const activeApp = createArApp();
  activeApp.camera.updateMatrixWorld(true);
  const forward = activeApp.camera.getWorldDirection(new THREE.Vector3());
  forward.y = 0;

  if (forward.lengthSq() <= 0.0001) {
    forward.set(0, 0, -1);
  }

  return forward.normalize();
}

function removeLocationMarker(locationId: string, marker: ActiveMarker) {
  marker.mixer?.stopAllAction();
  marker.object.removeFromParent();
  disposeMarkerShell(marker.object);
  activeMarkers.delete(locationId);
}

function clearActiveMarkers() {
  for (const [locationId, marker] of activeMarkers.entries()) {
    removeLocationMarker(locationId, marker);
  }
  updateActiveObjectCount();
  updateLocationInfo(null);
}

function disposeMarkerShell(marker: THREE.Object3D) {
  marker.traverse((object) => {
    if (!object.userData.disposeOnRemove) {
      return;
    }

    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
      return;
    }

    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

function updateActiveObjectCount() {
  objectCount.textContent = screenFallbackActive
    ? '1 layar'
    : `${activeMarkers.size}/${LOCATIONS.length}`;
}

function renderLocationList(current?: CurrentPosition) {
  locationList.innerHTML = '';

  for (const location of LOCATIONS) {
    const item = document.createElement('li');
    const distanceInMeters = current ? haversineDistance(current, location) : null;
    const distance =
      distanceInMeters === null ? 'menunggu' : formatDistance(distanceInMeters);
    const visibility =
      distanceInMeters === null
        ? 'menunggu'
        : distanceInMeters <= VISIBLE_RADIUS_METERS
          ? 'aktif'
          : 'di luar radius';

    item.innerHTML = `
      <span class="swatch" style="--swatch:${cssColor(location.accent)}"></span>
      <span>
        <strong>${location.name}</strong>
        <small>${location.category} - ${distance} - ${visibility}</small>
      </span>
    `;

    locationList.append(item);
  }
}

function updatePositionInfo(position: CurrentPosition, mode: string) {
  gpsMode.textContent = mode;
  gpsAccuracy.textContent =
    typeof position.accuracy === 'number' ? `${Math.round(position.accuracy)} m` : '-';
  renderLocationList(position);
}

function updateClosestLocationInfo(
  locationDistances: Array<{ location: ArLocation; distance: number }>
) {
  const closestActive = locationDistances
    .filter(({ location }) => activeMarkers.has(location.id))
    .sort((a, b) => a.distance - b.distance)[0];

  updateLocationInfo(closestActive?.location ?? null);
}

function updateLocationInfo(location: ArLocation | null) {
  locationInfo.hidden = !location;
  locationInfoTitle.textContent = location?.title ?? '';
  locationInfoDescription.replaceChildren();

  if (!location) {
    return;
  }

  locationInfoDescription.append(
    createLanguageDescription('Indonesia', location.descriptionId),
    createLanguageDescription('English', location.descriptionEn)
  );
}

function createLanguageDescription(label: string, text: string) {
  const paragraph = document.createElement('p');
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  paragraph.append(labelElement, document.createTextNode(text));
  return paragraph;
}

function setStatus(state: 'idle' | 'loading' | 'active' | 'error', message: string) {
  statusPill.dataset.state = state;
  statusPill.textContent = message;
}

function gpsErrorMessage(error: unknown) {
  const code = gpsErrorCode(error);

  if (code === GPS_PERMISSION_DENIED) {
    return 'Izin lokasi ditolak';
  }
  if (code === GPS_POSITION_UNAVAILABLE) {
    return 'GPS tidak tersedia';
  }
  if (code === GPS_TIMEOUT) {
    return 'GPS timeout';
  }
  return errorMessage(error, 'GPS error');
}

function isGpsPermissionDenied(error: unknown) {
  return gpsErrorCode(error) === GPS_PERMISSION_DENIED;
}

function gpsErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? Number(error.code)
    : 0;
}

async function showGpsDiagnostic(error: unknown) {
  setGpsDebug(gpsHelp(error));
  gpsRetry.hidden = false;
  if (isGpsPermissionDenied(error)) stopRealGpsWatch();
  const permission = await withTimeout(queryGpsPermissionState(), 1500, 'unknown').catch(() => 'unknown');
  const code = gpsErrorCode(error) || '-';
  const rawMessage = errorMessage(error, 'tanpa pesan');
  const secure = window.isSecureContext ? 'yes' : 'no';
  const protocol = window.location.protocol.replace(':', '');
  const message = `Diag GPS: secure=${secure}, protocol=${protocol}, permission=${permission}, code=${code}, message=${rawMessage}`;

  console.info(message, error);
}

async function queryGpsPermissionState() {
  if (!navigator.permissions?.query) {
    return 'unsupported';
  }

  try {
    const result = await navigator.permissions.query({
      name: 'geolocation' as PermissionName
    });
    return result.state;
  } catch {
    return 'unsupported';
  }
}

function setGpsDebug(message: string | null) {
  gpsDebug.hidden = !message;
  gpsDebug.textContent = message ?? '';
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }

  return fallback;
}

function haversineDistance(a: CurrentPosition, b: CurrentPosition) {
  const radius = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * radius * Math.asin(Math.sqrt(h));
}

function bearingTo(a: Coordinates, b: Coordinates) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return Math.atan2(y, x);
}

function destinationPoint(
  origin: Coordinates,
  distanceMeters: number,
  bearingRadians: number
) {
  const radius = 6371000;
  const angularDistance = distanceMeters / radius;
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngularDistance = Math.sin(angularDistance);
  const cosAngularDistance = Math.cos(angularDistance);

  const latitude = Math.asin(
    sinLat1 * cosAngularDistance +
      cosLat1 * sinAngularDistance * Math.cos(bearingRadians)
  );
  const longitude =
    lon1 +
    Math.atan2(
      Math.sin(bearingRadians) * sinAngularDistance * cosLat1,
      cosAngularDistance - sinLat1 * Math.sin(latitude)
    );

  return {
    latitude: toDegrees(latitude),
    longitude: toDegrees(longitude)
  };
}

function formatDistance(distance: number) {
  if (distance < 1000) {
    return `${Math.round(distance)} m`;
  }

  return `${(distance / 1000).toFixed(1)} km`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function cssColor(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function getElement<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element ${selector} tidak ditemukan`);
  }
  return element;
}

const gpsRetry = document.createElement('button');
gpsRetry.type = 'button';
gpsRetry.className = 'compact-button';
gpsRetry.textContent = 'Coba GPS lagi';
gpsRetry.hidden = true;
gpsDebug.insertAdjacentElement('afterend', gpsRetry);
gpsRetry.addEventListener('click', () => { if (locar) { setGpsDebug(null); activateRealGps(); } });
