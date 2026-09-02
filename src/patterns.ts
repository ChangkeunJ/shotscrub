export type Find = { at: number; end: number; kind: string }

const RULES: [string, RegExp][] = [
  ['private key', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g],
  ['json web token', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
  ['aws access key', /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g],
  ['github token', /\bgh[pousr]_[A-Za-z0-9]{28,}\b/g],
  ['slack token', /\bxox[baprse]-[0-9A-Za-z-]{10,}/g],
  ['stripe key', /\b[sr]k_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ['openai key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ['google api key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/g],
  ['connection string', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)s?:\/\/[^\s"'<>]+/g],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}/g],
  ['email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
]

// Only the value is covered. The label is what tells the reader something was
// there, and a black box with nothing to name it looks like a mistake. The
// optional prefix is what makes AWS_SECRET_ACCESS_KEY and DB_PASSWORD work; it
// has to end in a separator, or `monkey:` reads as a key.
const LABELLED =
  /\b(?:[\w.-]*[_.-])?(?:keys?|secrets?|tokens?|passwords?|passwd|pwd|credentials?|authorization)\s*[=:]\s*(\S{8,})/gi

const PRIVATE = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/
const IP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g

// A URL is only a secret when it carries one.
const PLAIN_URL = /^[a-z][a-z0-9+.-]*:\/\/(?![^/@\s]+:[^/@\s]+@)[^\s]*$/i
const LOADED_URL = /[?&#](?:token|key|secret|password|passwd|sig|signature|auth|access_token|api_key)=/i

export function keyish(w: string): boolean {
  if (w.length < 20 || /\s/.test(w)) return false
  if (!/[a-z]/.test(w) || !/[A-Z]/.test(w) || !/\d/.test(w)) return false
  if (/^[\/~.]/.test(w) || /^[A-Za-z]:\\/.test(w)) return false
  if (PLAIN_URL.test(w) && !LOADED_URL.test(w)) return false
  return new Set(w).size >= w.length * 0.5
  // OCR mangles a random key character by character, so no exact rule survives it.
  // Shape does. All three of lower case, upper case and digits is the line: every
  // vendor key has them, and what shows up in logs does not. A timestamp has no
  // lower case, a sha and a uuid have no upper case, a version number has almost
  // no letters. Paths and plain URLs are excluded by name because a mixed case
  // path is common and is never a secret by itself.
}

function push(out: Find[], at: number, end: number, kind: string): void {
  for (const f of out) if (at < f.end && f.at < end) return
  out.push({ at, end, kind })
}

export function scan(text: string): Find[] {
  const out: Find[] = []
  for (const [kind, re] of RULES) {
    re.lastIndex = 0
    for (let m = re.exec(text); m; m = re.exec(text)) push(out, m.index, m.index + m[0].length, kind)
  }
  LABELLED.lastIndex = 0
  for (let m = LABELLED.exec(text); m; m = LABELLED.exec(text)) {
    const v = m[1]!
    push(out, m.index + m[0].length - v.length, m.index + m[0].length, 'labelled value')
  }
  IP.lastIndex = 0
  for (let m = IP.exec(text); m; m = IP.exec(text)) {
    if (m[0].split('.').every((p) => Number(p) < 256) && !PRIVATE.test(m[0]))
      push(out, m.index, m.index + m[0].length, 'ip address')
  }
  let at = 0
  for (const w of text.split(/(\s+)/)) {
    if (!/^\s/.test(w) && keyish(w)) push(out, at, at + w.length, 'looks like a key')
    at += w.length
  }
  return out.map((f) => widen(text, f)).sort((a, b) => a.at - b.at)
  // Overlaps are dropped rather than merged: the first rule to claim a span is the
  // most specific one, and its name is what the panel shows for that box.
}

function widen(text: string, f: Find): Find {
  let at = f.at
  while (at > 0 && !/[\s=:]/.test(text[at - 1]!)) at--
  let end = f.end
  while (end < text.length && !/\s/.test(text[end]!)) end++
  return { ...f, at, end }
  // OCR chops a long random token into several words and a rule can land on one of
  // them, which covers the middle of a key and leaves both ends showing. Half a
  // secret under a black box reads as a safe screenshot, so every find is grown out
  // to the whole run. It stops at = and : on the left because the name of the thing
  // is what makes the box mean something.
}
