"use client";

import {
	FileAudio,
	Home,
	MessageSquare,
	PanelLeftClose,
	Settings,
	Users,
	AudioWaveform as Waveform,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarLeftProps {
	collapsed: boolean;
	onToggleCollapse?: () => void;
}

export function SidebarLeft({ collapsed, onToggleCollapse }: SidebarLeftProps) {
	const navItems = [
		{ icon: Home, label: "Home", active: false },
		{ icon: FileAudio, label: "Files", active: false },
		{ icon: Waveform, label: "Editor", active: true },
		{ icon: Users, label: "Speakers", active: false },
		{ icon: MessageSquare, label: "Comments", active: false },
		{ icon: Settings, label: "Settings", active: false },
	];

	if (collapsed) {
		return (
			<div className="w-14 h-full border-r border-border bg-card flex flex-col items-center py-3 gap-1">
				{navItems.map((item) => {
					const Icon = item.icon;
					return (
						<button
							key={item.label}
							className={cn(
								"w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
								item.active
									? "bg-primary text-primary-foreground"
									: "hover:bg-accent text-muted-foreground hover:text-foreground"
							)}
							title={item.label}
						>
							<Icon size={20} />
						</button>
					);
				})}
			</div>
		);
	}

	return (
		<div className="w-56 h-full border-r border-border bg-card flex flex-col">
			<div className="flex items-center justify-end px-2 py-2 border-b border-border">
				<button
					onClick={onToggleCollapse}
					className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
					title="Collapse sidebar"
				>
					<PanelLeftClose size={18} />
				</button>
			</div>

			<nav className="flex-1 p-2 space-y-0.5">
				{navItems.map((item) => {
					const Icon = item.icon;
					return (
						<button
							key={item.label}
							className={cn(
								"w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
								item.active
									? "bg-primary text-primary-foreground"
									: "hover:bg-accent text-foreground/80 hover:text-foreground"
							)}
						>
							<Icon size={18} />
							<span>{item.label}</span>
						</button>
					);
				})}
			</nav>
		</div>
	);
}
