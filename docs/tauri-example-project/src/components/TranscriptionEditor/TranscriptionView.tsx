import { convertFileSrc } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Download, Mic, PanelRightClose, PanelRightOpen, Sparkles, Upload } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useFluidAudio } from "../../hooks/useFluidAudio";
import { useTranscriptionStore } from "../../hooks/useTranscription";
import type { TranscriptionData } from "../../types/transcription";
import { TranscriptionProgressDialog } from "../TranscriptionProgressDialog";
import { ExportService } from "../TranscriptionTools/ExportService";
import { Button } from "../ui/button";
import { AudioPlayer } from "./AudioPlayer";
import { SpeakerManager } from "./SpeakerManager";
import { WordLevelEditor } from "./WordLevelEditor";

interface TranscriptionViewProps {
	className?: string;
}

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({ className = "" }) => {
	const { transcription, setTranscription, setCurrentTime } = useTranscriptionStore();

	const [audioUrl, setAudioUrl] = useState<string | undefined>();
	const [audioPath, setAudioPath] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(false);
	const [showSidebar, setShowSidebar] = useState(true);
	const [showProgressDialog, setShowProgressDialog] = useState(false);

	// FluidAudio integration
	const {
		isLoading: isTranscribing,
		progress,
		transcribe,
		cancel,
	} = useFluidAudio({
		modelVersion: "v3", // Multilingual
		withDiarization: true, // Enable speaker identification
		clusteringThreshold: 0.7,
	});

	const handleFileUpload = async () => {
		try {
			setIsLoading(true);

			const { open: openDialog } = await import("@tauri-apps/plugin-dialog");

			// Open file dialog for multiple files
			const selected = await openDialog({
				multiple: true,
				filters: [
					{
						name: "Audio and JSON files",
						extensions: ["mp3", "wav", "json"],
					},
				],
			});

			if (!selected || selected.length === 0) {
				setIsLoading(false);
				return;
			}

			// Process selected files
			const filePaths = Array.isArray(selected) ? selected : [selected];

			// Find audio and JSON files
			const audioFilePath = filePaths.find(
				(path) => path.endsWith(".mp3") || path.endsWith(".wav")
			);

			const jsonPath = filePaths.find((path) => path.endsWith(".json"));

			if (audioFilePath) {
				// Convert to Tauri's asset protocol for local playback
				const assetUrl = convertFileSrc(audioFilePath);
				console.log("Loading audio:", audioFilePath, "→", assetUrl);
				setAudioUrl(assetUrl);
				setAudioPath(audioFilePath); // Store for transcription

				// If only audio is loaded (no JSON), clear existing transcription
				// to show the "Ready to Transcribe" screen
				if (!jsonPath) {
					setTranscription(null);
				}
			}

			if (jsonPath) {
				const text = await readTextFile(jsonPath);
				const data = JSON.parse(text) as TranscriptionData;

				// Convert the data to our format if needed
				const convertedData: TranscriptionData = {
					language_code: data.language_code || "en",
					segments: data.segments.map((segment, index) => ({
						...segment,
						id: segment.id || `segment-${index}`,
					})),
					speakers: data.speakers || [],
					audio_file: audioFilePath ? audioFilePath.split("/").pop() : undefined,
				};

				setTranscription(convertedData);
			}
		} catch (error) {
			console.error("Error loading files:", error);
			alert("Error loading files. Please check the file format.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleTranscribe = async () => {
		if (!audioPath) {
			alert("Please load an audio file first");
			return;
		}

		try {
			setShowProgressDialog(true);
			const result = await transcribe(audioPath);

			if (!result) {
				// Transcription was cancelled or failed - keep dialog open to show error
				// User will close via the dialog's "Close" button
				return;
			}

			// Convert FluidAudio result to TranscriptionData format
			const speakers = new Set<string>();
			const segments =
				result.segments?.map((seg, index) => {
					if (seg.speakerId) speakers.add(seg.speakerId);

					// Create words array from segment text (simplified - FluidAudio doesn't provide word-level timing yet)
					const words = seg.text
						.split(/\s+/)
						.filter((w) => w.length > 0)
						.map((word) => ({
							text: word,
							start_time: seg.startTime,
							end_time: seg.endTime,
						}));

					return {
						id: `segment-${index}`,
						start_time: seg.startTime,
						end_time: seg.endTime,
						text: seg.text,
						speaker: seg.speakerId || "Unknown",
						words,
					};
				}) || [];

			const transcriptionData: TranscriptionData = {
				language_code: result.language || "en",
				segments,
				speakers: Array.from(speakers).map((id, index) => ({
					id,
					name: `Speaker ${index + 1}`,
					color: getRandomColor(index),
				})),
				audio_file: audioPath.split("/").pop(),
			};

			setTranscription(transcriptionData);
			console.log("Transcription complete:", {
				segments: segments.length,
				speakers: speakers.size,
				confidence: result.confidence,
			});

			// Auto-close dialog after a brief delay to show completion
			setTimeout(() => {
				setShowProgressDialog(false);
			}, 1500);
		} catch (error) {
			console.error("Transcription error:", error);
			alert(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
			setShowProgressDialog(false);
		}
	};

	const handleTimeUpdate = (currentTime: number) => {
		setCurrentTime(currentTime);
	};

	const handleExport = () => {
		if (!transcription) return;

		const dataStr = JSON.stringify(transcription, null, 2);
		const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

		const exportFileDefaultName = "transcription-edited.json";

		const linkElement = document.createElement("a");
		linkElement.setAttribute("href", dataUri);
		linkElement.setAttribute("download", exportFileDefaultName);
		linkElement.click();
	};

	const loadSampleData = async () => {
		try {
			setIsLoading(true);

			// Load the existing sample data
			const response = await fetch("./scar_isolated.json");
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();

			const convertedData: TranscriptionData = {
				language_code: data.language_code || "eng",
				segments: data.segments.map((segment: any, index: number) => ({
					...segment,
					id: `segment-${index}`,
				})),
				speakers: [],
				audio_file: "scar_isolated.mp3",
			};

			setTranscription(convertedData);
			setAudioUrl("./scar_isolated.mp3");
			console.log("Sample data loaded successfully");
		} catch (error) {
			console.error("Error loading sample data:", error);
			alert(`Error loading sample data: ${error}`);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className={`flex flex-col h-full relative ${className}`}>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
				<h1 className="text-2xl font-bold text-gray-900">Transcription Editor</h1>

				<div className="flex items-center space-x-3">
					<Button variant="outline" onClick={handleFileUpload} disabled={isLoading}>
						<Upload className="h-4 w-4 mr-2" />
						Load Files
					</Button>

					{audioPath && !transcription && (
						<Button
							onClick={handleTranscribe}
							disabled={isTranscribing}
							className="bg-blue-600 hover:bg-blue-700 text-white"
						>
							<Sparkles className="h-4 w-4 mr-2" />
							Transcribe Audio
						</Button>
					)}

					<Button variant="outline" onClick={loadSampleData} disabled={isLoading}>
						Load Sample
					</Button>

					<Button variant="outline" onClick={handleExport} disabled={!transcription}>
						<Download className="h-4 w-4 mr-2" />
						Export JSON
					</Button>

					<Button variant="outline" onClick={() => setShowSidebar(!showSidebar)}>
						{showSidebar ? (
							<PanelRightClose className="h-4 w-4" />
						) : (
							<PanelRightOpen className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left Panel - Editor */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* Audio Player */}
					<div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
						<AudioPlayer audioUrl={audioUrl} onTimeUpdate={handleTimeUpdate} />
					</div>

					{/* Transcription Editor */}
					<div className="flex-1 overflow-hidden">
						<WordLevelEditor className="h-full" />
					</div>
				</div>

				{/* Right Sidebar */}
				{showSidebar && (
					<div className="w-80 flex-shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto">
						<div className="p-4 space-y-6">
							<SpeakerManager />
							<ExportService />
						</div>
					</div>
				)}
			</div>

			{/* Status Bar */}
			<div className="flex-shrink-0 p-2 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
				<div className="flex items-center justify-between">
					<div>
						{transcription ? (
							<span>
								{transcription.segments.length} segments •{" "}
								{transcription.segments.reduce((acc, seg) => acc + seg.words.length, 0)} words
								{transcription.speakers && transcription.speakers.length > 0 && (
									<> • {transcription.speakers.length} speakers</>
								)}
							</span>
						) : (
							<span>No transcription loaded</span>
						)}
					</div>

					<div className="flex items-center space-x-4">
						<span>Language: {transcription?.language_code || "N/A"}</span>
						{(isLoading || isTranscribing) && (
							<div className="flex items-center space-x-2">
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
								<span>{isTranscribing ? "Transcribing..." : "Loading..."}</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Progress Dialog */}
			<TranscriptionProgressDialog
				open={showProgressDialog}
				progress={progress}
				onCancel={() => {
					cancel();
					setShowProgressDialog(false);
				}}
				onClose={() => setShowProgressDialog(false)}
			/>

			{/* Help Text */}
			{!transcription && !audioPath && (
				<div className="absolute inset-0 top-16 flex items-center justify-center bg-white bg-opacity-95">
					<div className="text-center p-8 max-w-md">
						<div className="mb-6">
							<Mic className="h-16 w-16 mx-auto text-blue-500 mb-4" />
						</div>
						<h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to Local-Celeb</h2>
						<p className="text-gray-600 mb-6">
							Upload an audio file to transcribe with AI, or load an existing transcription to edit.
						</p>

						{/* Action Buttons */}
						<div className="flex flex-col gap-3 mb-6">
							<Button
								onClick={handleFileUpload}
								disabled={isLoading}
								size="lg"
								className="bg-blue-600 hover:bg-blue-700 text-white"
							>
								<Upload className="h-5 w-5 mr-2" />
								Load Audio File
							</Button>
							<Button variant="outline" onClick={loadSampleData} disabled={isLoading} size="lg">
								Load Sample Data
							</Button>
						</div>

						<div className="space-y-3 text-sm text-left bg-gray-50 p-4 rounded-lg">
							<p className="font-semibold text-gray-900">Powered by FluidAudio</p>
							<p className="text-gray-600">• Parakeet TDT v3 (25 languages)</p>
							<p className="text-gray-600">• Automatic speaker diarization</p>
							<p className="text-gray-600">• Apple Neural Engine optimization</p>
							<p className="text-gray-600">• 100% local, no internet required</p>
						</div>
					</div>
				</div>
			)}

			{audioPath && !transcription && (
				<div className="absolute inset-0 top-16 flex items-center justify-center bg-white bg-opacity-95">
					<div className="text-center p-8 max-w-md">
						<Sparkles className="h-16 w-16 mx-auto text-blue-500 mb-4 animate-pulse" />
						<h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to Transcribe</h2>
						<p className="text-gray-600 mb-6">
							Audio file loaded! Click the "Transcribe Audio" button to generate a transcription
							with speaker identification.
						</p>
						<Button
							onClick={handleTranscribe}
							disabled={isTranscribing}
							size="lg"
							className="bg-blue-600 hover:bg-blue-700 text-white"
						>
							<Sparkles className="h-5 w-5 mr-2" />
							Start Transcription
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};

// Helper function to generate colors for speakers
function getRandomColor(index: number): string {
	const colors = [
		"#3B82F6", // blue
		"#10B981", // green
		"#F59E0B", // amber
		"#EF4444", // red
		"#8B5CF6", // purple
		"#EC4899", // pink
		"#06B6D4", // cyan
		"#F97316", // orange
	];
	return colors[index % colors.length];
}
