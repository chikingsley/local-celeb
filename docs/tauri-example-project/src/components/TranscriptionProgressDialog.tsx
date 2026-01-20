import { AlertCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import type React from "react";
import type { TranscriptionProgress } from "../hooks/useFluidAudio";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Progress } from "./ui/progress";

interface TranscriptionProgressDialogProps {
	open: boolean;
	progress: TranscriptionProgress;
	onCancel?: () => void;
	onClose?: () => void;
}

export const TranscriptionProgressDialog: React.FC<TranscriptionProgressDialogProps> = ({
	open,
	progress,
	onCancel,
	onClose,
}) => {
	const getIcon = () => {
		switch (progress.stage) {
			case "loading-models":
				return <Download className="h-6 w-6 text-blue-500 animate-bounce" />;
			case "transcribing":
				return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
			case "complete":
				return <CheckCircle2 className="h-6 w-6 text-green-500" />;
			case "error":
				return <AlertCircle className="h-6 w-6 text-red-500" />;
			default:
				return null;
		}
	};

	const getTitle = () => {
		switch (progress.stage) {
			case "loading-models":
				return "Loading AI Models";
			case "transcribing":
				return "Transcribing Audio";
			case "complete":
				return "Complete!";
			case "error":
				return "Error";
			default:
				return "Processing";
		}
	};

	const getDescription = () => {
		if (progress.stage === "loading-models") {
			return "Downloading and compiling models for the first time. This may take a few minutes.";
		}
		if (progress.stage === "error" && progress.error) {
			return progress.error;
		}
		return progress.message;
	};

	const canCancel = progress.stage === "loading-models" || progress.stage === "transcribing";
	const canClose = progress.stage === "complete" || progress.stage === "error";

	return (
		<Dialog open={open} onOpenChange={canClose ? onClose : undefined}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3">
						{getIcon()}
						<DialogTitle>{getTitle()}</DialogTitle>
					</div>
					<DialogDescription className="pt-2">{getDescription()}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{progress.stage !== "idle" && progress.stage !== "error" && (
						<>
							<Progress value={progress.progress} className="h-2" />
							<p className="text-sm text-muted-foreground text-center">
								{progress.progress}% complete
							</p>
						</>
					)}

					{progress.stage === "loading-models" && (
						<div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md text-sm">
							<p className="text-blue-900 dark:text-blue-100">
								💡 <strong>First-time setup:</strong> Models are being downloaded from HuggingFace.
								This only happens once and will be cached for future use.
							</p>
						</div>
					)}

					{progress.stage === "transcribing" && (
						<div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md text-sm space-y-2">
							<p className="text-gray-700 dark:text-gray-300">
								<strong>Processing audio with:</strong>
							</p>
							<ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
								<li>Parakeet TDT v3 (25 languages)</li>
								<li>Apple Neural Engine optimization</li>
								<li>Speaker diarization enabled</li>
							</ul>
						</div>
					)}

					{progress.stage === "complete" && (
						<div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
							<p className="text-green-900 dark:text-green-100 text-sm">
								✅ Transcription completed successfully! Check the editor for results.
							</p>
						</div>
					)}

					{progress.stage === "error" && (
						<div className="bg-red-50 dark:bg-red-950 p-3 rounded-md">
							<p className="text-red-900 dark:text-red-100 text-sm">
								<strong>Error details:</strong> {progress.error || "Unknown error occurred"}
							</p>
							<p className="text-red-700 dark:text-red-300 text-xs mt-2">
								Make sure you're running on macOS 14+ or iOS 17+
							</p>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2">
					{canCancel && (
						<Button variant="outline" onClick={onCancel}>
							Cancel
						</Button>
					)}
					{canClose && (
						<Button onClick={onClose}>{progress.stage === "error" ? "Close" : "Done"}</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
