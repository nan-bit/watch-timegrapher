# Watch Timegrapher

A browser-based mechanical watch accuracy analyzer. Hold your watch up to your microphone and get professional timegrapher metrics — rate, beat error, and amplitude — with no app to install and no data leaving your device.

---

## What It Does

Watch Timegrapher listens to the tick-tock of a mechanical watch through your microphone and runs a full signal processing pipeline entirely in the browser to produce three key metrics:

- **Rate (s/day)** — how many seconds per day the watch gains or loses. ±10 s/d is COSC certified; ±20 s/d is typical for a regulated movement.
- **Beat Error (ms)** — the asymmetry between the tick and tock intervals. Under 0.5 ms is excellent; over 1 ms may need regulation.
- **Amplitude (°)** — the arc of the balance wheel's swing. 250–310° is ideal; below 200° usually indicates low power reserve or worn parts.

It also renders two diagnostic charts after each capture:
- **Averaged Waveform** — a noise-reduced view of a single beat cycle
- **Beat Timeline** — a scatter plot of interval stability across the full sample

---

## How It's Built

The app is a pure static web app — HTML, CSS, and vanilla JavaScript — hosted on Firebase. There is no backend server. All audio capture and signal processing happens client-side using the browser's Web Audio API.

### Signal Processing Pipeline

1. **Capture** — the browser records a 6-second clip via `MediaRecorder`
2. **Bandpass filter** — a 4th-order biquad filter (2000–8000 Hz) strips low-frequency hum and high-frequency hiss using `OfflineAudioContext`
3. **Envelope** — the absolute value of the filtered signal is smoothed with a moving average to produce clean, unambiguous peaks
4. **Autocorrelation** — a custom Cooley-Tukey radix-2 FFT (no library) implements the Wiener-Khinchin theorem to find the beat period efficiently
5. **Sub-sample refinement** — quadratic interpolation on the autocorrelation peak gives floating-point precision on the period, essential for accurate rate
6. **Metrics** — rate from period ratio, beat error from alternating interval groups, amplitude via an arcsin formula using the lift angle

### Tech Stack

| | Technology |
|---|---|
| UI | HTML5, CSS3, Vanilla JS |
| Charts | Chart.js |
| Audio | Web Audio API (`OfflineAudioContext`, `MediaRecorder`) |
| Hosting | Firebase Hosting (static) |

---

## Using the App

### Prerequisites
- A modern browser (Chrome or Edge recommended for best Web Audio API support)
- A microphone — a phone mic works, but a USB mic or lapel mic near the watch gives cleaner results
- A mechanical watch

### Steps

1. **Open the app** in your browser
2. **Set your movement parameters** in the Parameters panel:
   - Search for your caliber (e.g. `NH35`, `ETA 2824-2`) — BPH and lift angle will auto-fill
   - Or set BPH and lift angle manually if your caliber isn't listed
3. **Click "Enable Microphone"** and grant mic access when prompted
4. **Position your watch** close to the microphone in a quiet environment
5. Watch the **live waveform** — you should see a clear repeating pattern. Adjust the **Gain** slider if the signal is too quiet or clipping
6. **Click "Capture 6s Sample"** — a 6-second recording is taken and analyzed automatically
7. Results appear in the **Results** panel. Color coding indicates quality: green (good), yellow (marginal), red (needs attention)
8. **Click "Copy Results"** to copy a text summary to your clipboard
9. Enable **Continuous Mode** to keep capturing automatically for ongoing monitoring

### Tips for Clean Results

- Hold the watch case directly against the mic or use a folded cloth to dampen ambient noise
- A quiet room makes a significant difference
- If you see a "Weak signal" warning, move the watch closer or increase gain
- Dial position (crown up, crown left, etc.) affects amplitude — note your position for consistent comparisons

---

## File Structure

```
/
├── static/
│   ├── index.html       # App shell
│   ├── script.js        # All signal processing and UI logic
│   ├── style.css        # Styling
│   └── movements.js     # Movement database (BPH + lift angles)
├── firebase.json        # Firebase hosting config
└── README.md
```

---

## License

MIT
