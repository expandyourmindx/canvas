/**
 * Helper to get the auto snap resolution based on the zoom level.
 * Used by both Arranger (Canvas) and Piano Roll.
 */
export function getAutoSnapResolution(zoom: number): number | null {
  if (zoom < 1.0) return 1;
  if (zoom < 1.75) return 0.5;
  if (zoom < 2.5) return 0.25;
  if (zoom < 4.0) return 0.125;
  return null; // max zoom only — free movement
}
