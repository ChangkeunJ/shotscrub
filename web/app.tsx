import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import { scan } from '../src/patterns.js'
import { cover, glue, line, type Box, type Word } from '../src/boxes.js'

type Mark = Box & { on: boolean }

const TESS = { workerPath: '/tess/worker.min.js', corePath: '/tess', langPath: '/tess', gzip: true }

async function load(src: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(src)
  try {
    const img = new Image()
    await new Promise((ok, no) => {
      img.onload = ok
      img.onerror = () => no(new Error('that file is not an image the browser can open'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// The blob is what goes to the reader, not the <img>. tesseract refetches an
// element's src, and by then the object URL behind it has been revoked.
async function find(src: Blob, say: (s: string) => void): Promise<Mark[]> {
  say('loading the reader')
  const worker = await createWorker('eng', 1, {
    ...TESS,
    logger: (m) => m.status === 'recognizing text' && say(`reading, ${Math.round(m.progress * 100)}%`),
  })
  try {
    const { data } = await worker.recognize(src, {}, { blocks: true })
    const out: Mark[] = []
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs)
        for (const l of p.lines) {
          const words: Word[] = glue(l.words.map((w) => ({
            text: w.text,
            x: w.bbox.x0,
            y: w.bbox.y0,
            w: w.bbox.x1 - w.bbox.x0,
            h: w.bbox.y1 - w.bbox.y0,
          })))
          for (const box of cover(words, scan(line(words)))) out.push({ ...box, on: true })
        }
    return out
  } finally {
    await worker.terminate()
  }
}

function paint(cv: HTMLCanvasElement, img: HTMLImageElement, marks: Mark[]): void {
  cv.width = img.naturalWidth
  cv.height = img.naturalHeight
  const g = cv.getContext('2d')!
  g.drawImage(img, 0, 0)
  g.fillStyle = '#000'
  for (const m of marks) if (m.on) g.fillRect(m.x, m.y, m.w, m.h)
  // The covered pixels are gone from this canvas, and the saved file is encoded
  // from it. Nothing to lift back out, unlike a blur.
}

export function App() {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [marks, setMarks] = useState<Mark[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState<Box | null>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const from = useRef<{ x: number; y: number } | null>(null)

  const take = useCallback(async (src: Blob) => {
    setErr('')
    setImg(null)
    setMarks([])
    try {
      const next = await load(src)
      setImg(next)
      setMarks(await find(src, setBusy))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }, [])

  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])][0]
      if (f) void take(f)
    }
    addEventListener('paste', paste)
    return () => removeEventListener('paste', paste)
  }, [take])

  useEffect(() => {
    if (img && cv.current) paint(cv.current, img, drag ? [...marks, { ...drag, kind: '', on: true }] : marks)
  }, [img, marks, drag])

  const at = (e: React.MouseEvent) => {
    const r = cv.current!.getBoundingClientRect()
    const s = cv.current!.width / r.width
    return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }
  }

  const up = () => {
    if (drag && drag.w > 4 && drag.h > 4) setMarks((m) => [...m, { ...drag, kind: 'drawn by hand', on: true }])
    else if (drag) {
      const p = { x: drag.x, y: drag.y }
      setMarks((m) =>
        m.map((k) =>
          p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h ? { ...k, on: !k.on } : k,
        ),
      )
    }
    from.current = null
    setDrag(null)
  }

  const save = () => {
    cv.current!.toBlob((b) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b!)
      a.download = 'scrubbed.png'
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }

  const covered = marks.filter((m) => m.on).length

  return (
    <main>
      <h1>shotscrub</h1>
      <p className="lede">
        Finds the keys, tokens and passwords in a screenshot and covers them. The image is read in
        this tab and never uploaded, which is the point: the screenshots worth scrubbing are the
        ones you cannot hand to a website.
      </p>

      <div
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) void take(f)
        }}
      >
        <label>
          Drop a screenshot, paste one, or{' '}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void take(f)
            }}
          />
        </label>
      </div>

      {busy && <p className="busy">{busy}</p>}
      {err && <p className="err">{err}</p>}

      {img && (
        <>
          <div className="bar">
            <strong>{covered}</strong> covered of {marks.length} found.
            <button onClick={save}>Save the scrubbed copy</button>
          </div>
          <canvas
            ref={cv}
            aria-label="the screenshot with its secrets covered"
            onMouseDown={(e) => {
              from.current = at(e)
              setDrag({ ...from.current, w: 0, h: 0, kind: '' })
            }}
            onMouseMove={(e) => {
              if (!from.current) return
              const p = at(e)
              const a = from.current
              setDrag({
                x: Math.min(a.x, p.x),
                y: Math.min(a.y, p.y),
                w: Math.abs(p.x - a.x),
                h: Math.abs(p.y - a.y),
                kind: '',
              })
            }}
            onMouseUp={up}
            onMouseLeave={() => from.current && up()}
          />
          <ul className="found" aria-label="what was found">
            {marks.map((m, i) => (
              <li key={i} className={m.on ? '' : 'off'}>
                <button onClick={() => setMarks((k) => k.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                  {m.on ? 'covered' : 'left alone'}
                </button>
                <span>{m.kind}</span>
              </li>
            ))}
          </ul>
          <p className="note">
            Click a box on the image to uncover it, or drag across the image to cover something the
            reader missed. The saved copy is re-encoded from what you see, so the covered pixels are
            not in the file and neither is the camera or location data the original carried.
          </p>
        </>
      )}
    </main>
  )
}
