# SemantiNote Social Reel Production Guide

This directory contains the build assets for the vertical SemantiNote social reel. The current output is `social-reel.mp4`.

## What This Build Produces

- 1080 x 1920 vertical MP4
- 30 fps H.264 video and AAC audio
- About 32 seconds
- Four narration samples, one per section:
  - Search: `en-US-BrianNeural`
  - AI Q&A: `en-US-ChristopherNeural`
  - Meeting recording: `en-GB-RyanNeural`
  - Privacy CTA: `en-US-RogerNeural`

## Required Tools

```bash
ffmpeg -version
ffprobe -version
python3 --version
/Users/mmu8133/Library/CloudStorage/OneDrive-MassMutual/Desktop/myvscodeextensionbudai/.venv/bin/edge-tts --version
```

The build scripts use Pillow through Python and Edge TTS from the workspace virtual environment. macOS `say` with the `Daniel` voice is the fallback if Edge TTS is unavailable.

For authentic desktop-app captures, also require:

- Node.js and dependencies installed in `semantinote-app`
- Electron development app running with Chrome DevTools Protocol on port `9222`
- Ollama running locally, with a chat model and `nomic-embed-text` configured

## Directory Contents

- `build-reel.sh`: full render pipeline
- `gen-overlays.py`: generated text overlays
- `gen-reel-scenes.py`: generated supporting frames and privacy masks
- `live-search.mp4`: continuous native capture of search typing and semantic results
- `live-chat.mp4`: continuous native capture of the HTML meeting note, AI question, working state, and answer
- `meeting-platforms/`: Zoom, Teams, Google Meet, and Webex image assets
- `shots/`: original app screenshots used by the generated meeting scene
- `social-reel.mp4`: current final export

## Build the Reel

Run this from the web asset folder:

```bash
cd "/Users/mmu8133/Library/CloudStorage/OneDrive-MassMutual/Desktop/myvscodeextensionbudai/semantinote-web/assets/img"
bash build-reel.sh
```

The builder will:

1. Generate overlays and static support scenes into a temporary directory.
2. Generate the four voice-over clips with Edge TTS.
3. Add 0.25 seconds of silence before and after each voice section.
4. Assemble the four vertical scenes.
5. Concatenate the scenes and mux the narration into `social-reel.mp4`.

## Change Narration

Edit the `make_narration` calls in `build-reel.sh`.

```bash
make_narration 1 "en-US-BrianNeural" "Your opening narration."
make_narration 2 "en-US-ChristopherNeural" "Your AI section narration."
make_narration 3 "en-GB-RyanNeural" "Your meeting section narration."
make_narration 4 "en-US-RogerNeural" "Your CTA narration."
```

`NEURAL_RATE` sets the default speech speed. The current value is `+15%`. Keep narration concise, then rebuild and check the duration. A 30 to 32 second reel is suitable for TikTok, Instagram Reels, and X.

List available voices:

```bash
/Users/mmu8133/Library/CloudStorage/OneDrive-MassMutual/Desktop/myvscodeextensionbudai/.venv/bin/edge-tts --list-voices | grep -E '^en-.*Male'
```

## Capture Real SemantiNote Footage

The most convincing scenes use native Electron `capturePage()` rather than screenshots or operating-system screen recording.

### 1. Start the desktop app

```bash
cd "/Users/mmu8133/Library/CloudStorage/OneDrive-MassMutual/Desktop/myvscodeextensionbudai/semantinote-app"
npm run dev -- --remote-debugging-port=9222
```

The app includes development-only bridge methods at `window.semantinote.app`:

- `capturePage(outputPath)`: capture one PNG
- `recordPage(outputDir, frameCount)`: capture a sequence of 30 fps PNG frames

The renderer can be controlled with `scripts/electron-evaluate.mjs`, a small Chrome DevTools Protocol helper.

### 2. Create an HTML meeting note

Use an `.html` note for rich formatting in the capture. Example source content:

