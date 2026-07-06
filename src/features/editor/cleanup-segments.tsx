import { ArrowLeftToLine, ArrowRightToLine, Scissors } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { Segment, Speaker } from "@/domain/transcript/types";
import { cn, parseTime } from "@/lib/utils";
import { Editor } from "./segment-editor";

interface SearchMatch {
	endIndex: number;
	segmentId: string;
	startIndex: number;
}

interface CleanupSegmentsProps {
	currentMatchIndex?: number;
	currentTime: number;
	onMergeAdjacentSegment: (id: string, direction: "previous" | "next") => void;
	onProgrammaticScroll?: () => void;
	onSeek?: (time: number) => void;
	onSelectSegment: (id: string) => void;
	onSplitSegment: (id: string, splitTime?: number) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
	searchMatches?: SearchMatch[];
	segments: Segment[];
	selectedSegmentId: string | null;
	speakers: Speaker[];
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
		canMergeNext: Boolean(selected && next && selected.speakerId === next.speakerId),
		canMergePrevious: Boolean(selected && previous && selected.speakerId === previous.speakerId),
		next,
		previous,
		selected,
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
	const handleSplitSelected = useCallback(() => {
		if (selected) {
			onSplitSegment(selected.id, currentTime);
		}
	}, [currentTime, onSplitSegment, selected]);
	const handleMergePrevious = useCallback(() => {
		if (selected) {
			onMergeAdjacentSegment(selected.id, "previous");
		}
	}, [onMergeAdjacentSegment, selected]);
	const handleMergeNext = useCallback(() => {
		if (selected) {
			onMergeAdjacentSegment(selected.id, "next");
		}
	}, [onMergeAdjacentSegment, selected]);

	return (
		<div className="min-h-full">
			<div className="border-slate-200 border-b bg-slate-50 px-6 py-3">
				<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
					<div className="min-w-0">
						<div className="font-semibold text-slate-500 text-xs uppercase tracking-wider">
							Segment tools
						</div>
						<div className="mt-0.5 truncate text-slate-500 text-sm">
							{selected
								? `${selected.startTime} - ${selected.endTime} · ${selected.text || "Empty segment"}`
								: "Select a segment to split or merge"}
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 font-medium text-sm transition",
								selected && canSplit
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									: "border-slate-100 bg-slate-100 text-slate-300"
							)}
							disabled={!(selected && canSplit)}
							onClick={handleSplitSelected}
							type="button"
						>
							<Scissors size={14} />
							{splitLabel}
						</button>
						<button
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 font-medium text-sm transition",
								canMergePrevious
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									: "border-slate-100 bg-slate-100 text-slate-300"
							)}
							disabled={!(canMergePrevious && selected)}
							onClick={handleMergePrevious}
							type="button"
						>
							<ArrowLeftToLine size={14} />
							Merge previous
						</button>
						<button
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 font-medium text-sm transition",
								canMergeNext
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									: "border-slate-100 bg-slate-100 text-slate-300"
							)}
							disabled={!(canMergeNext && selected)}
							onClick={handleMergeNext}
							type="button"
						>
							<ArrowRightToLine size={14} />
							Merge next
						</button>
					</div>
				</div>
			</div>

			<div className="mx-auto max-w-4xl px-8 py-8">
				<Editor
					currentMatchIndex={currentMatchIndex}
					currentTime={currentTime}
					onProgrammaticScroll={onProgrammaticScroll}
					onSeek={onSeek}
					onSelectSegment={onSelectSegment}
					onUpdateSegment={onUpdateSegment}
					scrollContainerRef={scrollContainerRef}
					searchMatches={searchMatches}
					segments={segments}
					selectedSegmentId={selectedSegmentId}
					speakers={speakers}
				/>
			</div>
		</div>
	);
}
