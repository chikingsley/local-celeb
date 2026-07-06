import { formatTime } from "@/lib/utils";
import {
	type FileMetaData,
	type Segment,
	SPEAKER_COLORS,
	type Speaker,
	type TranscriptSourceMeta,
	type WordTimestamp,
	type WordTimingStatus,
} from "@/types";

type UnknownRecord = Record<string, unknown>;

interface ProviderWord extends UnknownRecord {
	text?: unknown;
	word?: unknown;
	punctuated_word?: unknown;
	start?: unknown;
	end?: unknown;
	type?: unknown;
	speaker_id?: unknown;
	speaker?: unknown;
	logprob?: unknown;
}

interface SpeakerBuild {
	ids: Set<string>;
	names: Map<string, string>;
}

interface NormalizeMetaOptions {
	sourceFormat: TranscriptImportResult["sourceFormat"];
	filename: string;
	wrapper?: UnknownRecord;
	warnings?: string[];
	recordCount?: number;
	records?: TranscriptSourceMeta[];
}

interface BatchNormalizeResult {
	segments: Segment[];
	sources: TranscriptSourceMeta[];
}

export interface TranscriptImportResult {
	sourceFormat: "local-json" | "provider-json" | "scribe-jsonl" | "srt" | "vtt";
	segments: Segment[];
	speakers: Speaker[];
	meta: Partial<FileMetaData>;
	warnings: string[];
}

const DEFAULT_SEGMENT_GAP_SECONDS = 3;
const SOFT_MAX_SEGMENT_SECONDS = 14;

export function importTranscriptText(
	text: string,
	filename = "transcript"
): TranscriptImportResult {
	const trimmed = text.trim();
	if (!trimmed) {
		throw new Error("Transcript file is empty.");
	}

	const extension = filename.split(".").pop()?.toLowerCase() ?? "";
	if (extension === "srt") {
		return importSubtitle(trimmed, filename, "srt");
	}
	if (extension === "vtt" || trimmed.startsWith("WEBVTT")) {
		return importSubtitle(trimmed, filename, "vtt");
	}
	if (extension === "jsonl" || looksLikeJsonl(trimmed)) {
		return importJsonl(trimmed, filename);
	}
	if (extension === "json" || trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return importJson(trimmed, filename);
	}

	throw new Error("Unsupported transcript format. Use JSON, JSONL, SRT, or VTT.");
}

function importJson(text: string, filename: string): TranscriptImportResult {
	const parsed = JSON.parse(text) as unknown;
	const warnings: string[] = [];
	const speakerBuild = createSpeakerBuild();
	const normalized = normalizeJsonPayload(parsed, filename, warnings, speakerBuild);

	if (normalized.segments.length === 0) {
		throw new Error("No transcript segments or words were found in the JSON file.");
	}

	return {
		sourceFormat: normalized.sourceFormat,
		segments: normalized.segments,
		speakers: normalized.speakers ?? buildSpeakers(speakerBuild),
		meta: normalized.meta,
		warnings,
	};
}

function importJsonl(text: string, filename: string): TranscriptImportResult {
	const warnings: string[] = [];
	const speakerBuild = createSpeakerBuild();
	const segments: Segment[] = [];
	const recordSources: TranscriptSourceMeta[] = [];
	let offset = 0;
	let importedRecords = 0;

	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	for (const [recordIndex, line] of lines.entries()) {
		let record: unknown;
		try {
			record = JSON.parse(line);
		} catch {
			warnings.push(`Skipped JSONL line ${recordIndex + 1}: invalid JSON.`);
			continue;
		}

		const normalized = normalizeJsonPayload(record, filename, warnings, speakerBuild, {
			idPrefix: `record-${recordIndex + 1}`,
			timeOffset: offset,
		});
		if (normalized.segments.length === 0) {
			continue;
		}

		segments.push(...normalized.segments);
		if (normalized.meta.source) {
			recordSources.push(normalized.meta.source);
		}
		importedRecords += 1;
		offset = maxSegmentEnd(segments) + 2;
	}

	if (segments.length === 0) {
		throw new Error("No transcript segments or words were found in the JSONL file.");
	}
	if (importedRecords > 1) {
		warnings.push(
			`Imported ${importedRecords} JSONL records as one concatenated review transcript.`
		);
	}

	return {
		sourceFormat: "scribe-jsonl",
		segments,
		speakers: buildSpeakers(speakerBuild),
		meta: {
			name: filename,
			duration: maxSegmentEnd(segments),
			language: recordSources[0]?.languageCode ?? "",
			date: "",
			source: buildJsonlSourceMeta(filename, importedRecords, recordSources, warnings),
		},
		warnings,
	};
}

