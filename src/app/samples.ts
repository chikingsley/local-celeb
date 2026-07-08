export interface SampleEntry {
	id: string;
	title: string;
	transcript: string;
	audio: string;
	speakers: number;
	durationSec: number;
}

export async function loadSampleManifest(): Promise<SampleEntry[]> {
	const response = await fetch("/samples/index.json");
	if (!response.ok) {
		throw new Error(`Failed to load sample manifest: ${response.status}`);
	}
	return (await response.json()) as SampleEntry[];
}
