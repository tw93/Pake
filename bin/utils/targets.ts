export const LINUX_TARGET_TYPES = ['deb', 'appimage', 'rpm', 'zst'];

// Returns the valid Linux build targets from a comma-separated targets
// string, preserving LINUX_TARGET_TYPES order. Unknown entries are dropped.
export function filterLinuxTargets(targets: string): string[] {
  const requested = targets.split(',').map((target) => target.trim());
  return LINUX_TARGET_TYPES.filter((target) => requested.includes(target));
}
