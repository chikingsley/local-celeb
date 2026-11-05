import {
	AlertTriangle,
	AlignLeft,
	ChevronDown,
	ChevronRight,
	Clock,
	Info,
	Timer,
	Type,
} from "lucide-react";
import type { ChangeEvent, KeyboardEvent, MouseEvent, RefObject } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { CleanupGranularity } from "@/app/view-state";
import { deriveTranscriptTurns, type TranscriptTurn } from "@/domain/transcript/turns";
import type { FileMetaData, Segment, Speaker, WordTimestamp } from "@/domain/transcript/types";
import {
	estimateSegmentWordTiming,
	getDisplayWords,
	getWordTimingDisplay,
	getWordTimingStatus,
} from "@/domain/transcript/word-alignment";
import { ProposalQueue } from "@/features/assist/proposal-queue";
import type { ProposalReviewController } from "@/features/assist/use-proposal-review";
import { cn, formatTime, parseTime } from "@/lib/utils";

interface PropertiesPanelProps {
	currentTime: number;
	editorGranularity?: CleanupGranularity;
	meta: FileMetaData;
	onDeleteSegment: (id: string) => void;
	onEditorGranularityChange?: (granularity: CleanupGranularity) => void;
	onSeek?: (time: number) => void;
	onUpdateMeta?: (updates: Partial<FileMetaData>) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	proposalReview: ProposalReviewController;
	segments?: Segment[];
	selectedSegment: Segment | null;
	speakers?: Speaker[];
}

interface SpeakerWarning {
	id: string;
	text: string;
}

type WordTimingDisplay = ReturnType<typeof getWordTimingDisplay>;

const EDITOR_GRANULARITY_OPTIONS = [
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
];
const SPEAKER_NAME_SLUG_PATTERN = /[^a-z0-9]+/gu;
const UNKNOWN_SPEAKER_PATTERN = /unknown|unnamed|unidentified/iu;

function buildSegmentStatsBySpeaker(segments: Segment[]) {
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
}

function speakerDisplayName(speakerId: string, speakers: Speaker[]): string {
	return speakers.find((candidate) => candidate.id === speakerId)?.name ?? speakerId;
}

