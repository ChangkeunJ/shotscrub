# Contributing

Start with an [open issue](https://github.com/ChangkeunJ/shotscrub/issues?q=is%3Aissue+is%3Aopen).
A missed token, a false positive or a confusing setup step is enough for a small PR.
If you're changing how the tool behaves, describe the change in an issue first.

Use Node 22.12 or later, or Node 20.19 or later in the 20.x series. From your checkout:

```sh
npm ci
npm test
npm run web
```

The first dev run needs Bash and curl to download the English OCR data. The worker and
language files are then served locally from `web/public/tess/`.

Detection rules live in `src/patterns.ts`, box placement in `src/boxes.ts`, and their tests
in `test/patterns.test.ts`. `web/app.tsx` handles the image, OCR, editing and PNG export.

For detection changes, add a case to the existing test file. For browser changes, try
loading an image, adding and removing a box, and saving the result. Before opening a PR,
run `npm test` and `npm run build:web`, then say what changed and how you checked it.

Use made-up tokens, passwords and personal details in examples and screenshots. Include
the browser version and what you expected to be covered. Don't post an original screenshot
that contains real secrets, even if the reported problem is that shotscrub missed them.
