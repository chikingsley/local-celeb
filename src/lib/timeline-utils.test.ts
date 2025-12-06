import { describe, expect, it } from "vitest";
import {
	clampTimeToZero,
	DEFAULT_SNAP_CONFIG,
	getMaxStartTime,
	getMinEndTime,
	getSegmentEdgeTimes,
	snapTime,
	snapToEdge,
	snapToGrid,
} from "./timeline-utils";

describe("snapToGrid", () => {
	it("should snap to 0.5s intervals", () => {
		expect(snapToGrid(0.3, 0.5)).toBe(0.5);
		expect(snapToGrid(0.2, 0.5)).toBe(0);
		expect(snapToGrid(0.75, 0.5)).toBe(1);
		expect(snapToGrid(1.1, 0.5)).toBe(1);
		expect(snapToGrid(1.3, 0.5)).toBe(1.5);
	});

	it("should snap to 1s intervals", () => {
		expect(snapToGrid(0.4, 1)).toBe(0);
		expect(snapToGrid(0.6, 1)).toBe(1);
		expect(snapToGrid(2.3, 1)).toBe(2);
		expect(snapToGrid(2.7, 1)).toBe(3);
	});

	it("should return raw time when disabled", () => {
		expect(snapToGrid(0.3, 0.5, false)).toBe(0.3);
		expect(snapToGrid(1.7, 0.5, false)).toBe(1.7);
	});

	it("should return raw time when interval is 0 or negative", () => {
		expect(snapToGrid(0.3, 0)).toBe(0.3);
		expect(snapToGrid(0.3, -1)).toBe(0.3);
	});

	it("should handle exact grid values", () => {
		expect(snapToGrid(1.0, 0.5)).toBe(1);
		expect(snapToGrid(2.5, 0.5)).toBe(2.5);
		expect(snapToGrid(0, 0.5)).toBe(0);
	});

	it("should handle small intervals", () => {
		expect(snapToGrid(0.12, 0.1)).toBe(0.1);
		expect(snapToGrid(0.18, 0.1)).toBe(0.2);
	});
});

describe("snapToEdge", () => {
	const targets = [1, 3, 5, 10];
	const threshold = 0.2;

	it("should snap to nearby edge within threshold", () => {
		expect(snapToEdge(1.1, targets, threshold)).toEqual({ time: 1, snapped: true });
		expect(snapToEdge(0.9, targets, threshold)).toEqual({ time: 1, snapped: true });
		expect(snapToEdge(2.85, targets, threshold)).toEqual({ time: 3, snapped: true });
		expect(snapToEdge(5.15, targets, threshold)).toEqual({ time: 5, snapped: true });
	});

	it("should not snap when beyond threshold", () => {
		expect(snapToEdge(1.3, targets, threshold)).toEqual({ time: 1.3, snapped: false });
		expect(snapToEdge(2, targets, threshold)).toEqual({ time: 2, snapped: false });
		expect(snapToEdge(7, targets, threshold)).toEqual({ time: 7, snapped: false });
	});

	it("should return original time when disabled", () => {
		expect(snapToEdge(1.1, targets, threshold, false)).toEqual({ time: 1.1, snapped: false });
	});

	it("should return original time when no targets", () => {
		expect(snapToEdge(1.1, [], threshold)).toEqual({ time: 1.1, snapped: false });
	});

	it("should snap to closest edge when multiple are nearby", () => {
		const closeTargets = [1, 1.3];
		// 1.1 is 0.1 from 1 and 0.2 from 1.3, should snap to 1
		expect(snapToEdge(1.1, closeTargets, 0.25)).toEqual({ time: 1, snapped: true });
		// 1.2 is 0.2 from 1 and 0.1 from 1.3, should snap to 1.3
		expect(snapToEdge(1.2, closeTargets, 0.25)).toEqual({ time: 1.3, snapped: true });
	});

	it("should handle exact edge values", () => {
		expect(snapToEdge(3, targets, threshold)).toEqual({ time: 3, snapped: false });
	});
});

