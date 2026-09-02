# shotscrub

Finds the keys, tokens and passwords in a screenshot and covers them, in the browser.

Live at https://shotscrub.pages.dev

The screenshots worth scrubbing are the ones you cannot hand to a website. A terminal with
a `.env` open in it, a dashboard with a live connection string, the curl command you were
about to paste into an issue. Anything that uploads the image to have a look at it has
already done the thing you were trying to avoid, so this reads it in the tab and the file
never leaves.

Drop a screenshot in, or paste one. It runs OCR over the image, matches what it reads
against the shapes secrets come in, and draws opaque boxes over them. Click a box to take
it off, or drag across the image to add one the reader missed. Saving re-encodes the canvas
you are looking at, so the covered pixels are not in the file and neither is the camera or
location data the original carried.

## What it looks for

The well known shapes: AWS access keys, GitHub tokens, Google API keys, Anthropic and
OpenAI keys, Stripe keys, Slack tokens, npm tokens, JSON web tokens, private key headers,
and database connection strings with credentials in them.

Anything with a name in front of it: `DB_PASSWORD=`, `AWS_SECRET_ACCESS_KEY=`,
`api_key:`. The prefix matters, because the name in a real env file is never just
`password`.

And anything that is shaped like a key even when nothing announces it. OCR mangles a long
random string character by character, so no exact rule survives contact with one. Length,
mixed case, digits and a low repeat rate do.

Email addresses and public IP addresses as well. Private ranges are left alone: a
`192.168.1.10` in a screenshot is not a leak.

## Two things it does deliberately

It never blurs or pixelates. Both are reversible, which is what
[unredacter](https://github.com/BishopFox/unredacter) exists to demonstrate. The boxes are
opaque, and the saved file is encoded from a canvas where the pixels underneath are already
gone.

It covers whole lines rather than tight boxes around each secret. The reader splits a long
key into two or three pieces and a rule then matches one of them, which draws a box over
the middle of a secret and leaves both ends readable. Nothing in the geometry separates
those splits from real spaces: measured on one screenshot, the gap inside a token was 1.20
of a character while a real space on the line below was 1.14. So the line goes. It hides
the label along with the value and it sometimes takes a word that did not need taking, and
both of those are one click to undo. Half a key legible under a box that says it is covered
is not.

Email and IP addresses keep tight boxes, because a leaked `.com` costs nothing.

## Running it

```
npm install
npm test        # the detection rules and the box geometry
npm run web     # dev server
npm run build:web
```

Tesseract's worker, core and English data are served from this origin rather than a CDN.
That is the whole claim, and a CDN would break it.

MIT.
