import type { TranscriptionResponse } from "@/types";
import { TranscriptionResponseSchema } from "@/types";

const API_BASE = import.meta.env.VITE_TRANSCRIPTION_API_BASE ?? "/api";

class ApiError extends Error {
	constructor(
		message: string,
		public statusCode?: number
	) {
		super(message);
		this.name = "ApiError";
	}
}

/**
 * Transcribe audio using the backend API
 */
export async function transcribeAudio(
	base64Audio: string,
	mimeType: string
): Promise<TranscriptionResponse> {
	const response = await fetch(`${API_BASE}/transcribe`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			audio: base64Audio,
			mimeType,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new ApiError(`Transcription failed: ${errorText}`, response.status);
	}

	const data = await response.json();

	// Validate response with Zod
	const result = TranscriptionResponseSchema.safeParse(data);
	if (!result.success) {
		console.error("Invalid response format:", result.error);
		throw new ApiError("Invalid response format from server");
	}

	return result.data;
}

/**
 * Convert a File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			if (typeof reader.result === "string") {
				// Remove the "data:audio/mp3;base64," prefix
				const base64 = reader.result.split(",")[1];
				resolve(base64);
			} else {
				reject(new Error("Failed to read file"));
			}
		};
		reader.onerror = (error) => reject(error);
	});
}

/**
 * Check if the API server is healthy
 */
export async function checkHealth(): Promise<boolean> {
	try {
		const response = await fetch(`${API_BASE}/health`);
		return response.ok;
	} catch {
		return false;
	}
}
