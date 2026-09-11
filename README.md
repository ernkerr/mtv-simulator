# 📺 MTV — Music Television Simulator

A big boxy wood-console TV in a warm living room that only gets music channels. Turn the dial, check the guide, and it quietly learns what you like.

No build step, no framework, no backend. Three JavaScript files and a stylesheet. Videos stream from YouTube through the official embed API.

## What it does

- **Ten channels on a live schedule.** Each channel keeps "airing" whether you're watching or not, so you tune in mid-video like real TV. Channel 1 is MTV proper (everything); the rest are themed blocks: *VH1 Classic* (80s), *Alternative Nation*, *120 Minutes*, *Yo! MTV Raps*, *Headbangers Ball*, *TRL*, *AMP* (electronic) and *MTV Jams* (R&B).
- **Channel 2 is MTV YOU.** It is programmed by your taste and starts out random. The more you watch, the more it sounds like you.
- **It learns from how you surf.** Bailing on a video in the first few seconds is a no. Sticking around, or watching to the end, is a yes. `LOVE` and `NOPE` on the remote are loud votes. Every other channel reorders its upcoming picks around what it has learned, but keeps its genre.
- **A Prevue-style guide.** `GUIDE` shows the blue grid with NOW / NEXT for every channel, a clock, a ticker, and a *YOUR TASTE* tab with what the TV thinks it knows about you.
- **The real title card.** A few seconds into every video, the four-line card cuts in bottom-left the way MTV ran it: artist, the song in quotes, the album, the record label, in white Kabel-style type with a hard black shadow. It fades out, then comes back for the last few seconds. (Kabel itself is a commercial font; the site uses Josefin Sans, the closest free face, with Kabel as the first fallback if you have it installed.)
- **It feels like a real set.** A wood cabinet with a CHANNEL dial that notches over with a clunk, a VOLUME knob, a POWER push-button and a jewel light. The remote's rubber buttons lift on hover and push down when you click, with a clack on the way down and back up. Keyboard shortcuts press the matching remote button. Static between channels, scanlines, glass glare, a lower-third title card at the start and end of every video, and the tube throws light on the room.
- **Private by design.** Everything it learns lives in `localStorage` in your browser. Nothing is sent anywhere. "Reset what it has learned" at the bottom of the page wipes it.

## Controls

| Remote | Keyboard | Does |
| --- | --- | --- |
| ⏻ | `P` | Power (also the POWER button on the set) |
| CH ▲ / ▼ | `↑` / `↓` | Channel up / down (or turn the CHANNEL dial: click, shift-click, or scroll) |
| 0–9 | `0`–`9` | Tune directly (two digits, or wait a second) |
| LAST | `L` | Previous channel |
| VOL + / − | `→` / `←` | Volume (or turn the VOLUME dial) |
| MUTE | `M` | Mute |
| GUIDE | `G` | Open / close the guide (↑↓ to browse, Enter to tune, ←→ to switch tabs) |
| INFO | `I` or `Enter` | Show the channel and the title card again |
| ♥ LOVE | `F` | Strong yes for this video |
| ✕ NOPE | `X` | Strong no; the channel moves on |
| | `T` | Jump straight to the *YOUR TASTE* tab |
| | `?` | Open the owner's manual |

On a phone: swipe up or down on the screen to change channels, tap it for info.

## Running it

It is a static site. Open `index.html` from any web server:

```sh
python3 -m http.server 8000
# then http://localhost:8000
```

Add `?mock=1` to the URL to run with a fake player (no YouTube) when you're working on the UI offline.

### Moving it into its own repository

This folder was built inside the `ernkerr/ernkerr` repo. To give it its own repo (say `ernkerr/mtv-simulator`), create an empty repo on GitHub, then from the root of this repo:

```sh
git subtree split --prefix=mtv-simulator -b mtv-simulator-main
git push git@github.com:ernkerr/mtv-simulator.git mtv-simulator-main:main
```

That keeps the history and puts `index.html` at the root of the new repo, which is what the Pages workflow expects.

### Deploying

- **GitHub Pages:** the included workflow in `.github/workflows/pages.yml` publishes the repo root. In the new repo go to *Settings → Pages* and set the source to *GitHub Actions*. The site will be at `https://ernkerr.github.io/mtv-simulator/`.
- **Vercel / Netlify / anything:** point it at this folder. Framework: none, no build command, output directory: `.` (or `mtv-simulator` if you deploy from the profile repo).

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

`js/catalog.js` lists ~200 videos from the late 70s through the end of the 90s, with genre tags. Video IDs were verified against YouTube search results; some videos may still be region-locked or non-embeddable, and the TV skips those automatically and remembers not to schedule them again.

Album and label names on the title cards were filled in from memory for well-known releases; if you spot a wrong one, it's a one-line fix.

To add a video, append an object with `id`, `artist`, `title`, `album`, `label`, `year` and `tags`. Tags decide which channels it appears on (see the lineup at the top of `js/tv.js`).

## Credits and disclaimer

An unofficial fan project. Not affiliated with MTV, VH1, or Paramount. All videos belong to their respective owners and are played through YouTube's official embed, which serves ads and respects the rights holders' embed settings.
