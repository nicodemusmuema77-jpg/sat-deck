# SAT Strategy Deck

An interactive, single-page reference of 700+ SAT prep strategies distilled from 5 popular YouTube channels.

**Channels:** Penguin SAT Prep, LearnSATMath, The SAT Gamified, James Lu SAT, SuperTutorTV.

**Live at:** https://strategy.nicxon.tech

## What's in here

```
dist/
├── index.html       Single-page app
├── styles.css       Light/dark theme, responsive
├── app.js           Pure-JS, no dependencies, no build step
├── data/
│   └── strategies.json   719 extracted strategies with source timestamps
└── CNAME            sat.nicxon.tech
```

## How it was built

1. Enumerate every video on each channel with `yt-dlp --flat-playlist`.
2. Filter to strategy/tips/tricks videos by title keyword.
3. Fetch English auto-generated subtitles for the top videos.
4. Extract structured rules (section, rule, why, anchor_quote, tags) from each transcript via a local LLM proxy.
5. Dedupe near-identical rules and serialize.
6. Render with vanilla JS, no framework, no build.

The data pipeline scripts are kept outside this directory (in `../scripts/`) so the deployed repo is just the static site.

## Features

- **Strategy of the day** rotates daily (date-seeded, so it doesn't shuffle on reload).
- **Filter** by section (Math, Reading, Writing, Test-Day, Mindset, Study-Plan) and by channel.
- **Search** rules, "why" explanations, tags, channels, and source titles.
- **Check off** strategies you've practiced — progress is saved in `localStorage` and shows as a progress bar.
- **Source link** on every card jumps to the YouTube video at the relevant timestamp.
- **Export / Import** your progress as JSON so it survives a browser reset.
- **Light / dark theme** with auto-detect; toggle persists.
- No analytics or behavioral tracking is installed. The deployed site may load
  Google AdSense when its advertising flag is enabled; see the privacy page.

## Local development

```sh
cd dist
python3 -m http.server 8000
# open http://127.0.0.1:8000
```

## Updating the data

If you want to re-extract strategies from the source transcripts (e.g. after fixing a prompt or adding a new channel), see the parent `scripts/` directory:

```sh
# 1. Re-enumerate videos (writes data/videos.json)
bash scripts/fetch_channels.sh

# 2. Cap to top-N per channel (writes data/videos_selected.json)
python3 scripts/select_top_videos.py

# 3. Fetch transcripts (writes raw/<id>.vtt and data/transcripts.json)
bash scripts/fetch_transcripts.sh

# 4. Extract strategies via LLM (writes data/strategies_raw.json)
#    Requires the local LiteLLM proxy at http://127.0.0.1:4000
python3 scripts/extract_strategies.py

# 5. Consolidate & dedupe (writes data/strategies.json)
python3 scripts/consolidate.py

# 6. Copy to dist
cp data/strategies.json dist/data/strategies.json
```

## License

Strategy text is summarized from public YouTube videos; source attribution is on every card. Page source: MIT.
