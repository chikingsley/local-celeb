import {
	AlertTriangle,
	AlignLeft,
	ChevronDown,
	ChevronRight,
	Clock,
	Timer,
	Type,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { cn, formatTime, parseTime } from "@/lib/utils";
import type { FileMetaData, Segment, WordTimestamp } from "@/types";

interface PropertiesPanelProps {
	meta: FileMetaData;
	selectedSegment: Segment | null;
	currentTime: number;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onDeleteSegment: (id: string) => void;
	onUpdateMeta?: (updates: Partial<FileMetaData>) => void;
	onSeek?: (time: number) => void;
}

export function PropertiesPanel({
	meta,
	selectedSegment,
	currentTime,
	onUpdateSegment,
	onDeleteSegment,
	onUpdateMeta,
	onSeek,
}: PropertiesPanelProps) {
	const [globalCollapsed, setGlobalCollapsed] = useState(false);
	const [segmentCollapsed, setSegmentCollapsed] = useState(false);
	const [wordsCollapsed, setWordsCollapsed] = useState(false);
	const [isEditingName, setIsEditingName] = useState(false);
	const [editedName, setEditedName] = useState(meta.name);
	const nameInputRef = useRef<HTMLInputElement>(null);

	const handleNameClick = () => {
		setEditedName(meta.name);
		setIsEditingName(true);
		setTimeout(() => nameInputRef.current?.focus(), 0);
	};

	const handleNameBlur = () => {
		setIsEditingName(false);
		if (editedName.trim() && editedName !== meta.name) {
			onUpdateMeta?.({ name: editedName.trim() });
		}
	};

	const calculateDuration = (segment: Segment): string => {
		const start = parseTime(segment.startTime);
		const end = parseTime(segment.endTime);
		const diff = Math.max(0, end - start);
		return formatTime(diff);
	};

	const handleDurationChange = (durationStr: string) => {
		if (!selectedSegment) return;
		const durationSeconds = parseTime(durationStr);
		const startSeconds = parseTime(selectedSegment.startTime);
		const newEndSeconds = startSeconds + durationSeconds;
		onUpdateSegment(selectedSegment.id, { endTime: formatTime(newEndSeconds) });
	};

	// Get words to display - either from segment.words or split from text
	const getDisplayWords = useCallback((segment: Segment): WordTimestamp[] => {
		if (segment.words && segment.words.length > 0 && !segment.wordsDirty) {
			return segment.words;
		}
		// If dirty or no words, split text into words with no timestamps
		const textWords = segment.text.split(/\s+/).filter((w) => w.length > 0);
		const segStart = parseTime(segment.startTime);
		const segEnd = parseTime(segment.endTime);
		const duration = segEnd - segStart;
		// Distribute time evenly as placeholder
		return textWords.map((word, i) => ({
			word,
			start: segStart + (duration * i) / textWords.length,
			end: segStart + (duration * (i + 1)) / textWords.length,
			interpolated: true,
		}));
	}, []);

	// Update a single word's timestamp with linked adjacent boundaries
	const handleWordUpdate = useCallback(
		(segment: Segment, wordIndex: number, field: "start" | "end", value: string) => {
			const seconds = parseFloat(value);
			if (Number.isNaN(seconds) || seconds < 0) return;

			// Always use getDisplayWords to get current words (handles dirty/empty cases)
			const words = [...getDisplayWords(segment)].map((w) => ({ ...w }));
			if (wordIndex >= 0 && wordIndex < words.length) {
				words[wordIndex] = {
					...words[wordIndex],
					[field]: seconds,
					interpolated: false,
				};

				// Link adjacent timestamps (roll edit behavior)
				if (field === "end" && wordIndex < words.length - 1) {
					// Moving end time → adjust next word's start to match
					words[wordIndex + 1] = {
						...words[wordIndex + 1],
						start: seconds,
						interpolated: false,
					};
				} else if (field === "start" && wordIndex > 0) {
					// Moving start time → adjust previous word's end to match
					words[wordIndex - 1] = {
						...words[wordIndex - 1],
						end: seconds,
						interpolated: false,
					};
				}

				onUpdateSegment(segment.id, { words, wordsDirty: false });
			}
		},
		[getDisplayWords, onUpdateSegment]
	);

	// Find current word based on playback time
	const getCurrentWordIndex = useCallback(
		(segment: Segment): number => {
			const words = segment.words || [];
			for (let i = 0; i < words.length; i++) {
				if (currentTime >= words[i].start && currentTime < words[i].end) {
					return i;
				}
			}
			return -1;
		},
		[currentTime]
	);

	return (
		<div className="bg-slate-50 border-l border-slate-200 flex flex-col h-full overflow-hidden w-full">
			{/* Global Properties - fixed height */}
			<div className="border-b border-slate-200 flex-shrink-0">
				<button
					type="button"
					onClick={() => setGlobalCollapsed(!globalCollapsed)}
					className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors"
				>
					<span className="flex items-center gap-2">
						{globalCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
						Global Properties
					</span>
				</button>

				<div
					className={cn(
						"overflow-hidden transition-all duration-200",
						globalCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
					)}
				>
					<div className="px-4 py-4 space-y-4 bg-white">
						<div className="space-y-1">
							{isEditingName ? (
								<input
									ref={nameInputRef}
									type="text"
									value={editedName}
									onChange={(e) => setEditedName(e.target.value)}
									onBlur={handleNameBlur}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleNameBlur();
										if (e.key === "Escape") {
											setIsEditingName(false);
											setEditedName(meta.name);
										}
									}}
									className="w-full text-sm font-medium text-slate-900 bg-slate-50 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
								/>
							) : (
								<p
									onClick={handleNameClick}
									onKeyDown={(e) => e.key === "Enter" && handleNameClick()}
									tabIndex={0}
									role="button"
									className="text-sm font-medium text-slate-900 break-words leading-snug cursor-pointer hover:bg-slate-100 rounded px-2 py-1 -mx-2 transition-colors"
									title="Click to edit"
								>
									{meta.name}
								</p>
							)}
							<p className="text-xs text-slate-400">Audio Source</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<span className="text-xs text-slate-500 block mb-1.5">Language</span>
								<div className="text-sm text-slate-800 font-medium">{meta.language}</div>
							</div>
							<div>
								<span className="text-xs text-slate-500 block mb-1.5">Duration</span>
								<div className="text-sm text-slate-800 font-medium font-mono">
									{formatTime(meta.duration)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Segment Properties */}
			{selectedSegment ? (
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					<button
						type="button"
						onClick={() => setSegmentCollapsed(!segmentCollapsed)}
						className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
					>
						<span className="flex items-center gap-2">
							{segmentCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
							Segment Properties
						</span>
						{selectedSegment.wordsDirty && (
							<span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium normal-case">
								<AlertTriangle size={10} />
								Out of sync
							</span>
						)}
					</button>

					<div
						className={cn(
							"overflow-hidden transition-all duration-200 flex-shrink-0",
							segmentCollapsed ? "max-h-0 opacity-0" : "opacity-100"
						)}
					>
						<div className="px-4 py-4 space-y-4 bg-white">
							{/* Duration, Start, End in 3 columns */}
							<div className="grid grid-cols-3 gap-3">
								<label className="space-y-1.5">
									<span className="text-xs font-medium text-slate-500 flex items-center gap-1">
										<Timer size={11} /> Duration
									</span>
									<input
										type="text"
										value={calculateDuration(selectedSegment)}
										onChange={(e) => handleDurationChange(e.target.value)}
										className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
									/>
								</label>
								<label className="space-y-1.5">
									<span className="text-xs font-medium text-slate-500 flex items-center gap-1">
										<Clock size={11} /> Start
									</span>
									<input
										type="text"
										value={selectedSegment.startTime}
										onChange={(e) =>
											onUpdateSegment(selectedSegment.id, { startTime: e.target.value })
										}
										className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
									/>
								</label>
								<label className="space-y-1.5">
									<span className="text-xs font-medium text-slate-500 flex items-center gap-1">
										<Clock size={11} /> End
									</span>
									<input
										type="text"
										value={selectedSegment.endTime}
										onChange={(e) =>
											onUpdateSegment(selectedSegment.id, { endTime: e.target.value })
										}
										className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
									/>
								</label>
							</div>

							<div className="flex gap-3 pt-2">
								<button
									type="button"
									onClick={() => onDeleteSegment(selectedSegment.id)}
									className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all text-sm font-medium"
								>
									Delete
								</button>
								<button
									type="button"
									className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-sm font-medium"
								>
									<AlignLeft size={14} /> Align
								</button>
							</div>
						</div>
					</div>

					{/* Words Section - fills remaining space */}
					<div className="border-t border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden">
						<button
							type="button"
							onClick={() => setWordsCollapsed(!wordsCollapsed)}
							className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
						>
							<span className="flex items-center gap-2">
								{wordsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
								<Type size={12} />
								Words
								<span className="text-slate-400 font-normal normal-case">
									({getDisplayWords(selectedSegment).length})
								</span>
							</span>
						</button>

						<div
							className={cn(
								"transition-all duration-200 flex-1 min-h-0 overflow-hidden",
								wordsCollapsed ? "max-h-0 opacity-0" : "opacity-100"
							)}
						>
							<div className="px-4 py-4 bg-white h-full flex flex-col">
								<div className="space-y-1 flex-1 overflow-y-auto min-h-0">
									{getDisplayWords(selectedSegment).map((word, idx) => {
										const isCurrentWord = getCurrentWordIndex(selectedSegment) === idx;
										return (
											<div
												key={`${word.word}-${idx}`}
												onClick={() => onSeek?.(word.start)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														onSeek?.(word.start);
													}
												}}
												className={cn(
													"flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group",
													isCurrentWord
														? "bg-blue-100 border border-blue-300"
														: "hover:bg-slate-100 border border-transparent"
												)}
											>
												<span
													className={cn(
														"flex-1 text-sm truncate",
														isCurrentWord
															? "text-blue-700"
															: word.interpolated
																? "text-amber-600"
																: "text-slate-700"
													)}
													title={word.word}
												>
													{word.word}
												</span>
												<input
													type="number"
													step="0.01"
													value={word.start.toFixed(2)}
													onClick={(e) => e.stopPropagation()}
													onChange={(e) =>
														handleWordUpdate(selectedSegment, idx, "start", e.target.value)
													}
													className="w-16 px-1.5 py-0.5 text-xs font-mono bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
													title="Start time (seconds)"
												/>
												<span className="text-slate-300 text-xs">→</span>
												<input
													type="number"
													step="0.01"
													value={word.end.toFixed(2)}
													onClick={(e) => e.stopPropagation()}
													onChange={(e) =>
														handleWordUpdate(selectedSegment, idx, "end", e.target.value)
													}
													className="w-16 px-1.5 py-0.5 text-xs font-mono bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
													title="End time (seconds)"
												/>
												{word.interpolated && (
													<span className="text-[10px] text-slate-400" title="Estimated timestamp">
														~
													</span>
												)}
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="flex-1 flex flex-col items-center justify-center text-center p-6">
					<div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3">
						<AlignLeft size={20} className="text-slate-400" />
					</div>
					<p className="text-sm text-slate-500">Select a segment to edit its properties</p>
				</div>
			)}
		</div>
	);
}

export default PropertiesPanel;
