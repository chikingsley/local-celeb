# Phase 2.5 - Sync & Navigation Design Document

## Overview

This document outlines the design decisions and implementation plan for robust synchronization between the Editor, Timeline, and Audio playback in Local Celeb.

## Current State Analysis

### What We Have

| Component | Current Behavior | Issues |
|-----------|-----------------|--------|
| **Editor** | Click segment → scrollToTime + onSeek | Works but not word-level accurate |
| **Timeline** | Auto-scroll on playback | Sometimes lags, behavior inconsistent |
| **Audio** | Separate `<audio>` element | currentTime updates via timeupdate event |
| **Word highlighting** | Blue underline during playback | Works when words array exists |
| **Find** | Auto-scroll while typing | Fixed with requestAnimationFrame |

### Current Code References

- `src/stores/player-store.ts:117-125` - scrollToTime/scrollToSegment callbacks
- `src/components/Editor.tsx:246-270` - handleTextareaClick (word-level seek)
- `src/components/Timeline.tsx:141-169` - Auto-scroll during playback
- `src/lib/playback-utils.ts` - parseTime, findWordAtTime, findWordAtCharPosition

### Problems to Solve

1. **Multiple sources of truth** - currentTime in store vs audio.currentTime
2. **Scroll coordination race conditions** - Timeline and Editor can fight each other
3. **Word-level click accuracy** - Character position → word mapping can fail
4. **Auto-scroll jitter** - Smooth scrolling gets called too frequently
5. **Word timestamp gaps** - Groq sometimes returns ~90% of words, missing some

---

## Reference Implementations

### 1. Hyperaudio Lite

**Source:** <https://github.com/hyperaudio/hyperaudio-lite>

**Key Pattern: data-m attributes**

```html
<span data-m="5200">Hello</span>
<span data-m="5800">world</span>
```

**How it works:**

- Each word has `data-m` (milliseconds) attribute
- Click listener finds clicked element, reads `data-m`, seeks audio
- Playback loop: adds `.read` class to words where `data-m < currentTime`
- Simple, bulletproof - no complex character position math

**Lesson for us:** Store word timestamps directly on DOM elements or use word index lookup.

### 2. BBC React Transcript Editor

**Source:** <https://github.com/bbc/react-transcript-editor>

**Key Pattern: Draft.js with custom entities**

- Uses Draft.js editor with word-level entities
- Each word entity stores start/end timestamps
- Click on word → get entity → seek audio
- Playback: iterate entities, find current word by time range

**Lesson for us:** Word-level data should be indexed for O(1) lookup.

### 3. Descript

**Pattern: Text-as-timeline**

- Editing text directly edits audio
- Single source of truth: the script
- Timeline is derived from script timestamps

**Lesson for us:** One component should own the "position" state.

---

## Decisions Made

### 1. Word Rendering Approach ✅ DECIDED

**Decision: Render word spans always for consistent click behavior.**

**What this means:**

Currently, the Editor uses a `<textarea>` and we calculate character positions to find words. This is fragile.

Instead, we'll render the segment text as individual word `<span>` elements:

```tsx
// Current (fragile)
<textarea value={segment.text} onClick={handleClick} />

// Proposed (robust)
<div className="editable-segment">
  {segment.words?.map((word, i) => (
    <span
      key={i}
      data-word-index={i}
      data-start={word.start}
      data-end={word.end}
      onClick={() => onSeek(word.start)}
      className={cn(
        currentTime >= word.start && currentTime < word.end && "bg-blue-200 underline"
      )}
    >
      {word.word}
    </span>
  )) ?? segment.text}
</div>
```

**Trade-offs:**

- More DOM elements, but modern browsers handle this fine
- Need to handle editing differently (contentEditable or overlay approach)
- Consistent click-to-seek regardless of word timestamp availability

### 2. Timeline Click Behavior 🔶 NEEDS CLARIFICATION

**Leaning towards:** Descript-style (seek to exact text/time position)

**Open question:** Does this mean the timeline shows individual words visually?

**Options:**

A. **Segment-level timeline (current)** - Segments as blocks, click seeks to segment start
B. **Word-level timeline** - Each word is a mini-block within segment, click seeks to word
C. **Hybrid** - Segments as blocks, but click position within block calculates time proportionally

Option C seems like a good middle ground - keep visual simplicity but calculate time from click position within the segment bar.

### 3. Auto-Follow During Playback ✅ DECIDED

**Decision: Option A with visual indicator**

- Auto-follow pauses when user manually scrolls during playback
- Visual indicator button (red/green) shows auto-follow state
- Clicking the indicator re-engages auto-follow and snaps back to playhead

**Implementation:**

