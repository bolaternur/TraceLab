export function isEditableSpatialTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return element.matches("input, textarea, select, [contenteditable='true']") || Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}
