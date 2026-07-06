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
import { useMemo, useState } from "react";
import {
	type AudioExportMode,
	buildSpeakerAudioExportItems,
	buildTurnAudioExportItems,
	downloadAudioExportItems,
	summarizeAudioExportItems,
} from "@/lib/audio-export";
import { downloadExport, type ExportFormat, exportTranscript } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { FileMetaData, Segment, Speaker } from "@/types";

interface ExportModalProps {
	isOpen: boolean;
	onClose: () => void;
	segments: Segment[];
	speakers: Speaker[];
	meta?: Partial<FileMetaData>;
	audioUrl?: string | null;
}

interface FormatOption {
	format: ExportFormat;
	label: string;
	description: string;
	icon: React.ReactNode;
}

const FORMAT_OPTIONS: FormatOption[] = [
	{
		format: "txt",
		label: "Plain Text",
		description: "Simple text with timestamps and speaker names",
		icon: <FileText className="w-5 h-5" />,
	},
	{
		format: "srt",
		label: "SRT Subtitles",
		description: "SubRip format for video players",
		icon: <Subtitles className="w-5 h-5" />,
	},
	{
		format: "vtt",
		label: "WebVTT",
		description: "Web Video Text Tracks for HTML5 video",
		icon: <Subtitles className="w-5 h-5" />,
	},
	{
		format: "json",
		label: "JSON",
		description: "Full project data for backup or import",
		icon: <FileJson className="w-5 h-5" />,
	},
	{
		format: "html",
		label: "HTML",
		description: "Styled webpage with speaker colors",
		icon: <Globe className="w-5 h-5" />,
	},
	{
		format: "csv",
		label: "CSV",
		description: "Spreadsheet-compatible format",
		icon: <Table className="w-5 h-5" />,
	},
];

export default function ExportModal({
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
	const filename = meta?.name?.replace(/\.[^.]+$/, "") ?? "transcript";
	const speakerAudioItems = useMemo(
		() => buildSpeakerAudioExportItems(segments, speakers, filename),
		[filename, segments, speakers]
	);
	const turnAudioItems = useMemo(
		() => buildTurnAudioExportItems(segments, speakers, filename),
		[filename, segments, speakers]
	);

	if (!isOpen) return null;

	const handleExport = () => {
		const content = exportTranscript(selectedFormat, segments, speakers, meta);
		downloadExport(content, filename, selectedFormat);
		onClose();
	};

	const handlePreview = () => {
		const content = exportTranscript(selectedFormat, segments, speakers, meta);
		setPreview(content);
		setShowPreview(true);
	};

	const handleAudioExport = async (mode: AudioExportMode) => {
		if (!audioUrl) return;
		const items = mode === "speaker" ? speakerAudioItems : turnAudioItems;
		if (items.length === 0) return;

		setAudioExportError(null);
		setAudioExportMode(mode);
		try {
			await downloadAudioExportItems(audioUrl, items);
		} catch (error) {
			setAudioExportError(error instanceof Error ? error.message : "Audio export failed.");
		} finally {
			setAudioExportMode(null);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				type="button"
				aria-label="Close export dialog"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
					<h2 className="text-lg font-semibold text-slate-900">Export Transcript</h2>
					<button
						type="button"
						onClick={onClose}
						className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="overflow-y-auto p-6">
					{!showPreview ? (
						<>
							<p className="text-sm text-slate-600 mb-4">
								Choose an export format for your transcript
							</p>

							{/* Format Selection */}
							<div className="space-y-2">
								{FORMAT_OPTIONS.map((option) => (
									<button
										key={option.format}
										type="button"
										onClick={() => setSelectedFormat(option.format)}
										className={cn(
											"w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
											selectedFormat === option.format
												? "border-blue-500 bg-blue-50"
												: "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
										)}
									>
										<div
											className={cn(
												"flex-shrink-0 mt-0.5",
												selectedFormat === option.format ? "text-blue-600" : "text-slate-400"
											)}
										>
											{option.icon}
										</div>
										<div>
											<div
												className={cn(
													"font-medium",
													selectedFormat === option.format ? "text-blue-900" : "text-slate-900"
												)}
											>
												{option.label}
											</div>
											<div className="text-sm text-slate-500">{option.description}</div>
										</div>
									</button>
								))}
							</div>

							{/* Stats */}
							<div className="mt-4 p-3 bg-slate-50 rounded-lg">
								<div className="text-sm text-slate-600">
									<span className="font-medium">{segments.length}</span> segments from{" "}
									<span className="font-medium">{speakers.length}</span> speakers
								</div>
							</div>

							<div className="mt-5 rounded-lg border border-slate-200">
								<div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
									<AudioLines className="h-4 w-4 text-slate-400" />
									Audio
								</div>
								<div className="grid gap-2 p-3 sm:grid-cols-2">
									<button
										type="button"
										disabled={
											!audioUrl || speakerAudioItems.length === 0 || audioExportMode !== null
										}
										onClick={() => handleAudioExport("speaker")}
										className={cn(
											"rounded-lg border p-3 text-left transition-colors",
											audioUrl && speakerAudioItems.length > 0
												? "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
												: "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
										)}
									>
										<div className="flex items-center gap-2 text-sm font-medium">
											<UsersRound className="h-4 w-4" />
											Per speaker
										</div>
										<div className="mt-1 text-xs text-slate-500">
											{speakerAudioItems.length > 0
												? summarizeAudioExportItems(speakerAudioItems)
												: "No speaker ranges"}
										</div>
									</button>

									<button
										type="button"
										disabled={!audioUrl || turnAudioItems.length === 0 || audioExportMode !== null}
										onClick={() => handleAudioExport("turn")}
										className={cn(
											"rounded-lg border p-3 text-left transition-colors",
											audioUrl && turnAudioItems.length > 0
												? "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
												: "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
										)}
									>
										<div className="flex items-center gap-2 text-sm font-medium">
											<MessageSquareText className="h-4 w-4" />
											Per turn
										</div>
										<div className="mt-1 text-xs text-slate-500">
											{turnAudioItems.length > 0
												? summarizeAudioExportItems(turnAudioItems)
												: "No turn ranges"}
										</div>
									</button>
								</div>
								{!audioUrl && (
									<div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
										Load media to export audio slices.
									</div>
								)}
								{audioExportMode && (
									<div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
										Exporting {audioExportMode === "speaker" ? "speaker" : "turn"} audio...
									</div>
								)}
								{audioExportError && (
									<div className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
										{audioExportError}
									</div>
								)}
							</div>
						</>
					) : (
						<>
							{/* Preview */}
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-sm font-medium text-slate-700">Preview</h3>
								<button
									type="button"
									onClick={() => setShowPreview(false)}
									className="text-sm text-blue-600 hover:text-blue-700"
								>
									Back to formats
								</button>
							</div>
							<pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-auto max-h-80 font-mono">
								{preview}
							</pre>
						</>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
					<button
						type="button"
						onClick={handlePreview}
						className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900 transition-colors"
					>
						{showPreview ? "Refresh Preview" : "Preview"}
					</button>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleExport}
							className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
						>
							<Download className="w-4 h-4" />
							Export
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
