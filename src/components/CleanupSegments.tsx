import { ArrowLeftToLine, ArrowRightToLine, Scissors } from "lucide-react";
import { useMemo } from "react";
import { cn, parseTime } from "@/lib/utils";
import type { Segment, Speaker } from "@/types";
import { Editor } from "./Editor";

interface SearchMatch {
	segmentId: string;
	startIndex: number;
	endIndex: number;
}

interface CleanupSegmentsProps {
	segments: Segment[];
	speakers: Speaker[];
	selectedSegmentId: string | null;
	currentTime: number;
	searchMatches?: SearchMatch[];
	currentMatchIndex?: number;
	onSelectSegment: (id: string) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onSplitSegment: (id: string, splitTime?: number) => void;
	onMergeAdjacentSegment: (id: string, direction: "previous" | "next") => void;
	onSeek?: (time: number) => void;
	onProgrammaticScroll?: () => void;
	scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function selectedNeighborState(segments: Segment[], selectedSegmentId: string | null) {
	const sorted = [...segments].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
	const index = selectedSegmentId
		? sorted.findIndex((segment) => segment.id === selectedSegmentId)
		: -1;
	const selected = index >= 0 ? sorted[index] : null;
	const previous = index > 0 ? sorted[index - 1] : null;
	const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null;

	return {
		selected,
		previous,
		next,
		canMergePrevious: Boolean(selected && previous && selected.speakerId === previous.speakerId),
		canMergeNext: Boolean(selected && next && selected.speakerId === next.speakerId),
	};
}

export function CleanupSegments({
	segments,
	speakers,
	selectedSegmentId,
	currentTime,
	searchMatches = [],
	currentMatchIndex = 0,
	onSelectSegment,
	onUpdateSegment,
	onSplitSegment,
	onMergeAdjacentSegment,
	onSeek,
	onProgrammaticScroll,
	scrollContainerRef,
}: CleanupSegmentsProps) {
	const { selected, canMergePrevious, canMergeNext } = useMemo(
		() => selectedNeighborState(segments, selectedSegmentId),
		[segments, selectedSegmentId]
	);
	const selectedStart = selected ? parseTime(selected.startTime) : 0;
	const selectedEnd = selected ? parseTime(selected.endTime) : 0;
	const canSplit = selected ? selectedEnd - selectedStart >= 0.2 : false;
	const splitAtPlayhead =
		selected && currentTime > selectedStart + 0.1 && currentTime < selectedEnd - 0.1;
	const splitLabel = splitAtPlayhead ? "Split at playhead" : "Split at midpoint";

	return (
		<div className="min-h-full">
			<div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
				<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
							Segment tools
						</div>
						<div className="mt-0.5 truncate text-sm text-slate-500">
							{selected
								? `${selected.startTime} - ${selected.endTime} · ${selected.text || "Empty segment"}`
								: "Select a segment to split or merge"}
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={!selected || !canSplit}
							onClick={() => selected && onSplitSegment(selected.id, currentTime)}
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
								selected && canSplit
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									: "border-slate-100 bg-slate-100 text-slate-300"
							)}
						>
							<Scissors size={14} />
							{splitLabel}
						</button>
						<button
							type="button"
							disabled={!canMergePrevious || !selected}
							onClick={() => selected && onMergeAdjacentSegment(selected.id, "previous")}
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
								canMergePrevious
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									: "border-slate-100 bg-slate-100 text-slate-300"
							)}
						>
							<ArrowLeftToLine size={14} />
							Merge previous
						</button>
						<button
							type="button"
							disabled={!canMergeNext || !selected}
							onClick={() => selected && onMergeAdjacentSegment(selected.id, "next")}
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
								canMergeNext
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									: "border-slate-100 bg-slate-100 text-slate-300"
							)}
						>
							<ArrowRightToLine size={14} />
							Merge next
						</button>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-4xl px-8 py-8">
				<Editor
					segments={segments}
					speakers={speakers}
					selectedSegmentId={selectedSegmentId}
					onSelectSegment={onSelectSegment}
					onUpdateSegment={onUpdateSegment}
					currentTime={currentTime}
					searchMatches={searchMatches}
					currentMatchIndex={currentMatchIndex}
					onSeek={onSeek}
					onProgrammaticScroll={onProgrammaticScroll}
					scrollContainerRef={scrollContainerRef}
				/>
			</div>
		</div>
	);
}

export default CleanupSegments;
