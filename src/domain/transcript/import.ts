import { formatTime } from "@/lib/utils";
import { SPEAKER_COLORS } from "./constants";
import type {
	FileMetaData,
	Segment,
	Speaker,
	TranscriptSourceMeta,
	WordTimestamp,
	WordTimingStatus,
} from "./types";

type UnknownRecord = Record<string, unknown>;

interface ProviderWord extends UnknownRecord {
	end?: unknown;
	logprob?: unknown;
	punctuated_word?: unknown;
	speaker?: unknown;
	speaker_id?: unknown;
	start?: unknown;
	text?: unknown;
	type?: unknown;
	word?: unknown;
}

interface SpeakerBuild {
	ids: Set<string>;
	names: Map<string, string>;
}

interface NormalizeMetaOptions {
	filename: string;
	recordCount?: number;
	records?: TranscriptSourceMeta[];
	sourceFormat: TranscriptImportResult["sourceFormat"];
	warnings?: string[];
	wrapper?: UnknownRecord;
}

interface BatchNormalizeResult {
	segments: Segment[];
	sources: TranscriptSourceMeta[];
}

interface NormalizePayloadOptions {
	idPrefix?: string;
	timeOffset?: number;
}

interface NormalizedJsonPayload {
	meta: Partial<FileMetaData>;
	segments: Segment[];
	sourceFormat: "local-json" | "provider-json" | "scribe-jsonl";
	speakers?: Speaker[];
}

interface JsonSourceContext {
	source: UnknownRecord;
	sourceFormat: "local-json" | "provider-json";
	wrapper?: UnknownRecord;
}

interface WordsToSegmentsOptions {
	idPrefix: string;
	speakerBuild: SpeakerBuild;
	timeOffset: number;
}

interface WordsToSegmentsState {
	currentEnd: number;
	currentSpeaker: string;
	currentStart: number;
	segments: Segment[];
	segmentWords: WordTimestamp[];
	textParts: string[];
}

interface ProviderWordTiming {
	end: number;
	hasProviderTiming: boolean;
	start: number;
}

export interface TranscriptImportResult {
	meta: Partial<FileMetaData>;
	segments: Segment[];
	sourceFormat: "local-json" | "provider-json" | "scribe-jsonl" | "srt" | "vtt";
	speakers: Speaker[];
	warnings: string[];
}

const DEFAULT_SEGMENT_GAP_SECONDS = 3;
const SOFT_MAX_SEGMENT_SECONDS = 14;
const CUE_BLOCK_SEPARATOR_PATTERN = /\n{2,}/;
const CUE_MARKUP_PATTERN = /<[^>]+>/g;
const LINE_BREAK_PATTERN = /\r?\n/;
const SRT_LINE_BREAK_PATTERN = /\r\n/g;
const SPEAKER_ID_PATTERN = /^speaker_\d+$/;
const SPEAKER_NUMBER_PATTERN = /^\d+$/;
const SPEAKER_PREFIX_PATTERN = /^speaker_/;
const SUBTITLE_TIME_PATTERN = /(.+?)\s+-->\s+([^\s]+)/;
const TITLE_WORD_PATTERN = /\b\w/g;
const TRAILING_SENTENCE_PATTERN = /[.!?]["')\]]?$/;
const VTT_HEADER_PATTERN = /^WEBVTT[^\n]*\n+/i;
const VTT_VOICE_PATTERN = /^<v\s+([^>]+)>(.*)$/i;
const WORD_SEPARATOR_PATTERN = /\s+/;
const WORD_SEPARATOR_OR_DASH_PATTERN = /[\s-]+/g;
const SPEAKER_SLUG_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const SPEAKER_SLUG_TRIM_PATTERN = /^_+|_+$/g;
const PUNCTUATION_PREFIX_PATTERN = /^[.,!?;:%)\]}]/;

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
		meta: normalized.meta,
		segments: normalized.segments,
		sourceFormat: normalized.sourceFormat,
		speakers: normalized.speakers ?? buildSpeakers(speakerBuild),
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

	const lines = text.split(LINE_BREAK_PATTERN).filter((line) => line.trim().length > 0);
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
		meta: {
			date: "",
			duration: maxSegmentEnd(segments),
			language: recordSources[0]?.languageCode ?? "",
			name: filename,
			source: buildJsonlSourceMeta(filename, importedRecords, recordSources, warnings),
		},
		segments,
		sourceFormat: "scribe-jsonl",
		speakers: buildSpeakers(speakerBuild),
		warnings,
	};
}

