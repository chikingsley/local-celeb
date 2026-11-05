import type { Segment } from "@/domain/transcript/types";

export type EnglishVariant = "transcript" | "en-US" | "en-GB";
export type SerialCommaPreference = "preserve" | "prefer" | "avoid";
export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface ProposalOccurrence {
	after: string;
	before: string;
	endIndex: number;
	segmentId: string;
	startIndex: number;
}

export interface TranscriptProposal {
	confidence: "high" | "medium";
	id: string;
	occurrences: ProposalOccurrence[];
	reason: string;
	status: ProposalStatus;
	title: string;
}

export interface TranscriptAnalysisOptions {
	englishVariant: EnglishVariant;
	serialComma: SerialCommaPreference;
}

interface SpellingPair {
	gb: string;
	us: string;
}

const SPELLING_PAIRS: SpellingPair[] = [
	{ gb: "behaviour", us: "behavior" },
	{ gb: "centre", us: "center" },
	{ gb: "colour", us: "color" },
	{ gb: "favour", us: "favor" },
	{ gb: "favourite", us: "favorite" },
	{ gb: "honour", us: "honor" },
	{ gb: "labour", us: "labor" },
	{ gb: "neighbour", us: "neighbor" },
	{ gb: "theatre", us: "theater" },
];

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function preserveCase(source: string, replacement: string): string {
	if (source === source.toUpperCase()) {
		return replacement.toUpperCase();
	}
	if (source[0] === source[0]?.toUpperCase()) {
		return replacement.charAt(0).toUpperCase() + replacement.slice(1);
	}
	return replacement;
}

function collectRegexOccurrences(
	segments: Segment[],
	pattern: RegExp,
	replacement: (match: string, groups: string[]) => string
): ProposalOccurrence[] {
	const occurrences: ProposalOccurrence[] = [];
	for (const segment of segments) {
		pattern.lastIndex = 0;
		for (const match of segment.text.matchAll(pattern)) {
			const [before] = match;
			const startIndex = match.index ?? 0;
			const after = replacement(before, match.slice(1));
			if (before === after) {
				continue;
			}
			occurrences.push({
				after,
				before,
				endIndex: startIndex + before.length,
				segmentId: segment.id,
				startIndex,
			});
		}
	}
	return occurrences;
}

function spellingProposals(
	segments: Segment[],
	englishVariant: EnglishVariant
): TranscriptProposal[] {
	if (englishVariant === "transcript") {
		return [];
	}

	return SPELLING_PAIRS.flatMap((pair) => {
		const before = englishVariant === "en-US" ? pair.gb : pair.us;
		const after = englishVariant === "en-US" ? pair.us : pair.gb;
		const occurrences = collectRegexOccurrences(
			segments,
			new RegExp(`\\b${escapeRegExp(before)}\\b`, "giu"),
			(match) => preserveCase(match, after)
		);
		if (occurrences.length === 0) {
			return [];
		}
		const variantLabel = englishVariant === "en-US" ? "American" : "British";
		return [
			{
				confidence: "high" as const,
				id: `spelling-${englishVariant}-${before}-${after}`,
				occurrences,
				reason: `${variantLabel} English normally uses “${after}” for this spelling. Review every occurrence before applying the change.`,
				status: "pending" as const,
				title: `Standardize “${before}” to “${after}”`,
			},
		];
	});
}

function mechanicalProposals(segments: Segment[]): TranscriptProposal[] {
	const repeatedSpaces = collectRegexOccurrences(segments, /[ \t]{2,}/gu, () => " ");
	const spacesBeforePunctuation = collectRegexOccurrences(
		segments,
		/[ \t]+(?<punctuation>[,.;!?])/gu,
		(_match, groups) => groups[0] ?? ""
	);

	return [
		{
			confidence: "high" as const,
			id: "formatting-repeated-spaces",
			occurrences: repeatedSpaces,
			reason:
				"Repeated horizontal spaces are usually transcription artifacts. Line breaks are left unchanged.",
			status: "pending" as const,
			title: "Collapse repeated spaces",
		},
		{
			confidence: "high" as const,
			id: "formatting-space-before-punctuation",
			occurrences: spacesBeforePunctuation,
			reason:
				"English punctuation normally follows the preceding word without an intervening space.",
			status: "pending" as const,
			title: "Remove spaces before punctuation",
		},
	].filter((proposal) => proposal.occurrences.length > 0);
}

function serialCommaProposal(
	segments: Segment[],
	preference: SerialCommaPreference
): TranscriptProposal[] {
	if (preference === "preserve") {
		return [];
	}

	const shortItem = "[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’-]*){0,2}";
	const pattern =
		preference === "prefer"
			? new RegExp(`\\b(${shortItem}), (${shortItem}) and (${shortItem})\\b`, "gu")
			: new RegExp(`\\b(${shortItem}), (${shortItem}), and (${shortItem})\\b`, "gu");
	const occurrences = collectRegexOccurrences(segments, pattern, (_match, groups) => {
		const [first = "", second = "", third = ""] = groups;
		return preference === "prefer"
			? `${first}, ${second}, and ${third}`
			: `${first}, ${second} and ${third}`;
	});
	if (occurrences.length === 0) {
		return [];
	}

	return [
		{
			confidence: "medium",
			id: `punctuation-serial-comma-${preference}`,
			occurrences,
			reason:
				preference === "prefer"
					? "The selected style prefers a serial comma before the final conjunction in simple lists. Context can be ambiguous, so each match should be reviewed."
					: "The selected style avoids a serial comma in simple lists unless it prevents ambiguity. Context can be ambiguous, so each match should be reviewed.",
			status: "pending",
			title: preference === "prefer" ? "Add serial commas in simple lists" : "Remove serial commas",
		},
	];
}

export function analyzeTranscript(
	segments: Segment[],
	options: TranscriptAnalysisOptions
): TranscriptProposal[] {
	return [
		...mechanicalProposals(segments),
		...spellingProposals(segments, options.englishVariant),
		...serialCommaProposal(segments, options.serialComma),
	];
}

export function buildProposalUpdates(
	proposal: TranscriptProposal,
	segments: Segment[]
): Record<string, Partial<Segment>> {
	const occurrencesBySegment = proposal.occurrences.reduce<Record<string, ProposalOccurrence[]>>(
		(groups, occurrence) => {
			groups[occurrence.segmentId] ??= [];
			groups[occurrence.segmentId]?.push(occurrence);
			return groups;
		},
		{}
	);
	const updates: Record<string, Partial<Segment>> = {};

	for (const segment of segments) {
		const occurrences = occurrencesBySegment[segment.id];
		if (!occurrences) {
			continue;
		}
		let { text } = segment;
		for (const occurrence of [...occurrences].sort((a, b) => b.startIndex - a.startIndex)) {
			if (text.slice(occurrence.startIndex, occurrence.endIndex) !== occurrence.before) {
				continue;
			}
			text =
				text.slice(0, occurrence.startIndex) + occurrence.after + text.slice(occurrence.endIndex);
		}
		if (text !== segment.text) {
			updates[segment.id] = {
				text,
				wordsDirty: true,
				wordTimingStatus: "dirty",
			};
		}
	}

	return updates;
}