function collectSpeakerNameWarnings(
	speakers: Speaker[],
	segmentStatsBySpeaker: Map<string, { count: number; duration: number }>
): SpeakerWarning[] {
	const warnings: SpeakerWarning[] = [];
	const normalizedNames = new Map<string, Speaker[]>();

	for (const speaker of speakers) {
		const normalized = speaker.name.toLowerCase().replace(SPEAKER_NAME_SLUG_PATTERN, "");
		if (!normalized) {
			continue;
		}
		const matches = normalizedNames.get(normalized) ?? [];
		matches.push(speaker);
		normalizedNames.set(normalized, matches);

		if (UNKNOWN_SPEAKER_PATTERN.test(`${speaker.id} ${speaker.name}`)) {
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

	return warnings;
}

function collectShortTurnWarnings(turns: TranscriptTurn[], speakers: Speaker[]): SpeakerWarning[] {
	const warnings: SpeakerWarning[] = [];
	for (let index = 1; index < turns.length - 1; index += 1) {
		const previous = turns[index - 1];
		const turn = turns[index];
		const next = turns[index + 1];
		const duration = Math.max(0, parseTime(turn.endTime) - parseTime(turn.startTime));
		if (duration <= 1.5 && previous.speakerId === next.speakerId) {
			const speakerName = speakerDisplayName(turn.speakerId, speakers);
			const surroundingSpeakerName = speakerDisplayName(previous.speakerId, speakers);
			warnings.push({
				id: `short-${turn.id}`,
				text: `Short ${formatTime(duration)} ${speakerName} turn is between two ${surroundingSpeakerName} turns.`,
			});
		}
	}
	return warnings;
}

function buildSpeakerWarnings(
	speakers: Speaker[],
	turns: TranscriptTurn[],
	segmentStatsBySpeaker: Map<string, { count: number; duration: number }>
): SpeakerWarning[] {
	return [
		...collectSpeakerNameWarnings(speakers, segmentStatsBySpeaker),
		...collectShortTurnWarnings(turns, speakers),
	];
}

function calculateDuration(segment: Segment): string {
	const start = parseTime(segment.startTime);
	const end = parseTime(segment.endTime);
	const diff = Math.max(0, end - start);
	return formatTime(diff);
}

interface TimingBadgeProps {
	display: WordTimingDisplay;
	status: ReturnType<typeof getWordTimingStatus> | null;
	withIcon?: boolean;
}

function TimingBadge({ display, status, withIcon = false }: TimingBadgeProps) {
	return (
		<span
			className={cn(
				"flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium normal-case",
				display.tone === "emerald" && "bg-emerald-100 text-emerald-700",
				display.tone === "blue" && "bg-blue-100 text-blue-700",
				display.tone === "amber" && "bg-amber-100 text-amber-700",
				display.tone === "slate" && "bg-slate-200 text-slate-500"
			)}
			title={display.description}
		>
			{withIcon && status === "dirty" ? <AlertTriangle size={10} /> : null}
			{display.label}
		</span>
	);
}

interface GranularityOptionButtonProps {
	currentGranularity: CleanupGranularity;
	onChange: (granularity: CleanupGranularity) => void;
	option: (typeof EDITOR_GRANULARITY_OPTIONS)[number];
}

function GranularityOptionButton({
	option,
	currentGranularity,
	onChange,
}: GranularityOptionButtonProps) {
	const handleClick = useCallback(() => {
		onChange(option.value);
	}, [onChange, option.value]);

	return (
		<button
			className={cn(
				"min-w-0 rounded-md px-2 py-2 text-left transition-colors",
				currentGranularity === option.value
					? "bg-white text-slate-950 shadow-sm"
					: "text-slate-500 hover:text-slate-800"
			)}
			onClick={handleClick}
			type="button"
		>
			<span className="block truncate text-sm font-medium">{option.label}</span>
		</button>
	);
}

interface PropertyWordRowProps {
	index: number;
	isCurrentWord: boolean;
	onSeek?: (time: number) => void;
	onWordUpdate: (
		segment: Segment,
		wordIndex: number,
		field: "start" | "end",
		value: string
	) => void;
	segment: Segment;
	word: WordTimestamp;
}

function PropertyWordRow({
	word,
	index,
	segment,
	isCurrentWord,
	onSeek,
	onWordUpdate,
}: PropertyWordRowProps) {
	const handleSeek = useCallback(() => {
		onSeek?.(word.start);
	}, [onSeek, word.start]);
	const handleStartChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onWordUpdate(segment, index, "start", event.target.value);
		},
		[index, onWordUpdate, segment]
	);
	const handleEndChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onWordUpdate(segment, index, "end", event.target.value);
		},
		[index, onWordUpdate, segment]
	);
	const stopPropagation = useCallback((event: MouseEvent<HTMLInputElement>) => {
		event.stopPropagation();
	}, []);
	let wordTextClassName = "text-slate-700";
	if (isCurrentWord) {
		wordTextClassName = "text-blue-700";
	} else if (word.interpolated) {
		wordTextClassName = "text-amber-600";
	}

	return (
		<div
			className={cn(
				"group flex items-center gap-2 rounded-lg p-2 transition-colors",
				isCurrentWord
					? "border border-blue-300 bg-blue-100"
					: "border border-transparent hover:bg-slate-100"
			)}
		>
			<button
				className={cn("flex-1 truncate text-left text-sm", wordTextClassName)}
				onClick={handleSeek}
				title={word.word}
				type="button"
			>
				{word.word}
			</button>
			<input
				className="w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				onChange={handleStartChange}
				onClick={stopPropagation}
				step="0.01"
				title="Start time (seconds)"
				type="number"
				value={word.start.toFixed(2)}
			/>
			<span className="text-xs text-slate-300">→</span>
			<input
				className="w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				onChange={handleEndChange}
				onClick={stopPropagation}
				step="0.01"
				title="End time (seconds)"
				type="number"
				value={word.end.toFixed(2)}
			/>
			{word.interpolated ? (
				<span className="text-[10px] text-slate-400" title="Estimated timestamp">
					~
				</span>
			) : null}
		</div>
	);
}

