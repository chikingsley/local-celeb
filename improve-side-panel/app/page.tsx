"use client"

import { useState, useEffect } from "react"
import { PropertiesPanel } from "@/components/properties-panel"
import { Timeline } from "@/components/timeline"
import { Editor } from "@/components/editor"
import { SidebarLeft } from "@/components/sidebar-left"
import { Header } from "@/components/header"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { FileAudio, Settings, Layers, Play, Pause } from "lucide-react"
import type { Segment, FileMetaData, Speaker } from "@/types"
import { formatTime } from "@/lib/utils"
import { ZOOM } from "@/types"

// Sample data
const sampleMeta: FileMetaData = {
  name: "2018-02-11_034000---icloudvideo.wav",
  language: "English",
  duration: 31.88,
}

const sampleSpeakers: Speaker[] = [
  { id: "speaker-0", name: "Speaker 0", color: "#3b82f6" },
  { id: "speaker-1", name: "Speaker 1", color: "#ef4444" },
]

const sampleSegments: Segment[] = [
  {
    id: "seg-1",
    text: "Video of the man of the hour. I'm always the man of the hour. No, but it's always weird 'cause the camera's on the side",
    startTime: "00:00:01.84",
    endTime: "00:00:10.30",
    speakerId: "speaker-0",
    words: [
      { word: "Video", start: 1.84, end: 2.1, interpolated: false },
      { word: "of", start: 2.1, end: 2.2, interpolated: false },
      { word: "the", start: 2.2, end: 2.35, interpolated: false },
      { word: "man", start: 2.35, end: 2.6, interpolated: false },
      { word: "of", start: 2.6, end: 2.7, interpolated: false },
      { word: "the", start: 2.7, end: 2.85, interpolated: false },
      { word: "hour.", start: 2.85, end: 3.2, interpolated: false },
      { word: "I'm", start: 3.4, end: 3.6, interpolated: false },
      { word: "always", start: 3.6, end: 4.0, interpolated: false },
      { word: "the", start: 4.0, end: 4.15, interpolated: false },
      { word: "man", start: 4.15, end: 4.4, interpolated: false },
      { word: "of", start: 4.4, end: 4.5, interpolated: false },
      { word: "the", start: 4.5, end: 4.65, interpolated: false },
      { word: "hour.", start: 4.65, end: 5.0, interpolated: false },
    ],
    wordsDirty: false,
  },
  {
    id: "seg-2",
    text: "That side of the screen, so in the center of the screen. So it's like, just makes everything kinda off 'cause you're kinda lookin' at the thing when you should be lookin' there. But,",
    startTime: "00:00:10.34",
    endTime: "00:00:21.16",
    speakerId: "speaker-0",
    words: [],
    wordsDirty: true,
  },
  {
    id: "seg-3",
    text: "uh, quick little video 'cause I'm lookin' at",
    startTime: "00:00:21.16",
    endTime: "00:00:26.00",
    speakerId: "speaker-0",
    words: [],
    wordsDirty: true,
  },
]

