interface FileLike {
	name: string;
	type?: string;
}

export interface MediaSidecarSelection<T extends FileLike> {
	mediaFile: T | null;
	subtitleFile: T | null;
}

const MEDIA_EXTENSIONS = new Set([
	"aac",
	"aif",
	"aiff",
	"flac",
	"m4a",
	"mkv",
	"mov",
	"mp3",
	"mp4",
	"ogg",
	"wav",
	"webm",
]);
const SUBTITLE_EXTENSIONS = new Set(["srt", "vtt", "webvtt"]);

export function fileExtension(file: FileLike): string {
	const name = file.name.toLowerCase();
	const index = name.lastIndexOf(".");
	return index === -1 ? "" : name.slice(index + 1);
}

export function fileStem(file: FileLike): string {
	const name = file.name.toLowerCase();
	const index = name.lastIndexOf(".");
	return index === -1 ? name : name.slice(0, index);
}

export function isMediaFile(file: FileLike): boolean {
	const type = file.type ?? "";
	return (
		type.startsWith("audio/") ||
		type.startsWith("video/") ||
		MEDIA_EXTENSIONS.has(fileExtension(file))
	);
}

export function isSubtitleFile(file: FileLike): boolean {
	const type = file.type ?? "";
	return type === "text/vtt" || SUBTITLE_EXTENSIONS.has(fileExtension(file));
}

export function pickMediaAndSubtitleFiles<T extends FileLike>(
	files: readonly T[]
): MediaSidecarSelection<T> {
	const mediaFile = files.find(isMediaFile) ?? null;
	if (!mediaFile) {
		return { mediaFile: null, subtitleFile: null };
	}

	const subtitleFiles = files.filter(isSubtitleFile);
	if (subtitleFiles.length === 0) {
		return { mediaFile, subtitleFile: null };
	}

	const mediaStem = fileStem(mediaFile);
	const ranked = subtitleFiles
		.map((subtitleFile) => ({
			subtitleFile,
			score: subtitleMatchScore(mediaStem, fileStem(subtitleFile), subtitleFiles.length),
		}))
		.sort((a, b) => b.score - a.score);

	return {
		mediaFile,
		subtitleFile: ranked[0]?.score ? ranked[0].subtitleFile : null,
	};
}

function subtitleMatchScore(
	mediaStem: string,
	subtitleStem: string,
	subtitleCount: number
): number {
	if (subtitleStem === mediaStem) return 4;
	if (
		subtitleStem.startsWith(`${mediaStem}.`) ||
		subtitleStem.startsWith(`${mediaStem}-`) ||
		subtitleStem.startsWith(`${mediaStem}_`)
	) {
		return 3;
	}
	if (
		mediaStem.startsWith(`${subtitleStem}.`) ||
		mediaStem.startsWith(`${subtitleStem}-`) ||
		mediaStem.startsWith(`${subtitleStem}_`)
	) {
		return 2;
	}
	return subtitleCount === 1 ? 1 : 0;
}
