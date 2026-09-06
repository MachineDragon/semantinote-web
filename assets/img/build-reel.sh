#!/bin/bash
set -euo pipefail

# Improved SemantiNote Social Reel Builder
# Output: 1080x1920 vertical, 30fps, ~30s, with male voice narration
# Uses Pillow for text overlays (no drawtext filter needed)

DIR="$(cd "$(dirname "$0")" && pwd)"
SHOTS="$DIR/shots"
OUT="$DIR/social-reel.mp4"
LIVE_SEARCH="$DIR/live-search.mp4"
LIVE_CHAT="$DIR/live-chat.mp4"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

EDGE_TTS="$DIR/../../../.venv/bin/edge-tts"
FALLBACK_VOICE="Daniel"
RATE=175
NEURAL_RATE="+15%"

BG="0x0d0d1a"
W=1080
H=1920

# ─── 1. Generate text overlay PNGs ───────────────────────────────

echo "▸ Generating text overlays…"
python3 "$DIR/gen-overlays.py" "$TMP"
python3 "$DIR/gen-reel-scenes.py" "$TMP"

# ─── 2. Generate voiceover segments ──────────────────────────────

echo "▸ Generating voiceover…"

make_narration() {
  local number="$1"
  local voice="$2"
  local script="$3"
  if "$EDGE_TTS" \
    --voice "$voice" --rate="$NEURAL_RATE" --text "$script" \
    --write-media "$TMP/vo$number.mp3"; then
    echo "  Using neural male voice: $voice"
  else
    echo "  Neural voice unavailable; using local male fallback: $FALLBACK_VOICE"
    say -v "$FALLBACK_VOICE" -r "$RATE" -o "$TMP/vo$number.aiff" "$script"
    ffmpeg -y -loglevel error -i "$TMP/vo$number.aiff" "$TMP/vo$number.mp3"
  fi
}

make_narration 1 "en-US-BrianNeural" "Still hunting through notes? Search in your own words. When keywords miss, switch to semantic search. SemantiNote finds notes by what they mean."
make_narration 2 "en-US-ChristopherNeural" "Chat with your notes. Ask A.I. questions, create clear summaries, and find decisions and next steps from lectures or meetings."
make_narration 3 "en-GB-RyanNeural" "Record every meeting and lecture. SemantiNote turns calls into searchable notes."
make_narration 4 "en-US-RogerNeural" "Local A.I. No cloud. No monthly costs. SemantiNote is free to try at semantinote dot com."

for i in 1 2 3 4; do
  ffmpeg -y -loglevel error -i "$TMP/vo$i.mp3" -ar 44100 -ac 1 "$TMP/vo$i.wav"
done

dur1=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/vo1.wav")
dur2=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/vo2.wav")
dur3=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/vo3.wav")
dur4=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/vo4.wav")

echo "  VO durations: $dur1 $dur2 $dur3 $dur4"

# Pad each scene with a short visual breath.
for i in 1 2 3 4; do
  ffmpeg -y -loglevel error \
    -f lavfi -t 0.25 -i "anullsrc=r=44100:cl=mono" \
    -i "$TMP/vo$i.wav" \
    -f lavfi -t 0.25 -i "anullsrc=r=44100:cl=mono" \
    -filter_complex "[0][1][2]concat=n=3:v=0:a=1" \
    "$TMP/seg$i.wav"
done

sdur1=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/seg1.wav")
sdur2=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/seg2.wav")
sdur3=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/seg3.wav")
sdur4=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/seg4.wav")

echo "  Padded durations: $sdur1 $sdur2 $sdur3 $sdur4"

ffmpeg -y -loglevel error \
  -i "$TMP/seg1.wav" -i "$TMP/seg2.wav" -i "$TMP/seg3.wav" \
  -i "$TMP/seg4.wav" \
  -filter_complex "[0][1][2][3]concat=n=4:v=0:a=1" \
  "$TMP/full_vo.wav"

TOTAL_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$TMP/full_vo.wav")
echo "  Total audio: ${TOTAL_DUR}s"

# ─── 3. Build video scenes (overlay PNGs on scaled clips) ────────

echo "▸ Building video scenes…"

