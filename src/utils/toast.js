// Tiny pub/sub toast store: drop-in, non-blocking replacement for window.alert().
const listeners = new Set();
let nextId = 1;

const ERROR_HINT = /\b(error|failed|invalid|cannot|unable|cancelled)\b/i;
const WARN_HINT = /\b(please|no |must|select|enter)\b/i;
const SUCCESS_HINT = /\b(success|successfully|copied|saved|updated|deleted|imported)\b/i;

function inferType(message) {
  if (ERROR_HINT.test(message)) return 'error';
  if (SUCCESS_HINT.test(message)) return 'success';
  if (WARN_HINT.test(message)) return 'warning';
  return 'info';
}

export function notify(message, type) {
  const text = String(message ?? '');
  const toast = { id: nextId++, message: text, type: type || inferType(text) };
  listeners.forEach((fn) => fn(toast));
  return toast.id;
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
