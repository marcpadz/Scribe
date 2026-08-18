# Video transcription unreliable — decodeAudioData on mp4

**Status:** Open (suspected)
**Created:** 2026-08-18
**Tags:** #transcription #media #bug

## Symptoms
- Uploading an `.mp4` (or other video) shows "Error processing file" / "Unable to decode
  audio data".
- `processingStatus` ends on a decode error for video but works for pure audio.

## Root Cause
`App.processAudioBlob` calls `context.decodeAudioData(arrayBuffer)` on the **raw blob**.
`decodeAudioData` expects an audio format (WAV/MP3/OGG/M4A-AAC), not a video container
with a video track. Browsers reject/throw on `video/mp4` containers in most cases, so
transcription never starts.

## Resolution (candidates)
- Extract audio via `<video>` + `captureStream()` → `MediaRecorder` → WAV, or
- Use `ffmpeg.wasm` to demux audio, or
- Always send the file to Gemini as `audio/*`/native and let the API handle the video
  container instead of pre-decoding client-side.

## Prevention
- [ ] Add a separate media-type path: audio decoded directly, video routed through an
      audio-extraction step before transcription.