# Scene 1: One uninterrupted native capture from the live SemantiNote window.
ffmpeg -y -loglevel error \
  -i "$LIVE_SEARCH" \
  -loop 1 -i "$TMP/search_footer_mask.png" \
  -loop 1 -i "$TMP/overlay1.png" \
  -t "$sdur1" \
  -filter_complex "[0:v]crop=1272:1656:0:0,scale=${W}:-2:flags=lanczos,pad=${W}:${H}:0:(oh-ih)/2:color=${BG},tpad=stop_mode=clone:stop_duration=2[app];[app][1:v]overlay=0:0[masked];[masked][2:v]overlay=0:0" \
  -r 30 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$TMP/scene1.mp4"

# Scene 2: One continuous native capture: type a meeting question, send it, and watch the answer stream.
ffmpeg -y -loglevel error \
  -stream_loop -1 -i "$LIVE_CHAT" \
  -loop 1 -i "$TMP/chat_status_mask.png" \
  -loop 1 -i "$TMP/overlay2.png" \
  -t "$sdur2" \
  -filter_complex "[0:v]crop=1468:1662:1188:0,scale=${W}:-2:flags=lanczos,pad=${W}:${H}:0:(oh-ih)/2:color=${BG}[app];[app][1:v]overlay=0:0[masked];[masked][2:v]overlay=0:0" \
  -r 30 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$TMP/scene2.mp4"

# Scene 3: Real-person meeting call and live transcript states.
meeting_part_duration=$(python3 -c "print($sdur3 / 3)")
ffmpeg -y -loglevel error \
  -loop 1 -i "$TMP/scene3-1.png" \
  -loop 1 -i "$TMP/overlay3.png" \
  -filter_complex "[0:v]scale=${W}:${H}[scene];[scene][1:v]overlay=0:0" -t "$meeting_part_duration" -r 30 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$TMP/scene3-1.mp4"
ffmpeg -y -loglevel error \
  -loop 1 -i "$TMP/scene3-2.png" \
  -loop 1 -i "$TMP/overlay3.png" \
  -filter_complex "[0:v]scale=${W}:${H}[scene];[scene][1:v]overlay=0:0" -t "$meeting_part_duration" -r 30 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$TMP/scene3-2.mp4"
ffmpeg -y -loglevel error \
  -loop 1 -i "$TMP/scene3-3.png" \
  -loop 1 -i "$TMP/overlay3.png" \
  -filter_complex "[0:v]scale=${W}:${H}[scene];[scene][1:v]overlay=0:0" -t "$meeting_part_duration" -r 30 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$TMP/scene3-3.mp4"
printf "file 'scene3-1.mp4'\nfile 'scene3-2.mp4'\nfile 'scene3-3.mp4'\n" > "$TMP/scene3.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/scene3.txt" -c:v copy "$TMP/scene3.mp4"

# Scene 4: Privacy and call to action
ffmpeg -y -loglevel error \
  -loop 1 -i "$TMP/scene4_frame.png" \
  -t "$sdur4" \
  -vf "scale=${W}:${H}" \
  -r 30 -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$TMP/scene4.mp4"

# ─── 4. Concatenate video scenes ─────────────────────────────────

echo "▸ Concatenating scenes…"

cat > "$TMP/scenes.txt" <<EOF
file 'scene1.mp4'
file 'scene2.mp4'
file 'scene3.mp4'
file 'scene4.mp4'
EOF

ffmpeg -y -loglevel error \
  -f concat -safe 0 -i "$TMP/scenes.txt" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  "$TMP/video_only.mp4"

# ─── 5. Combine video + audio ────────────────────────────────────

echo "▸ Muxing audio + video…"

ffmpeg -y -loglevel error \
  -i "$TMP/video_only.mp4" \
  -i "$TMP/full_vo.wav" \
  -c:v copy -c:a aac -b:a 192k \
  -shortest \
  "$OUT"

# ─── 6. Summary ──────────────────────────────────────────────────

echo ""
echo "✅ Done! Output: $OUT"
ffprobe -v quiet -print_format json -show_format "$OUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)['format']
dur = float(d['duration'])
size = int(d['size'])
print(f'   Duration: {dur:.1f}s')
print(f'   Size: {size/1024/1024:.1f} MB')
"
echo "   Format: 1080×1920 vertical, 30fps, H.264 + AAC"
