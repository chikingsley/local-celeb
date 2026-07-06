import {
	Bot,
	Clipboard,
	Download,
	FileText,
	MessageSquareText,
	NotebookText,
	SearchCheck,
	Sparkles,
	Subtitles,
	Tags,
} from "lucide-react";
import { useMemo, useState } from "react";
import { downloadExport, exportToReviewText, exportToSrt, exportToTurnJson } from "@/lib/export";
import { deriveTranscriptTurns } from "@/lib/transcript-turns";
import { formatTime, parseTime } from "@/lib/utils";
import { getWordTimingStatus } from "@/lib/word-alignment";
import type { FileMetaData, Segment, Speaker, WordTimingStatus } from "@/types";

interface ReviewPanelProps {
	meta: FileMetaData;
	segments: Segment[];
	speakers: Speaker[];
	onUpdateMeta: (updates: Partial<FileMetaData>) => void;
	onOpenExport: () => void;
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function baseName(name: string): string {
	return name.replace(/\.[^.]+$/, "") || "transcript";
}

export function ReviewPanel({
	meta,
	segments,
	speakers,
	onUpdateMeta,
	onOpenExport,
}: ReviewPanelProps) {
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
	const turns = useMemo(() => deriveTranscriptTurns(segments), [segments]);
	const duration =
		meta.duration || Math.max(0, ...segments.map((segment) => parseTime(segment.endTime)));
	const wordCount = useMemo(
		() => segments.reduce((sum, segment) => sum + countWords(segment.text), 0),
		[segments]
	);
	const timedWordCount = useMemo(
		() => segments.reduce((sum, segment) => sum + (segment.words?.length ?? 0), 0),
		[segments]
	);
	const dirtySegmentCount = useMemo(
		() => segments.filter((segment) => getWordTimingStatus(segment) === "dirty").length,
		[segments]
	);
	const wordTimingStats = useMemo(() => {
		const stats: Record<WordTimingStatus, number> = {
			absent: 0,
			dirty: 0,
			estimated: 0,
			manual: 0,
			provider: 0,
		};
		for (const segment of segments) {
			stats[getWordTimingStatus(segment)] += 1;
		}
		return stats;
	}, [segments]);
	const speakerCount = useMemo(
		() => new Set(segments.map((segment) => segment.speakerId)).size,
		[segments]
	);
	const sourceRows = useMemo(() => {
		const source = meta.source;
		if (!source) return [];
		const language =
			source.languageCode && source.languageProbability !== undefined
				? `${source.languageCode} ${(source.languageProbability * 100).toFixed(1)}%`
				: source.languageCode;
		const timing =
			source.timingSource || source.timestampsRequested !== undefined
				? [
						source.timingSource,
						source.timestampsRequested === true ? "timestamps requested" : undefined,
						source.timestampsIncluded === true ? "included" : undefined,
					]
						.filter(Boolean)
						.join(" / ")
				: undefined;
		return [
			["Format", source.format],
			["Provider", source.provider],
			["Model", source.model ?? source.modelKey ?? source.modelId],
			["Language", language],
			["Timing", timing],
			["Records", source.recordCount?.toString()],
			["Audio path", source.audioPath],
		].filter((row): row is [string, string] => Boolean(row[1]));
	}, [meta.source]);

	const filename = baseName(meta.name);

	const handleCopyTranscript = async () => {
		try {
			await navigator.clipboard.writeText(exportToReviewText(segments, speakers));
			setCopyStatus("copied");
			window.setTimeout(() => setCopyStatus("idle"), 1500);
		} catch {
			setCopyStatus("failed");
			window.setTimeout(() => setCopyStatus("idle"), 1500);
		}
	};

	const handleExportReviewText = () => {
		downloadExport(
			exportToReviewText(segments, speakers, { includeTimestamps: true }),
			filename,
			"txt"
		);
	};

	const handleExportSubtitles = () => {
		downloadExport(exportToSrt(segments, speakers), filename, "srt");
	};

	const handleExportTurns = () => {
		downloadExport(exportToTurnJson(segments, speakers, meta), `${filename}.turns`, "json");
	};

	return (
		<aside className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50">
			<div className="border-b border-slate-200 bg-white px-4 py-4">
				<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
					<FileText size={14} />
					Review
				</div>
				<label className="block space-y-1.5">
					<span className="text-xs font-medium text-slate-500">Name</span>
					<input
						type="text"
						value={meta.name}
						onChange={(event) => onUpdateMeta({ name: event.target.value })}
						className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					/>
				</label>
				<div className="mt-3 grid grid-cols-2 gap-3">
					<label className="space-y-1.5">
						<span className="text-xs font-medium text-slate-500">Language</span>
						<input
							type="text"
							value={meta.language}
							onChange={(event) => onUpdateMeta({ language: event.target.value })}
							className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						/>
					</label>
					<label className="space-y-1.5">
						<span className="text-xs font-medium text-slate-500">Date</span>
						<input
							type="text"
							value={meta.date}
							onChange={(event) => onUpdateMeta({ date: event.target.value })}
							className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						/>
					</label>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<Tags size={14} />
						Stats
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<div className="text-lg font-semibold text-slate-900">{turns.length}</div>
							<div className="text-xs text-slate-500">Turns</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{segments.length}</div>
							<div className="text-xs text-slate-500">Segments</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{speakerCount}</div>
							<div className="text-xs text-slate-500">Speakers</div>
						</div>
						<div>
							<div className="font-mono text-lg font-semibold text-slate-900">
								{formatTime(duration)}
							</div>
							<div className="text-xs text-slate-500">Duration</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{wordCount}</div>
							<div className="text-xs text-slate-500">Words</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{timedWordCount}</div>
							<div className="text-xs text-slate-500">Timed words</div>
						</div>
					</div>
					{dirtySegmentCount > 0 && (
						<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
							{dirtySegmentCount} segment{dirtySegmentCount === 1 ? "" : "s"} need alignment review
						</div>
					)}
					{wordTimingStats.absent > 0 && (
						<div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
							{wordTimingStats.absent} segment{wordTimingStats.absent === 1 ? "" : "s"} have no word
							timing
						</div>
					)}
					{wordTimingStats.estimated > 0 && (
						<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
							{wordTimingStats.estimated} segment
							{wordTimingStats.estimated === 1 ? "" : "s"} use estimated word timing
						</div>
					)}
				</section>

				{sourceRows.length > 0 && (
					<section className="border-b border-slate-200 bg-white px-4 py-4">
						<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
							<Tags size={14} />
							Source
						</div>
						<div className="space-y-2">
							{sourceRows.map(([label, value]) => (
								<div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-xs">
									<div className="text-slate-500">{label}</div>
									<div className="truncate font-medium text-slate-700" title={value}>
										{value}
									</div>
								</div>
							))}
						</div>
					</section>
				)}

				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<Download size={14} />
						Actions
					</div>
					<div className="grid gap-2">
						<button
							type="button"
							onClick={handleCopyTranscript}
							className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
						>
							<span className="flex items-center gap-2">
								<Clipboard size={15} />
								Copy transcript
							</span>
							{copyStatus !== "idle" && (
								<span className="text-xs text-slate-400">
									{copyStatus === "copied" ? "Copied" : "Failed"}
								</span>
							)}
						</button>
						<button
							type="button"
							onClick={handleExportReviewText}
							className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
						>
							<FileText size={15} />
							Export transcript
						</button>
						<button
							type="button"
							onClick={handleExportSubtitles}
							className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
						>
							<Subtitles size={15} />
							Export subtitles
						</button>
						<button
							type="button"
							onClick={handleExportTurns}
							className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
						>
							<Download size={15} />
							Export turns JSON
						</button>
						<button
							type="button"
							onClick={onOpenExport}
							className="rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-slate-800"
						>
							All export formats
						</button>
					</div>
				</section>

				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<Sparkles size={14} />
						Summary
					</div>
					<textarea
						value={meta.summary ?? ""}
						onChange={(event) => onUpdateMeta({ summary: event.target.value })}
						className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					/>
				</section>

				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<NotebookText size={14} />
						Notes
					</div>
					<textarea
						value={meta.notes ?? ""}
						onChange={(event) => onUpdateMeta({ notes: event.target.value })}
						className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
					/>
				</section>

				<section className="bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<Bot size={14} />
						Assist
					</div>
					<div className="grid gap-2">
						{[
							{ icon: MessageSquareText, label: "Summarize" },
							{ icon: MessageSquareText, label: "Ask about transcript" },
							{ icon: SearchCheck, label: "Find likely mistakes" },
							{ icon: Tags, label: "Suggest speaker names" },
						].map((item) => (
							<button
								key={item.label}
								type="button"
								disabled
								className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-400"
							>
								<item.icon size={15} />
								{item.label}
							</button>
						))}
					</div>
				</section>
			</div>
		</aside>
	);
}

export default ReviewPanel;
