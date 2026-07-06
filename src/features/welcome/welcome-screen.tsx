import { ArrowRight, FileText, Sparkles, Upload, Users } from "lucide-react";

interface WelcomeScreenProps {
	isProcessing: boolean;
	loadingMessage: string;
	onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onLoadMultiSpeakerSample: () => void;
	onLoadSample: () => void;
	onTranscriptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function WelcomeScreen({
	isProcessing,
	loadingMessage,
	onFileUpload,
	onTranscriptUpload,
	onLoadSample,
	onLoadMultiSpeakerSample,
}: WelcomeScreenProps) {
	return (
		<div className="flex min-h-full flex-col items-center justify-center bg-white p-6 font-sans">
			<div className="w-full max-w-2xl text-center">
				{/* Title */}
				<h1 className="mb-4 font-semibold text-5xl text-slate-900 tracking-tight">Local Celeb</h1>
				<p className="mb-16 text-slate-500 text-xl">Local transcript review and editor</p>

				{isProcessing ? (
					<div className="flex flex-col items-center justify-center py-12">
						<div className="relative">
							<div className="h-12 w-12 rounded-full border-2 border-slate-200" />
							<div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
						</div>
						<p className="mt-6 text-lg text-slate-600">{loadingMessage}</p>
					</div>
				) : (
					<>
						<div className="grid gap-4 sm:grid-cols-2">
							{/* Upload Area */}
							<label className="group block w-full cursor-pointer">
								<div className="h-full rounded-2xl border-2 border-slate-200 border-dashed p-8 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50/50">
									<div className="flex flex-col items-center gap-4">
										<div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-slate-200">
											<Upload className="h-6 w-6 text-slate-600" />
										</div>
										<div>
											<p className="font-medium text-lg text-slate-900">Media + subtitles</p>
											<p className="mt-1 text-slate-500">Audio/video with SRT or VTT</p>
										</div>
									</div>
								</div>
								<input
									accept="audio/*,video/*,.srt,.vtt,.webvtt,text/vtt"
									className="hidden"
									multiple
									onChange={onFileUpload}
									type="file"
								/>
							</label>

							<label className="group block w-full cursor-pointer">
								<div className="h-full rounded-2xl border-2 border-slate-200 border-dashed p-8 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50/50">
									<div className="flex flex-col items-center gap-4">
										<div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-slate-200">
											<FileText className="h-6 w-6 text-slate-600" />
										</div>
										<div>
											<p className="font-medium text-lg text-slate-900">Transcript file</p>
											<p className="mt-1 text-slate-500">JSON, JSONL, SRT, or VTT</p>
										</div>
									</div>
								</div>
								<input
									accept=".json,.jsonl,.srt,.vtt,application/json,text/plain,text/vtt"
									className="hidden"
									onChange={onTranscriptUpload}
									type="file"
								/>
							</label>
						</div>

						{/* Divider */}
						<div className="my-8 flex items-center gap-4">
							<div className="h-px flex-1 bg-slate-200" />
							<span className="text-slate-400 text-sm">or</span>
							<div className="h-px flex-1 bg-slate-200" />
						</div>

						{/* Sample Buttons */}
						<div className="flex flex-wrap justify-center gap-3">
							<button
								className="group inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-3 font-medium text-slate-700 transition-all hover:bg-slate-200"
								onClick={onLoadSample}
								type="button"
							>
								<Sparkles className="text-amber-500" size={18} />
								<span>Try Scar sample</span>
								<ArrowRight
									className="text-slate-400 transition-transform group-hover:translate-x-0.5"
									size={16}
								/>
							</button>
							<button
								className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 font-medium text-white transition-all hover:bg-slate-800"
								onClick={onLoadMultiSpeakerSample}
								type="button"
							>
								<Users className="text-emerald-300" size={18} />
								<span>Try speaker sample</span>
								<ArrowRight
									className="text-slate-400 transition-transform group-hover:translate-x-0.5"
									size={16}
								/>
							</button>
						</div>

						{/* Features hint */}
						<p className="mt-12 text-slate-400 text-sm">
							Word-level timestamps, speaker labels, export to SRT/VTT/JSON
						</p>
					</>
				)}
			</div>
		</div>
	);
}
