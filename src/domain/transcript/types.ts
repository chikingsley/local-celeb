export interface Speaker {
	color: string;
	id: string;
	name: string;
}

export interface WordTimestamp {
	confidence?: number;
	end: number;
	interpolated?: boolean;
	logprob?: number;
	start: number;
	word: string;
}

export type WordTimingStatus = "provider" | "manual" | "estimated" | "absent" | "dirty";

export interface Segment {
	endTime: string;
	id: string;
	speakerId: string;
	startTime: string;
	text: string;
	words?: WordTimestamp[];
	wordsDirty?: boolean;
	wordTimingStatus?: WordTimingStatus;
}

export interface TranscriptSourceMeta {
	audioDuration?: number;
	audioPath?: string;
	detail?: string[];
	filename?: string;
	format?: string;
	inputKey?: string;
	jobId?: string;
	languageCode?: string;
	languageProbability?: number;
	mediaFilename?: string;
	model?: string;
	modelId?: string;
	modelKey?: string;
	outputArtifacts?: string[];
	processingTime?: number;
	provider?: string;
	rawResponse?: unknown;
	recordCount?: number;
	recordingId?: string;
	records?: unknown[];
	resultWrapper?: unknown;
	serviceMode?: string;
	sourceKind?: string;
	timestampsIncluded?: boolean;
	timestampsRequested?: boolean;
	timingSource?: string;
	transcriptionId?: string;
	warnings?: string[];
}

export interface FileMetaData {
	date: string;
	duration: number;
	language: string;
	name: string;
	notes?: string;
	source?: TranscriptSourceMeta;
	summary?: string;
}
