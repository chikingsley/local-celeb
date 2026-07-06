import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Segment, Speaker } from "@/types";

interface SearchMatch {
	segmentId: string;
	startIndex: number;
	endIndex: number;
}

interface MinimapProps {
	segments: Segment[];
	speakers: Speaker[];
	containerRef: React.RefObject<HTMLElement | null>;
	searchMatches?: SearchMatch[];
	currentMatchIndex?: number;
}

export default function Minimap({
	segments,
	speakers,
	containerRef,
	searchMatches = [],
	currentMatchIndex = 0,
}: MinimapProps) {
	const minimapRef = useRef<HTMLDivElement>(null);
	const [viewportTop, setViewportTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(100);
	const [isDragging, setIsDragging] = useState(false);
	const [_totalHeight, setTotalHeight] = useState(0);

	// Get speaker color
	const getSpeakerColor = useCallback(
		(speakerId: string) => {
			const speaker = speakers.find((s) => s.id === speakerId);
			return speaker?.color ?? "#94a3b8";
		},
		[speakers]
	);

	// Update viewport position on scroll
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateViewport = () => {
			const { scrollTop, scrollHeight, clientHeight } = container;
			setTotalHeight(scrollHeight);

			if (scrollHeight > 0) {
				const top = (scrollTop / scrollHeight) * 100;
				const height = (clientHeight / scrollHeight) * 100;
				setViewportTop(top);
				setViewportHeight(Math.max(height, 5)); // Minimum 5% height
			}
		};

		updateViewport();
		container.addEventListener("scroll", updateViewport);
		window.addEventListener("resize", updateViewport);

		// Also observe DOM changes
		const resizeObserver = new ResizeObserver(updateViewport);
		resizeObserver.observe(container);

		return () => {
			container.removeEventListener("scroll", updateViewport);
			window.removeEventListener("resize", updateViewport);
			resizeObserver.disconnect();
		};
	}, [containerRef]);

	// Handle click to navigate
	const scrollToPercentage = useCallback(
		(percentage: number, behavior: ScrollBehavior = "smooth") => {
			const container = containerRef.current;
			if (!container) return;
			const scrollTarget = percentage * container.scrollHeight - container.clientHeight / 2;

			container.scrollTo({
				top: Math.max(0, scrollTarget),
				behavior,
			});
		},
		[containerRef]
	);

	// Handle click to navigate
	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			const minimap = minimapRef.current;
			if (!minimap) return;

			const rect = minimap.getBoundingClientRect();
			const clickY = e.clientY - rect.top;
			scrollToPercentage(clickY / rect.height);
		},
		[scrollToPercentage]
	);

	// Handle drag
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const container = containerRef.current;
			if (!container) return;

			const step = container.clientHeight / Math.max(container.scrollHeight, 1);
			if (e.key === "ArrowDown" || e.key === "PageDown") {
				e.preventDefault();
				scrollToPercentage(Math.min(1, viewportTop / 100 + step), "auto");
			} else if (e.key === "ArrowUp" || e.key === "PageUp") {
				e.preventDefault();
				scrollToPercentage(Math.max(0, viewportTop / 100 - step), "auto");
			} else if (e.key === "Home") {
				e.preventDefault();
				scrollToPercentage(0, "auto");
			} else if (e.key === "End") {
				e.preventDefault();
				scrollToPercentage(1, "auto");
			}
		},
		[containerRef, scrollToPercentage, viewportTop]
	);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			const container = containerRef.current;
			const minimap = minimapRef.current;
			if (!container || !minimap) return;

			const rect = minimap.getBoundingClientRect();
			const mouseY = e.clientY - rect.top;
			const percentage = mouseY / rect.height;
			const scrollTarget = percentage * container.scrollHeight - container.clientHeight / 2;

			container.scrollTo({
				top: Math.max(0, scrollTarget),
			});
		};

		const handleMouseUp = () => {
			setIsDragging(false);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, containerRef]);

	// Calculate segment positions (simplified - assume equal height per segment)
	const segmentHeight = segments.length > 0 ? 100 / segments.length : 0;

	// Group matches by segment for markers
	const matchesBySegment = searchMatches.reduce(
		(acc, match) => {
			if (!acc[match.segmentId]) {
				acc[match.segmentId] = [];
			}
			acc[match.segmentId].push(match);
			return acc;
		},
		{} as Record<string, SearchMatch[]>
	);

	return (
		<div
			ref={minimapRef}
			role="scrollbar"
			aria-label="Transcript minimap"
			aria-controls="transcript-scroll-region"
			aria-orientation="vertical"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(viewportTop)}
			tabIndex={0}
			className="w-16 bg-slate-50 border-l border-slate-200 flex flex-col cursor-pointer select-none relative"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			{/* Segments representation */}
			<div className="flex-1 relative py-2 px-1.5">
				{segments.map((segment, _index) => {
					const hasMatches = matchesBySegment[segment.id]?.length > 0;
					const matchCount = matchesBySegment[segment.id]?.length ?? 0;

					return (
						<div
							key={segment.id}
							className="relative mb-0.5 rounded-sm overflow-hidden"
							style={{
								height: `${Math.max(segmentHeight - 0.5, 0.5)}%`,
								minHeight: "2px",
							}}
						>
							{/* Segment bar */}
							<div
								className="absolute inset-0 opacity-60 rounded-sm"
								style={{ backgroundColor: getSpeakerColor(segment.speakerId) }}
							/>

							{/* Search match markers */}
							{hasMatches && (
								<div className="absolute inset-0 flex flex-col justify-center gap-px px-0.5">
									{matchesBySegment[segment.id].slice(0, 3).map((match) => {
										const globalIdx = searchMatches.findIndex(
											(m) => m.segmentId === segment.id && m.startIndex === match.startIndex
										);
										const isCurrent = globalIdx === currentMatchIndex;

										return (
											<div
												key={`${match.segmentId}-${match.startIndex}-${match.endIndex}`}
												className={cn(
													"h-0.5 rounded-full",
													isCurrent ? "bg-orange-400" : "bg-yellow-400"
												)}
											/>
										);
									})}
									{matchCount > 3 && (
										<div className="h-0.5 bg-yellow-400 rounded-full opacity-50" />
									)}
								</div>
							)}
						</div>
					);
				})}

				{/* Viewport indicator */}
				<div
					role="slider"
					aria-label="Visible transcript region"
					aria-orientation="vertical"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(viewportTop)}
					tabIndex={0}
					className={cn(
						"absolute left-0 right-0 mx-1 rounded border-2 pointer-events-auto transition-opacity",
						isDragging
							? "border-blue-500 bg-blue-100/30"
							: "border-blue-400 bg-blue-50/20 hover:border-blue-500 hover:bg-blue-100/30"
					)}
					style={{
						top: `${viewportTop}%`,
						height: `${viewportHeight}%`,
						minHeight: "8px",
					}}
					onMouseDown={handleMouseDown}
					onKeyDown={handleKeyDown}
				/>
			</div>

			{/* Match count indicator */}
			{searchMatches.length > 0 && (
				<div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-medium rounded">
					{currentMatchIndex + 1}/{searchMatches.length}
				</div>
			)}
		</div>
	);
}
