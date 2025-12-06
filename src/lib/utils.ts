import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format seconds to MM:SS.d string (with decimal for sub-second precision)
 */
export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	// Round to 1 decimal place to avoid floating point noise
	const secsRounded = Math.round(secs * 10) / 10;
	// Format: if decimal is .0, show as whole number; otherwise show 1 decimal
	const secsStr =
		secsRounded % 1 === 0
			? secsRounded.toFixed(0).padStart(2, "0")
			: secsRounded.toFixed(1).padStart(4, "0");
	return `${mins.toString().padStart(2, "0")}:${secsStr}`;
}

/**
 * Parse MM:SS or MM:SS.d string to seconds
 */
export function parseTime(timeStr: string): number {
	const parts = timeStr.split(":");
	if (parts.length !== 2) return 0;

	const mins = Number.parseInt(parts[0], 10);
	const secs = Number.parseFloat(parts[1]);

	if (Number.isNaN(mins) || Number.isNaN(secs)) return 0;
	return mins * 60 + secs;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = "id"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
