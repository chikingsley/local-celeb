import type { Segment, Speaker } from "@/domain/transcript/types";
import { parseTime } from "@/lib/utils";
import { deriveTranscriptTurns } from "./turns";

export type AudioExportMode = "speaker" | "turn";

export interface AudioExportRange {
	end: number;
	id: string;
	label: string;
	start: number;
}

export interface AudioExportItem {
	duration: number;
	filename: string;
	id: string;
	label: string;
	ranges: AudioExportRange[];
}

const WAV_BITS_PER_SAMPLE = 16;
const WAV_BYTES_PER_SAMPLE = WAV_BITS_PER_SAMPLE / 8;
const FILENAME_EXTENSION_PATTERN = /\.[a-z0-9]+$/i;
const FILENAME_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const LEADING_TRAILING_DASH_PATTERN = /^-+|-+$/g;

export function buildSpeakerAudioExportItems(
	segments: Segment[],
	speakers: Speaker[],
	baseName = "transcript"
): AudioExportItem[] {
	return speakers
		.map((speaker, index) => {
			const ranges = segments
				.filter((segment) => segment.speakerId === speaker.id)
				.map(segmentToRange)
				.filter((range) => range.end > range.start)
				.sort((a, b) => a.start - b.start);

			if (ranges.length === 0) {
				return null;
			}

			return {
				duration: ranges.reduce((sum, range) => sum + range.end - range.start, 0),
				filename: `${sanitizeFilename(baseName)}-speaker-${index + 1}-${sanitizeFilename(speaker.name)}.wav`,
				id: `speaker-${speaker.id}`,
				label: speaker.name,
				ranges,
			} satisfies AudioExportItem;
		})
		.filter((item): item is AudioExportItem => item !== null);
}

export function buildTurnAudioExportItems(
	segments: Segment[],
	speakers: Speaker[],
	baseName = "transcript"
): AudioExportItem[] {
	const speakerNames = new Map(speakers.map((speaker) => [speaker.id, speaker.name]));
	const segmentById = new Map(segments.map((segment) => [segment.id, segment]));

	return deriveTranscriptTurns(segments)
		.map((turn, index) => {
			const ranges = turn.segmentIds
				.map((segmentId) => segmentById.get(segmentId))
				.filter((segment): segment is Segment => segment !== undefined)
				.map(segmentToRange)
				.filter((range) => range.end > range.start);

			if (ranges.length === 0) {
				return null;
			}

			const speakerName = speakerNames.get(turn.speakerId) ?? turn.speakerId;
			const turnNumber = index + 1;
			return {
				duration: ranges.reduce((sum, range) => sum + range.end - range.start, 0),
				filename: `${sanitizeFilename(baseName)}-turn-${turnNumber.toString().padStart(3, "0")}-${sanitizeFilename(speakerName)}.wav`,
				id: turn.id,
				label: `Turn ${turnNumber} - ${speakerName}`,
				ranges,
			} satisfies AudioExportItem;
		})
		.filter((item): item is AudioExportItem => item !== null);
}

export function summarizeAudioExportItems(items: AudioExportItem[]): string {
	const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);
	return `${items.length} file${items.length === 1 ? "" : "s"} / ${formatDuration(totalDuration)}`;
}

export async function downloadAudioExportItems(
	audioUrl: string,
	items: AudioExportItem[]
): Promise<void> {
	if (items.length === 0) {
		throw new Error("No timed audio ranges are available to export.");
	}

	const audioBuffer = await decodeAudioUrl(audioUrl);
	for (const item of items) {
		const wavBytes = encodeAudioBufferRangesToWav(audioBuffer, item.ranges);
		const wavBuffer = wavBytes.buffer.slice(
			wavBytes.byteOffset,
			wavBytes.byteOffset + wavBytes.byteLength
		) as ArrayBuffer;
		const blob = new Blob([wavBuffer], { type: "audio/wav" });
		downloadBlob(blob, item.filename);
	}
}

export function encodeAudioBufferRangesToWav(
	audioBuffer: AudioBuffer,
	ranges: AudioExportRange[]
): Uint8Array {
	const channelData = stitchAudioBufferRanges(audioBuffer, ranges);
	return encodeWavBytes(channelData, audioBuffer.sampleRate);
}

