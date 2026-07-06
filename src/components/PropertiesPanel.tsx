import {
	AlertTriangle,
	AlignLeft,
	ArrowRightLeft,
	Bot,
	ChevronDown,
	ChevronRight,
	Clock,
	Info,
	SearchCheck,
	Sparkles,
	Timer,
	Type,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { deriveTranscriptTurns } from "@/lib/transcript-turns";
import { cn, formatTime, parseTime } from "@/lib/utils";
import {
	estimateSegmentWordTiming,
	getDisplayWords,
	getWordTimingDisplay,
	getWordTimingStatus,
} from "@/lib/word-alignment";
import { CleanupGranularity, type FileMetaData, type Segment, type Speaker } from "@/types";

interface PropertiesPanelProps {
	meta: FileMetaData;
	selectedSegment: Segment | null;
	segments?: Segment[];
	speakers?: Speaker[];
	currentTime: number;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onDeleteSegment: (id: string) => void;
	onUpdateMeta?: (updates: Partial<FileMetaData>) => void;
	onSeek?: (time: number) => void;
	editorGranularity?: CleanupGranularity;
	onEditorGranularityChange?: (granularity: CleanupGranularity) => void;
}

export function PropertiesPanel({
	meta,
	selectedSegment,
	segments = [],
	speakers = [],
	currentTime,
	onUpdateSegment,
	onDeleteSegment,
	onUpdateMeta,
	onSeek,
	editorGranularity,
	onEditorGranularityChange,
}: PropertiesPanelProps) {
	const [globalCollapsed, setGlobalCollapsed] = useState(false);
	const [editorPropertiesCollapsed, setEditorPropertiesCollapsed] = useState(false);
	const [speakerRepairCollapsed, setSpeakerRepairCollapsed] = useState(false);
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

	const segmentStatsBySpeaker = useMemo(() => {
		const stats = new Map<string, { count: number; duration: number }>();
		for (const segment of segments) {
			const current = stats.get(segment.speakerId) ?? { count: 0, duration: 0 };
			stats.set(segment.speakerId, {
				count: current.count + 1,
				duration:
					current.duration + Math.max(0, parseTime(segment.endTime) - parseTime(segment.startTime)),
			});
		}
		return stats;
	}, [segments]);

	const turns = useMemo(() => deriveTranscriptTurns(segments), [segments]);
	const editorGranularityOptions = useMemo(
		() => [
			{
				label: "Turns",
				value: CleanupGranularity.TURNS,
			},
			{
				label: "Segments",
				value: CleanupGranularity.SEGMENTS,
			},
			{
				label: "Words",
				value: CleanupGranularity.WORDS,
			},
		],
		[]
	);

	const speakerWarnings = useMemo(() => {
		const warnings: { id: string; text: string }[] = [];
		const normalizedNames = new Map<string, Speaker[]>();

		for (const speaker of speakers) {
			const normalized = speaker.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
			if (!normalized) continue;
			const matches = normalizedNames.get(normalized) ?? [];
			matches.push(speaker);
			normalizedNames.set(normalized, matches);

			if (/unknown|unnamed|unidentified/i.test(`${speaker.id} ${speaker.name}`)) {
				const count = segmentStatsBySpeaker.get(speaker.id)?.count ?? 0;
				warnings.push({
					id: `unknown-${speaker.id}`,
					text: `${speaker.name} has ${count} segment${count === 1 ? "" : "s"} that still need a real speaker name.`,
				});
			}
		}

		for (const matches of normalizedNames.values()) {
			if (matches.length > 1) {
				warnings.push({
					id: `duplicate-${matches.map((speaker) => speaker.id).join("-")}`,
					text: `Possible duplicate speakers: ${matches.map((speaker) => speaker.name).join(", ")}.`,
				});
			}
		}

		for (let index = 1; index < turns.length - 1; index += 1) {
			const previous = turns[index - 1];
			const turn = turns[index];
			const next = turns[index + 1];
			const duration = Math.max(0, parseTime(turn.endTime) - parseTime(turn.startTime));
			if (duration <= 1.5 && previous.speakerId === next.speakerId) {
				const speaker = speakers.find((candidate) => candidate.id === turn.speakerId);
				const surroundingSpeaker = speakers.find(
					(candidate) => candidate.id === previous.speakerId
				);
				warnings.push({
					id: `short-${turn.id}`,
					text: `Short ${formatTime(duration)} ${speaker?.name ?? turn.speakerId} turn is between two ${surroundingSpeaker?.name ?? previous.speakerId} turns.`,
				});
			}
		}

		return warnings;
	}, [segmentStatsBySpeaker, speakers, turns]);

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

				onUpdateSegment(segment.id, {
					words,
					wordsDirty: false,
					wordTimingStatus: "manual",
				});
			}
		},
		[onUpdateSegment]
	);

	const handleRealignSegment = useCallback(() => {
		if (!selectedSegment) return;
		const words = estimateSegmentWordTiming(selectedSegment);
		if (words.length === 0) return;
		onUpdateSegment(selectedSegment.id, {
			words,
			wordsDirty: false,
			wordTimingStatus: "estimated",
		});
	}, [onUpdateSegment, selectedSegment]);

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

	const selectedWordTimingStatus = selectedSegment ? getWordTimingStatus(selectedSegment) : null;
	const selectedWordTimingDisplay = selectedWordTimingStatus
		? getWordTimingDisplay(selectedWordTimingStatus)
		: null;
	const selectedDisplayWords = useMemo(
		() => (selectedSegment ? getDisplayWords(selectedSegment) : []),
		[selectedSegment]
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
								<button
									type="button"
									onClick={handleNameClick}
									className="block w-full text-left text-sm font-medium text-slate-900 break-words leading-snug cursor-pointer hover:bg-slate-100 rounded px-2 py-1 -mx-2 transition-colors"
									title="Click to edit"
								>
									{meta.name}
								</button>
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

			{/* Views */}
			{editorGranularity && onEditorGranularityChange && (
				<div className="border-b border-slate-200 flex-shrink-0">
					<button
						type="button"
						onClick={() => setEditorPropertiesCollapsed(!editorPropertiesCollapsed)}
						className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors"
					>
						<span className="flex items-center gap-2">
							{editorPropertiesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
							Views
						</span>
					</button>

					<div
						className={cn(
							"overflow-hidden transition-all duration-200",
							editorPropertiesCollapsed ? "max-h-0 opacity-0" : "max-h-72 opacity-100"
						)}
					>
						<div className="space-y-3 bg-white px-4 py-4">
							<div className="text-xs font-medium text-slate-500">Editor view</div>
							<div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
								{editorGranularityOptions.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => onEditorGranularityChange(option.value)}
										className={cn(
											"min-w-0 rounded-md px-2 py-2 text-left transition-colors",
											editorGranularity === option.value
												? "bg-white text-slate-950 shadow-sm"
												: "text-slate-500 hover:text-slate-800"
										)}
									>
										<span className="block truncate text-sm font-medium">{option.label}</span>
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Assisted Cleanup */}
			{speakers.length > 0 && (
				<div className="border-b border-slate-200 flex-shrink-0">
					<button
						type="button"
						onClick={() => setSpeakerRepairCollapsed(!speakerRepairCollapsed)}
						className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100 hover:bg-slate-200 transition-colors"
					>
						<span className="flex items-center gap-2">
							{speakerRepairCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
							Assisted Cleanup
						</span>
						{speakerWarnings.length > 0 && (
							<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 normal-case">
								{speakerWarnings.length}
							</span>
						)}
					</button>

					<div
						className={cn(
							"overflow-hidden transition-all duration-200",
							speakerRepairCollapsed ? "max-h-0 opacity-0" : "max-h-[34rem] opacity-100"
						)}
					>
						<div className="space-y-4 bg-white px-4 py-4">
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-xs font-medium text-slate-500">
									<Info size={13} />
									Consistency warnings
								</div>
								{speakerWarnings.length === 0 ? (
									<div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
										No speaker consistency warnings.
									</div>
								) : (
									<div className="space-y-2">
										{speakerWarnings.map((warning) => (
											<div
												key={warning.id}
												className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
											>
												{warning.text}
											</div>
										))}
									</div>
								)}
							</div>

							<div className="space-y-2">
								<div className="flex items-center gap-2 text-xs font-medium text-slate-500">
									<Bot size={13} />
									Suggestions
								</div>
								<div className="grid gap-2">
									<button
										type="button"
										disabled
										className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-400"
									>
										<Sparkles size={13} />
										Infer likely speaker names
									</button>
									<button
										type="button"
										disabled
										className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-400"
									>
										<SearchCheck size={13} />
										Detect name-address clues
									</button>
									<button
										type="button"
										disabled
										className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-400"
									>
										<ArrowRightLeft size={13} />
										Suggest diarization corrections
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

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
						{selectedWordTimingDisplay && (
							<span
								className={cn(
									"flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium normal-case",
									selectedWordTimingDisplay.tone === "emerald" && "bg-emerald-100 text-emerald-700",
									selectedWordTimingDisplay.tone === "blue" && "bg-blue-100 text-blue-700",
									selectedWordTimingDisplay.tone === "amber" && "bg-amber-100 text-amber-700",
									selectedWordTimingDisplay.tone === "slate" && "bg-slate-200 text-slate-500"
								)}
								title={selectedWordTimingDisplay.description}
							>
								{selectedWordTimingStatus === "dirty" && <AlertTriangle size={10} />}
								{selectedWordTimingDisplay.label}
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
									onClick={handleRealignSegment}
									disabled={selectedDisplayWords.length === 0}
									title="Estimate word timing from the current segment text and duration"
									className={cn(
										"flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
										selectedDisplayWords.length === 0
											? "bg-slate-100 text-slate-300"
											: "bg-slate-900 text-white hover:bg-slate-800"
									)}
								>
									<AlignLeft size={14} /> Re-align
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
									({selectedDisplayWords.length})
								</span>
								{selectedWordTimingDisplay && (
									<span
										className={cn(
											"rounded px-1.5 py-0.5 text-[10px] font-medium normal-case",
											selectedWordTimingDisplay.tone === "emerald" &&
												"bg-emerald-100 text-emerald-700",
											selectedWordTimingDisplay.tone === "blue" && "bg-blue-100 text-blue-700",
											selectedWordTimingDisplay.tone === "amber" && "bg-amber-100 text-amber-700",
											selectedWordTimingDisplay.tone === "slate" && "bg-slate-200 text-slate-500"
										)}
									>
										{selectedWordTimingDisplay.label}
									</span>
								)}
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
									{selectedDisplayWords.map((word, idx) => {
										const isCurrentWord = getCurrentWordIndex(selectedSegment) === idx;
										return (
											<div
												key={`${word.word}-${word.start}-${word.end}`}
												className={cn(
													"flex items-center gap-2 p-2 rounded-lg transition-colors group",
													isCurrentWord
														? "bg-blue-100 border border-blue-300"
														: "hover:bg-slate-100 border border-transparent"
												)}
											>
												<button
													type="button"
													onClick={() => onSeek?.(word.start)}
													className={cn(
														"flex-1 truncate text-left text-sm",
														isCurrentWord
															? "text-blue-700"
															: word.interpolated
																? "text-amber-600"
																: "text-slate-700"
													)}
													title={word.word}
												>
													{word.word}
												</button>
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
