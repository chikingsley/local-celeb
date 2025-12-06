import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
	};
})();

Object.defineProperty(window, "localStorage", {
	value: localStorageMock,
});

// Clear localStorage before each test
beforeEach(() => {
	localStorageMock.clear();
});

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}),
});

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(URL, "createObjectURL", {
	writable: true,
	value: () => "blob:mock-url",
});

Object.defineProperty(URL, "revokeObjectURL", {
	writable: true,
	value: () => {},
});
