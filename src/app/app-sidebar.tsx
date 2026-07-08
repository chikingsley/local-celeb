import { AudioLines, ChevronsUpDown, FileText, Home, LogOut, Mic2, Plus, Settings } from "lucide-react";
import { useCallback } from "react";
import { AppView } from "@/app/view-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import type { SampleEntry } from "@/app/samples";
import type { FileMetaData } from "@/domain/transcript/types";
import { formatTime } from "@/lib/utils";

interface AppSidebarProps {
	activeSample: string | null;
	meta: FileMetaData;
	onNavigate: (view: AppView) => void;
	onOpenExport: () => void;
	onOpenSettings: () => void;
	onSelectSample: (sample: SampleEntry) => void;
	samples: SampleEntry[];
	segmentCount: number;
}

interface AppSwitcherProps {
	onNavigateHome: () => void;
	onOpenSettings: () => void;
}

function AppSwitcher({ onNavigateHome, onOpenSettings }: AppSwitcherProps) {
	const { isMobile } = useSidebar();

	return (
		<SidebarMenu className="group-data-[collapsible=icon]:items-center">
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton className="data-[size=lg]:h-11" size="lg" tooltip="Local Celeb" />
						}
					>
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
							<Mic2 className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">Local Celeb</span>
							<span className="truncate text-sidebar-foreground/70 text-xs">
								Transcript workspace
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="w-56"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Workspace</DropdownMenuLabel>
							<DropdownMenuItem onClick={onNavigateHome}>
								<Home className="size-4" />
								<span>Home</span>
								<DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onOpenSettings}>
								<Settings className="size-4" />
								<span>Settings</span>
								<DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

interface FilesNavProps {
	activeSample: string | null;
	onAddFile: () => void;
	onSelectSample: (sample: SampleEntry) => void;
	samples: SampleEntry[];
}

function FilesNav({ activeSample, onAddFile, onSelectSample, samples }: FilesNavProps) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Files</SidebarGroupLabel>
			<SidebarGroupAction onClick={onAddFile} title="Add file">
				<Plus />
				<span className="sr-only">Add file</span>
			</SidebarGroupAction>
			<SidebarGroupContent>
				<SidebarMenu className="group-data-[collapsible=icon]:items-center">
					{samples.map((sample) => (
						<SidebarMenuItem key={sample.id}>
							<SidebarMenuButton
								isActive={activeSample === sample.id}
								onClick={() => onSelectSample(sample)}
								tooltip={sample.title}
							>
								<AudioLines />
								<span>{sample.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

interface UserNavProps {
	duration: number;
	hasTranscript: boolean;
	onOpenExport: () => void;
	onOpenSettings: () => void;
}

function UserNav({ duration, hasTranscript, onOpenExport, onOpenSettings }: UserNavProps) {
	const { isMobile } = useSidebar();

	return (
		<SidebarMenu className="group-data-[collapsible=icon]:items-center">
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
								size="lg"
								tooltip="Simon Local"
							/>
						}
					>
						<Avatar>
							<AvatarFallback>SL</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">Simon Local</span>
							<span className="truncate text-sidebar-foreground/70 text-xs">
								{duration ? formatTime(duration) : "Local session"}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-56"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar>
										<AvatarFallback>SL</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">Simon Local</span>
										<span className="truncate text-xs">Local workspace</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem onClick={onOpenSettings}>
								<Settings className="size-4" />
								<span>Settings</span>
							</DropdownMenuItem>
							<DropdownMenuItem disabled={!hasTranscript} onClick={onOpenExport}>
								<FileText className="size-4" />
								<span>Export current file</span>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem disabled>
								<LogOut className="size-4" />
								<span>Sign out</span>
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

export function AppSidebar({
	activeSample,
	meta,
	samples,
	segmentCount,
	onNavigate,
	onSelectSample,
	onOpenSettings,
	onOpenExport,
}: AppSidebarProps) {
	const hasTranscript = segmentCount > 0;

	const handleNavigateHome = useCallback(() => {
		onNavigate(AppView.WELCOME);
	}, [onNavigate]);

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<AppSwitcher onNavigateHome={handleNavigateHome} onOpenSettings={onOpenSettings} />
			</SidebarHeader>

			<SidebarContent>
				<FilesNav
					activeSample={activeSample}
					onAddFile={handleNavigateHome}
					onSelectSample={onSelectSample}
					samples={samples}
				/>
			</SidebarContent>

			<SidebarFooter>
				<UserNav
					duration={meta.duration}
					hasTranscript={hasTranscript}
					onOpenExport={onOpenExport}
					onOpenSettings={onOpenSettings}
				/>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
