import { Check, ChevronLeft, ChevronRight, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	EnglishVariant,
	SerialCommaPreference,
	TranscriptProposal,
} from "@/domain/transcript/proposals";
import type { ProposalReviewController } from "@/features/assist/use-proposal-review";
import { cn } from "@/lib/utils";

interface ProposalQueueProps {
	controller: ProposalReviewController;
}

function statusLabel(proposal: TranscriptProposal): string {
	if (proposal.status === "accepted") {
		return "Accepted";
	}
	if (proposal.status === "rejected") {
		return "Rejected";
	}
	return `${proposal.occurrences.length} location${proposal.occurrences.length === 1 ? "" : "s"}`;
}

export function ProposalQueue({ controller }: ProposalQueueProps) {
	const {
		acceptSelected,
		analyze,
		analysisRan,
		clear,
		currentOccurrenceIndex,
		englishVariant,
		goToNextOccurrence,
		goToPreviousOccurrence,
		proposals,
		rejectSelected,
		selectProposal,
		selectedProposal,
		serialComma,
		setEnglishVariant,
		setSerialComma,
	} = controller;

	const handleEnglishVariantChange = useCallback(
		(value: string | null) => {
			if (value) {
				setEnglishVariant(value as EnglishVariant);
			}
		},
		[setEnglishVariant]
	);
	const handleSerialCommaChange = useCallback(
		(value: string | null) => {
			if (value) {
				setSerialComma(value as SerialCommaPreference);
			}
		},
		[setSerialComma]
	);
	const handleProposalClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			const { proposalId } = event.currentTarget.dataset;
			if (proposalId) {
				selectProposal(proposalId);
			}
		},
		[selectProposal]
	);

	const locationCount = proposals.reduce(
		(total, proposal) => total + proposal.occurrences.length,
		0
	);
	const selectedOccurrence = selectedProposal?.occurrences[currentOccurrenceIndex];

	return (
		<section className="border-border bg-background flex max-h-[34rem] flex-col gap-3 overflow-y-auto border-b px-4 py-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-1">
					<div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
						<Sparkles />
						Review proposals
					</div>
					<p className="text-muted-foreground text-xs leading-5">
						Rule-based preview. A future model can add contextual findings to this same queue.
					</p>
				</div>
				{analysisRan ? (
					<Button aria-label="Clear proposals" onClick={clear} size="icon-xs" variant="ghost">
						<RotateCcw />
					</Button>
				) : null}
			</div>

			<div className="flex flex-col gap-2">
				<div className="text-muted-foreground flex flex-col gap-1 text-xs">
					<span id="proposal-english-variant-label">English spelling</span>
					<Select onValueChange={handleEnglishVariantChange} value={englishVariant}>
						<SelectTrigger aria-labelledby="proposal-english-variant-label" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="en-US">American English</SelectItem>
								<SelectItem value="en-GB">British English</SelectItem>
								<SelectItem value="transcript">Preserve transcript spelling</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>

				<div className="text-muted-foreground flex flex-col gap-1 text-xs">
					<span id="proposal-serial-comma-label">Serial comma</span>
					<Select onValueChange={handleSerialCommaChange} value={serialComma}>
						<SelectTrigger aria-labelledby="proposal-serial-comma-label" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="preserve">Preserve existing usage</SelectItem>
								<SelectItem value="prefer">Prefer serial comma</SelectItem>
								<SelectItem value="avoid">Avoid serial comma</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>

			<Button className="w-full" onClick={analyze} variant="secondary">
				<ListChecks data-icon="inline-start" />
				Analyze transcript
			</Button>

			{analysisRan ? (
				<div className="flex flex-col gap-2">
					<p className="text-muted-foreground text-xs">
						{proposals.length === 0
							? "No deterministic issues found. Try another spelling or serial-comma preference; contextual model findings can use this queue later."
							: `${proposals.length} proposal${proposals.length === 1 ? "" : "s"} across ${locationCount} location${locationCount === 1 ? "" : "s"}`}
					</p>

					{proposals.map((proposal) => (
						<Button
							className={cn(
								"h-auto w-full justify-start py-2 text-left whitespace-normal",
								selectedProposal?.id === proposal.id && "ring-ring ring-2"
							)}
							data-proposal-id={proposal.id}
							key={proposal.id}
							onClick={handleProposalClick}
							variant="outline"
						>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="text-foreground text-xs leading-5 font-medium">
									{proposal.title}
								</span>
								<span className="text-muted-foreground text-[11px]">{statusLabel(proposal)}</span>
							</span>
						</Button>
					))}
				</div>
			) : null}

			{selectedProposal ? (
				<div className="border-border bg-muted/30 flex flex-col gap-3 rounded-lg border p-3">
					<div className="flex flex-col gap-1">
						<div className="text-foreground text-sm font-semibold">{selectedProposal.title}</div>
						<p className="text-muted-foreground text-xs leading-5">{selectedProposal.reason}</p>
					</div>

					{selectedOccurrence ? (
						<div className="bg-background flex flex-col gap-2 rounded-md p-2 text-xs">
							<div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
								<span className="text-muted-foreground">Before</span>
								<code className="text-foreground break-words">{selectedOccurrence.before}</code>
								<span className="text-muted-foreground">After</span>
								<code className="text-foreground break-words">{selectedOccurrence.after}</code>
							</div>
							<div className="flex items-center justify-between gap-2">
								<Button
									aria-label="Previous affected location"
									onClick={goToPreviousOccurrence}
									size="icon-xs"
									variant="ghost"
								>
									<ChevronLeft />
								</Button>
								<span className="text-muted-foreground">
									{currentOccurrenceIndex + 1} / {selectedProposal.occurrences.length}
								</span>
								<Button
									aria-label="Next affected location"
									onClick={goToNextOccurrence}
									size="icon-xs"
									variant="ghost"
								>
									<ChevronRight />
								</Button>
							</div>
						</div>
					) : null}

					<div className="grid grid-cols-2 gap-2">
						<Button
							disabled={selectedProposal.status !== "pending"}
							onClick={rejectSelected}
							variant="outline"
						>
							<X data-icon="inline-start" />
							Reject
						</Button>
						<Button disabled={selectedProposal.status !== "pending"} onClick={acceptSelected}>
							<Check data-icon="inline-start" />
							Accept all
						</Button>
					</div>
				</div>
			) : null}
		</section>
	);
}
