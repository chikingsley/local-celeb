import type { FileMetaData, Segment, Speaker } from "@/types";
import { parseTime } from "./utils";

/**
 * Export formats supported by the application
 */
export type ExportFormat = "txt" | "srt" | "vtt" | "json" | "html" | "csv";

/**
 * Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
export function secondsToSrtTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const millis = Math.round((seconds % 1) * 1000);

	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
}

/**
 * Convert seconds to VTT timestamp format (HH:MM:SS.mmm)
 */
export function secondsToVttTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const millis = Math.round((seconds % 1) * 1000);

	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

/**
 * Get speaker name by ID
 */
function getSpeakerName(speakerId: string, speakers: Speaker[]): string {
	const speaker = speakers.find((s) => s.id === speakerId);
	return speaker?.name ?? speakerId;
}

/**
 * Export to plain text format
 * Format:
 * [00:00 - 00:04] Speaker Name
 * Transcript text here.
 */
export function exportToTxt(segments: Segment[], speakers: Speaker[]): string {
	return segments
		.map((segment) => {
			const speakerName = getSpeakerName(segment.speakerId, speakers);
			return `[${segment.startTime} - ${segment.endTime}] ${speakerName}\n${segment.text}`;
		})
		.join("\n\n");
}

/**
 * Export to SRT subtitle format
 * Format:
 * 1
 * 00:00:00,000 --> 00:00:04,000
 * Speaker Name: Transcript text here.
 */
export function exportToSrt(segments: Segment[], speakers: Speaker[]): string {
	return segments
		.map((segment, index) => {
			const startSeconds = parseTime(segment.startTime);
			const endSeconds = parseTime(segment.endTime);
			const speakerName = getSpeakerName(segment.speakerId, speakers);

			const startTime = secondsToSrtTime(startSeconds);
			const endTime = secondsToSrtTime(endSeconds);

			return `${index + 1}\n${startTime} --> ${endTime}\n${speakerName}: ${segment.text}`;
		})
		.join("\n\n");
}

/**
 * Export to WebVTT subtitle format
 * Format:
 * WEBVTT
 *
 * 1
 * 00:00:00.000 --> 00:00:04.000
 * <v Speaker Name>Transcript text here.
 */
export function exportToVtt(segments: Segment[], speakers: Speaker[]): string {
	const header = "WEBVTT\n\n";
	const cues = segments
		.map((segment, index) => {
			const startSeconds = parseTime(segment.startTime);
			const endSeconds = parseTime(segment.endTime);
			const speakerName = getSpeakerName(segment.speakerId, speakers);

			const startTime = secondsToVttTime(startSeconds);
			const endTime = secondsToVttTime(endSeconds);

			return `${index + 1}\n${startTime} --> ${endTime}\n<v ${speakerName}>${segment.text}`;
		})
		.join("\n\n");

	return header + cues;
}

/**
 * Export project data to JSON
 */
export function exportToJson(
	segments: Segment[],
	speakers: Speaker[],
	meta?: Partial<FileMetaData>
): string {
	const exportData = {
		version: "1.0",
		exportedAt: new Date().toISOString(),
		meta: meta ?? {},
		speakers,
		segments,
	};

	return JSON.stringify(exportData, null, 2);
}

/**
 * Export to HTML format
 */
export function exportToHtml(
	segments: Segment[],
	speakers: Speaker[],
	meta?: Partial<FileMetaData>
): string {
	const title = meta?.name ?? "Transcript";
	const speakerStyles = speakers
		.map((s) => `.speaker-${s.id} { color: ${s.color}; font-weight: 600; }`)
		.join("\n    ");

	const segmentsHtml = segments
		.map((segment) => {
			const speaker = speakers.find((s) => s.id === segment.speakerId);
			const speakerName = speaker?.name ?? segment.speakerId;
			return `    <div class="segment">
      <div class="timestamp">${segment.startTime} - ${segment.endTime}</div>
      <div class="speaker speaker-${segment.speakerId}">${speakerName}</div>
      <div class="text">${segment.text}</div>
    </div>`;
		})
		.join("\n");

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .segment { margin-bottom: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 8px; }
    .timestamp { font-size: 0.875rem; color: #64748b; font-family: monospace; }
    .speaker { margin: 0.25rem 0; }
    .text { color: #1e293b; }
    ${speakerStyles}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p style="color: #64748b; font-size: 0.875rem;">Exported on ${new Date().toLocaleDateString()}</p>
${segmentsHtml}
</body>
</html>`;
}

/**
 * Export to CSV format
 */
export function exportToCsv(segments: Segment[], speakers: Speaker[]): string {
	const header = "Start Time,End Time,Speaker,Text";
	const rows = segments.map((segment) => {
		const speakerName = getSpeakerName(segment.speakerId, speakers);
		// Escape quotes in text and wrap in quotes
		const escapedText = `"${segment.text.replace(/"/g, '""')}"`;
		return `${segment.startTime},${segment.endTime},"${speakerName}",${escapedText}`;
	});

	return [header, ...rows].join("\n");
}

/**
 * Export data in the specified format
 */
export function exportTranscript(
	format: ExportFormat,
	segments: Segment[],
	speakers: Speaker[],
	meta?: Partial<FileMetaData>
): string {
	switch (format) {
		case "txt":
			return exportToTxt(segments, speakers);
		case "srt":
			return exportToSrt(segments, speakers);
		case "vtt":
			return exportToVtt(segments, speakers);
		case "json":
			return exportToJson(segments, speakers, meta);
		case "html":
			return exportToHtml(segments, speakers, meta);
		case "csv":
			return exportToCsv(segments, speakers);
		default:
			throw new Error(`Unsupported export format: ${format}`);
	}
}

/**
 * Get file extension for export format
 */
export function getFileExtension(format: ExportFormat): string {
	return format;
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
	switch (format) {
		case "txt":
			return "text/plain";
		case "srt":
			return "application/x-subrip";
		case "vtt":
			return "text/vtt";
		case "json":
			return "application/json";
		case "html":
			return "text/html";
		case "csv":
			return "text/csv";
		default:
			return "text/plain";
	}
}

/**
 * Download exported content as a file
 */
export function downloadExport(content: string, filename: string, format: ExportFormat): void {
	const mimeType = getMimeType(format);
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.${getFileExtension(format)}`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	URL.revokeObjectURL(url);
}