function normalizeJsonPayload(
	payload: unknown,
	filename: string,
	warnings: string[],
	speakerBuild: SpeakerBuild,
	options: NormalizePayloadOptions = {}
): NormalizedJsonPayload {
	const idPrefix = options.idPrefix ?? "import";
	const timeOffset = options.timeOffset ?? 0;

	if (Array.isArray(payload)) {
		return normalizeArrayPayload(payload, filename, warnings, speakerBuild, idPrefix, timeOffset);
	}

	if (!isRecord(payload)) {
		return emptyProviderPayload(filename);
	}

	return normalizeRecordPayload(payload, filename, warnings, speakerBuild, idPrefix, timeOffset);
}

function normalizeArrayPayload(
	payload: unknown[],
	filename: string,
	warnings: string[],
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): NormalizedJsonPayload {
	const batch = normalizeBatchRecords(payload, warnings, speakerBuild, idPrefix, timeOffset);
	return {
		meta: {
			date: "",
			duration: maxSegmentEnd(batch.segments),
			language: batch.sources[0]?.languageCode ?? "",
			name: filename,
			source: buildJsonlSourceMeta(filename, batch.sources.length, batch.sources, warnings),
		},
		segments: batch.segments,
		sourceFormat: "scribe-jsonl",
	};
}

function emptyProviderPayload(filename: string): NormalizedJsonPayload {
	return {
		meta: {
			date: "",
			language: "",
			name: filename,
			source: { filename, format: "provider-json" },
		},
		segments: [],
		sourceFormat: "provider-json",
	};
}

function jsonSourceContext(payload: UnknownRecord): JsonSourceContext {
	const result = isRecord(payload.result) ? payload.result : undefined;
	const source = result ?? payload;
	const sourceFormat = result ? "provider-json" : "local-json";
	const wrapper = result ? omitKeys(payload, ["result"]) : undefined;
	return { source, sourceFormat, wrapper };
}

function normalizeRecordPayload(
	payload: UnknownRecord,
	filename: string,
	warnings: string[],
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): NormalizedJsonPayload {
	const context = jsonSourceContext(payload);
	return (
		normalizeSegmentsPayload(context, filename, speakerBuild, idPrefix, timeOffset) ??
		normalizeWordsPayload(context, filename, speakerBuild, idPrefix, timeOffset) ??
		normalizeTurnsPayload(context, filename, speakerBuild, idPrefix, timeOffset) ??
		normalizeTextPayload(context, filename, warnings, speakerBuild, idPrefix, timeOffset) ??
		emptyRecordPayload(context.source, filename, context.wrapper)
	);
}

function normalizeSegmentsPayload(
	{ source, sourceFormat, wrapper }: JsonSourceContext,
	filename: string,
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): NormalizedJsonPayload | undefined {
	if (!Array.isArray(source.segments)) {
		return;
	}

	const segments = source.segments.map((segment, index) =>
		normalizeSegment(segment, `${idPrefix}-segment-${index + 1}`, timeOffset, speakerBuild)
	);
	const cleanSegments = segments.filter((segment): segment is Segment => segment !== null);
	const speakers = Array.isArray(source.speakers)
		? normalizeSpeakers(source.speakers, speakerBuild)
		: undefined;
	return {
		meta: normalizeMeta(source, cleanSegments, {
			filename,
			sourceFormat,
			wrapper,
		}),
		segments: cleanSegments,
		sourceFormat,
		speakers,
	};
}