```typescript
// In player-store
interface PlayerState {
  autoFollowEnabled: boolean;
  setAutoFollow: (enabled: boolean) => void;
}

// In Timeline
const [userScrolled, setUserScrolled] = useState(false);

// Detect user scroll
const handleScroll = (e) => {
  if (!isPlaying) return;
  // If scroll wasn't triggered by auto-follow, mark as user scroll
  if (!autoScrolling.current) {
    setUserScrolled(true);
  }
};

// Auto-follow indicator button
<button
  onClick={() => {
    setUserScrolled(false);
    scrollToPlayhead();
  }}
  className={userScrolled ? "text-red-500" : "text-green-500"}
  title={userScrolled ? "Click to re-enable auto-follow" : "Auto-following playhead"}
>
  <Target className="w-4 h-4" />
</button>
```

### 4. Find in Timeline ✅ DECIDED

**Decision: Skip for now.** Low value compared to effort.

Find highlights remain in Editor only. May revisit if we implement word-level timeline visualization.

---

## New Feature: Word-Level Editing Tools

### Problem: Incomplete Word Timestamps

Groq Whisper sometimes returns ~90% of words with timestamps, missing some. This creates gaps in word-level highlighting and click-to-seek.

**Test Results (4:30 audio, Lion King monologue):**

| Metric | Value |
|--------|-------|
| Total segments | 75 |
| Total words in text | 568 |
| Words with timestamps | 521 |
| **Coverage** | **91.7%** |

**Common missing word patterns:**

- Single-word segments (e.g., "Yes.", "No.") → **0 timestamps**
- First word of sentences often missing ("Life's" in "Life's not fair")
- Last word before segment boundary (e.g., "it?" missing)
- Short words and contractions ("a", "I", "I'd")
- Words with unusual punctuation

This is a Whisper model limitation, not a filtering bug in our code.

### Proposed Solutions

#### A. "Align" Button (Re-process Segment)

When a segment has incomplete word timestamps:

1. User clicks "Align" button in segment context menu or properties panel
2. Sends just that segment's audio slice to a more accurate (slower/expensive) model
3. Returns with corrected word-level timestamps
4. Merges new timestamps back into segment

**Benefits:** Less manual work, leverages AI for correction

#### B. Word-Level UI in Properties Panel

The "Preview Text" area in PropertiesPanel could show word-level timestamps:

```text
┌─────────────────────────────────────────┐
│ Preview Text                            │
├─────────────────────────────────────────┤
│ [0.00] Hello [0.45] world [0.89] this   │
│ [1.23] is [1.45] a [???] missing        │
│ [2.10] word [2.35] here                 │
└─────────────────────────────────────────┘
```

- Words with `[???]` indicate missing timestamps
- Click word to seek to it
- Double-click to edit word text or timestamp

#### C. Expand Segment to Word Blocks (Timeline)

Double-click a segment in Timeline to "explode" it into individual word blocks:

```text
Before: [──────── Segment 1 ────────]

After:  [Hello][world][this][is][a][test]
```

- Can now drag word edges to adjust individual timestamps
- Can add missing words by splitting gaps
- Click "Collapse" to return to segment view

**Note:** This is complex. May be Phase 3+.

#### D. Interpolate Missing Timestamps (Quick Fix)

For words without timestamps, calculate approximate timing based on neighbors:

```typescript
function interpolateWordTimestamps(text: string, words: WordTimestamp[], segStart: number, segEnd: number) {
  const textWords = text.split(/\s+/);
  const segDuration = segEnd - segStart;
  const avgWordDuration = segDuration / textWords.length;

  return textWords.map((textWord, i) => {
    // Try to find matching word with timestamp
    const match = words.find(w => w.word.replace(/[.,!?]/g, '') === textWord.replace(/[.,!?]/g, ''));

    if (match) return match;

    // Interpolate based on position in segment
    return {
      word: textWord,
      start: segStart + (i * avgWordDuration),
      end: segStart + ((i + 1) * avgWordDuration),
      interpolated: true, // Flag for UI styling
    };
  });
}
```

**Pros:** Quick to implement, fills 100% of gaps
**Cons:** Timestamps are estimates, may be off by ~0.5s

**Recommendation:** Implement Option D first for immediate improvement, then add Option A (Align button) for precise correction when needed.

---

## Proposed Architecture

### Single Source of Truth: `currentTime`

```text
                    ┌─────────────┐
                    │   Audio     │
                    │  Element    │
                    └──────┬──────┘
                           │ timeupdate
                           ▼
                    ┌─────────────┐
                    │ playerStore │
                    │ currentTime │◄──── seek events
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Editor  │    │ Timeline │    │ Minimap  │
    └──────────┘    └──────────┘    └──────────┘
```

**Rule:** Only `<audio>` element and explicit seek calls update `currentTime`. Components ONLY read it.

### Word Index Map (Phase A Explained)

**What is it?**

