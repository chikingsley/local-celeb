import { invoke } from "@tauri-apps/api/core";

// Types

export interface LoadModelOptions {
	modelVersion?: "v2" | "v3"; // v2 = English-only, v3 = 25 languages
	loadDiarizer?: boolean;
}

export interface TranscribeFileOptions {
	path: string;
	modelVersion?: "v2" | "v3";
	withDiarization?: boolean;
	clusteringThreshold?: number; // 0.5-0.9, optimal: 0.7
}

export interface TranscribeAudioOptions {
	audioData: string; // Base64 encoded audio data
	modelVersion?: "v2" | "v3";
	withDiarization?: boolean;
}

export interface DiarizeFileOptions {
	path: string;
	clusteringThreshold?: number; // 0.5-0.9, optimal: 0.7
}

export interface TranscriptionSegment {
	text: string;
	startTime: number;
	endTime: number;
	speakerId?: string;
	confidence?: number;
}

export interface TranscriptionResult {
	text: string;
	confidence?: number;
	segments?: TranscriptionSegment[];
	language?: string;
}

export interface DiarizationSegment {
	speakerId: string;
	startTime: number;
	endTime: number;
}

export interface DiarizationResult {
	segments: DiarizationSegment[];
	speakerCount: number;
}

export interface LoadModelResponse {
	success: boolean;
	model: string;
	diarizationLoaded: boolean;
}

export interface ReadyResponse {
	ready: boolean;
	diarizationReady: boolean;
}

// API Functions

export async function loadModel(options: LoadModelOptions = {}): Promise<LoadModelResponse> {
	return await invoke("plugin:fluidaudio|load_model", {
		payload: {
			modelVersion: options.modelVersion ?? "v3",
			loadDiarizer: options.loadDiarizer ?? false,
		},
	});
}

export async function unloadModel(): Promise<{ success: boolean }> {
	return await invoke("plugin:fluidaudio|unload_model");
}

export async function transcribeFile(options: TranscribeFileOptions): Promise<TranscriptionResult> {
	return await invoke("plugin:fluidaudio|transcribe_file", {
		payload: {
			path: options.path,
			modelVersion: options.modelVersion,
			withDiarization: options.withDiarization ?? false,
			clusteringThreshold: options.clusteringThreshold ?? 0.7,
		},
	});
}

export async function transcribeAudio(
	options: TranscribeAudioOptions
): Promise<TranscriptionResult> {
	return await invoke("plugin:fluidaudio|transcribe_audio", {
		payload: {
			audioData: options.audioData,
			modelVersion: options.modelVersion,
			withDiarization: options.withDiarization ?? false,
		},
	});
}

export async function diarizeFile(options: DiarizeFileOptions): Promise<DiarizationResult> {
	return await invoke("plugin:fluidaudio|diarize_file", {
		payload: {
			path: options.path,
			clusteringThreshold: options.clusteringThreshold ?? 0.7,
		},
	});
}

export async function getAvailableModels(): Promise<{ models: string[] }> {
	return await invoke("plugin:fluidaudio|get_available_models");
}

export async function getCurrentModel(): Promise<{ model: string | null }> {
	return await invoke("plugin:fluidaudio|get_current_model");
}

export async function isReady(): Promise<ReadyResponse> {
	return await invoke("plugin:fluidaudio|is_ready");
}

// Helper function to convert audio file to base64
export async function audioFileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const base64 = reader.result?.toString().split(",")[1];
			if (base64) {
				resolve(base64);
			} else {
				reject(new Error("Failed to convert audio file to base64"));
			}
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// Convenience class for easier usage
export class FluidAudioClient {
	private modelLoaded = false;
	private diarizerLoaded = false;

	async initialize(modelVersion: "v2" | "v3" = "v3", withDiarization = false): Promise<void> {
		const result = await loadModel({ modelVersion, loadDiarizer: withDiarization });
		this.modelLoaded = result.success;
		this.diarizerLoaded = result.diarizationLoaded;
	}

	async transcribe(
		audioPath: string,
		options: { withDiarization?: boolean; clusteringThreshold?: number } = {}
	): Promise<TranscriptionResult> {
		if (!this.modelLoaded) {
			await this.initialize("v3", options.withDiarization);
		}
		return await transcribeFile({
			path: audioPath,
			withDiarization: options.withDiarization,
			clusteringThreshold: options.clusteringThreshold,
		});
	}

	async diarize(audioPath: string, clusteringThreshold = 0.7): Promise<DiarizationResult> {
		if (!this.diarizerLoaded) {
			await loadModel({ loadDiarizer: true });
			this.diarizerLoaded = true;
		}
		return await diarizeFile({ path: audioPath, clusteringThreshold });
	}

	async cleanup(): Promise<void> {
		await unloadModel();
		this.modelLoaded = false;
		this.diarizerLoaded = false;
	}

	isReady(): Promise<ReadyResponse> {
		return isReady();
	}
}

// Default export for easy usage
export default {
	loadModel,
	unloadModel,
	transcribeFile,
	transcribeAudio,
	diarizeFile,
	getAvailableModels,
	getCurrentModel,
	isReady,
	FluidAudioClient,
};
