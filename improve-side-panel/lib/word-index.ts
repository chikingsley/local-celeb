export interface WordIndex {
  words: Array<{
    word: string
    start: number
    end: number
    segmentId: string
    charStart: number
    charEnd: number
  }>
}

export function buildWordIndex(segments: any[]): WordIndex {
  const words: WordIndex["words"] = []

  for (const segment of segments) {
    let charOffset = 0
    const segmentWords = segment.words || []

    for (const word of segmentWords) {
      const wordText = word.word
      words.push({
        word: wordText,
        start: word.start,
        end: word.end,
        segmentId: segment.id,
        charStart: charOffset,
        charEnd: charOffset + wordText.length,
      })
      charOffset += wordText.length + 1 // +1 for space
    }
  }

  return { words }
}

export function findWordAtTimeFast(index: WordIndex, time: number) {
  for (const word of index.words) {
    if (time >= word.start && time < word.end) {
      return word
    }
  }
  return null
}

export function findWordAtCharPositionFast(index: WordIndex, segmentId: string, charPos: number) {
  for (const word of index.words) {
    if (word.segmentId === segmentId && charPos >= word.charStart && charPos < word.charEnd) {
      return word
    }
  }
  return null
}

export function getSegmentWords(segment: any) {
  return segment.words || []
}