export default function Home() {
  const [segments, setSegments] = useState<Segment[]>(sampleSegments)
  const [speakers, setSpeakers] = useState<Speaker[]>(sampleSpeakers)
  const [meta, setMeta] = useState<FileMetaData>(sampleMeta)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>("seg-1")
  const [currentTime, setCurrentTime] = useState(3.5)
  const [isPlaying, setIsPlaying] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(ZOOM.DEFAULT)
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 0.75 | 1 | 1.25 | 1.5 | 2>(1)

  // Collapse states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [timelineCollapsed, setTimelineCollapsed] = useState(false)

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null

  const handleUpdateSegment = (id: string, updates: Partial<Segment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
    if (selectedSegmentId === id) setSelectedSegmentId(null)
  }

  const handleUpdateMeta = (updates: Partial<FileMetaData>) => {
    setMeta((prev) => ({ ...prev, ...updates }))
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
  }

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const handleAddSegment = (time: number, speakerId?: string) => {
    const newSegment: Segment = {
      id: `seg-${Date.now()}`,
      text: "",
      startTime: formatTime(time),
      endTime: formatTime(time + 5),
      speakerId: speakerId || speakers[0].id,
      words: [],
      wordsDirty: false,
    }
    setSegments((prev) => [...prev, newSegment])
  }

  const handleUpdateSpeaker = (id: string, updates: Partial<Speaker>) => {
    setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const handleDeleteSpeaker = (id: string) => {
    setSpeakers((prev) => prev.filter((s) => s.id !== id))
  }

  const handleMergeSpeakers = (fromId: string, toId: string) => {
    setSegments((prev) => prev.map((s) => (s.speakerId === fromId ? { ...s, speakerId: toId } : s)))
    handleDeleteSpeaker(fromId)
  }

  const handleReorderSpeakers = (fromIndex: number, toIndex: number) => {
    setSpeakers((prev) => {
      const newSpeakers = [...prev]
      const [removed] = newSpeakers.splice(fromIndex, 1)
      newSpeakers.splice(toIndex, 0, removed)
      return newSpeakers
    })
  }

  // Simple playback simulation
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentTime((t) => {
        const next = t + 0.1 * playbackSpeed
        return next >= meta.duration ? 0 : next
      })
    }, 100)
    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed, meta.duration])

  const RIGHT_PANEL_WIDTH = 320

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Main Layout with Left Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Full height */}
        <SidebarLeft collapsed={leftSidebarCollapsed} onToggleCollapse={() => setLeftSidebarCollapsed(true)} />

        {/* Main Content Area (Header + Editor + Timeline + Right Panel) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - spans main content only */}
          <Header
            title="Transcription Editor"
            leftSidebarCollapsed={leftSidebarCollapsed}
            rightPanelCollapsed={rightPanelCollapsed}
            timelineCollapsed={timelineCollapsed}
            onToggleLeftSidebar={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            onToggleRightPanel={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            onToggleTimeline={() => setTimelineCollapsed(!timelineCollapsed)}
          />

          {/* Content Area (Editor + Timeline + Right Panel) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Editor + Timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ResizablePanelGroup direction="vertical">
                {/* Editor Area */}
                <ResizablePanel defaultSize={timelineCollapsed ? 100 : 60} minSize={30}>
                  <div className="h-full overflow-auto bg-background">
                    <Editor
                      segments={segments}
                      speakers={speakers}
                      selectedSegmentId={selectedSegmentId}
                      onSelectSegment={setSelectedSegmentId}
                      onUpdateSegment={handleUpdateSegment}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                    />
                  </div>
                </ResizablePanel>

                {/* Timeline Area */}
                {!timelineCollapsed ? (
                  <>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={40} minSize={15} maxSize={60}>
                      <Timeline
                        segments={segments}
                        speakers={speakers}
                        selectedSegmentId={selectedSegmentId}
                        onSelectSegment={setSelectedSegmentId}
                        isPlaying={isPlaying}
                        onTogglePlay={handleTogglePlay}
                        currentTime={currentTime}
                        totalDuration={meta.duration}
                        onSeek={handleSeek}
                        zoomLevel={zoomLevel}
                        setZoomLevel={setZoomLevel}
                        playbackSpeed={playbackSpeed}
                        setPlaybackSpeed={setPlaybackSpeed}
                        onAddSegment={handleAddSegment}
                        onUpdateSegment={handleUpdateSegment}
                        onDeleteSegment={handleDeleteSegment}
                        onUpdateSpeaker={handleUpdateSpeaker}
                        onDeleteSpeaker={handleDeleteSpeaker}
                        onMergeSpeakers={handleMergeSpeakers}
                        onReorderSpeakers={handleReorderSpeakers}
                      />
                    </ResizablePanel>
                  </>
                ) : (
                  /* Collapsed Timeline Mini Bar */
                  <div className="h-14 border-t border-border bg-card flex items-center justify-center gap-4 px-4 shrink-0">
                    <button
                      onClick={handleTogglePlay}
                      className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shadow-md"
                    >
                      {isPlaying ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                    <div className="text-sm font-mono text-muted-foreground">
                      {formatTime(currentTime)} / {formatTime(meta.duration)}
                    </div>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-md">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(currentTime / meta.duration) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </ResizablePanelGroup>
            </div>

            {/* Right Properties Panel - Fixed width, collapsible only */}
            {!rightPanelCollapsed ? (
              <div className="border-l border-border shrink-0" style={{ width: RIGHT_PANEL_WIDTH }}>
                <PropertiesPanel
                  meta={meta}
                  selectedSegment={selectedSegment}
                  currentTime={currentTime}
                  onUpdateSegment={handleUpdateSegment}
                  onDeleteSegment={handleDeleteSegment}
                  onUpdateMeta={handleUpdateMeta}
                  onSeek={handleSeek}
                />
              </div>
            ) : (
              /* Collapsed Right Panel Mini Bar */
              <div className="w-12 border-l border-border bg-card flex flex-col items-center py-4 gap-3 shrink-0">
                <button
                  onClick={() => setRightPanelCollapsed(false)}
                  className="w-9 h-9 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="File Properties"
                >
                  <FileAudio size={18} />
                </button>
                <button
                  onClick={() => setRightPanelCollapsed(false)}
                  className="w-9 h-9 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Segment Properties"
                >
                  <Layers size={18} />
                </button>
                <button
                  onClick={() => setRightPanelCollapsed(false)}
                  className="w-9 h-9 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
