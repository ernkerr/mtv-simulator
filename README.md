# 📺 MTV 1999 — Retro Music Television Simulator

A 1999 living-room TV that only gets music channels. Flip around, check the guide, and it quietly learns what you like.

No build step, no framework, no backend. Three JavaScript files and a stylesheet. Videos stream from YouTube through the official embed API.

## What it does

- **Ten channels on a live schedule.** Each channel keeps "airing" whether you're watching or not, so you tune in mid-video like real TV. Channel 1 is MTV proper (everything); the rest are themed blocks: *VH1 Classic* (80s), *Alternative Nation*, *120 Minutes*, *Yo! MTV Raps*, *Headbangers Ball*, *TRL*, *AMP* (electronic) and *MTV Jams* (R&B).
- **Channel 2 is MTV YOU.** It is programmed by your taste and starts out random. The more you watch, the more it sounds like you.
- **It learns from how you surf.** Bailing on a video in the first few seconds is a no. Sticking around, or watching to the end, is a yes. `LOVE` and `NOPE` on the remote are loud votes. Every other channel reorders its upcoming picks around what it has learned, but keeps its genre.
- **A Prevue-style guide.** `GUIDE` shows the blue grid with NOW / NEXT for every channel, a 1999 clock, a ticker, and a *YOUR TASTE* tab with what the TV thinks it knows about you.
- **CRT details.** Static between channels, scanlines, glass glare, a lower-third title card at the start and end of every video, an on-screen channel number, a volume bar, and synthesized power-on/off and static sounds.
- **Private by design.** Everything it learns lives in `localStorage` in your browser. Nothing is sent anywhere. "Reset what it has learned" at the bottom of the page wipes it.

## Controls

| Remote | Keyboard | Does |
| --- | --- | --- |
| ⏻ | `P` | Power |
| CH ▲ / ▼ | `↑` / `↓` | Channel up / down |
| 0–9 | `0`–`9` | Tune directly (two digits, or wait a second) |
| LAST | `L` | Previous channel |
| VOL + / − | `→` / `←` | Volume |
| MUTE | `M` | Mute |
| GUIDE | `G` | Open / close the guide (↑↓ to browse, Enter to tune, ←→ to switch tabs) |
| INFO | `I` or `Enter` | Show the channel and the title card again |
| ♥ LOVE | `F` | Strong yes for this video |
| ✕ NOPE | `X` | Strong no; the channel moves on |
| | `T` | Jump straight to the *YOUR TASTE* tab |

On a phone: swipe up or down on the screen to change channels, tap it for info.

## Running it

It is a static site. Open `index.html` from any web server:

```sh
python3 -m http.server 8000
# then http://localhost:8000
```

Add `?mock=1` to the URL to run with a fake player (no YouTube) when you're working on the UI offline.

### Deploying

- **GitHub Pages:** the included workflow in `.github/workflows/pages.yml` publishes the repo root. Enable Pages with source *GitHub Actions* in the repo settings.
- **Vercel / Netlify / anything:** point it at this folder. There is no build command.

## How the taste model works

`js/taste.js` keeps a score per genre tag and per artist.

| Signal | Weight |
| --- | --- |
| Watched to the end | +1.0 |
| Watched most of it, or more than 90 seconds | +0.5 to +0.7 |
| Flipped away after 6–25 seconds | −0.35 |
| Flipped away within 6 seconds | −0.8 |
| LOVE | +2.0 |
| NOPE | −2.0 |

Each channel picks its next video by a softmax over its own pool of videos, weighted by those scores. MTV YOU uses a low temperature (it obeys your taste), the genre channels use a high one (they stay eclectic but tilt your way). Unseen videos get a small exploration bonus and anything that played recently is pushed to the back of the line, so it never turns into a five-song loop.

## The catalog

`js/catalog.js` lists ~200 videos from 1979–1999 with genre tags. Video IDs were verified against YouTube search results; some videos may still be region-locked or non-embeddable, and the TV skips those automatically and remembers not to schedule them again.

To add a video, append an object with `id`, `artist`, `title`, `year` and `tags`. Tags decide which channels it appears on (see the lineup at the top of `js/tv.js`).

## Credits and disclaimer

An unofficial fan project. Not affiliated with MTV, VH1, or Paramount. All videos belong to their respective owners and are played through YouTube's official embed, which serves ads and respects the rights holders' embed settings.
