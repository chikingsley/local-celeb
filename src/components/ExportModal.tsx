import { Download, FileJson, FileText, Globe, Subtitles, Table, X } from "lucide-react";
import { useState } from "react";
import { downloadExport, type ExportFormat, exportTranscript } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { FileMetaData, Segment, Speaker } from "@/types";

interface ExportModalProps {
	isOpen: boolean;
	onClose: () => void;
	segments: Segment[];
	speakers: Speaker[];
	meta?: Partial<FileMetaData>;
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
}: ExportModalProps) {
	const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("txt");
	const [preview, setPreview] = useState<string>("");
	const [showPreview, setShowPreview] = useState(false);

	if (!isOpen) return null;

	const handleExport = () => {
		const content = exportTranscript(selectedFormat, segments, speakers, meta);
		const filename = meta?.name?.replace(/\.[^.]+$/, "") ?? "transcript";
		downloadExport(content, filename, selectedFormat);
		onClose();
	};

	const handlePreview = () => {
		const content = exportTranscript(selectedFormat, segments, speakers, meta);
		setPreview(content);
		setShowPreview(true);
	};

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			onClick={handleBackdropClick}
		>
			<div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
					<h2 className="text-lg font-semibold text-slate-900">Export Transcript</h2>
					<button
						onClick={onClose}
						className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="p-6">
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
						</>
					) : (
						<>
							{/* Preview */}
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-sm font-medium text-slate-700">Preview</h3>
								<button
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
						onClick={handlePreview}
						className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900 transition-colors"
					>
						{showPreview ? "Refresh Preview" : "Preview"}
					</button>
					<div className="flex gap-2">
						<button
							onClick={onClose}
							className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
						>
							Cancel
						</button>
						<button
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
