export interface SnapConfig {
	gridEnabled: boolean;
	gridInterval: number;
	edgeEnabled: boolean;
	edgeThreshold: number;
}

export function snapToGrid(time: number, interval: number, enabled: boolean): number {
	if (!enabled) return time;
	return Math.round(time / interval) * interval;
}

export function snapToEdge(
	time: number,
	targets: number[],
	threshold: number,
	enabled: boolean
): { time: number; snapped: boolean } {
	if (!enabled || targets.length === 0) return { time, snapped: false };

	for (const target of targets) {
		if (Math.abs(time - target) <= threshold) {
			return { time: target, snapped: true };
		}
	}
	return { time, snapped: false };
}

export function snapTime(
	time: number,
	edgeTargets: number[],
	config: SnapConfig
): { time: number; snapped: boolean } {
	// Try edge snapping first
	const edgeResult = snapToEdge(time, edgeTargets, config.edgeThreshold, config.edgeEnabled);
	if (edgeResult.snapped) return edgeResult;

	// Fall back to grid snapping
	const gridTime = snapToGrid(time, config.gridInterval, config.gridEnabled);
	return { time: gridTime, snapped: gridTime !== time };
}

export function getSegmentEdgeTimes(
	segments: any[],
	excludeSegmentId: string,
	parseTime: (timeStr: string) => number
): number[] {
	const edges: number[] = [];
	for (const seg of segments) {
		if (seg.id !== excludeSegmentId) {
			edges.push(parseTime(seg.startTime));
			edges.push(parseTime(seg.endTime));
		}
	}
	return edges;
}
