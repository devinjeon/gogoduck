/**
 * Author: @devinjeon (Hyojun Jeon)
 * Copyright (c) 2025 devinjeon (Hyojun Jeon)
 *
 * Screen recorder built on the browser's getDisplayMedia + MediaRecorder.
 * Fully self-contained: no server, no changes to game/camera logic.
 * Desktop-only — getDisplayMedia requires a secure context and is not
 * available on mobile browsers.
 */

export class Recorder {
    constructor() {
        this.stream = null;
        this.mediaRecorder = null;
        this.chunks = [];
        this.blobUrl = null;
        this.recording = false;
    }

    /**
     * Whether screen recording is usable in this browser.
     * getDisplayMedia is undefined on mobile browsers and outside secure contexts.
     */
    static isSupported() {
        return !!(
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.getDisplayMedia === "function" &&
            typeof window.MediaRecorder === "function"
        );
    }

    /**
     * Prompt the user to pick a screen/tab and begin recording.
     * Must be called from a user gesture (e.g. a button click).
     * Returns true if recording started, false if unsupported or the user cancelled.
     */
    async start() {
        if (!Recorder.isSupported()) return false;

        this._cleanupBlob();

        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30 },
                audio: false,
                // Chromium: default the picker to the current tab.
                preferCurrentTab: true,
            });
        } catch (e) {
            // User dismissed the picker or denied permission — race proceeds without recording.
            this.stream = null;
            return false;
        }

        this.chunks = [];
        const mimeType = this._pickMimeType();
        this._lastMimeType = mimeType;
        const options = { videoBitsPerSecond: 6_000_000 };
        if (mimeType) options.mimeType = mimeType;
        this.mediaRecorder = new MediaRecorder(this.stream, options);
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) this.chunks.push(e.data);
        };
        // Timeslice: emit data every second so chunks accumulate during the race.
        // This keeps a valid blob available even if the final `onstop` is delayed.
        this.mediaRecorder.start(1000);
        this.recording = true;

        // If the user stops sharing via the browser's own UI, finalize gracefully.
        const [track] = this.stream.getVideoTracks();
        if (track) track.addEventListener("ended", () => this.stop());

        return true;
    }

    /**
     * Stop recording and return an object URL for the resulting webm blob
     * (or null if nothing was recorded). Safe to call when not recording.
     */
    stop() {
        return new Promise((resolve) => {
            if (!this.recording || !this.mediaRecorder) {
                resolve(this.blobUrl);
                return;
            }
            this.recording = false;

            // Some browsers (notably MP4 MediaRecorder) don't reliably fire `onstop`,
            // leaving the share stream running and no blob produced. Finalize exactly
            // once — via onstop if it fires, otherwise via a safety timeout using the
            // chunks already collected by the timeslice.
            let finalized = false;
            const finalize = () => {
                if (finalized) return;
                finalized = true;
                const type = (this.mediaRecorder && this.mediaRecorder.mimeType) || this._lastMimeType || "video/webm";
                const blob = new Blob(this.chunks, { type });
                this.chunks = [];
                this._cleanupBlob();
                this.blobUrl = blob.size > 0 ? URL.createObjectURL(blob) : null;
                this._stopStream();
                resolve(this.blobUrl);
            };

            this.mediaRecorder.onstop = finalize;

            try {
                if (typeof this.mediaRecorder.requestData === "function") this.mediaRecorder.requestData();
                this.mediaRecorder.stop();
            } catch (e) {
                finalize();
                return;
            }

            // Safety net if onstop never arrives.
            setTimeout(finalize, 1500);
        });
    }

    /** Release the current recording's object URL and reset. */
    clear() {
        this._cleanupBlob();
    }

    _pickMimeType() {
        // Prefer MP4/H.264: messengers like KakaoTalk treat MP4 as an inline-playable
        // video, whereas WebM is downloaded as a file. Recent desktop Chrome/Safari can
        // record MP4 directly. Fall back to WebM (VP8 first — VP9 real-time encoding is
        // far heavier on CPU and makes the game stutter).
        const candidates = [
            "video/mp4;codecs=avc1.42E01E",
            "video/mp4;codecs=h264",
            "video/mp4",
            "video/webm;codecs=vp8",
            "video/webm;codecs=h264",
            "video/webm",
            "video/webm;codecs=vp9",
        ];
        for (const c of candidates) {
            if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(c)) {
                return c;
            }
        }
        return "";
    }

    /** File extension matching the recorded container ("mp4" or "webm"). */
    fileExtension() {
        const type = (this.mediaRecorder && this.mediaRecorder.mimeType) || this._lastMimeType || "";
        return type.includes("mp4") ? "mp4" : "webm";
    }

    _stopStream() {
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
    }

    _cleanupBlob() {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
    }
}
