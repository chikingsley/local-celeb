import { Command } from "cmdk";
import {
	ChevronRight,
	Download,
	FileText,
	Keyboard,
	Pause,
	Play,
	Redo,
	Search,
	Settings,
	Undo,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
	isOpen: boolean;
	onClose: () => void;
	isPlaying: boolean;
	canUndo: boolean;
	canRedo: boolean;
	onTogglePlay: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onOpenFind: () => void;
	onOpenFindReplace: () => void;
	onOpenExport: () => void;
	onOpenSettings: () => void;
}

interface CommandItem {
	id: string;
	label: string;
	icon: React.ReactNode;
	shortcut?: string;
	action: () => void;
	disabled?: boolean;
	category: string;
}

export default function CommandPalette({
	isOpen,
	onClose,
	isPlaying,
	canUndo,
	canRedo,
	onTogglePlay,
	onUndo,
	onRedo,
	onOpenFind,
	onOpenFindReplace,
	onOpenExport,
	onOpenSettings,
}: CommandPaletteProps) {
	const [showShortcuts, setShowShortcuts] = useState(false);

	const commands: CommandItem[] = [
		{
			id: "toggle-play",
			label: isPlaying ? "Pause Playback" : "Play Playback",
			icon: isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />,
			shortcut: "Space",
			action: onTogglePlay,
			category: "Playback",
		},
		{
			id: "find",
			label: "Find in Transcript",
			icon: <Search className="w-4 h-4" />,
			shortcut: "⌘F",
			action: onOpenFind,
			category: "Search",
		},
		{
			id: "find-replace",
			label: "Find and Replace",
			icon: <FileText className="w-4 h-4" />,
			shortcut: "⌘H",
			action: onOpenFindReplace,
			category: "Search",
		},
		{
			id: "export",
			label: "Export Transcript",
			icon: <Download className="w-4 h-4" />,
			shortcut: "⌘E",
			action: onOpenExport,
			category: "File",
		},
		{
			id: "undo",
			label: "Undo",
			icon: <Undo className="w-4 h-4" />,
			shortcut: "⌘Z",
			action: onUndo,
			disabled: !canUndo,
			category: "Edit",
		},
		{
			id: "redo",
			label: "Redo",
			icon: <Redo className="w-4 h-4" />,
			shortcut: "⌘⇧Z",
			action: onRedo,
			disabled: !canRedo,
			category: "Edit",
		},
		{
			id: "shortcuts",
			label: "Keyboard Shortcuts",
			icon: <Keyboard className="w-4 h-4" />,
			action: () => setShowShortcuts(true),
			category: "Help",
		},
		{
			id: "settings",
			label: "Settings",
			icon: <Settings className="w-4 h-4" />,
			shortcut: "⌘,",
			action: onOpenSettings,
			category: "Preferences",
		},
	];

	const handleSelect = useCallback(
		(item: CommandItem) => {
			if (item.disabled) return;
			item.action();
			if (item.id !== "shortcuts") {
				onClose();
			}
		},
		[onClose]
	);

	// Reset shortcuts view when closing
	useEffect(() => {
		if (!isOpen) {
			setShowShortcuts(false);
		}
	}, [isOpen]);

	if (!isOpen) return null;

	// Group shortcuts by category
	const shortcutsByCategory = KEYBOARD_SHORTCUTS.reduce(
		(acc, shortcut) => {
			if (!acc[shortcut.category]) {
				acc[shortcut.category] = [];
			}
			acc[shortcut.category].push(shortcut);
			return acc;
		},
		{} as Record<string, (typeof KEYBOARD_SHORTCUTS)[number][]>
	);

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
			{/* Backdrop */}
			<button
				type="button"
				aria-label="Close command palette"
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Command Dialog */}
			<Command
				className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
				loop
			>
				{!showShortcuts ? (
					<>
						{/* Search Input */}
						<div className="flex items-center border-b border-slate-200 px-3">
							<Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
							<Command.Input
								placeholder="Type a command or search..."
								className="flex-1 px-3 py-3 text-sm outline-none placeholder:text-slate-400"
								autoFocus
							/>
						</div>

						{/* Command List */}
						<Command.List className="max-h-80 overflow-y-auto p-2">
							<Command.Empty className="py-6 text-center text-sm text-slate-500">
								No commands found.
							</Command.Empty>

							{/* Group commands by category */}
							{["Playback", "Search", "Edit", "File", "Help", "Preferences"].map((category) => {
								const categoryCommands = commands.filter((c) => c.category === category);
								if (categoryCommands.length === 0) return null;

								return (
									<Command.Group key={category} heading={category}>
										{categoryCommands.map((item) => (
											<Command.Item
												key={item.id}
												value={item.label}
												onSelect={() => handleSelect(item)}
												disabled={item.disabled}
												className={cn(
													"flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm",
													"data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-900",
													item.disabled && "opacity-50 cursor-not-allowed"
												)}
											>
												<span className="text-slate-500">{item.icon}</span>
												<span className="flex-1">{item.label}</span>
												{item.shortcut && (
													<span className="text-xs text-slate-400 font-mono">{item.shortcut}</span>
												)}
												{item.id === "shortcuts" && (
													<ChevronRight className="w-4 h-4 text-slate-400" />
												)}
											</Command.Item>
										))}
									</Command.Group>
								);
							})}
						</Command.List>
					</>
				) : (
					<>
						{/* Shortcuts View */}
						<div className="flex items-center border-b border-slate-200 px-4 py-3">
							<button
								type="button"
								onClick={() => setShowShortcuts(false)}
								className="text-sm text-blue-600 hover:text-blue-700"
							>
								← Back
							</button>
							<span className="flex-1 text-center text-sm font-medium text-slate-900">
								Keyboard Shortcuts
							</span>
							<div className="w-12" /> {/* Spacer for centering */}
						</div>

						<div className="max-h-80 overflow-y-auto p-4">
							{Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
								<div key={category} className="mb-4 last:mb-0">
									<h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
										{category}
									</h3>
									<div className="space-y-1">
										{shortcuts.map((shortcut) => (
											<div
												key={`${shortcut.category}-${shortcut.key}-${shortcut.description}`}
												className="flex items-center justify-between py-1.5"
											>
												<span className="text-sm text-slate-700">{shortcut.description}</span>
												<kbd className="px-2 py-1 text-xs font-mono bg-slate-100 rounded text-slate-600">
													{shortcut.key}
												</kbd>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{/* Footer */}
				<div className="border-t border-slate-100 px-4 py-2 bg-slate-50">
					<div className="flex items-center justify-between text-xs text-slate-500">
						<span>
							<kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">
								↑↓
							</kbd>{" "}
							to navigate
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">
								↵
							</kbd>{" "}
							to select
						</span>
						<span>
							<kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono">
								esc
							</kbd>{" "}
							to close
						</span>
					</div>
				</div>
			</Command>
		</div>
	);
}