describe("snapTime", () => {
	const targets = [2, 4, 6];

	it("should prioritize edge snap over grid snap", () => {
		const config = {
			gridEnabled: true,
			gridInterval: 0.5,
			edgeEnabled: true,
			edgeThreshold: 0.2,
		};

		// 1.9 is near edge 2, should snap to 2 (not 2.0 from grid)
		const result = snapTime(1.9, targets, config);
		expect(result.time).toBe(2);
		expect(result.snapped).toBe(true);
	});

	it("should fall back to grid snap when no edge nearby", () => {
		const config = {
			gridEnabled: true,
			gridInterval: 0.5,
			edgeEnabled: true,
			edgeThreshold: 0.2,
		};

		// 3 is not near any edge, should snap to grid (3.0)
		const result = snapTime(3.2, targets, config);
		expect(result.time).toBe(3);
		expect(result.snapped).toBe(false);
	});

	it("should only grid snap when edge snap disabled", () => {
		const config = {
			gridEnabled: true,
			gridInterval: 0.5,
			edgeEnabled: false,
			edgeThreshold: 0.2,
		};

		// 1.9 is near edge 2, but edge snap disabled
		const result = snapTime(1.9, targets, config);
		expect(result.time).toBe(2); // Grid snaps to 2.0
		expect(result.snapped).toBe(false);
	});

	it("should only edge snap when grid snap disabled", () => {
		const config = {
			gridEnabled: false,
			gridInterval: 0.5,
			edgeEnabled: true,
			edgeThreshold: 0.2,
		};

		// 3.3 is not near any edge
		const result = snapTime(3.3, targets, config);
		expect(result.time).toBe(3.3); // No snap
		expect(result.snapped).toBe(false);
	});

	it("should return raw time when all snapping disabled", () => {
		const config = {
			gridEnabled: false,
			gridInterval: 0.5,
			edgeEnabled: false,
			edgeThreshold: 0.2,
		};

		const result = snapTime(1.9, targets, config);
		expect(result.time).toBe(1.9);
		expect(result.snapped).toBe(false);
	});

	it("should use default config", () => {
		const result = snapTime(1.9, targets);
		expect(result.time).toBe(2); // Should snap to edge
		expect(result.snapped).toBe(true);
	});
});

describe("getSegmentEdgeTimes", () => {
	const parseTime = (t: string) => {
		const [mins, secs] = t.split(":").map(Number);
		return mins * 60 + secs;
	};

	const segments = [
		{ id: "1", startTime: "00:00", endTime: "00:05" },
		{ id: "2", startTime: "00:10", endTime: "00:15" },
		{ id: "3", startTime: "00:20", endTime: "00:30" },
	];

	it("should get all edge times except excluded segment", () => {
		const result = getSegmentEdgeTimes(segments, "2", parseTime);
		expect(result).toEqual([0, 5, 20, 30]); // Excludes 10 and 15 from segment 2
	});

	it("should return all edges when excluding non-existent segment", () => {
		const result = getSegmentEdgeTimes(segments, "999", parseTime);
		expect(result).toEqual([0, 5, 10, 15, 20, 30]);
	});

	it("should return empty array for empty segments", () => {
		const result = getSegmentEdgeTimes([], "1", parseTime);
		expect(result).toEqual([]);
	});

	it("should return empty array when all segments excluded", () => {
		const singleSegment = [{ id: "1", startTime: "00:00", endTime: "00:05" }];
		const result = getSegmentEdgeTimes(singleSegment, "1", parseTime);
		expect(result).toEqual([]);
	});
});

describe("getMaxStartTime", () => {
	it("should calculate maximum start time based on end and min duration", () => {
		expect(getMaxStartTime(10, 0.5)).toBe(9.5);
		expect(getMaxStartTime(5, 1)).toBe(4);
		expect(getMaxStartTime(2, 2)).toBe(0);
	});
});

describe("getMinEndTime", () => {
	it("should calculate minimum end time based on start and min duration", () => {
		expect(getMinEndTime(0, 0.5)).toBe(0.5);
		expect(getMinEndTime(5, 1)).toBe(6);
		expect(getMinEndTime(10, 2)).toBe(12);
	});
});

describe("clampTimeToZero", () => {
	it("should return 0 for negative values", () => {
		expect(clampTimeToZero(-1)).toBe(0);
		expect(clampTimeToZero(-0.5)).toBe(0);
		expect(clampTimeToZero(-100)).toBe(0);
	});

	it("should return original value for positive values", () => {
		expect(clampTimeToZero(0)).toBe(0);
		expect(clampTimeToZero(1)).toBe(1);
		expect(clampTimeToZero(0.5)).toBe(0.5);
	});
});

describe("DEFAULT_SNAP_CONFIG", () => {
	it("should have sensible defaults", () => {
		expect(DEFAULT_SNAP_CONFIG.gridEnabled).toBe(true);
		expect(DEFAULT_SNAP_CONFIG.gridInterval).toBe(0.5);
		expect(DEFAULT_SNAP_CONFIG.edgeEnabled).toBe(true);
		expect(DEFAULT_SNAP_CONFIG.edgeThreshold).toBe(0.2);
	});
});