function normalizeJsonPayload(
	payload: unknown,
	filename: string,
	warnings: string[],
	speakerBuild: SpeakerBuild,
	options: { idPrefix?: string; timeOffset?: number } = {}
): {
	sourceFormat: "local-json" | "provider-json" | "scribe-jsonl";
	segments: Segment[];
	speakers?: Speaker[];
	meta: Partial<FileMetaData>;
} {
	const idPrefix = options.idPrefix ?? "import";
	const timeOffset = options.timeOffset ?? 0;

	if (Array.isArray(payload)) {
		const batch = normalizeBatchRecords(payload, warnings, speakerBuild, idPrefix, timeOffset);
		return {
			sourceFormat: "scribe-jsonl",
			segments: batch.segments,
			meta: {
				name: filename,
				duration: maxSegmentEnd(batch.segments),
				language: batch.sources[0]?.languageCode ?? "",
				date: "",
				source: buildJsonlSourceMeta(filename, batch.sources.length, batch.sources, warnings),
			},
		};
	}

	if (!isRecord(payload)) {
		return {
			sourceFormat: "provider-json",
			segments: [],
			meta: {
				name: filename,
				language: "",
				date: "",
				source: { format: "provider-json", filename },
			},
		};
	}

	const result = isRecord(payload.result) ? payload.result : undefined;
	const source = result ?? payload;
	const sourceFormat = result ? "provider-json" : "local-json";
	const wrapper = result ? omitKeys(payload, ["result"]) : undefined;

	if (Array.isArray(source.segments)) {
		const segments = source.segments.map((segment, index) =>
			normalizeSegment(segment, `${idPrefix}-segment-${index + 1}`, timeOffset, speakerBuild)
		);
		const cleanSegments = segments.filter((segment): segment is Segment => segment !== null);
		const speakers = Array.isArray(source.speakers)
			? normalizeSpeakers(source.speakers, speakerBuild)
			: undefined;
		return {
			sourceFormat,
			segments: cleanSegments,
			speakers,
			meta: normalizeMeta(source, cleanSegments, {
				filename,
				sourceFormat,
				wrapper,
			}),
		};
	}

	const rawResponse = isRecord(source.raw_response) ? source.raw_response : undefined;
	const words = arrayOfRecords(rawResponse?.words) ?? arrayOfRecords(source.words);
	if (words) {
		const segments = wordsToSegments(words, {
			idPrefix,
			timeOffset,
			speakerBuild,
		});
		return {
			sourceFormat: rawResponse ? "scribe-jsonl" : "provider-json",
			segments,
			meta: normalizeMeta(source, segments, {
				filename,
				sourceFormat: rawResponse ? "scribe-jsonl" : "provider-json",
				wrapper,
			}),
		};
	}

	const turns = arrayOfRecords(source.turns);
	if (turns) {
		const segments = turnsToSegments(turns, idPrefix, timeOffset, speakerBuild);
		return {
			sourceFormat: "provider-json",
			segments,
			meta: normalizeMeta(source, segments, {
				filename,
				sourceFormat: "provider-json",
				wrapper,
			}),
		};
	}

	if (typeof source.transcript === "string" || typeof source.text === "string") {
		const text = String(source.transcript ?? source.text).trim();
		if (text) {
			const duration =
				numberOrUndefined(source.duration) ?? numberOrUndefined(source.audio_duration_secs) ?? 0;
			const segment: Segment = {
				id: `${idPrefix}-transcript`,
				speakerId: "speaker_1",
				startTime: formatTime(timeOffset),
				endTime: formatTime(timeOffset + duration),
				text,
				wordTimingStatus: "absent",
			};
			addSpeaker(speakerBuild, "speaker_1");
			warnings.push("Imported transcript text without segment or word timing.");
			return {
				sourceFormat: "provider-json",
				segments: [segment],
				meta: normalizeMeta(source, [segment], {
					filename,
					sourceFormat: "provider-json",
					wrapper,
				}),
			};
		}
	}

	return {
		sourceFormat: "provider-json",
		segments: [],
		meta: normalizeMeta(source, [], {
			filename,
			sourceFormat: "provider-json",
			wrapper,
		}),
	};
}

