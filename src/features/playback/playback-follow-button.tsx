import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlaybackFollowButtonProps {
	className?: string;
	compact?: boolean;
	isFollowing: boolean;
	isPlaying: boolean;
	label?: string;
	onResume: () => void;
}

export function PlaybackFollowButton({
	className,
	compact = false,
	isFollowing,
	isPlaying,
	label = "Return to current speech",
	onResume,
}: PlaybackFollowButtonProps) {
	if (!(isPlaying && !isFollowing)) {
		return null;
	}

	return (
		<Button
			className={cn("shadow-lg", className)}
			onClick={onResume}
			size="sm"
			title={label}
			variant="secondary"
		>
			<LocateFixed data-icon="inline-start" />
			<span className={cn(compact && "hidden sm:inline")}>{label}</span>
		</Button>
	);
}
