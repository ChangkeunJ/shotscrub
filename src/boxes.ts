import type { Find } from './patterns.js'

export type Word = { text: string; x: number; y: number; w: number; h: number }
export type Box = { x: number; y: number; w: number; h: number; kind: string }

export function glue(words: Word[]): Word[] {
  const out: Word[] = []
  for (const w of words) {
    const p = out[out.length - 1]
    const em = Math.min(p ? p.w / Math.max(p.text.length, 1) : Infinity, w.w / Math.max(w.text.length, 1))
    if (p && w.x - (p.x + p.w) < em * 0.9 && Math.abs(w.y - p.y) < p.h * 0.6) {
      p.text += w.text
      p.w = Math.max(p.x + p.w, w.x + w.w) - p.x
      p.h = Math.max(p.h, w.y + w.h - p.y)
    } else out.push({ ...w })
  }
  return out
  // A long random key comes back from the reader as two or three words with no
  // space between them on screen. Left alone, a rule matches one of them and the
  // box covers part of the secret with the rest still legible, which is the one
  // failure this tool must not have. Measured on a terminal screenshot: a split
  // inside a token leaves 0.69 em, a real space leaves 1.2 to 1.5, so 0.9 sits
  // between them with room on both sides.
}

export function line(words: Word[]): string {
  return words.map((w) => w.text).join(' ')
}

// Where a leaked edge does not matter. Everything else takes the whole line.
//
// The reader breaks a long key into pieces and a rule then matches one of them,
// so a box drawn to the matched words leaves the head or the tail of the secret
// legible. No gap measurement fixes it: on one screenshot the gap inside a token
// was 1.20 of a character while a real space on the line below was 1.14, and any
// threshold between them is wrong on one of the two. Taking the line is crude and
// it hides the label with the value, but it cannot leave four characters of a key
// showing under a box that claims to have covered it, and that is the only
// failure here that matters. Anything covered too eagerly is one click to undo.
const TIGHT = new Set(['email address', 'ip address'])

export function cover(words: Word[], finds: Find[], pad = 2): Box[] {
  const out: Box[] = []
  const edge = Math.max(...words.map((w) => w.x + w.w), 0)
  const left = words.length ? Math.min(...words.map((w) => w.x)) : 0
  const top = words.length ? Math.min(...words.map((w) => w.y)) : 0
  const foot = Math.max(...words.map((w) => w.y + w.h), 0)
  for (const f of finds) {
    let at = 0
    let box: Box | null = null
    for (const w of words) {
      const end = at + w.text.length
      if (at < f.end && f.at < end) {
        if (!box) box = { x: w.x, y: w.y, w: w.w, h: w.h, kind: f.kind }
        else {
          const right = Math.max(box.x + box.w, w.x + w.w)
          const bottom = Math.max(box.y + box.h, w.y + w.h)
          box.x = Math.min(box.x, w.x)
          box.y = Math.min(box.y, w.y)
          box.w = right - box.x
          box.h = bottom - box.y
        }
      }
      at = end + 1
    }
    if (!box) continue
    const wide = !TIGHT.has(box.kind)
    const x = wide ? left : box.x
    const y = wide ? top : box.y
    out.push({
      x: x - pad,
      y: y - pad,
      w: (wide ? edge - left : box.w) + pad * 2,
      h: (wide ? foot - top : box.h) + pad * 2,
      kind: box.kind,
    })
    // Vertically too. A quotation mark sits above the letters and gets its own
    // box, so a line box drawn to one word's height leaves punctuation floating
    // outside it.
  }
  return out
  // A find that spans three words becomes one box, not three, so no sliver of the
  // secret survives in the gaps the reader leaves between words.
}