function normalizeBatchRecords(
	records: unknown[],
	warnings: string[],
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): BatchNormalizeResult {
	const segments: Segment[] = [];
	const sources: TranscriptSourceMeta[] = [];
	let offset = timeOffset;
	for (const [index, record] of records.entries()) {
		const normalized = normalizeJsonPayload(record, "batch.json", warnings, speakerBuild, {
			idPrefix: `${idPrefix}-${index + 1}`,
			timeOffset: offset,
		});
		segments.push(...normalized.segments);
		if (normalized.meta.source) {
			sources.push(normalized.meta.source);
		}
		offset = maxSegmentEnd(segments) + 2;
	}
	return { segments, sources };
}

function normalizeSegment(
	input: unknown,
	fallbackId: string,
	timeOffset: number,
	speakerBuild: SpeakerBuild
): Segment | null {
	if (!isRecord(input)) return null;

	const text = stringOrUndefined(input.text)?.trim();
	if (!text) return null;

	const start = timeFromAny(input.startTime ?? input.start ?? input.start_time) + timeOffset;
	const endCandidate = timeFromAny(input.endTime ?? input.end ?? input.end_time) + timeOffset;
	const end = endCandidate > start ? endCandidate : start + 1;
	const speakerId = speakerIdFrom(input.speakerId ?? input.speaker_id ?? input.speaker);
	addSpeaker(speakerBuild, speakerId);

	const words = arrayOfRecords(input.words)
		?.map((word) => normalizeWordTimestamp(word, timeOffset))
		.filter((word): word is WordTimestamp => word !== null);
	const wordTimingStatus = inferWordTimingStatus(
		text,
		words,
		stringOrUndefined(input.wordTimingStatus),
		input.wordsDirty === true
	);

	return {
		id: stringOrUndefined(input.id) ?? fallbackId,
		speakerId,
		startTime: formatTime(start),
		endTime: formatTime(end),
		text,
		...(words && words.length > 0 ? { words } : {}),
		...(input.wordsDirty === true ? { wordsDirty: true } : {}),
		wordTimingStatus,
	};
}

function wordsToSegments(
	words: ProviderWord[],
	options: { idPrefix: string; timeOffset: number; speakerBuild: SpeakerBuild }
): Segment[] {
	const segments: Segment[] = [];
	let currentSpeaker = "speaker_1";
	let currentStart = 0;
	let currentEnd = 0;
	let textParts: string[] = [];
	let segmentWords: WordTimestamp[] = [];

	const flush = () => {
		const text = textParts.join("").trim();
		if (!text) {
			textParts = [];
			segmentWords = [];
			return;
		}
		const id = `${options.idPrefix}-segment-${segments.length + 1}`;
		const wordTimingStatus = inferWordTimingStatus(text, segmentWords, undefined, false);
		segments.push({
			id,
			speakerId: currentSpeaker,
			startTime: formatTime(currentStart + options.timeOffset),
			endTime: formatTime(Math.max(currentEnd, currentStart + 0.1) + options.timeOffset),
			text,
			...(segmentWords.length > 0 ? { words: segmentWords } : {}),
			wordTimingStatus,
		});
		textParts = [];
		segmentWords = [];
	};

	for (const item of words) {
		const kind = stringOrUndefined(item.type) ?? "word";
		if (kind === "spacing") {
			if (textParts.length > 0) {
				textParts.push(stringOrUndefined(item.text) ?? " ");
			}
			continue;
		}
		if (kind !== "word") {
			continue;
		}

		const text = wordText(item);
		if (!text) continue;

		const speaker = speakerIdFrom(item.speaker_id ?? item.speaker, "speaker_0");
		const startValue = numberOrUndefined(item.start);
		const endValue = numberOrUndefined(item.end);
		const hasProviderTiming = startValue !== undefined && endValue !== undefined;
		const start = startValue ?? currentEnd;
		const end = endValue ?? start + estimateWordDuration(text);
		const gap = textParts.length > 0 ? start - currentEnd : 0;
		const previousText = lastVisibleText(textParts);
		const shouldSoftSplit =
			textParts.length > 0 &&
			currentEnd - currentStart >= SOFT_MAX_SEGMENT_SECONDS &&
			endsSentence(previousText);

		if (
			textParts.length > 0 &&
			(speaker !== currentSpeaker || gap > DEFAULT_SEGMENT_GAP_SECONDS || shouldSoftSplit)
		) {
			flush();
		}

		if (textParts.length === 0) {
			currentSpeaker = speaker;
			currentStart = start;
			addSpeaker(options.speakerBuild, speaker);
		}

		if (
			textParts.length > 0 &&
			!textParts[textParts.length - 1].endsWith(" ") &&
			!joinsPrevious(text)
		) {
			textParts.push(" ");
		}
		textParts.push(text);
		currentEnd = Math.max(end, start);
		if (hasProviderTiming) {
			segmentWords.push({
				word: text,
				start: start + options.timeOffset,
				end: Math.max(end, start) + options.timeOffset,
				...wordQuality(item),
			});
		}
	}

	flush();
	return segments;
}