function normalizeWordsPayload(
	{ source, wrapper }: JsonSourceContext,
	filename: string,
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): NormalizedJsonPayload | undefined {
	const rawResponse = isRecord(source.raw_response) ? source.raw_response : undefined;
	const words = arrayOfRecords(rawResponse?.words) ?? arrayOfRecords(source.words);
	if (!words) {
		return;
	}

	const segments = wordsToSegments(words, {
		idPrefix,
		speakerBuild,
		timeOffset,
	});
	const sourceFormat = rawResponse ? "scribe-jsonl" : "provider-json";
	return {
		meta: normalizeMeta(source, segments, {
			filename,
			sourceFormat,
			wrapper,
		}),
		segments,
		sourceFormat,
	};
}

function normalizeTurnsPayload(
	{ source, wrapper }: JsonSourceContext,
	filename: string,
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): NormalizedJsonPayload | undefined {
	const turns = arrayOfRecords(source.turns);
	if (!turns) {
		return;
	}

	const segments = turnsToSegments(turns, idPrefix, timeOffset, speakerBuild);
	return {
		meta: normalizeMeta(source, segments, {
			filename,
			sourceFormat: "provider-json",
			wrapper,
		}),
		segments,
		sourceFormat: "provider-json",
	};
}

function normalizeTextPayload(
	{ source, wrapper }: JsonSourceContext,
	filename: string,
	warnings: string[],
	speakerBuild: SpeakerBuild,
	idPrefix: string,
	timeOffset: number
): NormalizedJsonPayload | undefined {
	const text = stringOrUndefined(source.transcript ?? source.text)?.trim();
	if (!text) {
		return;
	}

	const duration =
		numberOrUndefined(source.duration) ?? numberOrUndefined(source.audio_duration_secs) ?? 0;
	const segment: Segment = {
		endTime: formatTime(timeOffset + duration),
		id: `${idPrefix}-transcript`,
		speakerId: "speaker_1",
		startTime: formatTime(timeOffset),
		text,
		wordTimingStatus: "absent",
	};
	addSpeaker(speakerBuild, "speaker_1");
	warnings.push("Imported transcript text without segment or word timing.");
	return {
		meta: normalizeMeta(source, [segment], {
			filename,
			sourceFormat: "provider-json",
			wrapper,
		}),
		segments: [segment],
		sourceFormat: "provider-json",
	};
}

