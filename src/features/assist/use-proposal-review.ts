import { useCallback, useEffect, useMemo, useState } from "react";
import {
	analyzeTranscript,
	buildProposalUpdates,
	type EnglishVariant,
	type ProposalOccurrence,
	type SerialCommaPreference,
	type TranscriptProposal,
} from "@/domain/transcript/proposals";
import type { Segment } from "@/domain/transcript/types";

interface UseProposalReviewOptions {
	defaultEnglishVariant: EnglishVariant;
	documentKey: string;
	onApplyUpdates: (updates: Record<string, Partial<Segment>>) => void;
	onClearNavigation: () => void;
	onNavigate: (
		occurrence: ProposalOccurrence,
		occurrences: ProposalOccurrence[],
		index: number
	) => void;
	segments: Segment[];
}

export interface ProposalReviewController {
	acceptSelected: () => void;
	analysisRan: boolean;
	analyze: () => void;
	clear: () => void;
	currentOccurrenceIndex: number;
	englishVariant: EnglishVariant;
	goToNextOccurrence: () => void;
	goToPreviousOccurrence: () => void;
	proposals: TranscriptProposal[];
	rejectSelected: () => void;
	selectedProposal: TranscriptProposal | null;
	selectProposal: (proposalId: string) => void;
	serialComma: SerialCommaPreference;
	setEnglishVariant: (variant: EnglishVariant) => void;
	setSerialComma: (preference: SerialCommaPreference) => void;
}

export function useProposalReview({
	defaultEnglishVariant,
	documentKey,
	segments,
	onApplyUpdates,
	onNavigate,
	onClearNavigation,
}: UseProposalReviewOptions): ProposalReviewController {
	const [englishVariant, setEnglishVariant] = useState<EnglishVariant>("en-US");
	const [serialComma, setSerialComma] = useState<SerialCommaPreference>("preserve");
	const [proposals, setProposals] = useState<TranscriptProposal[]>([]);
	const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
	const [currentOccurrenceIndex, setCurrentOccurrenceIndex] = useState(0);
	const [analysisRan, setAnalysisRan] = useState(false);

	const selectedProposal = useMemo(
		() => proposals.find((proposal) => proposal.id === selectedProposalId) ?? null,
		[proposals, selectedProposalId]
	);

	const navigateTo = useCallback(
		(proposal: TranscriptProposal, index: number) => {
			if (proposal.occurrences.length === 0) {
				return;
			}
			const wrappedIndex =
				((index % proposal.occurrences.length) + proposal.occurrences.length) %
				proposal.occurrences.length;
			const navigationOccurrences = proposal.occurrences.map((item) =>
				proposal.status === "accepted"
					? { ...item, endIndex: item.startIndex + item.after.length }
					: item
			);
			const occurrence = navigationOccurrences[wrappedIndex];
			if (!occurrence) {
				return;
			}
			setCurrentOccurrenceIndex(wrappedIndex);
			onNavigate(occurrence, navigationOccurrences, wrappedIndex);
		},
		[onNavigate]
	);

	const analyze = useCallback(() => {
		const nextProposals = analyzeTranscript(segments, { englishVariant, serialComma });
		setAnalysisRan(true);
		setProposals(nextProposals);
		const [firstProposal] = nextProposals;
		if (firstProposal) {
			setSelectedProposalId(firstProposal.id);
			navigateTo(firstProposal, 0);
			return;
		}
		setSelectedProposalId(null);
		setCurrentOccurrenceIndex(0);
		onClearNavigation();
	}, [englishVariant, navigateTo, onClearNavigation, segments, serialComma]);

	const selectProposal = useCallback(
		(proposalId: string) => {
			const proposal = proposals.find((candidate) => candidate.id === proposalId);
			if (!proposal) {
				return;
			}
			setSelectedProposalId(proposalId);
			navigateTo(proposal, 0);
		},
		[navigateTo, proposals]
	);

	const goToNextOccurrence = useCallback(() => {
		if (selectedProposal) {
			navigateTo(selectedProposal, currentOccurrenceIndex + 1);
		}
	}, [currentOccurrenceIndex, navigateTo, selectedProposal]);

	const goToPreviousOccurrence = useCallback(() => {
		if (selectedProposal) {
			navigateTo(selectedProposal, currentOccurrenceIndex - 1);
		}
	}, [currentOccurrenceIndex, navigateTo, selectedProposal]);

	const setSelectedStatus = useCallback(
		(status: "accepted" | "rejected") => {
			if (!selectedProposal) {
				return;
			}
			if (status === "accepted") {
				onApplyUpdates(buildProposalUpdates(selectedProposal, segments));
				onClearNavigation();
			}
			setProposals((current) =>
				current.map((proposal) =>
					proposal.id === selectedProposal.id ? { ...proposal, status } : proposal
				)
			);
		},
		[onApplyUpdates, onClearNavigation, segments, selectedProposal]
	);

	const acceptSelected = useCallback(() => {
		setSelectedStatus("accepted");
	}, [setSelectedStatus]);

	const rejectSelected = useCallback(() => {
		setSelectedStatus("rejected");
	}, [setSelectedStatus]);

	const clear = useCallback(() => {
		setAnalysisRan(false);
		setProposals([]);
		setSelectedProposalId(null);
		setCurrentOccurrenceIndex(0);
		onClearNavigation();
	}, [onClearNavigation]);
	const changeEnglishVariant = useCallback(
		(variant: EnglishVariant) => {
			setEnglishVariant(variant);
			clear();
		},
		[clear]
	);
	const changeSerialComma = useCallback(
		(preference: SerialCommaPreference) => {
			setSerialComma(preference);
			clear();
		},
		[clear]
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: documentKey intentionally resets profile and proposals when the open transcript changes.
	useEffect(() => {
		setEnglishVariant(defaultEnglishVariant);
		clear();
	}, [clear, defaultEnglishVariant, documentKey]);

	return {
		acceptSelected,
		analysisRan,
		analyze,
		clear,
		currentOccurrenceIndex,
		englishVariant,
		goToNextOccurrence,
		goToPreviousOccurrence,
		proposals,
		rejectSelected,
		selectedProposal,
		selectProposal,
		serialComma,
		setEnglishVariant: changeEnglishVariant,
		setSerialComma: changeSerialComma,
	};
}
