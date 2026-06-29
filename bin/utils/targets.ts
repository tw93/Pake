export const LINUX_TARGET_TYPES = ['deb', 'appimage', 'rpm', 'zst'];

// Returns the valid Linux build targets from a comma-separated targets
// string, preserving LINUX_TARGET_TYPES order. Unknown entries are dropped.
export function filterLinuxTargets(targets: string): string[] {
  const requested = targets.split(',').map((target) => target.trim());
  return LINUX_TARGET_TYPES.filter((target) => requested.includes(target));
}

export function needsTemporaryDebForZst(targets: string[]): boolean {
  return targets.includes('zst') && !targets.includes('deb');
}

// Resolves the Tauri `bundle.targets` list for a Linux build from a
// comma-separated --targets string (e.g. the distro-aware default
// "deb,appimage"). zst is repacked from the deb payload, so it maps to a deb
// bundle. hasValidTarget is false only when no known target is present, which
// is the single case that should warn and fall back to the default.
export function resolveLinuxBundleTargets(targets: string): {
  bundleTargets: string[];
  hasValidTarget: boolean;
} {
  const requested = filterLinuxTargets(targets);
  const bundleTargets = [
    ...new Set(requested.map((target) => (target === 'zst' ? 'deb' : target))),
  ];
  return { bundleTargets, hasValidTarget: requested.length > 0 };
}
