const STORAGE_KEY = 'ikari-display-scale-v1';
export const scaleLimits = { character: [0.25, 3], location: [0.5, 2] };
export function clampScale(kind, value) {
  const number = Number(value);
  const [min, max] = scaleLimits[kind];
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 1;
}
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* Storage can be unavailable. */ }
const scales = { character: clampScale('character', saved.character ?? 1), location: clampScale('location', saved.location ?? 1) };

export function applyMarkerScale(group) {
  const character = group.getObjectByName('character-wrapper');
  const label = group.getObjectByName('location-label');
  if (character) character.scale.setScalar(scales.character);
  if (label) {
    label.scale.set(9.4 * scales.location, 3.1 * scales.location, 1);
    // Keep the label above the character as either size changes.
    label.position.y = 0.28 + 5.45 * scales.character + 1.55 * scales.location + 0.15;
  }
}

export function bindScaleControls(getMarkers) {
  const root = document.getElementById('size-controls');
  function render() {
    for (const kind of Object.keys(scales)) {
      const percent = Math.round(scales[kind] * 100);
      root.querySelector(`#${kind}-scale`).value = String(percent);
      root.querySelector(`#${kind}-scale-value`).value = `${percent}%`;
      for (const button of root.querySelectorAll(`[data-scale-kind="${kind}"]`)) {
        button.disabled = button.dataset.scaleStep === '-1' ? scales[kind] <= scaleLimits[kind][0] : scales[kind] >= scaleLimits[kind][1];
      }
    }
    document.getElementById('location-info').style.setProperty('--location-scale', String(scales.location));
    for (const marker of getMarkers()) applyMarkerScale(marker.object);
  }
  function update(kind, value) {
    scales[kind] = clampScale(kind, value);
    render();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scales)); } catch { /* Still works for this session. */ }
  }
  for (const kind of Object.keys(scales)) {
    root.querySelector(`#${kind}-scale`).addEventListener('input', event => update(kind, Number(event.target.value) / 100));
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-scale-kind]');
    if (button) update(button.dataset.scaleKind, Math.round((scales[button.dataset.scaleKind] + Number(button.dataset.scaleStep) * 0.1) * 100) / 100);
  });
  document.getElementById('reset-sizes').addEventListener('click', () => { scales.character = 1; update('location', 1); });
  render();
}