interface GlobalPropertiesSectionProps {
	collapsed: boolean;
	editedName: string;
	isEditingName: boolean;
	meta: FileMetaData;
	nameInputRef: RefObject<HTMLInputElement | null>;
	onEditedNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onNameBlur: () => void;
	onNameClick: () => void;
	onNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onToggle: () => void;
}

function GlobalPropertiesSection({
	meta,
	collapsed,
	isEditingName,
	editedName,
	nameInputRef,
	onToggle,
	onNameClick,
	onNameBlur,
	onEditedNameChange,
	onNameKeyDown,
}: GlobalPropertiesSectionProps) {
	return (
		<div className="flex-shrink-0 border-b border-slate-200">
			<button
				className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-xs font-semibold tracking-wider text-slate-600 uppercase transition-colors hover:bg-slate-200"
				onClick={onToggle}
				type="button"
			>
				<span className="flex items-center gap-2">
					{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
					Global Properties
				</span>
			</button>

			<div
				className={cn(
					"overflow-hidden transition-all duration-200",
					collapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
				)}
			>
				<div className="space-y-4 bg-white px-4 py-4">
					<div className="space-y-1">
						{isEditingName ? (
							<input
								className="w-full rounded border border-blue-500 bg-slate-50 px-2 py-1 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
								onBlur={onNameBlur}
								onChange={onEditedNameChange}
								onKeyDown={onNameKeyDown}
								ref={nameInputRef}
								type="text"
								value={editedName}
							/>
						) : (
							<button
								className="-mx-2 block w-full cursor-pointer rounded px-2 py-1 text-left text-sm leading-snug font-medium break-words text-slate-900 transition-colors hover:bg-slate-100"
								onClick={onNameClick}
								title="Click to edit"
								type="button"
							>
								{meta.name}
							</button>
						)}
						<p className="text-xs text-slate-400">Audio Source</p>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<span className="mb-1.5 block text-xs text-slate-500">Language</span>
							<div className="text-sm font-medium text-slate-800">{meta.language}</div>
						</div>
						<div>
							<span className="mb-1.5 block text-xs text-slate-500">Duration</span>
							<div className="font-mono text-sm font-medium text-slate-800">
								{formatTime(meta.duration)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

interface EditorViewsSectionProps {
	collapsed: boolean;
	editorGranularity?: CleanupGranularity;
	onEditorGranularityChange?: (granularity: CleanupGranularity) => void;
	onToggle: () => void;
}

function EditorViewsSection({
	editorGranularity,
	onEditorGranularityChange,
	collapsed,
	onToggle,
}: EditorViewsSectionProps) {
	if (!(editorGranularity && onEditorGranularityChange)) {
		return null;
	}

	return (
		<div className="flex-shrink-0 border-b border-slate-200">
			<button
				className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-xs font-semibold tracking-wider text-slate-600 uppercase transition-colors hover:bg-slate-200"
				onClick={onToggle}
				type="button"
			>
				<span className="flex items-center gap-2">
					{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
					Views
				</span>
			</button>

			<div
				className={cn(
					"overflow-hidden transition-all duration-200",
					collapsed ? "max-h-0 opacity-0" : "max-h-72 opacity-100"
				)}
			>
				<div className="space-y-3 bg-white px-4 py-4">
					<div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
						{EDITOR_GRANULARITY_OPTIONS.map((option) => (
							<GranularityOptionButton
								currentGranularity={editorGranularity}
								key={option.value}
								onChange={onEditorGranularityChange}
								option={option}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

interface AssistedCleanupSectionProps {
	collapsed: boolean;
	hasSpeakers: boolean;
	onToggle: () => void;
	speakerWarnings: SpeakerWarning[];
}

function AssistedCleanupSection({
	hasSpeakers,
	collapsed,
	speakerWarnings,
	onToggle,
}: AssistedCleanupSectionProps) {
	if (!hasSpeakers) {
		return null;
	}

	return (
		<div className="flex-shrink-0 border-b border-slate-200">
			<button
				className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-xs font-semibold tracking-wider text-slate-600 uppercase transition-colors hover:bg-slate-200"
				onClick={onToggle}
				type="button"
			>
				<span className="flex items-center gap-2">
					{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
					Assisted Cleanup
				</span>
				{speakerWarnings.length > 0 ? (
					<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 normal-case">
						{speakerWarnings.length}
					</span>
				) : null}
			</button>

			<div
				className={cn(
					"overflow-hidden transition-all duration-200",
					collapsed ? "max-h-0 opacity-0" : "max-h-[34rem] opacity-100"
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
										className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"
										key={warning.id}
									>
										{warning.text}
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

interface SelectedSegmentPanelProps {
	getCurrentWordIndex: (segment: Segment) => number;
	onDeleteSegment: () => void;
	onDurationChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onEndTimeChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onRealignSegment: () => void;
	onSeek?: (time: number) => void;
	onStartTimeChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onToggleSegmentCollapsed: () => void;
	onToggleWordsCollapsed: () => void;
	onWordUpdate: (
		segment: Segment,
		wordIndex: number,
		field: "start" | "end",
		value: string
	) => void;
	segment: Segment | null;
	segmentCollapsed: boolean;
	selectedDisplayWords: WordTimestamp[];
	wordsCollapsed: boolean;
	wordTimingDisplay: WordTimingDisplay | null;
	wordTimingStatus: ReturnType<typeof getWordTimingStatus> | null;
}

function EmptySegmentPanel() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
			<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
				<AlignLeft className="text-slate-400" size={20} />
			</div>
			<p className="text-sm text-slate-500">Select a segment to edit its properties</p>
		</div>
	);
}

function SelectedSegmentPanel({
	segment,
	segmentCollapsed,
	wordsCollapsed,
	selectedDisplayWords,
	wordTimingStatus,
	wordTimingDisplay,
	onToggleSegmentCollapsed,
	onToggleWordsCollapsed,
	onDurationChange,
	onStartTimeChange,
	onEndTimeChange,
	onDeleteSegment,
	onRealignSegment,
	onWordUpdate,
	onSeek,
	getCurrentWordIndex,
}: SelectedSegmentPanelProps) {
	if (!segment) {
		return <EmptySegmentPanel />;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<button
				className="flex w-full flex-shrink-0 items-center justify-between bg-slate-100 px-4 py-3 text-xs font-semibold tracking-wider text-slate-600 uppercase transition-colors hover:bg-slate-200"
				onClick={onToggleSegmentCollapsed}
				type="button"
			>
				<span className="flex items-center gap-2">
					{segmentCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
					Segment Properties
				</span>
				{wordTimingDisplay ? (
					<TimingBadge display={wordTimingDisplay} status={wordTimingStatus} withIcon />
				) : null}
			</button>

			<div
				className={cn(
					"flex-shrink-0 overflow-hidden transition-all duration-200",
					segmentCollapsed ? "max-h-0 opacity-0" : "opacity-100"
				)}
			>
				<div className="space-y-4 bg-white px-4 py-4">
					<div className="grid grid-cols-3 gap-3">
						<label className="space-y-1.5">
							<span className="flex items-center gap-1 text-xs font-medium text-slate-500">
								<Timer size={11} /> Duration
							</span>
							<input
								className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-sm transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								onChange={onDurationChange}
								type="text"
								value={calculateDuration(segment)}
							/>
						</label>
						<label className="space-y-1.5">
							<span className="flex items-center gap-1 text-xs font-medium text-slate-500">
								<Clock size={11} /> Start
							</span>
							<input
								className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-sm transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								onChange={onStartTimeChange}
								type="text"
								value={segment.startTime}
							/>
						</label>
						<label className="space-y-1.5">
							<span className="flex items-center gap-1 text-xs font-medium text-slate-500">
								<Clock size={11} /> End
							</span>
							<input
								className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-sm transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								onChange={onEndTimeChange}
								type="text"
								value={segment.endTime}
							/>
						</label>
					</div>

					<div className="flex gap-3 pt-2">
						<button
							className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
							onClick={onDeleteSegment}
							type="button"
						>
							Delete
						</button>
						<button
							className={cn(
								"flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
								selectedDisplayWords.length === 0
									? "bg-slate-100 text-slate-300"
									: "bg-slate-900 text-white hover:bg-slate-800"
							)}
							disabled={selectedDisplayWords.length === 0}
							onClick={onRealignSegment}
							title="Estimate word timing from the current segment text and duration"
							type="button"
						>
							<AlignLeft size={14} /> Re-align
						</button>
					</div>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-slate-200">
				<button
					className="flex w-full flex-shrink-0 items-center justify-between bg-slate-100 px-4 py-3 text-xs font-semibold tracking-wider text-slate-600 uppercase transition-colors hover:bg-slate-200"
					onClick={onToggleWordsCollapsed}
					type="button"
				>
					<span className="flex items-center gap-2">
						{wordsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
						<Type size={12} />
						Words
						<span className="font-normal text-slate-400 normal-case">
							({selectedDisplayWords.length})
						</span>
						{wordTimingDisplay ? (
							<TimingBadge display={wordTimingDisplay} status={wordTimingStatus} />
						) : null}
					</span>
				</button>

				<div
					className={cn(
						"min-h-0 flex-1 overflow-hidden transition-all duration-200",
						wordsCollapsed ? "max-h-0 opacity-0" : "opacity-100"
					)}
				>
					<div className="flex h-full flex-col bg-white px-4 py-4">
						<div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
							{selectedDisplayWords.map((word, idx) => (
								<PropertyWordRow
									index={idx}
									isCurrentWord={getCurrentWordIndex(segment) === idx}
									key={`${word.word}-${word.start}-${word.end}`}
									onSeek={onSeek}
									onWordUpdate={onWordUpdate}
									segment={segment}
									word={word}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function PropertiesPanel({
	meta,
	selectedSegment,
	segments = [],
	speakers = [],
	currentTime,
	onUpdateSegment,
	proposalReview,
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

	const handleNameClick = useCallback(() => {
		setEditedName(meta.name);
		setIsEditingName(true);
		setTimeout(() => nameInputRef.current?.focus(), 0);
	}, [meta.name]);

	const handleNameBlur = useCallback(() => {
		setIsEditingName(false);
		if (editedName.trim() && editedName !== meta.name) {
			onUpdateMeta?.({ name: editedName.trim() });
		}
	}, [editedName, meta.name, onUpdateMeta]);

	const handleEditedNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setEditedName(event.target.value);
	}, []);

	const handleNameKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				handleNameBlur();
			}
			if (event.key === "Escape") {
				setIsEditingName(false);
				setEditedName(meta.name);
			}
		},
		[handleNameBlur, meta.name]
	);

	const handleDurationChange = useCallback(
		(durationStr: string) => {
			if (!selectedSegment) {
				return;
			}
			const durationSeconds = parseTime(durationStr);
			const startSeconds = parseTime(selectedSegment.startTime);
			const newEndSeconds = startSeconds + durationSeconds;
			onUpdateSegment(selectedSegment.id, { endTime: formatTime(newEndSeconds) });
		},
		[onUpdateSegment, selectedSegment]
	);

	const segmentStatsBySpeaker = useMemo(() => buildSegmentStatsBySpeaker(segments), [segments]);

	const turns = useMemo(() => deriveTranscriptTurns(segments), [segments]);
	const speakerWarnings = useMemo(
		() => buildSpeakerWarnings(speakers, turns, segmentStatsBySpeaker),
		[segmentStatsBySpeaker, speakers, turns]
	);

	// Update a single word's timestamp with linked adjacent boundaries
	const handleWordUpdate = useCallback(
		(segment: Segment, wordIndex: number, field: "start" | "end", value: string) => {
			const seconds = Number.parseFloat(value);
			if (Number.isNaN(seconds) || seconds < 0) {
				return;
			}

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
						interpolated: false,
						start: seconds,
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
		if (!selectedSegment) {
			return;
		}
		const words = estimateSegmentWordTiming(selectedSegment);
		if (words.length === 0) {
			return;
		}
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
			for (let i = 0; i < words.length; i += 1) {
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
	const toggleGlobalCollapsed = useCallback(() => {
		setGlobalCollapsed((current) => !current);
	}, []);
	const toggleEditorPropertiesCollapsed = useCallback(() => {
		setEditorPropertiesCollapsed((current) => !current);
	}, []);
	const toggleSpeakerRepairCollapsed = useCallback(() => {
		setSpeakerRepairCollapsed((current) => !current);
	}, []);
	const toggleSegmentCollapsed = useCallback(() => {
		setSegmentCollapsed((current) => !current);
	}, []);
	const toggleWordsCollapsed = useCallback(() => {
		setWordsCollapsed((current) => !current);
	}, []);
	const handleDurationInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			handleDurationChange(event.target.value);
		},
		[handleDurationChange]
	);
	const handleStartTimeChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (selectedSegment) {
				onUpdateSegment(selectedSegment.id, { startTime: event.target.value });
			}
		},
		[onUpdateSegment, selectedSegment]
	);
	const handleEndTimeChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (selectedSegment) {
				onUpdateSegment(selectedSegment.id, { endTime: event.target.value });
			}
		},
		[onUpdateSegment, selectedSegment]
	);
	const handleDeleteSegment = useCallback(() => {
		if (selectedSegment) {
			onDeleteSegment(selectedSegment.id);
		}
	}, [onDeleteSegment, selectedSegment]);

	return (
		<div className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50">
			<GlobalPropertiesSection
				collapsed={globalCollapsed}
				editedName={editedName}
				isEditingName={isEditingName}
				meta={meta}
				nameInputRef={nameInputRef}
				onEditedNameChange={handleEditedNameChange}
				onNameBlur={handleNameBlur}
				onNameClick={handleNameClick}
				onNameKeyDown={handleNameKeyDown}
				onToggle={toggleGlobalCollapsed}
			/>
			<EditorViewsSection
				collapsed={editorPropertiesCollapsed}
				editorGranularity={editorGranularity}
				onEditorGranularityChange={onEditorGranularityChange}
				onToggle={toggleEditorPropertiesCollapsed}
			/>
			<AssistedCleanupSection
				collapsed={speakerRepairCollapsed}
				hasSpeakers={speakers.length > 0}
				onToggle={toggleSpeakerRepairCollapsed}
				speakerWarnings={speakerWarnings}
			/>
			<ProposalQueue controller={proposalReview} />
			<SelectedSegmentPanel
				getCurrentWordIndex={getCurrentWordIndex}
				onDeleteSegment={handleDeleteSegment}
				onDurationChange={handleDurationInputChange}
				onEndTimeChange={handleEndTimeChange}
				onRealignSegment={handleRealignSegment}
				onSeek={onSeek}
				onStartTimeChange={handleStartTimeChange}
				onToggleSegmentCollapsed={toggleSegmentCollapsed}
				onToggleWordsCollapsed={toggleWordsCollapsed}
				onWordUpdate={handleWordUpdate}
				segment={selectedSegment}
				segmentCollapsed={segmentCollapsed}
				selectedDisplayWords={selectedDisplayWords}
				wordsCollapsed={wordsCollapsed}
				wordTimingDisplay={selectedWordTimingDisplay}
				wordTimingStatus={selectedWordTimingStatus}
			/>
		</div>
	);
}
