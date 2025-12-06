import {
	ChevronLeft,
	ChevronRight,
	Database,
	FolderOpen,
	Home,
	Layers,
	Mic2,
	Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppView } from "@/types";

interface SidebarProps {
	collapsed: boolean;
	onToggle: () => void;
	currentView: AppView;
	onNavigate: (view: AppView) => void;
}

const navItems = [
	{ icon: Home, label: "Home", view: AppView.WELCOME },
	{ icon: FolderOpen, label: "Projects", view: AppView.EDITOR },
	{ icon: Mic2, label: "Voice Lab", view: null },
	{ icon: Database, label: "Resources", view: null },
	{ icon: Layers, label: "Templates", view: null },
];

export function Sidebar({ collapsed, onToggle, currentView, onNavigate }: SidebarProps) {
	return (
		<div
			className={cn(
				"bg-[#f9fafb] border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out relative z-30",
				collapsed ? "w-16" : "w-64"
			)}
		>
			<div className="h-16 flex items-center justify-center border-b border-transparent">
				{!collapsed && (
					<span className="font-bold text-xl tracking-tight text-slate-900">Local Celeb</span>
				)}
				{collapsed && <span className="font-bold text-xl text-slate-900">LC</span>}
			</div>

			<nav className="flex-1 py-6 px-2 space-y-1">
				{navItems.map((item) => {
					const isActive = item.view === currentView;
					const isDisabled = item.view === null;

					return (
						<button
							key={item.label}
							type="button"
							onClick={() => item.view && onNavigate(item.view)}
							disabled={isDisabled}
							className={cn(
								"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
								isActive
									? "bg-white text-blue-600 shadow-sm border border-slate-200"
									: isDisabled
										? "text-slate-400 cursor-not-allowed"
										: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
								collapsed && "justify-center"
							)}
							title={collapsed ? item.label : undefined}
						>
							<item.icon size={20} strokeWidth={1.5} />
							{!collapsed && <span>{item.label}</span>}
						</button>
					);
				})}
			</nav>

			<div className="p-2 border-t border-slate-200">
				<button
					type="button"
					className={cn(
						"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors",
						collapsed && "justify-center"
					)}
				>
					<Settings size={20} strokeWidth={1.5} />
					{!collapsed && <span>Settings</span>}
				</button>
			</div>

			<button
				type="button"
				onClick={onToggle}
				className="absolute -right-3 top-20 bg-white border border-slate-200 rounded-full p-1 shadow-sm hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors z-40"
			>
				{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
			</button>
		</div>
	);
}

export default Sidebar;
