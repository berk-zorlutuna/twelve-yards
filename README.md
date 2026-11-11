# Twelve Yards

A 3D penalty shootout game in a single HTML file. Open `index.html` in a browser to play.

- Your kick: flick up from the ball toward your corner. A faster flick is a harder shot; bend the flick to curl it.
- Their kick: move the gloves across the goal and get them behind the ball.
- Five kicks each, then sudden death.

## Documents

1. [System requirements](docs/01-system-requirements.md)
2. [Software requirements](docs/02-software-requirements.md)
3. [Software verification cases](docs/03-software-verification-cases.md)
4. [Software verification results](docs/04-software-verification-results.md)

## Running the verification

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run verify
```

The runner executes the automated cases in headless Chromium and regenerates documents 3 and 4. It serves three.js from `node_modules` so it works without access to the CDN.
