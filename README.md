# NUMA SPIN

NUMA SPIN is a browser-based casino interface demo with a game catalog, provider demos, rewards, and two demo coin balances. The demo account and wallet are stored in IndexedDB in each browser. Provider games use separate demo balances.

[Open the live site](https://jarmanarnar.github.io/numaspin/)

## Develop

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open [the local preview](http://127.0.0.1:4320/luckyloopcasino/). In GitHub Codespaces, open forwarded port **4320** and append **/luckyloopcasino/** to its URL. The page reloads after you save a change in **public/**. Use **npm start** for a preview without automatic reload.

## Verify and publish

```sh
npm run check
npm test
npm run build
```

Push to **main** to run the checks and publish the versioned **dist/** build to GitHub Pages. You can also run **Deploy GitHub Pages** from the Actions tab.

## Project files

| Path | Purpose |
| --- | --- |
| **public/** | UI, client modules, game catalog, and assets |
| **scripts/** | Static build, syntax checks, and catalog import |
| **tests/** | Account, catalog, game, and server checks |
| **design/references/** | Earlier logo concepts kept for design reference |

Game and provider artwork sources are recorded in [games](public/assets/games/README.md) and [providers](public/assets/providers/README.md).
