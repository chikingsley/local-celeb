export interface SampleEntry {
	audio: string;
	durationSec: number;
	id: string;
	speakers: number;
	title: string;
	transcript: string;
}

export async function loadSampleManifest(): Promise<SampleEntry[]> {
	const response = await fetch("/samples/index.json");
	if (!response.ok) {
		throw new Error(`Failed to load sample manifest: ${response.status}`);
	}
	return (await response.json()) as SampleEntry[];
}
