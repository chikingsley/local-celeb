/**
 * Timeline utility functions for snapping and time calculations
 */

export interface SnapToEdgeResult {
	time: number;
	snapped: boolean;
}

export interface SnapConfig {
	gridEnabled: boolean;
	gridInterval: number;
	edgeEnabled: boolean;
	edgeThreshold: number;
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
	gridEnabled: true,
	gridInterval: 0.5, // 0.5 second intervals
	edgeEnabled: true,
	edgeThreshold: 0.2, // Snap within 0.2 seconds of other edges
};

/**
 * Snap a time value to the nearest grid interval
 * @param time - The time in seconds to snap
 * @param interval - The grid interval in seconds (e.g., 0.5 for half-second snapping)
 * @param enabled - Whether grid snapping is enabled
 * @returns The snapped time value
 */
export function snapToGrid(time: number, interval: number, enabled = true): number {
	if (!enabled || interval <= 0) return time;
	return Math.round(time / interval) * interval;
}

/**
 * Find the nearest edge (start or end time) from a list of target times
 * @param time - The time in seconds to snap
 * @param targets - Array of target times to snap to (other segment edges)
 * @param threshold - Maximum distance to snap (in seconds)
 * @param enabled - Whether edge snapping is enabled
 * @returns Object with snapped time and whether snapping occurred
 */
export function snapToEdge(
	time: number,
	targets: number[],
	threshold: number,
	enabled = true
): SnapToEdgeResult {
	if (!enabled || targets.length === 0) {
		return { time, snapped: false };
	}

	let closestTarget = time;
	let minDistance = threshold;

	for (const target of targets) {
		const distance = Math.abs(time - target);
		if (distance < minDistance) {
			minDistance = distance;
			closestTarget = target;
		}
	}

	return {
		time: closestTarget,
		snapped: closestTarget !== time,
	};
}

/**
 * Combined snap function - edge snap takes priority over grid snap
 * @param time - The time in seconds to snap
 * @param targets - Array of target times for edge snapping
 * @param config - Snap configuration options
 * @returns Object with final snapped time and whether edge snapping occurred
 */
export function snapTime(
	time: number,
	targets: number[],
	config: SnapConfig = DEFAULT_SNAP_CONFIG
): SnapToEdgeResult {
	// Try edge snap first (higher priority)
	const edgeResult = snapToEdge(time, targets, config.edgeThreshold, config.edgeEnabled);

	if (edgeResult.snapped) {
		return edgeResult;
	}

	// Fall back to grid snap
	const gridSnapped = snapToGrid(time, config.gridInterval, config.gridEnabled);

	return {
		time: gridSnapped,
		snapped: false, // Only true for edge snaps (for showing guides)
	};
}

/**
 * Get all edge times from segments, excluding a specific segment
 * @param segments - Array of segments with startTime and endTime
 * @param excludeId - Segment ID to exclude from targets
 * @param parseTimeFn - Function to parse time strings to numbers
 * @returns Array of edge times in seconds
 */
export function getSegmentEdgeTimes<T extends { id: string; startTime: string; endTime: string }>(
	segments: T[],
	excludeId: string,
	parseTimeFn: (time: string) => number
): number[] {
	const targets: number[] = [];

	for (const seg of segments) {
		if (seg.id === excludeId) continue;
		targets.push(parseTimeFn(seg.startTime));
		targets.push(parseTimeFn(seg.endTime));
	}

	return targets;
}

/**
 * Calculate the minimum allowed start time when resizing left edge
 * @param currentEnd - Current end time of the segment
 * @param minDuration - Minimum allowed duration
 * @returns Maximum start time allowed
 */
export function getMaxStartTime(currentEnd: number, minDuration: number): number {
	return currentEnd - minDuration;
}

/**
 * Calculate the minimum allowed end time when resizing right edge
 * @param currentStart - Current start time of the segment
 * @param minDuration - Minimum allowed duration
 * @returns Minimum end time allowed
 */
export function getMinEndTime(currentStart: number, minDuration: number): number {
	return currentStart + minDuration;
}

/**
 * Clamp a time value to be non-negative
 * @param time - Time value to clamp
 * @returns Time value, minimum 0
 */
export function clampTimeToZero(time: number): number {
	return Math.max(0, time);
}
