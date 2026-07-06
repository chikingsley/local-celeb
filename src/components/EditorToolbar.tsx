import {
	Download,
	PanelBottomClose,
	PanelBottomOpen,
	PanelRightClose,
	PanelRightOpen,
	Redo2,
	Search,
	Settings,
	Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TranscriptMode } from "@/types";

interface EditorToolbarProps {
	mode: TranscriptMode;
	canUndo: boolean;
	canRedo: boolean;
	lastSavedAt: number | null;
	timelineCollapsed: boolean;
	rightPanelCollapsed: boolean;
	onModeChange: (mode: TranscriptMode) => void;
	onUndo: () => void;
	onRedo: () => void;
	onFind: () => void;
	onToggleTimeline: () => void;
	onToggleRightPanel: () => void;
	onSettings: () => void;
	onExport: () => void;
}

function formatRelativeTime(timestamp: number | null): string {
	if (!timestamp) return "Not saved";

	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (seconds < 5) return "Saved just now";
	if (seconds < 60) return `Saved ${seconds}s ago`;
	if (minutes < 60) return `Saved ${minutes}m ago`;
	if (hours < 24) return `Saved ${hours}h ago`;
	return `Saved ${Math.floor(hours / 24)}d ago`;
}

export function EditorToolbar({
	mode,
	canUndo,
	canRedo,
	lastSavedAt,
	timelineCollapsed,
	rightPanelCollapsed,
	onModeChange,
	onUndo,
	onRedo,
	onFind,
	onToggleTimeline,
	onToggleRightPanel,
	onSettings,
	onExport,
}: EditorToolbarProps) {
	// Force re-render every 10s to update relative time
	const [, setTick] = useState(0);
	useEffect(() => {
		const interval = setInterval(() => setTick((t) => t + 1), 10000);
		return () => clearInterval(interval);
	}, []);

	return (
		<header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0 z-20">
			<div className="flex items-center gap-4">
				<div className="flex items-center gap-1 text-slate-400">
					<button
						type="button"
						onClick={onUndo}
						disabled={!canUndo}
						className={cn(
							"p-2 rounded-lg transition-colors",
							canUndo ? "hover:bg-slate-100 text-slate-600" : "opacity-50 cursor-not-allowed"
						)}
					>
						<Undo2 size={18} />
					</button>
					<button
						type="button"
						onClick={onRedo}
						disabled={!canRedo}
						className={cn(
							"p-2 rounded-lg transition-colors",
							canRedo ? "hover:bg-slate-100 text-slate-600" : "opacity-50 cursor-not-allowed"
						)}
					>
						<Redo2 size={18} />
					</button>
				</div>
				<div className="h-4 w-px bg-slate-200 mx-2" />
				<div className="flex items-center gap-1.5 text-xs text-slate-500">
					<span
						className={cn(
							"w-1.5 h-1.5 rounded-full",
							lastSavedAt ? "bg-emerald-500" : "bg-slate-300"
						)}
					/>
					{formatRelativeTime(lastSavedAt)}
				</div>
			</div>

			<div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
				{[
					{ label: "Review", value: TranscriptMode.REVIEW },
					{ label: "Editor", value: TranscriptMode.CLEANUP },
				].map((item) => (
					<button
						key={item.value}
						type="button"
						onClick={() => onModeChange(item.value)}
						className={cn(
							"h-8 px-4 text-sm font-medium rounded-md transition-colors",
							mode === item.value
								? "bg-white text-slate-950 shadow-sm"
								: "text-slate-500 hover:text-slate-800"
						)}
					>
						{item.label}
					</button>
				))}
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onFind}
					className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
				>
					<Search size={16} />
					Find
				</button>
				<div className="h-5 w-px bg-slate-200" />
				<button
					type="button"
					onClick={onToggleTimeline}
					className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
					title={timelineCollapsed ? "Show timeline" : "Hide timeline"}
				>
					{timelineCollapsed ? <PanelBottomOpen size={17} /> : <PanelBottomClose size={17} />}
				</button>
				<button
					type="button"
					onClick={onToggleRightPanel}
					className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
					title={rightPanelCollapsed ? "Show properties" : "Hide properties"}
				>
					{rightPanelCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
				</button>
				<button
					type="button"
					onClick={onSettings}
					className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
					title="Settings"
				>
					<Settings size={17} />
				</button>
				<button
					type="button"
					onClick={onExport}
					className="flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
				>
					<Download size={16} /> Export
				</button>
			</div>
		</header>
	);
}

export default EditorToolbar;
