import { ArrowRight, Sparkles, Upload } from "lucide-react";

interface WelcomeScreenProps {
	isProcessing: boolean;
	loadingMessage: string;
	onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onLoadSample: () => void;
}

export function WelcomeScreen({
	isProcessing,
	loadingMessage,
	onFileUpload,
	onLoadSample,
}: WelcomeScreenProps) {
	return (
		<div className="flex flex-col items-center justify-center min-h-full p-6 font-sans bg-white">
			<div className="max-w-2xl w-full text-center">
				{/* Title */}
				<h1 className="text-5xl font-semibold text-slate-900 mb-4 tracking-tight">
					Local Celeb
				</h1>
				<p className="text-xl text-slate-500 mb-16">
					AI-powered transcription editor
				</p>

				{isProcessing ? (
					<div className="flex flex-col items-center justify-center py-12">
						<div className="relative">
							<div className="h-12 w-12 rounded-full border-2 border-slate-200" />
							<div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
						</div>
						<p className="text-slate-600 mt-6 text-lg">{loadingMessage}</p>
					</div>
				) : (
					<>
						{/* Upload Area */}
						<label className="group block w-full cursor-pointer">
							<div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50/50">
								<div className="flex flex-col items-center gap-4">
									<div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
										<Upload className="h-6 w-6 text-slate-600" />
									</div>
									<div>
										<p className="text-lg font-medium text-slate-900">
											Drop your audio or video file here
										</p>
										<p className="text-slate-500 mt-1">
											or click to browse
										</p>
									</div>
								</div>
							</div>
							<input
								type="file"
								accept="audio/*,video/*"
								className="hidden"
								onChange={onFileUpload}
							/>
						</label>

						{/* Divider */}
						<div className="flex items-center gap-4 my-8">
							<div className="flex-1 h-px bg-slate-200" />
							<span className="text-sm text-slate-400">or</span>
							<div className="flex-1 h-px bg-slate-200" />
						</div>

						{/* Sample Button */}
						<button
							type="button"
							onClick={onLoadSample}
							className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all"
						>
							<Sparkles size={18} className="text-amber-500" />
							<span>Try with a sample</span>
							<ArrowRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
						</button>

						{/* Features hint */}
						<p className="text-sm text-slate-400 mt-12">
							Word-level timestamps, speaker labels, export to SRT/VTT/JSON
						</p>
					</>
				)}
			</div>
		</div>
	);
}

export default WelcomeScreen;
