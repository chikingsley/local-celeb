"use client"

import { ArrowLeft, ChevronRight, Undo2, Redo2, MessageSquare, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  LayoutSidebarLeft,
  LayoutSidebarLeftOff,
  LayoutSidebarRight,
  LayoutSidebarRightOff,
  LayoutPanel,
  LayoutPanelOff,
} from "./icons/layout-icons"

interface HeaderProps {
  title: string
  leftSidebarCollapsed: boolean
  rightPanelCollapsed: boolean
  timelineCollapsed: boolean
  onToggleLeftSidebar: () => void
  onToggleRightPanel: () => void
  onToggleTimeline: () => void
  onBack?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

export function Header({
  title,
  leftSidebarCollapsed,
  rightPanelCollapsed,
  timelineCollapsed,
  onToggleLeftSidebar,
  onToggleRightPanel,
  onToggleTimeline,
  onBack,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: HeaderProps) {
  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-3 shrink-0">
      {/* Left: Back button and breadcrumbs */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground hover:text-foreground cursor-pointer">Home</span>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="font-medium truncate max-w-[200px]" title={title}>
            {title}
          </span>
        </div>
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Right: Save status, panel toggles, actions */}
      <div className="flex items-center gap-2">
        {/* Save status */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Last saved now
        </div>

        {/* Panel toggle buttons */}
        <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 bg-background">
          <button
            onClick={onToggleLeftSidebar}
            className={`p-1.5 rounded transition-colors ${leftSidebarCollapsed ? "bg-accent" : "hover:bg-accent"}`}
            title={leftSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {leftSidebarCollapsed ? (
              <LayoutSidebarLeftOff className="text-muted-foreground" />
            ) : (
              <LayoutSidebarLeft className="text-muted-foreground" />
            )}
          </button>
          <button
            onClick={onToggleTimeline}
            className={`p-1.5 rounded transition-colors ${timelineCollapsed ? "bg-accent" : "hover:bg-accent"}`}
            title={timelineCollapsed ? "Show timeline" : "Hide timeline"}
          >
            {timelineCollapsed ? (
              <LayoutPanelOff className="text-muted-foreground" />
            ) : (
              <LayoutPanel className="text-muted-foreground" />
            )}
          </button>
          <button
            onClick={onToggleRightPanel}
            className={`p-1.5 rounded transition-colors ${rightPanelCollapsed ? "bg-accent" : "hover:bg-accent"}`}
            title={rightPanelCollapsed ? "Show properties" : "Hide properties"}
          >
            {rightPanelCollapsed ? (
              <LayoutSidebarRightOff className="text-muted-foreground" />
            ) : (
              <LayoutSidebarRight className="text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Action buttons */}
        <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 bg-transparent">
          <MessageSquare size={14} />
          Feedback
        </Button>
        <Button size="sm" className="text-xs h-8 gap-1.5">
          <Upload size={14} />
          Export
        </Button>
      </div>
    </header>
  )
}