function emptyRecordPayload(
	source: UnknownRecord,
	filename: string,
	wrapper: UnknownRecord | undefined
): NormalizedJsonPayload {
	return {
		meta: normalizeMeta(source, [], {
			filename,
			sourceFormat: "provider-json",
			wrapper,
		}),
		segments: [],
		sourceFormat: "provider-json",
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
	if (!isRecord(input)) {
		return null;
	}

	const text = stringOrUndefined(input.text)?.trim();
	if (!text) {
		return null;
	}

	const start = timeFromAny(input.startTime ?? input.start ?? input.start_time) + timeOffset;
	const endCandidate = timeFromAny(input.endTime ?? input.end ?? input.end_time) + timeOffset;
	const end = endCandidate > start ? endCandidate : start + 1;
	const speakerId = speakerIdFrom(input.speakerId ?? input.speaker_id ?? input.speaker);
	addSpeaker(speakerBuild, speakerId);

	const wordRecords = arrayOfRecords(input.words);
	const words = wordRecords
		? wordRecords
				.map((word) => normalizeWordTimestamp(word, timeOffset))
				.filter((word): word is WordTimestamp => word !== null)
		: undefined;
	const wordTimingStatus = inferWordTimingStatus(
		text,
		words,
		stringOrUndefined(input.wordTimingStatus),
		input.wordsDirty === true
	);

	const segment: Segment = {
		endTime: formatTime(end),
		id: stringOrUndefined(input.id) ?? fallbackId,
		speakerId,
		startTime: formatTime(start),
		text,
		wordTimingStatus,
	};
	if (words && words.length > 0) {
		segment.words = words;
	}
	if (input.wordsDirty === true) {
		segment.wordsDirty = true;
	}
	return segment;
}

function wordsToSegments(words: ProviderWord[], options: WordsToSegmentsOptions): Segment[] {
	const state = createWordsToSegmentsState();

	for (const item of words) {
		const kind = stringOrUndefined(item.type) ?? "word";
		if (kind === "spacing") {
			appendSpacingWord(state, item);
			continue;
		}
		if (kind !== "word") {
			continue;
		}
		appendProviderWordSegment(state, item, options);
	}

	flushWordSegment(state, options);
	return state.segments;
}

function createWordsToSegmentsState(): WordsToSegmentsState {
	return {
		currentEnd: 0,
		currentSpeaker: "speaker_1",
		currentStart: 0,
		segments: [],
		segmentWords: [],
		textParts: [],
	};
}

function flushWordSegment(state: WordsToSegmentsState, options: WordsToSegmentsOptions) {
	const text = state.textParts.join("").trim();
	if (!text) {
		state.textParts = [];
		state.segmentWords = [];
		return;
	}

	const wordTimingStatus = inferWordTimingStatus(text, state.segmentWords, undefined, false);
	state.segments.push({
		endTime: formatTime(Math.max(state.currentEnd, state.currentStart + 0.1) + options.timeOffset),
		id: `${options.idPrefix}-segment-${state.segments.length + 1}`,
		speakerId: state.currentSpeaker,
		startTime: formatTime(state.currentStart + options.timeOffset),
		text,
		...(state.segmentWords.length > 0 ? { words: state.segmentWords } : {}),
		wordTimingStatus,
	});
	state.textParts = [];
	state.segmentWords = [];
}

function appendSpacingWord(state: WordsToSegmentsState, item: ProviderWord) {
	if (state.textParts.length > 0) {
		state.textParts.push(stringOrUndefined(item.text) ?? " ");
	}
}

function appendProviderWordSegment(
	state: WordsToSegmentsState,
	item: ProviderWord,
	options: WordsToSegmentsOptions
) {
	const text = wordText(item);
	if (!text) {
		return;
	}

	const speaker = speakerIdFrom(item.speaker_id ?? item.speaker, "speaker_0");
	const timing = providerWordTiming(item, state.currentEnd, text);
	if (shouldFlushWordSegment(state, speaker, timing.start)) {
		flushWordSegment(state, options);
	}
	if (state.textParts.length === 0) {
		startWordSegment(state, speaker, timing.start, options.speakerBuild);
	}

	appendWordText(state, text);
	state.currentEnd = Math.max(timing.end, timing.start);
	appendWordTimestamp(state, item, text, timing, options.timeOffset);
}

function providerWordTiming(
	item: ProviderWord,
	currentEnd: number,
	text: string
): ProviderWordTiming {
	const startValue = numberOrUndefined(item.start);
	const endValue = numberOrUndefined(item.end);
	const start = startValue ?? currentEnd;
	return {
		end: endValue ?? start + estimateWordDuration(text),
		hasProviderTiming: startValue !== undefined && endValue !== undefined,
		start,
	};
}

function shouldFlushWordSegment(
	state: WordsToSegmentsState,
	speaker: string,
	start: number
): boolean {
	if (state.textParts.length === 0) {
		return false;
	}
	const gap = start - state.currentEnd;
	const shouldSoftSplit =
		state.currentEnd - state.currentStart >= SOFT_MAX_SEGMENT_SECONDS &&
		endsSentence(lastVisibleText(state.textParts));
	return speaker !== state.currentSpeaker || gap > DEFAULT_SEGMENT_GAP_SECONDS || shouldSoftSplit;
}

function startWordSegment(
	state: WordsToSegmentsState,
	speaker: string,
	start: number,
	speakerBuild: SpeakerBuild
) {
	state.currentSpeaker = speaker;
	state.currentStart = start;
	addSpeaker(speakerBuild, speaker);
}

function appendWordText(state: WordsToSegmentsState, text: string) {
	if (
		state.textParts.length > 0 &&
		!state.textParts.at(-1)?.endsWith(" ") &&
		!joinsPrevious(text)
	) {
		state.textParts.push(" ");
	}
	state.textParts.push(text);
}

function appendWordTimestamp(
	state: WordsToSegmentsState,
	item: ProviderWord,
	text: string,
	timing: ProviderWordTiming,
	timeOffset: number
) {
	if (!timing.hasProviderTiming) {
		return;
	}
	state.segmentWords.push({
		end: Math.max(timing.end, timing.start) + timeOffset,
		start: timing.start + timeOffset,
		word: text,
		...wordQuality(item),
	});
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
			if (!text) {
				return null;
			}
			const speakerId = speakerIdFrom(
				turn.speaker_id ?? turn.speaker ?? turn.speakerId,
				"speaker_0"
			);
			addSpeaker(speakerBuild, speakerId);
			const start = timeFromAny(turn.start ?? turn.startTime) + timeOffset;
			const endCandidate = timeFromAny(turn.end ?? turn.endTime) + timeOffset;
			return {
				endTime: formatTime(endCandidate > start ? endCandidate : start + 1),
				id: stringOrUndefined(turn.id) ?? `${idPrefix}-turn-${index + 1}`,
				speakerId,
				startTime: formatTime(start),
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
		.replace(SRT_LINE_BREAK_PATTERN, "\n")
		.replace(VTT_HEADER_PATTERN, "")
		.split(CUE_BLOCK_SEPARATOR_PATTERN)
		.map((block) => block.trim())
		.filter(Boolean);
	const segments: Segment[] = [];

	for (const block of cueBlocks) {
		if (block.startsWith("NOTE")) {
			continue;
		}

		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
		if (timeLineIndex === -1) {
			continue;
		}

		const timeMatch = lines[timeLineIndex].match(SUBTITLE_TIME_PATTERN);
		if (!timeMatch) {
			continue;
		}

		const rawText = lines
			.slice(timeLineIndex + 1)
			.join(" ")
			.trim();
		if (!rawText) {
			continue;
		}

		const voice = rawText.match(VTT_VOICE_PATTERN);
		const speakerName = voice?.[1]?.trim();
		const speakerId = speakerName ? slugSpeakerId(speakerName) : "speaker_1";
		const cleanText = stripCueMarkup(voice?.[2] ?? rawText);
		if (!cleanText) {
			continue;
		}

		addSpeaker(speakerBuild, speakerId, speakerName);
		segments.push({
			endTime: formatTime(parseSubtitleTime(timeMatch[2])),
			id: `${sourceFormat}-${segments.length + 1}`,
			speakerId,
			startTime: formatTime(parseSubtitleTime(timeMatch[1])),
			text: cleanText,
			wordTimingStatus: "absent",
		});
	}

	if (segments.length === 0) {
		throw new Error(`No cues were found in ${sourceFormat.toUpperCase()} file.`);
	}

	return {
		meta: {
			date: "",
			duration: maxSegmentEnd(segments),
			language: "",
			name: filename,
		},
		segments,
		sourceFormat,
		speakers: buildSpeakers(speakerBuild),
		warnings: [],
	};
}

function normalizeWordTimestamp(input: UnknownRecord, timeOffset: number): WordTimestamp | null {
	const text = stringOrUndefined(input.word ?? input.text ?? input.punctuated_word)?.trim();
	const start = numberOrUndefined(input.start);
	const end = numberOrUndefined(input.end);
	if (!text || start === undefined || end === undefined) {
		return null;
	}
	return {
		end: Math.max(end, start) + timeOffset,
		start: start + timeOffset,
		word: text,
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
	if (wordsDirty) {
		return "dirty";
	}
	if (isWordTimingStatus(explicit)) {
		return explicit;
	}
	if (!words || words.length === 0) {
		return "absent";
	}
	if (words.some((word) => word.interpolated)) {
		return "estimated";
	}
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
			if (!isRecord(speaker)) {
				return null;
			}
			const id = stringOrUndefined(speaker.id);
			const name = stringOrUndefined(speaker.name);
			if (!(id && name)) {
				return null;
			}
			const color =
				stringOrUndefined(speaker.color) ?? SPEAKER_COLORS[index % SPEAKER_COLORS.length];
			addSpeaker(speakerBuild, id, name);
			return { color, id, name };
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
		date: stringOrUndefined(rawMeta.date ?? rawMeta.datetime) ?? "",
		duration:
			numberOrUndefined(rawMeta.duration) ??
			numberOrUndefined(rawMeta.audio_duration_secs) ??
			numberOrUndefined(rawResponse?.audio_duration_secs) ??
			maxSegmentEnd(segments),
		language:
			stringOrUndefined(rawMeta.language ?? rawMeta.language_code ?? rawResponse?.language_code) ??
			"",
		name: stringOrUndefined(rawMeta.name) ?? options.filename,
		source: buildSourceMeta(source, options),
	};
}

function buildJsonlSourceMeta(
	filename: string,
	recordCount: number,
	records: TranscriptSourceMeta[],
	warnings: string[]
): TranscriptSourceMeta {
	const [first] = records;
	return removeUndefined({
		filename,
		format: "scribe-jsonl",
		languageCode: first?.languageCode,
		languageProbability: first?.languageProbability,
		model: first?.model,
		modelId: first?.modelId,
		modelKey: first?.modelKey,
		provider: first?.provider,
		recordCount,
		records: records.map(compactSourceRecord),
		timestampsIncluded: first?.timestampsIncluded,
		timestampsRequested: first?.timestampsRequested,
		timingSource: first?.timingSource,
		warnings: warnings.length > 0 ? warnings : undefined,
	});
}

function buildSourceMeta(
	source: UnknownRecord,
	options: NormalizeMetaOptions
): TranscriptSourceMeta {
	const rawMeta = sourceMetaRecord(source);
	const existingSource = sourceExistingSource(rawMeta);
	const rawResponse = sourceRawResponse(source);
	const transcriptJson = sourceTranscriptJson(source);
	const timing = sourceTimingRecord(source, transcriptJson);
	const serviceSource = sourceServiceSource(source);

	return removeUndefined({
		...(existingSource ? sanitizeRecord(existingSource) : {}),
		audioDuration: sourceAudioDuration(rawMeta, rawResponse),
		audioPath: sourceAudioPath(rawMeta),
		detail: sourceDetail(rawMeta, transcriptJson),
		filename: options.filename,
		format: options.sourceFormat,
		inputKey: sourceInputKey(rawMeta, serviceSource),
		jobId: sourceJobId(rawMeta, options.wrapper),
		languageCode: sourceLanguageCode(rawMeta, rawResponse),
		languageProbability: numberOrUndefined(rawResponse?.language_probability),
		model: sourceModel(rawMeta),
		modelId: stringOrUndefined(rawMeta.model_id),
		modelKey: stringOrUndefined(rawMeta.model_key),
		outputArtifacts: sourceOutputArtifacts(rawMeta, transcriptJson),
		processingTime: numberOrUndefined(rawMeta.processing_time),
		provider: stringOrUndefined(rawMeta.provider),
		rawResponse: rawResponse ? summarizeProviderPayload(rawResponse) : undefined,
		recordCount: options.recordCount,
		recordingId: stringOrUndefined(rawMeta.recording_id),
		records: options.records?.map(compactSourceRecord),
		resultWrapper: options.wrapper ? summarizeProviderPayload(options.wrapper) : undefined,
		serviceMode: sourceServiceMode(rawMeta, transcriptJson),
		sourceKind: stringOrUndefined(serviceSource?.source),
		timestampsIncluded: booleanOrUndefined(timing?.timestamps_included),
		timestampsRequested: sourceTimestampsRequested(rawMeta, timing),
		timingSource: sourceTimingSource(timing, transcriptJson),
		transcriptionId: stringOrUndefined(rawResponse?.transcription_id),
		warnings: sourceWarnings(options.warnings),
	});
}

function sourceMetaRecord(source: UnknownRecord): UnknownRecord {
	return isRecord(source.meta) ? source.meta : source;
}

function sourceExistingSource(rawMeta: UnknownRecord): UnknownRecord | undefined {
	return isRecord(rawMeta.source) ? rawMeta.source : undefined;
}

function sourceRawResponse(source: UnknownRecord): UnknownRecord | undefined {
	return isRecord(source.raw_response) ? source.raw_response : undefined;
}

function sourceTranscriptJson(source: UnknownRecord): UnknownRecord | undefined {
	return isRecord(source.transcript_json) ? source.transcript_json : undefined;
}

function sourceTimingRecord(
	source: UnknownRecord,
	transcriptJson: UnknownRecord | undefined
): UnknownRecord | undefined {
	if (isRecord(source.timing)) {
		return source.timing;
	}
	return isRecord(transcriptJson?.timing) ? transcriptJson.timing : undefined;
}

function sourceServiceSource(source: UnknownRecord): UnknownRecord | undefined {
	return isRecord(source.source) ? source.source : undefined;
}

function sourceAudioDuration(
	rawMeta: UnknownRecord,
	rawResponse: UnknownRecord | undefined
): number | undefined {
	return (
		numberOrUndefined(rawMeta.audio_duration_secs) ??
		numberOrUndefined(rawMeta.duration) ??
		numberOrUndefined(rawResponse?.audio_duration_secs)
	);
}

function sourceAudioPath(rawMeta: UnknownRecord): string | undefined {
	return stringOrUndefined(rawMeta.audio_path ?? rawMeta.path);
}

function sourceDetail(
	rawMeta: UnknownRecord,
	transcriptJson: UnknownRecord | undefined
): string[] | undefined {
	return stringArray(rawMeta.detail ?? transcriptJson?.detail);
}

function sourceInputKey(
	rawMeta: UnknownRecord,
	serviceSource: UnknownRecord | undefined
): string | undefined {
	return stringOrUndefined(serviceSource?.input_key ?? rawMeta.input_key);
}

function sourceJobId(
	rawMeta: UnknownRecord,
	wrapper: UnknownRecord | undefined
): string | undefined {
	return stringOrUndefined(rawMeta.job_id ?? rawMeta.jobId ?? wrapper?.job_id);
}

function sourceLanguageCode(
	rawMeta: UnknownRecord,
	rawResponse: UnknownRecord | undefined
): string | undefined {
	return stringOrUndefined(rawResponse?.language_code ?? rawMeta.language_code ?? rawMeta.language);
}

function sourceModel(rawMeta: UnknownRecord): string | undefined {
	return stringOrUndefined(rawMeta.model ?? rawMeta.asr_model);
}

function sourceOutputArtifacts(
	rawMeta: UnknownRecord,
	transcriptJson: UnknownRecord | undefined
): string[] | undefined {
	return stringArray(rawMeta.output_artifacts ?? transcriptJson?.output_artifacts);
}

function sourceServiceMode(
	rawMeta: UnknownRecord,
	transcriptJson: UnknownRecord | undefined
): string | undefined {
	return stringOrUndefined(rawMeta.mode ?? transcriptJson?.mode);
}

function sourceTimestampsRequested(
	rawMeta: UnknownRecord,
	timing: UnknownRecord | undefined
): boolean | undefined {
	return booleanOrUndefined(timing?.timestamps_requested ?? rawMeta.timestamps);
}

function sourceTimingSource(
	timing: UnknownRecord | undefined,
	transcriptJson: UnknownRecord | undefined
): string | undefined {
	return stringOrUndefined(timing?.source ?? transcriptJson?.timing_source);
}

function sourceWarnings(warnings: string[] | undefined): string[] | undefined {
	return warnings && warnings.length > 0 ? warnings : undefined;
}

function compactSourceRecord(source: TranscriptSourceMeta): TranscriptSourceMeta {
	return removeUndefined({
		audioDuration: source.audioDuration,
		audioPath: source.audioPath,
		filename: source.filename,
		format: source.format,
		languageCode: source.languageCode,
		languageProbability: source.languageProbability,
		model: source.model,
		modelId: source.modelId,
		modelKey: source.modelKey,
		processingTime: source.processingTime,
		provider: source.provider,
		rawResponse: source.rawResponse,
		recordingId: source.recordingId,
		timestampsIncluded: source.timestampsIncluded,
		timestampsRequested: source.timestampsRequested,
		timingSource: source.timingSource,
		transcriptionId: source.transcriptionId,
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
		if (!isRecord(item)) {
			continue;
		}
		const type = stringOrUndefined(item.type) ?? "word";
		typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
		const speaker = stringOrUndefined(item.speaker_id ?? item.speaker);
		if (speaker) {
			speakerIds.add(speaker);
		}
	}

	return {
		count: words.length,
		first: words.slice(0, 3).map(sanitizeValue),
		last: words.slice(-3).map(sanitizeValue),
		speakerIds: Array.from(speakerIds).sort(),
		typeCounts: Object.fromEntries(typeCounts),
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
	if (Array.isArray(value)) {
		return summarizeArray(value);
	}
	if (isRecord(value)) {
		return sanitizeRecord(value);
	}
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
		color: SPEAKER_COLORS[index % SPEAKER_COLORS.length],
		id,
		name: build.names.get(id) ?? titleSpeaker(id, index),
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
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value !== "string") {
		return 0;
	}
	if (value.includes(":")) {
		const normalized = value.replace(",", ".");
		const parts = normalized.split(":").map(Number);
		if (parts.some((part) => Number.isNaN(part))) {
			return 0;
		}
		if (parts.length === 3) {
			return parts[0] * 3600 + parts[1] * 60 + parts[2];
		}
		if (parts.length === 2) {
			return parts[0] * 60 + parts[1];
		}
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
}

function parseSubtitleTime(value: string): number {
	return timeFromAny(value.trim());
}

function stripCueMarkup(value: string): string {
	return value.replace(CUE_MARKUP_PATTERN, "").replace(WORD_SEPARATOR_PATTERN, " ").trim();
}

function speakerIdFrom(value: unknown, fallback = "speaker_1"): string {
	if (value === undefined || value === null || value === "") {
		return fallback;
	}
	if (typeof value === "number") {
		return `speaker_${value}`;
	}
	const text = String(value).trim();
	if (!text) {
		return fallback;
	}
	const normalized = text.toLowerCase().replace(WORD_SEPARATOR_OR_DASH_PATTERN, "_");
	if (SPEAKER_ID_PATTERN.test(normalized)) {
		return normalized;
	}
	return normalized.startsWith("speaker_") ? normalized : slugSpeakerId(text);
}

function slugSpeakerId(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(SPEAKER_SLUG_SEPARATOR_PATTERN, "_")
		.replace(SPEAKER_SLUG_TRIM_PATTERN, "");
	return slug ? `speaker_${slug}` : "speaker_1";
}

function titleSpeaker(id: string, index: number): string {
	const raw = id.replace(SPEAKER_PREFIX_PATTERN, "").replace(/_/g, " ").trim();
	if (!raw || SPEAKER_NUMBER_PATTERN.test(raw)) {
		return `Speaker ${index + 1}`;
	}
	return raw.replace(TITLE_WORD_PATTERN, (char) => char.toUpperCase());
}

function wordText(item: ProviderWord): string {
	return stringOrUndefined(item.text ?? item.punctuated_word ?? item.word)?.trim() ?? "";
}

function lastVisibleText(parts: string[]): string {
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const text = parts[index].trim();
		if (text) {
			return text;
		}
	}
	return "";
}

function endsSentence(value: string): boolean {
	return TRAILING_SENTENCE_PATTERN.test(value);
}

function joinsPrevious(value: string): boolean {
	return PUNCTUATION_PREFIX_PATTERN.test(value) || value.startsWith("'");
}

function countWords(text: string): number {
	return text.trim().split(WORD_SEPARATOR_PATTERN).filter(Boolean).length;
}

function estimateWordDuration(text: string): number {
	return Math.max(0.18, Math.min(0.65, text.length * 0.055));
}

function looksLikeJsonl(value: string): boolean {
	const lines = value.split(LINE_BREAK_PATTERN).filter((line) => line.trim());
	return lines.length > 1 && lines.slice(0, 3).every((line) => line.trim().startsWith("{"));
}

function arrayOfRecords(value: unknown): UnknownRecord[] | undefined {
	if (!Array.isArray(value)) {
		return;
	}
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
	if (!Array.isArray(value)) {
		return;
	}
	const strings = value.filter((item): item is string => typeof item === "string");
	return strings.length > 0 ? strings : undefined;
}

function omitKeys(record: UnknownRecord, keys: string[]): UnknownRecord {
	const omitted = new Set(keys);
	return Object.fromEntries(Object.entries(record).filter(([key]) => !omitted.has(key)));
}
