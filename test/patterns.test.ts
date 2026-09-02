import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scan, keyish } from '../src/patterns.js'
import { cover, glue, line } from '../src/boxes.js'

const kinds = (s: string) => scan(s).map((f) => f.kind)
const took = (s: string) => scan(s).map((f) => s.slice(f.at, f.end))

test('names the well known key shapes', () => {
  assert.deepEqual(kinds('AKIAIOSFODNN7EXAMPLE'), ['aws access key'])
  assert.deepEqual(kinds('ghp_' + 'a'.repeat(36)), ['github token'])
  assert.deepEqual(kinds('AIza' + 'B'.repeat(35)), ['google api key'])
  assert.deepEqual(kinds('sk-ant-api03-' + 'x'.repeat(30)), ['anthropic key'])
  assert.deepEqual(kinds('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.dBjftJeZ4CVPmB92K'), ['json web token'])
  assert.deepEqual(kinds('-----BEGIN RSA PRIVATE KEY-----'), ['private key'])
})

test('covers only the value of a labelled secret', () => {
  assert.deepEqual(took('DB_PASSWORD=hunter2hunter2'), ['hunter2hunter2'])
  assert.deepEqual(took('api_key: abcd1234efgh5678'), ['abcd1234efgh5678'])
  assert.deepEqual(took('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG'), ['wJalrXUtnFEMI/K7MDENG'])
  assert.deepEqual(kinds('monkey: bananas are great'), [])
})

test('leaves private addresses alone', () => {
  assert.deepEqual(kinds('192.168.1.10'), [])
  assert.deepEqual(kinds('10.0.0.1'), [])
  assert.deepEqual(kinds('127.0.0.1'), [])
  assert.deepEqual(kinds('203.0.113.7'), ['ip address'])
  assert.deepEqual(kinds('999.1.1.1'), [])
})

test('takes a whole connection string, credentials and all', () => {
  assert.deepEqual(took('postgresql://u:p@db.example.com:5432/app'),
    ['postgresql://u:p@db.example.com:5432/app'])
})

test('shape catches what ocr mangled', () => {
  assert.equal(keyish('kR8vQ2mZ-x7Lp0WdT4nBj6Yc'), true)
  assert.equal(keyish('screenshot'), false)
  assert.equal(keyish('aaaaaaaaaaaaaaaaaaaa1A'), false)
  assert.equal(keyish('2026-09-02T00:00:00Z'), false)
})

test('claims a span once, under its most specific name', () => {
  assert.deepEqual(kinds('AIza' + 'B'.repeat(35)), ['google api key'])
})

test('one find spanning two words becomes one box', () => {
  const words = [
    { text: 'Bearer', x: 10, y: 20, w: 40, h: 10 },
    { text: 'abcdefghijklmnop1234', x: 55, y: 22, w: 90, h: 12 },
  ]
  assert.equal(line(words), 'Bearer abcdefghijklmnop1234')
  const boxes = cover(words, scan(line(words)), 0)
  assert.equal(boxes.length, 1)
  assert.deepEqual(boxes[0], { x: 10, y: 20, w: 135, h: 14, kind: 'bearer token' })
})

test('grows a find out to the whole token, both ends', () => {
  const s = 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCY'
  assert.deepEqual(took(s), ['wJalrXUtnFEMIK7MDENGbPxRfiCY'])
  const mid = 'x ' + 'a1B2c3D4e5F6g7H8i9J0kLmN' + ' y'
  const [f] = scan(mid)
  assert.equal(mid.slice(f!.at, f!.end), 'a1B2c3D4e5F6g7H8i9J0kLmN')
  assert.deepEqual(took('connected to 203.0.113.7 as ops@example.com'),
    ['203.0.113.7', 'ops@example.com'])
})

test('rejoins a key the reader split, and leaves real spaces alone', () => {
  const split = [
    { text: 'AWS_SECRET_ACCESS_KEY=wJa', x: 45, y: 60, w: 370, h: 20 },
    { text: 'lrXUtnFEMIK7MDENGbPxRfiCY', x: 425, y: 60, w: 368, h: 20 },
  ]
  const one = glue(split)
  assert.equal(one.length, 1)
  assert.equal(one[0]!.text, 'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCY')
  assert.equal(one[0]!.w, 748)
  const prose = [
    { text: 'Bearer', x: 436, y: 60, w: 87, h: 20 },
    { text: 'eyJhbGciOiJIUzIINiJ9.eyJzdWIiOiI', x: 540, y: 60, w: 460, h: 20 },
  ]
  assert.equal(glue(prose).length, 2)
  const boxes = cover(one, scan(line(one)), 0)
  assert.equal(boxes.length, 1)
  assert.equal(boxes[0]!.x + boxes[0]!.w, 793)
})

test('a key takes the whole line, an address does not', () => {
  const words = [
    { text: 'TOKEN=abc123def456ghi789', x: 40, y: 60, w: 300, h: 20 },
    { text: 'trailing', x: 360, y: 60, w: 90, h: 20 },
  ]
  const [box] = cover(words, scan(line(words)), 0)
  assert.equal(box!.x, 40)
  assert.equal(box!.x + box!.w, 450)
  const prose = [
    { text: 'reached', x: 40, y: 60, w: 90, h: 20 },
    { text: '203.0.113.7', x: 150, y: 60, w: 140, h: 20 },
    { text: 'today', x: 300, y: 60, w: 70, h: 20 },
  ]
  const [ip] = cover(prose, scan(line(prose)), 0)
  assert.equal(ip!.x, 150)
  assert.equal(ip!.x + ip!.w, 290)
})
