import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface KeyboardShortcutsConfig {
	onTogglePlay: () => void;
	onSeek: (time: number) => void;
	currentTime: number;
	duration: number;
	onUndo?: () => void;
	onRedo?: () => void;
	onOpenFind?: () => void;
	onOpenFindReplace?: () => void;
	onOpenCommandPalette?: () => void;
	onOpenExport?: () => void;
	onOpenSettings?: () => void;
	onEscape?: () => void;
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
	onOpenCommandPalette,
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

	// Command Palette - Cmd/Ctrl+K
	useHotkeys(
		"mod+k",
		(e) => {
			e.preventDefault();
			onOpenCommandPalette?.();
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

/**
 * Keyboard shortcut definitions for display in UI
 */
export const KEYBOARD_SHORTCUTS = [
	{ key: "Space", description: "Play / Pause", category: "Playback" },
	{ key: "←", description: "Seek back 5s", category: "Playback" },
	{ key: "→", description: "Seek forward 5s", category: "Playback" },
	{ key: "Shift+←", description: "Seek back 1s", category: "Playback" },
	{ key: "Shift+→", description: "Seek forward 1s", category: "Playback" },
	{ key: "J", description: "Seek back 5s", category: "Playback" },
	{ key: "K", description: "Play / Pause", category: "Playback" },
	{ key: "L", description: "Seek forward 5s", category: "Playback" },
	{ key: "⌘Z", description: "Undo", category: "Editing" },
	{ key: "⌘⇧Z", description: "Redo", category: "Editing" },
	{ key: "⌘F", description: "Find", category: "Search" },
	{ key: "⌘H", description: "Find & Replace", category: "Search" },
	{ key: "⌘K", description: "Command Palette", category: "Navigation" },
	{ key: "⌘E", description: "Export", category: "File" },
	{ key: "⌘,", description: "Settings", category: "Navigation" },
	{ key: "Escape", description: "Close panel", category: "Navigation" },
] as const;