function turnsToSegments(
	turns: UnknownRecord[],
	idPrefix: string,
	timeOffset: number,
	speakerBuild: SpeakerBuild
): Segment[] {
	return turns
		.map((turn, index): Segment | null => {
			const text = stringOrUndefined(turn.text ?? turn.transcript)?.trim();
			if (!text) return null;
			const speakerId = speakerIdFrom(
				turn.speaker_id ?? turn.speaker ?? turn.speakerId,
				"speaker_0"
			);
			addSpeaker(speakerBuild, speakerId);
			const start = timeFromAny(turn.start ?? turn.startTime) + timeOffset;
			const endCandidate = timeFromAny(turn.end ?? turn.endTime) + timeOffset;
			return {
				id: stringOrUndefined(turn.id) ?? `${idPrefix}-turn-${index + 1}`,
				speakerId,
				startTime: formatTime(start),
				endTime: formatTime(endCandidate > start ? endCandidate : start + 1),
				text,
				wordTimingStatus: "absent",
			} satisfies Segment;
		})
		.filter((segment): segment is Segment => segment !== null);
}

function importSubtitle(
	text: string,
	filename: string,
	sourceFormat: "srt" | "vtt"
): TranscriptImportResult {
	const speakerBuild = createSpeakerBuild();
	const cueBlocks = text
		.replace(/\r\n/g, "\n")
		.replace(/^WEBVTT[^\n]*\n+/i, "")
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean);
	const segments: Segment[] = [];

	for (const block of cueBlocks) {
		if (block.startsWith("NOTE")) continue;

		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
		if (timeLineIndex === -1) continue;

		const timeMatch = lines[timeLineIndex].match(/(.+?)\s+-->\s+([^\s]+)/);
		if (!timeMatch) continue;

		const rawText = lines
			.slice(timeLineIndex + 1)
			.join(" ")
			.trim();
		if (!rawText) continue;

		const voice = rawText.match(/^<v\s+([^>]+)>(.*)$/i);
		const speakerName = voice?.[1]?.trim();
		const speakerId = speakerName ? slugSpeakerId(speakerName) : "speaker_1";
		const cleanText = stripCueMarkup(voice?.[2] ?? rawText);
		if (!cleanText) continue;

		addSpeaker(speakerBuild, speakerId, speakerName);
		segments.push({
			id: `${sourceFormat}-${segments.length + 1}`,
			speakerId,
			startTime: formatTime(parseSubtitleTime(timeMatch[1])),
			endTime: formatTime(parseSubtitleTime(timeMatch[2])),
			text: cleanText,
			wordTimingStatus: "absent",
		});
	}

	if (segments.length === 0) {
		throw new Error(`No cues were found in ${sourceFormat.toUpperCase()} file.`);
	}

	return {
		sourceFormat,
		segments,
		speakers: buildSpeakers(speakerBuild),
		meta: {
			name: filename,
			duration: maxSegmentEnd(segments),
			language: "",
			date: "",
		},
		warnings: [],
	};
}

