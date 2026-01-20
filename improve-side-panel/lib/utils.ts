import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// <CHANGE> Add time formatting utilities
export function formatTime(seconds: number): string {
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = (seconds % 60).toFixed(2);
	return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.padStart(5, "0")}`;
}

export function parseTime(timeStr: string): number {
	const parts = timeStr.split(":");
	if (parts.length === 3) {
		const [hrs, mins, secs] = parts.map(Number.parseFloat);
		return hrs * 3600 + mins * 60 + secs;
	}
	return Number.parseFloat(timeStr) || 0;
}
