import { beforeEach, describe, expect, it } from "vitest";
import { AppView, DEFAULT_SPEAKERS } from "@/types";
import { createSpeakersFromSegments, useProjectStore } from "./project-store";

describe("useProjectStore", () => {
	beforeEach(() => {
		// Reset store before each test
		useProjectStore.setState({
			view: AppView.WELCOME,
			file: null,
			audioUrl: null,
			meta: { name: "Untitled Project", duration: 0, language: "English", date: "" },
			isProcessing: false,
			loadingMessage: "",
			segments: [],
			speakers: DEFAULT_SPEAKERS,
			past: [],
			future: [],
			selectedSegmentId: null,
		});
	});

	it("should have initial state", () => {
		const state = useProjectStore.getState();
		expect(state.view).toBe(AppView.WELCOME);
		expect(state.segments).toEqual([]);
		expect(state.speakers).toEqual(DEFAULT_SPEAKERS);
	});

	it("should set view", () => {
		const { setView } = useProjectStore.getState();
		setView(AppView.EDITOR);
		expect(useProjectStore.getState().view).toBe(AppView.EDITOR);
	});

	it("should set processing state", () => {
		const { setProcessing } = useProjectStore.getState();
		setProcessing(true, "Loading...");

		const state = useProjectStore.getState();
		expect(state.isProcessing).toBe(true);
		expect(state.loadingMessage).toBe("Loading...");
	});

	it("should update segment", () => {
		// Set initial segments
		useProjectStore.setState({
			segments: [
				{ id: "1", speakerId: "speaker_1", startTime: "00:00", endTime: "00:05", text: "Hello" },
			],
		});

		const { updateSegment } = useProjectStore.getState();
		updateSegment("1", { text: "Hello World" });

		const state = useProjectStore.getState();
		expect(state.segments[0].text).toBe("Hello World");
		expect(state.past.length).toBe(1); // Should have history
	});

	it("should delete segment", () => {
		useProjectStore.setState({
			segments: [
				{ id: "1", speakerId: "speaker_1", startTime: "00:00", endTime: "00:05", text: "Hello" },
				{ id: "2", speakerId: "speaker_1", startTime: "00:05", endTime: "00:10", text: "World" },
			],
			selectedSegmentId: "1",
		});

		const { deleteSegment } = useProjectStore.getState();
		deleteSegment("1");

		const state = useProjectStore.getState();
		expect(state.segments.length).toBe(1);
		expect(state.segments[0].id).toBe("2");
		expect(state.selectedSegmentId).toBeNull(); // Should clear selection
	});

	it("should undo and redo", () => {
		useProjectStore.setState({
			segments: [
				{ id: "1", speakerId: "speaker_1", startTime: "00:00", endTime: "00:05", text: "Hello" },
			],
		});

		const { updateSegment, undo, redo, canUndo, canRedo } = useProjectStore.getState();

		// Make a change
		updateSegment("1", { text: "Changed" });
		expect(useProjectStore.getState().segments[0].text).toBe("Changed");
		expect(useProjectStore.getState().canUndo()).toBe(true);

		// Undo
		undo();
		expect(useProjectStore.getState().segments[0].text).toBe("Hello");
		expect(useProjectStore.getState().canRedo()).toBe(true);

		// Redo
		redo();
		expect(useProjectStore.getState().segments[0].text).toBe("Changed");
	});

	it("should merge speakers", () => {
		useProjectStore.setState({
			speakers: [
				{ id: "speaker_1", name: "Speaker 1", color: "#000" },
				{ id: "speaker_2", name: "Speaker 2", color: "#fff" },
			],
			segments: [
				{ id: "1", speakerId: "speaker_1", startTime: "00:00", endTime: "00:05", text: "Hello" },
				{ id: "2", speakerId: "speaker_2", startTime: "00:05", endTime: "00:10", text: "World" },
			],
		});

		const { mergeSpeakers } = useProjectStore.getState();
		mergeSpeakers("speaker_2", "speaker_1");

		const state = useProjectStore.getState();
		expect(state.speakers.length).toBe(1);
		expect(state.segments[1].speakerId).toBe("speaker_1");
	});
});

describe("createSpeakersFromSegments", () => {
	it("should create speakers from segment speaker IDs", () => {
		const segments = [
			{ id: "1", speakerId: "speaker_1", startTime: "00:00", endTime: "00:05", text: "Hello" },
			{ id: "2", speakerId: "speaker_2", startTime: "00:05", endTime: "00:10", text: "World" },
			{ id: "3", speakerId: "speaker_1", startTime: "00:10", endTime: "00:15", text: "!" },
		];

		const speakers = createSpeakersFromSegments(segments);

		expect(speakers.length).toBe(2);
		expect(speakers[0].id).toBe("speaker_1");
		expect(speakers[1].id).toBe("speaker_2");
		expect(speakers[0].name).toBe("Speaker 1");
		expect(speakers[1].name).toBe("Speaker 2");
	});
});