function normalizeWordTimestamp(input: UnknownRecord, timeOffset: number): WordTimestamp | null {
	const text = stringOrUndefined(input.word ?? input.text ?? input.punctuated_word)?.trim();
	const start = numberOrUndefined(input.start);
	const end = numberOrUndefined(input.end);
	if (!text || start === undefined || end === undefined) return null;
	return {
		word: text,
		start: start + timeOffset,
		end: Math.max(end, start) + timeOffset,
		...(input.interpolated === true ? { interpolated: true } : {}),
		...wordQuality(input),
	};
}

function inferWordTimingStatus(
	text: string,
	words: WordTimestamp[] | undefined,
	explicit: string | undefined,
	wordsDirty: boolean
): WordTimingStatus {
	if (wordsDirty) return "dirty";
	if (isWordTimingStatus(explicit)) return explicit;
	if (!words || words.length === 0) return "absent";
	if (words.some((word) => word.interpolated)) return "estimated";
	return words.length < countWords(text) ? "estimated" : "provider";
}

function isWordTimingStatus(value: string | undefined): value is WordTimingStatus {
	return (
		value === "provider" ||
		value === "manual" ||
		value === "estimated" ||
		value === "absent" ||
		value === "dirty"
	);
}

function wordQuality(input: UnknownRecord): Partial<WordTimestamp> {
	return removeUndefined({
		confidence: numberOrUndefined(input.confidence),
		logprob: numberOrUndefined(input.logprob),
	});
}

function normalizeSpeakers(input: unknown[], speakerBuild: SpeakerBuild): Speaker[] | undefined {
	const speakers = input
		.map((speaker, index) => {
			if (!isRecord(speaker)) return null;
			const id = stringOrUndefined(speaker.id);
			const name = stringOrUndefined(speaker.name);
			if (!id || !name) return null;
			const color =
				stringOrUndefined(speaker.color) ?? SPEAKER_COLORS[index % SPEAKER_COLORS.length];
			addSpeaker(speakerBuild, id, name);
			return { id, name, color };
		})
		.filter((speaker): speaker is Speaker => speaker !== null);
	return speakers.length > 0 ? speakers : undefined;
}

function normalizeMeta(
	source: UnknownRecord,
	segments: Segment[],
	options: NormalizeMetaOptions
): Partial<FileMetaData> {
	const rawMeta = isRecord(source.meta) ? source.meta : source;
	const rawResponse = isRecord(source.raw_response) ? source.raw_response : undefined;
	return {
		name: stringOrUndefined(rawMeta.name) ?? options.filename,
		duration:
			numberOrUndefined(rawMeta.duration) ??
			numberOrUndefined(rawMeta.audio_duration_secs) ??
			numberOrUndefined(rawResponse?.audio_duration_secs) ??
			maxSegmentEnd(segments),
		language:
			stringOrUndefined(rawMeta.language ?? rawMeta.language_code ?? rawResponse?.language_code) ??
			"",
		date: stringOrUndefined(rawMeta.date ?? rawMeta.datetime) ?? "",
		source: buildSourceMeta(source, options),
	};
}

function buildJsonlSourceMeta(
	filename: string,
	recordCount: number,
	records: TranscriptSourceMeta[],
	warnings: string[]
): TranscriptSourceMeta {
	const first = records[0];
	return removeUndefined({
		format: "scribe-jsonl",
		filename,
		provider: first?.provider,
		model: first?.model,
		modelId: first?.modelId,
		modelKey: first?.modelKey,
		languageCode: first?.languageCode,
		languageProbability: first?.languageProbability,
		timingSource: first?.timingSource,
		timestampsRequested: first?.timestampsRequested,
		timestampsIncluded: first?.timestampsIncluded,
		recordCount,
		records: records.map(compactSourceRecord),
		warnings: warnings.length > 0 ? warnings : undefined,
	});
}

