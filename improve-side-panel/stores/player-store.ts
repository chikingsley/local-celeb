import { create } from "zustand"

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

interface PlayerStore {
  isPlaying: boolean
  autoFollowEnabled: boolean
  scrollToTime: (timeSeconds: number) => void
  scrollToSegment: (segmentId: string) => void
  registerScrollToTime: (callback: (timeSeconds: number) => void) => void
  registerScrollToSegment: (callback: (segmentId: string) => void) => void
  setAutoFollow: (enabled: boolean) => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  let scrollToTimeCallback: ((timeSeconds: number) => void) | null = null
  let scrollToSegmentCallback: ((segmentId: string) => void) | null = null

  return {
    isPlaying: false,
    autoFollowEnabled: true,
    scrollToTime: (timeSeconds: number) => {
      scrollToTimeCallback?.(timeSeconds)
    },
    scrollToSegment: (segmentId: string) => {
      scrollToSegmentCallback?.(segmentId)
    },
    registerScrollToTime: (callback: (timeSeconds: number) => void) => {
      scrollToTimeCallback = callback
    },
    registerScrollToSegment: (callback: (segmentId: string) => void) => {
      scrollToSegmentCallback = callback
    },
    setAutoFollow: (enabled: boolean) => set({ autoFollowEnabled: enabled }),
  }
})