export function encodeWavBytes(channelData: Float32Array[], sampleRate: number): Uint8Array {
	if (channelData.length === 0) {
		throw new Error("Cannot encode WAV without audio channels.");
	}
	const frameCount = channelData[0].length;
	const channelCount = channelData.length;
	const blockAlign = channelCount * WAV_BYTES_PER_SAMPLE;
	const byteRate = sampleRate * blockAlign;
	const dataByteLength = frameCount * blockAlign;
	const buffer = new ArrayBuffer(44 + dataByteLength);
	const view = new DataView(buffer);

	writeAscii(view, 0, "RIFF");
	view.setUint32(4, 36 + dataByteLength, true);
	writeAscii(view, 8, "WAVE");
	writeAscii(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channelCount, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, WAV_BITS_PER_SAMPLE, true);
	writeAscii(view, 36, "data");
	view.setUint32(40, dataByteLength, true);

	let offset = 44;
	for (let frame = 0; frame < frameCount; frame += 1) {
		for (let channel = 0; channel < channelCount; channel += 1) {
			const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0));
			const pcm = sample < 0 ? sample * 0x80_00 : sample * 0x7f_ff;
			view.setInt16(offset, Math.round(pcm), true);
			offset += WAV_BYTES_PER_SAMPLE;
		}
	}

	return new Uint8Array(buffer);
}

function segmentToRange(segment: Segment): AudioExportRange {
	return {
		end: parseTime(segment.endTime),
		id: segment.id,
		label: segment.text,
		start: parseTime(segment.startTime),
	};
}

function stitchAudioBufferRanges(
	audioBuffer: AudioBuffer,
	ranges: AudioExportRange[]
): Float32Array[] {
	const { numberOfChannels: channelCount, sampleRate } = audioBuffer;
	const frameRanges = ranges
		.map((range) => {
			const startFrame = Math.max(
				0,
				Math.min(audioBuffer.length, Math.floor(range.start * sampleRate))
			);
			const endFrame = Math.max(
				startFrame,
				Math.min(audioBuffer.length, Math.ceil(range.end * sampleRate))
			);
			return { endFrame, startFrame };
		})
		.filter((range) => range.endFrame > range.startFrame);
	const totalFrames = frameRanges.reduce(
		(sum, range) => sum + range.endFrame - range.startFrame,
		0
	);

	if (totalFrames === 0) {
		throw new Error("No audio samples overlap the selected transcript ranges.");
	}

	const outputChannels = Array.from({ length: channelCount }, () => new Float32Array(totalFrames));
	let outputOffset = 0;

	for (const range of frameRanges) {
		const frameLength = range.endFrame - range.startFrame;
		for (let channel = 0; channel < channelCount; channel += 1) {
			const source = audioBuffer.getChannelData(channel).subarray(range.startFrame, range.endFrame);
			outputChannels[channel].set(source, outputOffset);
		}
		outputOffset += frameLength;
	}

	return outputChannels;
}

async function decodeAudioUrl(audioUrl: string): Promise<AudioBuffer> {
	const response = await fetch(audioUrl);
	if (!response.ok) {
		throw new Error(`Unable to fetch audio for export (${response.status}).`);
	}
	const arrayBuffer = await response.arrayBuffer();
	const contextCtor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!contextCtor) {
		throw new Error("Audio export needs Web Audio support in this browser.");
	}
	const audioContext = new contextCtor();
	try {
		return await audioContext.decodeAudioData(arrayBuffer);
	} finally {
		await audioContext.close();
	}
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(FILENAME_EXTENSION_PATTERN, "")
			.replace(FILENAME_SEPARATOR_PATTERN, "-")
			.replace(LEADING_TRAILING_DASH_PATTERN, "")
			.slice(0, 80) || "export"
	);
}

function formatDuration(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remaining = Math.round(seconds % 60);
	return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

function writeAscii(view: DataView, offset: number, text: string): void {
	for (let index = 0; index < text.length; index += 1) {
		view.setUint8(offset + index, text.charCodeAt(index));
	}
}
