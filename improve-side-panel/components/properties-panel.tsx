"use client"

import { AlertTriangle, AlignLeft, ChevronDown, ChevronRight, Clock, Plus, Trash2, Type } from "lucide-react"
import { useCallback, useState, useRef } from "react"
import { cn, formatTime, parseTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FileMetaData, Segment, WordTimestamp } from "@/types"

interface PropertiesPanelProps {
  meta: FileMetaData
  selectedSegment: Segment | null
  currentTime: number
  onUpdateSegment: (id: string, updates: Partial<Segment>) => void
  onDeleteSegment: (id: string) => void
  onUpdateMeta?: (updates: Partial<FileMetaData>) => void
  onSeek?: (time: number) => void
  onAddSubtitle?: () => void
}

export function PropertiesPanel({
  meta,
  selectedSegment,
  currentTime,
  onUpdateSegment,
  onDeleteSegment,
  onUpdateMeta,
  onSeek,
  onAddSubtitle,
}: PropertiesPanelProps) {
  const [globalCollapsed, setGlobalCollapsed] = useState(false)
  const [segmentCollapsed, setSegmentCollapsed] = useState(false)
  const [wordsCollapsed, setWordsCollapsed] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(meta.name)
  const nameInputRef = useRef<HTMLTextAreaElement>(null)

  const handleNameClick = () => {
    setEditedName(meta.name)
    setIsEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  const handleNameBlur = () => {
    setIsEditingName(false)
    if (editedName.trim() && editedName !== meta.name) {
      onUpdateMeta?.({ name: editedName.trim() })
    }
  }

  const handleDurationChange = (durationStr: string) => {
    if (!selectedSegment) return
    const durationSeconds = parseTime(durationStr)
    const startSeconds = parseTime(selectedSegment.startTime)
    const newEndSeconds = startSeconds + durationSeconds
    onUpdateSegment(selectedSegment.id, { endTime: formatTime(newEndSeconds) })
  }

  const calculateDuration = (segment: Segment): string => {
    const start = parseTime(segment.startTime)
    const end = parseTime(segment.endTime)
    const diff = Math.max(0, end - start)
    return formatTime(diff)
  }

  const getDisplayWords = useCallback((segment: Segment): WordTimestamp[] => {
    if (segment.words && segment.words.length > 0 && !segment.wordsDirty) {
      return segment.words
    }
    const textWords = segment.text.split(/\s+/).filter((w) => w.length > 0)
    const segStart = parseTime(segment.startTime)
    const segEnd = parseTime(segment.endTime)
    const duration = segEnd - segStart
    return textWords.map((word, i) => ({
      word,
      start: segStart + (duration * i) / textWords.length,
      end: segStart + (duration * (i + 1)) / textWords.length,
      interpolated: true,
    }))
  }, [])

  const handleWordUpdate = useCallback(
    (segment: Segment, wordIndex: number, field: "start" | "end", value: string) => {
      const seconds = Number.parseFloat(value)
      if (Number.isNaN(seconds) || seconds < 0) return

      const words = segment.words ? [...segment.words] : getDisplayWords(segment)
      if (wordIndex >= 0 && wordIndex < words.length) {
        words[wordIndex] = {
          ...words[wordIndex],
          [field]: seconds,
          interpolated: false,
        }
        onUpdateSegment(segment.id, { words, wordsDirty: false })
      }
    },
    [getDisplayWords, onUpdateSegment],
  )

  const getCurrentWordIndex = useCallback(
    (segment: Segment): number => {
      const words = segment.words || []
      for (let i = 0; i < words.length; i++) {
        if (currentTime >= words[i].start && currentTime < words[i].end) {
          return i
        }
      }
      return -1
    },
    [currentTime],
  )

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Properties Sections */}
      <div className="flex-1 overflow-auto">
        {/* Global Properties Section */}
        <div className="border-b border-border">
          <button
            onClick={() => setGlobalCollapsed(!globalCollapsed)}
            className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wider bg-muted/50 hover:bg-muted transition-colors"
          >
            {globalCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Global Properties
          </button>

          <div
            className={cn(
              "overflow-hidden transition-all duration-200",
              globalCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100",
            )}
          >
            <div className="px-4 pb-5 space-y-4 bg-card">
              {/* File Name */}
              <div className="pt-4">
                {isEditingName ? (
                  <textarea
                    ref={nameInputRef}
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleNameBlur()
                      }
                      if (e.key === "Escape") {
                        setIsEditingName(false)
                        setEditedName(meta.name)
                      }
                    }}
                    className="w-full text-sm font-medium text-foreground bg-background border border-primary rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 leading-relaxed"
                    rows={Math.min(4, Math.ceil(editedName.length / 30))}
                  />
                ) : (
                  <p
                    onClick={handleNameClick}
                    className="text-sm font-medium text-foreground truncate leading-relaxed cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                    title={meta.name}
                  >
                    {meta.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Audio Source</p>
              </div>

              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Language</span>
                  <span className="text-sm font-medium text-foreground">{meta.language} (Detected)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-sm font-mono font-medium text-foreground">{formatTime(meta.duration)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtitles</span>
                  <button
                    onClick={onAddSubtitle}
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Segment Properties Section */}
        {selectedSegment ? (
          <>
            <div className="border-b border-border">
              <button
                onClick={() => setSegmentCollapsed(!segmentCollapsed)}
                className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wider bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  {segmentCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Segment Properties
                </span>
                {selectedSegment.wordsDirty && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-[10px] font-medium normal-case">
                    <AlertTriangle size={10} />
                    Out of sync
                  </span>
                )}
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  segmentCollapsed ? "max-h-0 opacity-0" : "max-h-[600px] opacity-100",
                )}
              >
                <div className="px-4 pb-5 bg-card">
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Clock size={14} /> Duration
                      </span>
                      <Input
                        type="text"
                        value={calculateDuration(selectedSegment)}
                        onChange={(e) => handleDurationChange(e.target.value)}
                        className="font-mono text-sm h-9 w-32"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock size={12} /> Start Time
                        </span>
                        <Input
                          type="text"
                          value={selectedSegment.startTime}
                          onChange={(e) => onUpdateSegment(selectedSegment.id, { startTime: e.target.value })}
                          className="font-mono text-sm h-9"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock size={12} /> End Time
                        </span>
                        <Input
                          type="text"
                          value={selectedSegment.endTime}
                          onChange={(e) => onUpdateSegment(selectedSegment.id, { endTime: e.target.value })}
                          className="font-mono text-sm h-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 bg-transparent"
                      onClick={() => onDeleteSegment(selectedSegment.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                    <Button className="flex-1 gap-2">
                      <AlignLeft className="w-4 h-4" />
                      Align words
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Words Section */}
            <div className="border-b border-border">
              <button
                onClick={() => setWordsCollapsed(!wordsCollapsed)}
                className="flex items-center justify-between w-full px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wider bg-muted/50 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  {wordsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <Type size={12} />
                  Words
                  <span className="text-muted-foreground/70 font-normal normal-case">
                    ({getDisplayWords(selectedSegment).length})
                  </span>
                </span>
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  wordsCollapsed ? "max-h-0 opacity-0" : "max-h-[400px] opacity-100",
                )}
              >
                <div className="px-4 pb-5 bg-card">
                  {selectedSegment.wordsDirty && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Text was edited. Timestamps are estimated. Edit manually or click Align words.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1 max-h-64 overflow-y-auto mt-3 pr-1">
                    {getDisplayWords(selectedSegment).map((word, idx) => {
                      const isCurrentWord = getCurrentWordIndex(selectedSegment) === idx
                      return (
                        <div
                          key={`${word.word}-${idx}`}
                          onClick={() => onSeek?.(word.start)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onSeek?.(word.start)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group",
                            isCurrentWord
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-background border border-transparent",
                          )}
                        >
                          <span
                            className={cn(
                              "flex-1 text-sm truncate",
                              isCurrentWord ? "font-semibold text-primary" : "text-foreground",
                              word.interpolated && "italic text-muted-foreground",
                            )}
                            title={word.word}
                          >
                            {word.word}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={word.start.toFixed(2)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleWordUpdate(selectedSegment, idx, "start", e.target.value)}
                            className="w-14 px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            title="Start time (seconds)"
                          />
                          <span className="text-muted-foreground text-xs">→</span>
                          <input
                            type="number"
                            step="0.01"
                            value={word.end.toFixed(2)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleWordUpdate(selectedSegment, idx, "end", e.target.value)}
                            className="w-14 px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            title="End time (seconds)"
                          />
                          {word.interpolated && (
                            <span className="text-[10px] text-muted-foreground" title="Estimated timestamp">
                              ~
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 flex flex-col items-center justify-center text-center opacity-60 mt-10">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
              <AlignLeft size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Select a segment to edit its properties</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PropertiesPanel
