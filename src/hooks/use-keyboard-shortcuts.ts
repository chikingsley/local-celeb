import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface KeyboardShortcutsConfig {
	currentTime: number;
	duration: number;
	onEscape?: () => void;
	onOpenExport?: () => void;
	onOpenFind?: () => void;
	onOpenFindReplace?: () => void;
	onOpenSettings?: () => void;
	onRedo?: () => void;
	onSeek: (time: number) => void;
	onTogglePlay: () => void;
	onUndo?: () => void;
}

/**
 * Hook to manage global keyboard shortcuts
 */
export function useKeyboardShortcuts({
	onTogglePlay,
	onSeek,
	currentTime,
	duration,
	onUndo,
	onRedo,
	onOpenFind,
	onOpenFindReplace,
	onOpenExport,
	onOpenSettings,
	onEscape,
}: KeyboardShortcutsConfig) {
	// Seek forward/backward helpers
	const seekBy = useCallback(
		(seconds: number) => {
			const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
			onSeek(newTime);
		},
		[currentTime, duration, onSeek]
	);

	// Play/Pause - Space (when not in input)
	useHotkeys(
		"space",
		(e) => {
			e.preventDefault();
			onTogglePlay();
		},
		{
			enableOnFormTags: false, // Don't trigger when typing in inputs
		}
	);

	// Seek backward 5s - Left Arrow
	useHotkeys(
		"left",
		(e) => {
			e.preventDefault();
			seekBy(-5);
		},
		{ enableOnFormTags: false }
	);

	// Seek forward 5s - Right Arrow
	useHotkeys(
		"right",
		(e) => {
			e.preventDefault();
			seekBy(5);
		},
		{ enableOnFormTags: false }
	);

	// Seek backward 1s - Shift+Left
	useHotkeys(
		"shift+left",
		(e) => {
			e.preventDefault();
			seekBy(-1);
		},
		{ enableOnFormTags: false }
	);

	// Seek forward 1s - Shift+Right
	useHotkeys(
		"shift+right",
		(e) => {
			e.preventDefault();
			seekBy(1);
		},
		{ enableOnFormTags: false }
	);

	// J/K/L playback controls (like video editors)
	// J = rewind, K = pause, L = forward
	useHotkeys(
		"j",
		(e) => {
			e.preventDefault();
			seekBy(-5);
		},
		{ enableOnFormTags: false }
	);

	useHotkeys(
		"k",
		(e) => {
			e.preventDefault();
			onTogglePlay();
		},
		{ enableOnFormTags: false }
	);

	useHotkeys(
		"l",
		(e) => {
			e.preventDefault();
			seekBy(5);
		},
		{ enableOnFormTags: false }
	);

	// Undo - Cmd/Ctrl+Z
	useHotkeys(
		"mod+z",
		(e) => {
			e.preventDefault();
			onUndo?.();
		},
		{ enableOnFormTags: false }
	);

	// Redo - Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
	useHotkeys(
		"mod+shift+z, mod+y",
		(e) => {
			e.preventDefault();
			onRedo?.();
		},
		{ enableOnFormTags: false }
	);

	// Find - Cmd/Ctrl+F
	useHotkeys(
		"mod+f",
		(e) => {
			e.preventDefault();
			onOpenFind?.();
		},
		{ enableOnFormTags: true } // Allow even in inputs
	);

	// Find & Replace - Cmd/Ctrl+H
	useHotkeys(
		"mod+h",
		(e) => {
			e.preventDefault();
			onOpenFindReplace?.();
		},
		{ enableOnFormTags: true }
	);

	// Export - Cmd/Ctrl+E
	useHotkeys(
		"mod+e",
		(e) => {
			e.preventDefault();
			onOpenExport?.();
		},
		{ enableOnFormTags: false }
	);

	// Settings - Cmd/Ctrl+,
	useHotkeys(
		"mod+,",
		(e) => {
			e.preventDefault();
			onOpenSettings?.();
		},
		{ enableOnFormTags: false }
	);

	// Escape - Close panels
	useHotkeys(
		"escape",
		(e) => {
			e.preventDefault();
			onEscape?.();
		},
		{ enableOnFormTags: true }
	);
}
