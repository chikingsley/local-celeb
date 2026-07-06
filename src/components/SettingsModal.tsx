import { Eye, Gauge, PanelBottom, PanelRight, SplitSquareHorizontal, X } from "lucide-react";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "@/stores/player-store";
import { TranscriptMode } from "@/types";

interface SettingsModalProps {
	isOpen: boolean;
	mode: TranscriptMode;
	showReviewTimestamps: boolean;
	timelineCollapsed: boolean;
	rightPanelCollapsed: boolean;
	playbackSpeed: PlaybackSpeed;
	onClose: () => void;
	onModeChange: (mode: TranscriptMode) => void;
	onShowReviewTimestampsChange: (visible: boolean) => void;
	onToggleTimeline: () => void;
	onToggleRightPanel: () => void;
	onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
}

export default function SettingsModal({
	isOpen,
	mode,
	showReviewTimestamps,
	timelineCollapsed,
	rightPanelCollapsed,
	playbackSpeed,
	onClose,
	onModeChange,
	onShowReviewTimestampsChange,
	onToggleTimeline,
	onToggleRightPanel,
	onPlaybackSpeedChange,
}: SettingsModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				type="button"
				aria-label="Close settings"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative mx-4 w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
				<div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
					<h2 className="text-lg font-semibold text-slate-900">Settings</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
					>
						<X size={18} />
					</button>
				</div>

				<div className="space-y-5 px-5 py-5">
					<section>
						<div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
							<SplitSquareHorizontal size={14} />
							Mode
						</div>
						<div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
							{[
								{ label: "Review", value: TranscriptMode.REVIEW },
								{ label: "Editor", value: TranscriptMode.CLEANUP },
							].map((item) => (
								<button
									key={item.value}
									type="button"
									onClick={() => onModeChange(item.value)}
									className={`h-9 rounded-md text-sm font-medium transition ${
										mode === item.value
											? "bg-white text-slate-950 shadow-sm"
											: "text-slate-500 hover:text-slate-800"
									}`}
								>
									{item.label}
								</button>
							))}
						</div>
					</section>

					<section className="space-y-2">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
							<Eye size={14} />
							Review Display
						</div>
						<label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
							<span className="text-sm font-medium text-slate-700">Turn timestamps</span>
							<input
								type="checkbox"
								checked={showReviewTimestamps}
								onChange={(event) => onShowReviewTimestampsChange(event.target.checked)}
								className="h-4 w-4"
							/>
						</label>
					</section>

					<section className="space-y-2">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
							<PanelRight size={14} />
							Panels
						</div>
						<button
							type="button"
							onClick={onToggleRightPanel}
							className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						>
							<span className="flex items-center gap-2">
								<PanelRight size={15} />
								Right panel
							</span>
							<span className="text-xs text-slate-400">
								{rightPanelCollapsed ? "Hidden" : "Visible"}
							</span>
						</button>
						<button
							type="button"
							onClick={onToggleTimeline}
							className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						>
							<span className="flex items-center gap-2">
								<PanelBottom size={15} />
								Timeline
							</span>
							<span className="text-xs text-slate-400">
								{timelineCollapsed ? "Hidden" : "Visible"}
							</span>
						</button>
					</section>

					<section>
						<label className="space-y-2">
							<span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
								<Gauge size={14} />
								Playback Speed
							</span>
							<select
								value={playbackSpeed}
								onChange={(event) =>
									onPlaybackSpeedChange(Number(event.target.value) as PlaybackSpeed)
								}
								className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
							>
								{PLAYBACK_SPEEDS.map((speed) => (
									<option key={speed} value={speed}>
										{speed}x
									</option>
								))}
							</select>
						</label>
					</section>
				</div>
			</div>
		</div>
	);
}
