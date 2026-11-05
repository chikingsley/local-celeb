import { Eye, Gauge, PanelBottom, PanelRight, SplitSquareHorizontal, X } from "lucide-react";
import type { ChangeEvent, MouseEvent } from "react";
import { useCallback } from "react";
import { TranscriptMode } from "@/app/view-state";
import { cn } from "@/lib/utils";
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "@/stores/player-store";

interface SettingsModalProps {
	isOpen: boolean;
	mode: TranscriptMode;
	onClose: () => void;
	onModeChange: (mode: TranscriptMode) => void;
	onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
	onShowReviewTimestampsChange: (visible: boolean) => void;
	onToggleRightPanel: () => void;
	onToggleTimeline: () => void;
	playbackSpeed: PlaybackSpeed;
	rightPanelCollapsed: boolean;
	showReviewTimestamps: boolean;
	timelineCollapsed: boolean;
}

const MODE_OPTIONS = [
	{ label: "Review", value: TranscriptMode.REVIEW },
	{ label: "Editor", value: TranscriptMode.CLEANUP },
];

export function SettingsModal({
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
	const handleModeClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onModeChange(event.currentTarget.dataset.mode as TranscriptMode);
		},
		[onModeChange]
	);

	const handleShowReviewTimestampsChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onShowReviewTimestampsChange(event.target.checked);
		},
		[onShowReviewTimestampsChange]
	);

	const handlePlaybackSpeedChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onPlaybackSpeedChange(Number(event.target.value) as PlaybackSpeed);
		},
		[onPlaybackSpeedChange]
	);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<button
				aria-label="Close settings"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
				type="button"
			/>
			<div className="relative mx-4 w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
				<div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
					<h2 className="text-lg font-semibold text-slate-900">Settings</h2>
					<button
						className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
						onClick={onClose}
						type="button"
					>
						<X size={18} />
					</button>
				</div>

				<div className="space-y-5 px-5 py-5">
					<section>
						<div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
							<SplitSquareHorizontal size={14} />
							Mode
						</div>
						<div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
							{MODE_OPTIONS.map((item) => (
								<button
									className={cn(
										"h-9 rounded-md text-sm font-medium transition",
										mode === item.value
											? "bg-white text-slate-950 shadow-sm"
											: "text-slate-500 hover:text-slate-800"
									)}
									data-mode={item.value}
									key={item.value}
									onClick={handleModeClick}
									type="button"
								>
									{item.label}
								</button>
							))}
						</div>
					</section>

					<section className="space-y-2">
						<div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
							<Eye size={14} />
							Review Display
						</div>
						<label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5">
							<span className="text-sm font-medium text-slate-700">Turn timestamps</span>
							<input
								checked={showReviewTimestamps}
								className="h-4 w-4"
								onChange={handleShowReviewTimestampsChange}
								type="checkbox"
							/>
						</label>
					</section>

					<section className="space-y-2">
						<div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
							<PanelRight size={14} />
							Panels
						</div>
						<button
							className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
							onClick={onToggleRightPanel}
							type="button"
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
							className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
							onClick={onToggleTimeline}
							type="button"
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
							<span className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
								<Gauge size={14} />
								Playback Speed
							</span>
							<select
								className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								onChange={handlePlaybackSpeedChange}
								value={playbackSpeed}
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
