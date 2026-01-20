export interface WordTimestamp {
	word: string;
	start: number;
	end: number;
	interpolated?: boolean;
}

export interface Segment {
	id: string;
	text: string;
	startTime: string;
	endTime: string;
	speakerId?: string;
	words?: WordTimestamp[];
	wordsDirty?: boolean;
}

export interface FileMetaData {
	name: string;
	language: string;
	duration: number;
}

export interface Speaker {
	id: string;
	name: string;
	color: string;
}

export const ZOOM = {
	MIN: 10,
	MAX: 200,
	DEFAULT: 50,
};

export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
