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
import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { TranscriptMode } from "@/app/view-state";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
	canRedo: boolean;
	canUndo: boolean;
	lastSavedAt: number | null;
	mode: TranscriptMode;
	onExport: () => void;
	onFind: () => void;
	onModeChange: (mode: TranscriptMode) => void;
	onRedo: () => void;
	onSettings: () => void;
	onToggleRightPanel: () => void;
	onToggleTimeline: () => void;
	onUndo: () => void;
	rightPanelCollapsed: boolean;
	timelineCollapsed: boolean;
}

const MODE_OPTIONS = [
	{ label: "Review", value: TranscriptMode.REVIEW },
	{ label: "Editor", value: TranscriptMode.CLEANUP },
];

function formatRelativeTime(timestamp: number | null): string {
	if (!timestamp) {
		return "Not saved";
	}

	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (seconds < 5) {
		return "Saved just now";
	}
	if (seconds < 60) {
		return `Saved ${seconds}s ago`;
	}
	if (minutes < 60) {
		return `Saved ${minutes}m ago`;
	}
	if (hours < 24) {
		return `Saved ${hours}h ago`;
	}
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
		const interval = setInterval(() => setTick((t) => t + 1), 10_000);
		return () => clearInterval(interval);
	}, []);

	const handleModeClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onModeChange(event.currentTarget.dataset.mode as TranscriptMode);
		},
		[onModeChange]
	);

	return (
		<header className="z-20 flex h-14 shrink-0 items-center justify-between border-slate-200 border-b bg-white px-4">
			<div className="flex items-center gap-4">
				<SidebarTrigger className="-ml-1 text-slate-500" />
				<div className="mx-1 h-4 w-px bg-slate-200" />
				<div className="flex items-center gap-1 text-slate-400">
					<button
						className={cn(
							"rounded-lg p-2 transition-colors",
							canUndo ? "text-slate-600 hover:bg-slate-100" : "cursor-not-allowed opacity-50"
						)}
						disabled={!canUndo}
						onClick={onUndo}
						type="button"
					>
						<Undo2 size={18} />
					</button>
					<button
						className={cn(
							"rounded-lg p-2 transition-colors",
							canRedo ? "text-slate-600 hover:bg-slate-100" : "cursor-not-allowed opacity-50"
						)}
						disabled={!canRedo}
						onClick={onRedo}
						type="button"
					>
						<Redo2 size={18} />
					</button>
				</div>
				<div className="mx-2 h-4 w-px bg-slate-200" />
				<div className="flex items-center gap-1.5 text-slate-500 text-xs">
					<span
						className={cn(
							"h-1.5 w-1.5 rounded-full",
							lastSavedAt ? "bg-emerald-500" : "bg-slate-300"
						)}
					/>
					{formatRelativeTime(lastSavedAt)}
				</div>
			</div>

			<div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
				{MODE_OPTIONS.map((item) => (
					<button
						className={cn(
							"h-8 rounded-md px-4 font-medium text-sm transition-colors",
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

			<div className="flex items-center gap-3">
				<button
					className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-slate-600 text-sm transition-colors hover:bg-slate-100"
					onClick={onFind}
					type="button"
				>
					<Search size={16} />
					Find
				</button>
				<div className="h-5 w-px bg-slate-200" />
				<button
					className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
					onClick={onToggleTimeline}
					title={timelineCollapsed ? "Show timeline" : "Hide timeline"}
					type="button"
				>
					{timelineCollapsed ? <PanelBottomOpen size={17} /> : <PanelBottomClose size={17} />}
				</button>
				<button
					className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
					onClick={onToggleRightPanel}
					title={rightPanelCollapsed ? "Show properties" : "Hide properties"}
					type="button"
				>
					{rightPanelCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
				</button>
				<button
					className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
					onClick={onSettings}
					title="Settings"
					type="button"
				>
					<Settings size={17} />
				</button>
				<button
					className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-1.5 font-medium text-sm text-white shadow-sm transition-colors hover:bg-slate-800"
					onClick={onExport}
					type="button"
				>
					<Download size={16} /> Export
				</button>
			</div>
		</header>
	);
}