```html
<h1>Product Launch Planning Meeting</h1>
<p><strong>August 26, 2026</strong> &middot; Product, Marketing, and Customer Success</p>
<hr>
<h2>Decision</h2>
<blockquote><p>The team agreed to launch on <strong>September 18</strong>.</p></blockquote>
<h2>Key Discussion</h2>
<ul>
  <li>Marketing publishes the announcement and customer email.</li>
  <li>Customer Success hosts the onboarding session.</li>
</ul>
<h2>Owners</h2>
<table><tbody><tr><th>Team</th><th>Responsibilities</th></tr><tr><td>Marketing</td><td>Announcement and customer email</td></tr></tbody></table>
```

Reload the renderer and open the note through the real notebook UI:

```bash
node scripts/electron-evaluate.mjs "window.location.reload(); 'reloading'"
node scripts/electron-evaluate.mjs "new Promise(resolve => setTimeout(() => { [...document.querySelectorAll('.nb-page-name')].find(element => element.textContent?.includes('Product Launch Planning Meeting'))?.closest('.nb-page')?.click(); setTimeout(() => resolve('opened'), 500); }, 900))"
```

Optionally click `button[title="Zoom out"]` twice to fit more of the rich note into the captured pane.

### 3. Capture a prefilled AI question

This records a prefilled question, then sends it after 1.25 seconds. It preserves the app's real working/thinking indicator and local streamed answer.

```bash
rm -rf /tmp/live-prefilled-chat-frames
mkdir -p /tmp/live-prefilled-chat-frames
node scripts/electron-evaluate.mjs "(async () => { const question = 'What is the launch date, and who owns the customer email?'; const textarea = document.querySelector('textarea[placeholder]'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(textarea, question); textarea.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 250)); const recording = window.semantinote.app.recordPage('/tmp/live-prefilled-chat-frames', 420); await new Promise(resolve => setTimeout(resolve, 1250)); document.querySelector('.chat-send')?.click(); await recording; return 'recorded'; })()"
```

Encode it and replace the reel source:

```bash
ffmpeg -y -framerate 30 -i /tmp/live-prefilled-chat-frames/frame-%04d.png -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p /tmp/live-prefilled-chat.mp4
cp /tmp/live-prefilled-chat.mp4 live-chat.mp4
```

### 4. Capture the search section

For the search footage, progressive typing is useful, followed by one semantic-search result transition. Do not loop the clip: `build-reel.sh` uses `tpad=stop_mode=clone` to hold the final semantic-results frame so opening keystrokes never replay at the end.

## Privacy and Presentation Fixes

Generated masks avoid leaking local details from native captures:

- `search_footer_mask.png` hides the local user folder path and displays `SemantiNote Demo`.
- `chat_status_mask.png` hides the transient `Saved` status so the rich note header does not visibly change during the Q&A capture.

Both masks are created in `gen-reel-scenes.py` and composited in `build-reel.sh`.

Before publishing, inspect every visible label for user names, local paths, email addresses, meeting attendees, and other personal or confidential data.

## Validate the Export

```bash
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of default=noprint_wrappers=1 social-reel.mp4
```

Extract representative frames:

```bash
ffmpeg -y -ss 5 -i social-reel.mp4 -frames:v 1 /tmp/reel-search.png
ffmpeg -y -ss 12 -i social-reel.mp4 -frames:v 1 /tmp/reel-chat.png
ffmpeg -y -ss 20 -i social-reel.mp4 -frames:v 1 /tmp/reel-meeting.png
```

Check that:

- Search ends on semantic results, not a replayed first keystroke.
- The AI question is prefilled, then shows working/thinking and an answer.
- The meeting section shows the platform logos and real SemantiNote recording surface.
- No personally identifiable path or transient UI status appears.
- Export is vertical, 30 fps, has audio, and fits the desired runtime.

## Recommended Iteration Workflow

1. Change only the narration line, captured source, or generator element being tested.
2. Run `bash build-reel.sh`.
3. Extract a frame around the changed scene with `ffmpeg -ss`.
4. View the frame before making the next adjustment.
5. Keep native app behavior continuous whenever demonstrating a product interaction.