Currently, to find which word is at time 5.2s, we loop through all words in all segments:

```typescript
// Current: O(n) linear search
for (const segment of segments) {
  for (const word of segment.words) {
    if (time >= word.start && time < word.end) {
      return word; // Found it after checking many words
    }
  }
}
```

**Word Index Map** is a pre-built sorted array that enables binary search:

```typescript
// Phase A: Build index once when segments load
interface WordIndex {
  segmentId: string;
  wordIndex: number;
  start: number;      // Word start time
  end: number;        // Word end time
  charStart: number;  // Character position in segment text
  charEnd: number;    // Character end position
}

// Build sorted by start time
const wordTimeIndex: WordIndex[] = segments.flatMap(seg =>
  seg.words?.map((w, i) => ({
    segmentId: seg.id,
    wordIndex: i,
    start: w.start,
    end: w.end,
    charStart: /* calculated */,
    charEnd: /* calculated */,
  })) ?? []
).sort((a, b) => a.start - b.start);

// O(log n) lookup
function findWordAtTime(time: number): WordIndex | null {
  // Binary search in sorted array
  let low = 0, high = wordTimeIndex.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const word = wordTimeIndex[mid];
    if (time >= word.start && time < word.end) return word;
    if (time < word.start) high = mid - 1;
    else low = mid + 1;
  }
  return null;
}
```

**Why it matters:**

- 10-minute transcript = ~1,500 words
- Linear search: check up to 1,500 words every frame during playback
- Binary search: check ~11 words max (log₂1500 ≈ 11)

---

## Implementation Checklist

### Phase A: Data Model Cleanup

- [ ] **Interpolate missing word timestamps** (fills ~8% gap from Whisper)
  - Add `interpolateWordTimestamps()` utility
  - Flag interpolated words with `interpolated: true`
  - Run on segment load before building index
- [ ] Add `charStart` and `charEnd` to word timestamps in segment
- [ ] Build word index map on segment load/change (memoized in store)
- [ ] Add binary search utility for O(log n) word lookup
- [ ] Add tests for word index building, interpolation, and lookup

### Phase B: Single Source of Truth

- [ ] Audit all `setCurrentTime` calls - should only be from audio events or explicit seeks
- [ ] Remove any direct `audio.currentTime` mutations outside App.tsx
- [ ] Add `seekTo(time, source)` action that handles all seeking

### Phase C: Click-to-Seek (Editor)

- [ ] Replace textarea with word spans (or overlay approach)
- [ ] Add `data-word-index` and `data-start` attributes to word spans
- [ ] Click handler: find word element → read data attribute → seek
- [ ] Test with edge cases: punctuation, spaces, selection

### Phase D: Click-to-Seek (Timeline)

- [ ] Calculate time from click position within segment (proportional)
- [ ] Verify scroll-to-editor works after seek

### Phase E: Auto-Follow During Playback

- [ ] Add `autoFollowEnabled` state to player store
- [ ] Detect user scroll vs programmatic scroll
- [ ] Add auto-follow indicator button to Timeline toolbar
- [ ] Re-engage auto-follow on button click
- [ ] Test with various zoom levels

### Phase F: Testing

- [ ] Add integration tests for seek → scroll behavior
- [ ] Add tests for word index building
- [ ] Add tests for auto-follow threshold logic
- [ ] Manual QA: 10-minute+ audio file

---

## Decisions Made

### Timeline Click Behavior ✅ DECIDED

**Decision: Option B** - Seek to proportional time based on click X position within segment.

Click position within segment bar calculates time: `segStart + (clickX / segWidth) * segDuration`

Keep visual simplicity (segment blocks, not word blocks), but get precise seeking.

---

### Word Editing Approach ✅ DECIDED

**Decision: Option A** - Clear timestamps on edit, mark segment as "needs re-alignment".

- Add `wordsDirty?: boolean` flag to segment
- Show visual indicator when timestamps are stale
- User clicks "Align" button to re-sync (future feature)
- Keeps current textarea approach, no contentEditable complexity

---

## Reference Links

- [Hyperaudio Lite](https://github.com/hyperaudio/hyperaudio-lite) - Lightweight transcript player
- [BBC React Transcript Editor](https://github.com/bbc/react-transcript-editor) - Full-featured editor
- [Transcript Tracer JS](https://github.com/samuelbradshaw/transcript-tracer-js) - WebVTT sync
- [Syncing Transcript with Audio in React](https://www.metaview.ai/resources/blog/syncing-a-transcript-with-audio-in-react) - Tutorial

---

## Next Steps

1. ~~Review this document and answer open questions~~ ✅ Reviewed
2. Decide on Timeline click behavior (A, B, or C)
3. Decide on word editing approach when text changes
4. Implement Phase A (data model) first - it unblocks everything else
5. Build incrementally with tests at each phase