function buildSourceMeta(
	source: UnknownRecord,
	options: NormalizeMetaOptions
): TranscriptSourceMeta {
	const rawMeta = isRecord(source.meta) ? source.meta : source;
	const existingSource = isRecord(rawMeta.source) ? rawMeta.source : undefined;
	const rawResponse = isRecord(source.raw_response) ? source.raw_response : undefined;
	const transcriptJson = isRecord(source.transcript_json) ? source.transcript_json : undefined;
	const timing = isRecord(source.timing)
		? source.timing
		: isRecord(transcriptJson?.timing)
			? transcriptJson.timing
			: undefined;
	const serviceSource = isRecord(source.source) ? source.source : undefined;

	return removeUndefined({
		...(existingSource ? sanitizeRecord(existingSource) : {}),
		format: options.sourceFormat,
		filename: options.filename,
		provider: stringOrUndefined(rawMeta.provider),
		model: stringOrUndefined(rawMeta.model ?? rawMeta.asr_model),
		modelId: stringOrUndefined(rawMeta.model_id),
		modelKey: stringOrUndefined(rawMeta.model_key),
		audioPath: stringOrUndefined(rawMeta.audio_path ?? rawMeta.path),
		audioDuration:
			numberOrUndefined(rawMeta.audio_duration_secs) ??
			numberOrUndefined(rawMeta.duration) ??
			numberOrUndefined(rawResponse?.audio_duration_secs),
		processingTime: numberOrUndefined(rawMeta.processing_time),
		recordingId: stringOrUndefined(rawMeta.recording_id),
		transcriptionId: stringOrUndefined(rawResponse?.transcription_id),
		languageCode: stringOrUndefined(
			rawResponse?.language_code ?? rawMeta.language_code ?? rawMeta.language
		),
		languageProbability: numberOrUndefined(rawResponse?.language_probability),
		detail: stringArray(rawMeta.detail ?? transcriptJson?.detail),
		timestampsRequested: booleanOrUndefined(timing?.timestamps_requested ?? rawMeta.timestamps),
		timestampsIncluded: booleanOrUndefined(timing?.timestamps_included),
		timingSource: stringOrUndefined(timing?.source ?? transcriptJson?.timing_source),
		serviceMode: stringOrUndefined(rawMeta.mode ?? transcriptJson?.mode),
		jobId: stringOrUndefined(rawMeta.job_id ?? rawMeta.jobId ?? options.wrapper?.job_id),
		sourceKind: stringOrUndefined(serviceSource?.source),
		inputKey: stringOrUndefined(serviceSource?.input_key ?? rawMeta.input_key),
		outputArtifacts: stringArray(rawMeta.output_artifacts ?? transcriptJson?.output_artifacts),
		recordCount: options.recordCount,
		warnings: options.warnings && options.warnings.length > 0 ? options.warnings : undefined,
		rawResponse: rawResponse ? summarizeProviderPayload(rawResponse) : undefined,
		resultWrapper: options.wrapper ? summarizeProviderPayload(options.wrapper) : undefined,
		records: options.records?.map(compactSourceRecord),
	});
}

function compactSourceRecord(source: TranscriptSourceMeta): TranscriptSourceMeta {
	return removeUndefined({
		format: source.format,
		filename: source.filename,
		provider: source.provider,
		model: source.model,
		modelId: source.modelId,
		modelKey: source.modelKey,
		audioPath: source.audioPath,
		audioDuration: source.audioDuration,
		processingTime: source.processingTime,
		recordingId: source.recordingId,
		transcriptionId: source.transcriptionId,
		languageCode: source.languageCode,
		languageProbability: source.languageProbability,
		timestampsRequested: source.timestampsRequested,
		timestampsIncluded: source.timestampsIncluded,
		timingSource: source.timingSource,
		rawResponse: source.rawResponse,
	});
}

function summarizeProviderPayload(record: UnknownRecord): UnknownRecord {
	const summary: UnknownRecord = {};
	for (const [key, value] of Object.entries(record)) {
		if (Array.isArray(value)) {
			summary[key] = key === "words" ? summarizeProviderWords(value) : summarizeArray(value);
		} else if (isRecord(value)) {
			summary[key] = summarizeProviderPayload(value);
		} else {
			summary[key] = value;
		}
	}
	return summary;
}

function summarizeProviderWords(words: unknown[]): UnknownRecord {
	const typeCounts = new Map<string, number>();
	const speakerIds = new Set<string>();

	for (const item of words) {
		if (!isRecord(item)) continue;
		const type = stringOrUndefined(item.type) ?? "word";
		typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
		const speaker = stringOrUndefined(item.speaker_id ?? item.speaker);
		if (speaker) speakerIds.add(speaker);
	}

	return {
		count: words.length,
		typeCounts: Object.fromEntries(typeCounts),
		speakerIds: Array.from(speakerIds).sort(),
		first: words.slice(0, 3).map(sanitizeValue),
		last: words.slice(-3).map(sanitizeValue),
	};
}

