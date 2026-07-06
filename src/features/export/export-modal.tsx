import {
	AudioLines,
	Download,
	FileJson,
	FileText,
	Globe,
	MessageSquareText,
	Subtitles,
	Table,
	UsersRound,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import {
	type AudioExportMode,
	buildSpeakerAudioExportItems,
	buildTurnAudioExportItems,
	downloadAudioExportItems,
	summarizeAudioExportItems,
} from "@/domain/transcript/audio-export";
import { downloadExport, type ExportFormat, exportTranscript } from "@/domain/transcript/export";
import type { FileMetaData, Segment, Speaker } from "@/domain/transcript/types";
import { cn } from "@/lib/utils";

interface ExportModalProps {
	audioUrl?: string | null;
	isOpen: boolean;
	meta?: Partial<FileMetaData>;
	onClose: () => void;
	segments: Segment[];
	speakers: Speaker[];
}

interface FormatOption {
	description: string;
	format: ExportFormat;
	icon: ReactNode;
	label: string;
}

interface FormatOptionButtonProps {
	onSelectFormat: (format: ExportFormat) => void;
	option: FormatOption;
	selectedFormat: ExportFormat;
}

interface AudioExportButtonProps {
	disabled: boolean;
	icon: ReactNode;
	label: string;
	onExport: () => void;
	summary: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
	{
		description: "Simple text with timestamps and speaker names",
		format: "txt",
		icon: <FileText className="h-5 w-5" />,
		label: "Plain Text",
	},
	{
		description: "SubRip format for video players",
		format: "srt",
		icon: <Subtitles className="h-5 w-5" />,
		label: "SRT Subtitles",
	},
	{
		description: "Web Video Text Tracks for HTML5 video",
		format: "vtt",
		icon: <Subtitles className="h-5 w-5" />,
		label: "WebVTT",
	},
	{
		description: "Full project data for backup or import",
		format: "json",
		icon: <FileJson className="h-5 w-5" />,
		label: "JSON",
	},
	{
		description: "Styled webpage with speaker colors",
		format: "html",
		icon: <Globe className="h-5 w-5" />,
		label: "HTML",
	},
	{
		description: "Spreadsheet-compatible format",
		format: "csv",
		icon: <Table className="h-5 w-5" />,
		label: "CSV",
	},
];
const FILENAME_EXTENSION_PATTERN = /\.[^.]+$/;

function FormatOptionButton({ option, selectedFormat, onSelectFormat }: FormatOptionButtonProps) {
	const isSelected = selectedFormat === option.format;
	const handleClick = useCallback(() => {
		onSelectFormat(option.format);
	}, [onSelectFormat, option.format]);

	return (
		<button
			className={cn(
				"flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
				isSelected
					? "border-blue-500 bg-blue-50"
					: "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
			)}
			onClick={handleClick}
			type="button"
		>
			<div className={cn("mt-0.5 flex-shrink-0", isSelected ? "text-blue-600" : "text-slate-400")}>
				{option.icon}
			</div>
			<div>
				<div className={cn("font-medium", isSelected ? "text-blue-900" : "text-slate-900")}>
					{option.label}
				</div>
				<div className="text-slate-500 text-sm">{option.description}</div>
			</div>
		</button>
	);
}

function AudioExportButton({ disabled, icon, label, summary, onExport }: AudioExportButtonProps) {
	return (
		<button
			className={cn(
				"rounded-lg border p-3 text-left transition-colors",
				disabled
					? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
					: "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
			)}
			disabled={disabled}
			onClick={onExport}
			type="button"
		>
			<div className="flex items-center gap-2 font-medium text-sm">
				{icon}
				{label}
			</div>
			<div className="mt-1 text-slate-500 text-xs">{summary}</div>
		</button>
	);
}

export function ExportModal({
	isOpen,
	onClose,
	segments,
	speakers,
	meta,
	audioUrl,
}: ExportModalProps) {
	const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("txt");
	const [preview, setPreview] = useState<string>("");
	const [showPreview, setShowPreview] = useState(false);
	const [audioExportMode, setAudioExportMode] = useState<AudioExportMode | null>(null);
	const [audioExportError, setAudioExportError] = useState<string | null>(null);
	const filename = meta?.name?.replace(FILENAME_EXTENSION_PATTERN, "") ?? "transcript";
	const speakerAudioItems = useMemo(
		() => buildSpeakerAudioExportItems(segments, speakers, filename),
		[filename, segments, speakers]
	);
	const turnAudioItems = useMemo(
		() => buildTurnAudioExportItems(segments, speakers, filename),
		[filename, segments, speakers]
	);
	const speakerAudioDisabled =
		!audioUrl || speakerAudioItems.length === 0 || audioExportMode !== null;
	const turnAudioDisabled = !audioUrl || turnAudioItems.length === 0 || audioExportMode !== null;
	const speakerAudioSummary =
		speakerAudioItems.length > 0
			? summarizeAudioExportItems(speakerAudioItems)
			: "No speaker ranges";
	const turnAudioSummary =
		turnAudioItems.length > 0 ? summarizeAudioExportItems(turnAudioItems) : "No turn ranges";

	const handleExport = useCallback(() => {
		const content = exportTranscript(selectedFormat, segments, speakers, meta);
		downloadExport(content, filename, selectedFormat);
		onClose();
	}, [filename, meta, onClose, segments, selectedFormat, speakers]);

	const handlePreview = useCallback(() => {
		const content = exportTranscript(selectedFormat, segments, speakers, meta);
		setPreview(content);
		setShowPreview(true);
	}, [meta, segments, selectedFormat, speakers]);

	const handleBackToFormats = useCallback(() => {
		setShowPreview(false);
	}, []);

	const handleAudioExport = useCallback(
		async (mode: AudioExportMode) => {
			if (!audioUrl) {
				return;
			}
			const items = mode === "speaker" ? speakerAudioItems : turnAudioItems;
			if (items.length === 0) {
				return;
			}

			setAudioExportError(null);
			setAudioExportMode(mode);
			try {
				await downloadAudioExportItems(audioUrl, items);
			} catch (error) {
				setAudioExportError(error instanceof Error ? error.message : "Audio export failed.");
			} finally {
				setAudioExportMode(null);
			}
		},
		[audioUrl, speakerAudioItems, turnAudioItems]
	);

	const handleSpeakerAudioExport = useCallback(() => {
		handleAudioExport("speaker");
	}, [handleAudioExport]);

	const handleTurnAudioExport = useCallback(() => {
		handleAudioExport("turn");
	}, [handleAudioExport]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				aria-label="Close export dialog"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
				type="button"
			/>
			<div className="relative mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
				{/* Header */}
				<div className="flex items-center justify-between border-slate-200 border-b px-6 py-4">
					<h2 className="font-semibold text-lg text-slate-900">Export Transcript</h2>
					<button
						className="rounded p-1 text-slate-400 transition-colors hover:text-slate-600"
						onClick={onClose}
						type="button"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Content */}
				<div className="overflow-y-auto p-6">
					{showPreview ? (
						<>
							{/* Preview */}
							<div className="mb-3 flex items-center justify-between">
								<h3 className="font-medium text-slate-700 text-sm">Preview</h3>
								<button
									className="text-blue-600 text-sm hover:text-blue-700"
									onClick={handleBackToFormats}
									type="button"
								>
									Back to formats
								</button>
							</div>
							<pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-slate-100 text-xs">
								{preview}
							</pre>
						</>
					) : (
						<>
							<p className="mb-4 text-slate-600 text-sm">
								Choose an export format for your transcript
							</p>

							{/* Format Selection */}
							<div className="space-y-2">
								{FORMAT_OPTIONS.map((option) => (
									<FormatOptionButton
										key={option.format}
										onSelectFormat={setSelectedFormat}
										option={option}
										selectedFormat={selectedFormat}
									/>
								))}
							</div>

							{/* Stats */}
							<div className="mt-4 rounded-lg bg-slate-50 p-3">
								<div className="text-slate-600 text-sm">
									<span className="font-medium">{segments.length}</span> segments from{" "}
									<span className="font-medium">{speakers.length}</span> speakers
								</div>
							</div>

							<div className="mt-5 rounded-lg border border-slate-200">
								<div className="flex items-center gap-2 border-slate-200 border-b px-3 py-2 font-medium text-slate-700 text-sm">
									<AudioLines className="h-4 w-4 text-slate-400" />
									Audio
								</div>
								<div className="grid gap-2 p-3 sm:grid-cols-2">
									<AudioExportButton
										disabled={speakerAudioDisabled}
										icon={<UsersRound className="h-4 w-4" />}
										label="Per speaker"
										onExport={handleSpeakerAudioExport}
										summary={speakerAudioSummary}
									/>

									<AudioExportButton
										disabled={turnAudioDisabled}
										icon={<MessageSquareText className="h-4 w-4" />}
										label="Per turn"
										onExport={handleTurnAudioExport}
										summary={turnAudioSummary}
									/>
								</div>
								{audioUrl ? null : (
									<div className="border-slate-100 border-t px-3 py-2 text-slate-500 text-xs">
										Load media to export audio slices.
									</div>
								)}
								{audioExportMode ? (
									<div className="border-slate-100 border-t px-3 py-2 text-slate-500 text-xs">
										Exporting {audioExportMode === "speaker" ? "speaker" : "turn"} audio...
									</div>
								) : null}
								{audioExportError ? (
									<div className="border-red-100 border-t bg-red-50 px-3 py-2 text-red-700 text-xs">
										{audioExportError}
									</div>
								) : null}
							</div>
						</>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between rounded-b-lg border-slate-200 border-t bg-slate-50 px-6 py-4">
					<button
						className="px-4 py-2 text-slate-700 text-sm transition-colors hover:text-slate-900"
						onClick={handlePreview}
						type="button"
					>
						{showPreview ? "Refresh Preview" : "Preview"}
					</button>
					<div className="flex gap-2">
						<button
							className="px-4 py-2 text-slate-600 text-sm transition-colors hover:text-slate-800"
							onClick={onClose}
							type="button"
						>
							Cancel
						</button>
						<button
							className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700"
							onClick={handleExport}
							type="button"
						>
							<Download className="h-4 w-4" />
							Export
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