function summarizeArray(values: unknown[]): UnknownRecord {
	return {
		count: values.length,
		first: values.slice(0, 3).map(sanitizeValue),
		last: values.slice(-3).map(sanitizeValue),
	};
}

function sanitizeRecord(record: UnknownRecord): UnknownRecord {
	const sanitized: UnknownRecord = {};
	for (const [key, value] of Object.entries(record)) {
		sanitized[key] = sanitizeValue(value);
	}
	return sanitized;
}

function sanitizeValue(value: unknown): unknown {
	if (Array.isArray(value)) return summarizeArray(value);
	if (isRecord(value)) return sanitizeRecord(value);
	return value;
}

function removeUndefined<T extends Record<string, unknown>>(record: T): T {
	return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

function buildSpeakers(build: SpeakerBuild): Speaker[] {
	const ids = Array.from(build.ids);
	if (ids.length === 0) {
		ids.push("speaker_1");
	}
	return ids.map((id, index) => ({
		id,
		name: build.names.get(id) ?? titleSpeaker(id, index),
		color: SPEAKER_COLORS[index % SPEAKER_COLORS.length],
	}));
}

function createSpeakerBuild(): SpeakerBuild {
	return { ids: new Set<string>(), names: new Map<string, string>() };
}

function addSpeaker(build: SpeakerBuild, id: string, name?: string): void {
	build.ids.add(id);
	if (name) {
		build.names.set(id, name);
	}
}

function maxSegmentEnd(segments: Segment[]): number {
	return Math.max(0, ...segments.map((segment) => timeFromAny(segment.endTime)));
}

function timeFromAny(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return 0;
	if (value.includes(":")) {
		const normalized = value.replace(",", ".");
		const parts = normalized.split(":").map(Number);
		if (parts.some((part) => Number.isNaN(part))) return 0;
		if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
		if (parts.length === 2) return parts[0] * 60 + parts[1];
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
}

function parseSubtitleTime(value: string): number {
	return timeFromAny(value.trim());
}

function stripCueMarkup(value: string): string {
	return value
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function speakerIdFrom(value: unknown, fallback = "speaker_1"): string {
	if (value === undefined || value === null || value === "") return fallback;
	if (typeof value === "number") return `speaker_${value}`;
	const text = String(value).trim();
	if (!text) return fallback;
	const normalized = text.toLowerCase().replace(/[\s-]+/g, "_");
	if (/^speaker_\d+$/.test(normalized)) return normalized;
	return normalized.startsWith("speaker_") ? normalized : slugSpeakerId(text);
}

function slugSpeakerId(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return slug ? `speaker_${slug}` : "speaker_1";
}

function titleSpeaker(id: string, index: number): string {
	const raw = id
		.replace(/^speaker_/, "")
		.replace(/_/g, " ")
		.trim();
	if (!raw || /^\d+$/.test(raw)) return `Speaker ${index + 1}`;
	return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function wordText(item: ProviderWord): string {
	return stringOrUndefined(item.text ?? item.punctuated_word ?? item.word)?.trim() ?? "";
}

function lastVisibleText(parts: string[]): string {
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const text = parts[index].trim();
		if (text) return text;
	}
	return "";
}

function endsSentence(value: string): boolean {
	return /[.!?]["')\]]?$/.test(value);
}

function joinsPrevious(value: string): boolean {
	return /^[.,!?;:%)\]}]/.test(value) || value.startsWith("'");
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function estimateWordDuration(text: string): number {
	return Math.max(0.18, Math.min(0.65, text.length * 0.055));
}

function looksLikeJsonl(value: string): boolean {
	const lines = value.split(/\r?\n/).filter((line) => line.trim());
	return lines.length > 1 && lines.slice(0, 3).every((line) => line.trim().startsWith("{"));
}

function arrayOfRecords(value: unknown): UnknownRecord[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const records = value.filter(isRecord);
	return records.length > 0 ? records : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const strings = value.filter((item): item is string => typeof item === "string");
	return strings.length > 0 ? strings : undefined;
}

function omitKeys(record: UnknownRecord, keys: string[]): UnknownRecord {
	const omitted = new Set(keys);
	return Object.fromEntries(Object.entries(record).filter(([key]) => !omitted.has(key)));
}
