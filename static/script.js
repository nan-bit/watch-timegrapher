import { COMMON_MOVEMENTS } from './movements.js';

// ─── FFT (Cooley-Tukey radix-2, in-place) ────────────────────────────────────
function nextPow2(n) {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

function _fftCore(re, im, invert) {
    const n = re.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    // Butterfly operations
    for (let len = 2; len <= n; len <<= 1) {
        const ang = 2 * Math.PI / len * (invert ? -1 : 1);
        const wRe = Math.cos(ang), wIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            for (let j = 0; j < len / 2; j++) {
                const uRe = re[i + j], uIm = im[i + j];
                const vRe = re[i + j + len/2] * curRe - im[i + j + len/2] * curIm;
                const vIm = re[i + j + len/2] * curIm + im[i + j + len/2] * curRe;
                re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
                re[i + j + len/2] = uRe - vRe; im[i + j + len/2] = uIm - vIm;
                const newCurRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newCurRe;
            }
        }
    }
    if (invert) {
        for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
}

function autocorr(signal) {
    const n = signal.length;
    const size = nextPow2(2 * n);
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < n; i++) re[i] = signal[i];
    _fftCore(re, im, false);
    for (let i = 0; i < size; i++) {
        re[i] = (re[i] * re[i] + im[i] * im[i]);
        im[i] = 0;
    }
    _fftCore(re, im, true);
    return re.slice(0, n);
}

// ─── Signal Processing ────────────────────────────────────────────────────────
async function applyBandpass(samples, sampleRate, lo = 2000, hi = 8000) {
    const offCtx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf = offCtx.createBuffer(1, samples.length, sampleRate);
    buf.copyToChannel(samples, 0);
    const src = offCtx.createBufferSource();
    src.buffer = buf;
    // Two cascaded biquad bandpass = ~4th-order
    const center = (lo + hi) / 2;
    const Q = center / (hi - lo);
    const f1 = offCtx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = center; f1.Q.value = Q;
    const f2 = offCtx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = center; f2.Q.value = Q;
    src.connect(f1); f1.connect(f2); f2.connect(offCtx.destination);
    src.start();
    const rendered = await offCtx.startRendering();
    return rendered.getChannelData(0);
}

function movingAverage(data, w) {
    if (w < 1) return data;
    const out = new Float32Array(data.length - w + 1);
    let sum = 0;
    for (let i = 0; i < w; i++) sum += data[i];
    out[0] = sum / w;
    for (let i = 1; i < out.length; i++) {
        sum += data[i + w - 1] - data[i - 1];
        out[i] = sum / w;
    }
    return out;
}

function quadraticPeak(data, idx) {
    if (idx < 1 || idx >= data.length - 1) return idx;
    const y0 = data[idx - 1], y1 = data[idx], y2 = data[idx + 1];
    const denom = 2 * (y0 - 2 * y1 + y2);
    if (denom === 0) return idx;
    return idx + (y0 - y2) / denom;
}

function findPeaks(data, minHeight, minDist) {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] >= minHeight && data[i] > data[i - 1] && data[i] > data[i + 1]) {
            if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) {
                peaks.push(i);
            }
        }
    }
    return peaks;
}

function mean(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function rejectOutliers(arr) {
    if (arr.length < 4) return arr;
    const m = mean(arr), s = stddev(arr);
    return arr.filter(v => Math.abs(v - m) <= 2 * s);
}

function averagedWaveform(envelope, periodSamples) {
    const full = Math.floor(periodSamples * 2);
    if (envelope.length < full) return null;
    const n = Math.floor(envelope.length / full);
    if (n < 1) return null;
    const avg = new Float64Array(full);
    for (let p = 0; p < n; p++) {
        for (let i = 0; i < full; i++) avg[i] += envelope[p * full + i];
    }
    for (let i = 0; i < full; i++) avg[i] /= n;
    return avg;
}

function calcAmplitude(avgWave, periodSamples, liftAngleDeg) {
    if (!avgWave) return 0;
    let avgWaveMax = -Infinity;
    for (let i = 0; i < avgWave.length; i++) if (avgWave[i] > avgWaveMax) avgWaveMax = avgWave[i];
    const maxH = avgWaveMax * 0.3;
    const minDist = periodSamples * 0.5;
    const peaks = findPeaks(avgWave, maxH, minDist);
    if (peaks.length < 2) return 0;

    // Sort by height, take two tallest
    peaks.sort((a, b) => avgWave[b] - avgWave[a]);
    const timeDiff = Math.abs(peaks[0] - peaks[1]);

    const liftAngleRad = liftAngleDeg * Math.PI / 180;
    const rotAngle = (Math.PI * timeDiff) / periodSamples;
    const sinRatio = Math.sin(rotAngle) / Math.sin(liftAngleRad / 2);
    if (Math.abs(sinRatio) > 1) return 0;
    const semiAmp = Math.asin(sinRatio);
    const deg = 2 * semiAmp * 180 / Math.PI;
    return (deg > 100 && deg < 400) ? deg : 0;
}

async function analyzeBlob(blob, bph, liftAngle) {
    const arrayBuf = await blob.arrayBuffer();
    const tempCtx = new AudioContext();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuf);
    await tempCtx.close();

    const sampleRate = audioBuffer.sampleRate;
    const raw = audioBuffer.getChannelData(0);

    const filtered = await applyBandpass(raw, sampleRate);
    const envelope = new Float32Array(filtered.length);
    for (let i = 0; i < filtered.length; i++) envelope[i] = Math.abs(filtered[i]);

    const smoothWin = Math.round(sampleRate * 0.002);
    const smoothed = movingAverage(envelope, smoothWin);

    const ac = autocorr(smoothed);

    const expectedPeriod = (3600.0 / bph) * sampleRate;
    const searchWindow = Math.floor(0.05 * expectedPeriod);
    const lo = Math.max(1, Math.floor(expectedPeriod - searchWindow));
    const hi = Math.min(ac.length - 1, Math.ceil(expectedPeriod + searchWindow));

    let maxVal = -Infinity, maxIdx = lo;
    for (let i = lo; i <= hi; i++) {
        if (ac[i] > maxVal) { maxVal = ac[i]; maxIdx = i; }
    }

    // Signal quality check
    const acSlice = ac.slice(1, Math.floor(expectedPeriod * 1.5));
    let overallMax = -Infinity;
    for (let i = 0; i < acSlice.length; i++) if (acSlice[i] > overallMax) overallMax = acSlice[i];
    const quality = maxVal / overallMax;

    const measuredPeriod = quadraticPeak(ac, maxIdx);
    const rateSpd = ((expectedPeriod / measuredPeriod) - 1) * 86400;

    let smoothedMax = -Infinity;
    for (let i = 0; i < smoothed.length; i++) if (smoothed[i] > smoothedMax) smoothedMax = smoothed[i];
    const peakMinH = smoothedMax * 0.1;
    const peakMinDist = measuredPeriod * 0.75;
    const peaks = findPeaks(smoothed, peakMinH, peakMinDist);

    let beatErrorMs = 0;
    let beatIntervals = [];
    if (peaks.length >= 3) {
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            intervals.push((peaks[i] - peaks[i - 1]) * 1000.0 / sampleRate);
        }
        beatIntervals = intervals;
        const t1Raw = intervals.filter((_, i) => i % 2 === 0);
        const t2Raw = intervals.filter((_, i) => i % 2 === 1);
        const t1 = rejectOutliers(t1Raw);
        const t2 = rejectOutliers(t2Raw);
        if (t1.length > 0 && t2.length > 0) {
            beatErrorMs = Math.abs(mean(t1) - mean(t2));
        }
    }

    const avgWave = averagedWaveform(smoothed, measuredPeriod);
    const amplitude = calcAmplitude(avgWave, measuredPeriod, liftAngle);

    return {
        rate: rateSpd,
        beatError: beatErrorMs,
        amplitude,
        avgWaveform: avgWave ? Array.from(avgWave) : [],
        beatIntervals,
        quality,
    };
}

// ─── UI ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const startBtn       = document.getElementById('startMonitoring');
    const captureBtn     = document.getElementById('captureSample');
    const continuousToggle = document.getElementById('continuousMode');
    const gainSlider     = document.getElementById('gainSlider');
    const spinner        = document.getElementById('loadingSpinner');
    const statusDot      = document.getElementById('statusDot');
    const statusText     = document.getElementById('statusText');
    const peakMeterBar   = document.getElementById('peak-meter-bar');
    const waveformCanvas = document.getElementById('waveformCanvas');
    const waveformCtx    = waveformCanvas.getContext('2d');
    const countdownOverlay = document.getElementById('countdownOverlay');
    const qualityWarning = document.getElementById('qualityWarning');
    const exportBtn      = document.getElementById('exportBtn');
    const historyList    = document.getElementById('historyList');

    let audioContext, analyser, gainNode, mediaRecorder;
    let audioChunks = [];
    let averagedWaveformChart = null;
    let beatErrorChart = null;
    let continuousTimer = null;
    let isCapturing = false;
    const measurementHistory = [];

    const CAPTURE_DURATION = 6000;

    // ── Status helper ──
    function setStatus(state) {
        const states = {
            idle:       { label: 'Idle',       color: '#9cabba' },
            monitoring: { label: 'Monitoring', color: '#4caf50' },
            capturing:  { label: 'Capturing',  color: '#f4a23d' },
            analyzing:  { label: 'Analyzing',  color: '#3d98f4' },
        };
        const s = states[state] || states.idle;
        statusDot.style.backgroundColor = s.color;
        statusText.textContent = s.label;
    }

    // ── Movement database ──
    const movementSearch = document.getElementById('movementSearch');
    const movementList   = document.getElementById('movementList');
    const liftAngleSelect = document.getElementById('liftAngle');
    const bphSelect      = document.getElementById('bph');

    COMMON_MOVEMENTS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = `${m.brand} ${m.caliber}`;
        movementList.appendChild(opt);
    });

    movementSearch.addEventListener('focus', () => movementSearch.select());

    movementSearch.addEventListener('input', e => {
        const match = COMMON_MOVEMENTS.find(m => `${m.brand} ${m.caliber}` === e.target.value);
        if (!match) return;
        // Set BPH if provided
        if (match.bph) {
            bphSelect.value = match.bph;
        }
        // Set lift angle
        let exists = Array.from(liftAngleSelect.options).some(o => parseFloat(o.value) === match.liftAngle);
        if (!exists) {
            const newOpt = document.createElement('option');
            newOpt.value = match.liftAngle;
            newOpt.textContent = `${match.liftAngle}°`;
            liftAngleSelect.appendChild(newOpt);
        }
        liftAngleSelect.value = match.liftAngle;
        liftAngleSelect.classList.add('highlight');
        setTimeout(() => liftAngleSelect.classList.remove('highlight'), 800);
    });

    // ── Init audio ──
    startBtn.addEventListener('click', async () => {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContext.createMediaStreamSource(stream);
            gainNode = audioContext.createGain();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(gainNode);
            gainNode.connect(analyser);

            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = handleRecordingStop;

            startBtn.disabled = true;
            startBtn.textContent = 'Monitoring';
            gainSlider.disabled = false;
            captureBtn.disabled = false;
            exportBtn.disabled = false;
            setStatus('monitoring');
            drawWaveform();
        } catch (err) {
            const isInsecure = location.protocol !== 'https:' && location.hostname !== 'localhost';
            let msg = `Microphone access denied.\n\nError: ${err.name}`;
            if (isInsecure) msg += '\n\nTip: Browsers require HTTPS for microphone access (except localhost).';
            else msg += "\n\nCheck the lock icon in your browser's address bar and allow microphone access.";
            alert(msg);
        }
    });

    gainSlider.addEventListener('input', () => {
        if (gainNode) gainNode.gain.value = parseFloat(gainSlider.value);
    });

    captureBtn.addEventListener('click', () => startCapture());

    continuousToggle.addEventListener('change', () => {
        if (continuousToggle.checked) {
            if (!isCapturing) startCapture();
        } else {
            clearTimeout(continuousTimer);
        }
    });

    exportBtn.addEventListener('click', copyResults);

    // ── Capture ──
    function startCapture() {
        if (!mediaRecorder || isCapturing) return;
        isCapturing = true;
        clearTimeout(continuousTimer);

        document.getElementById('rateResult').textContent = '-';
        document.getElementById('beatErrorResult').textContent = '-';
        document.getElementById('amplitudeResult').textContent = '-';
        document.querySelectorAll('.metric').forEach(m => m.className = 'metric');
        qualityWarning.style.display = 'none';

        captureBtn.disabled = true;
        setStatus('capturing');
        audioChunks = [];
        mediaRecorder.start();

        // Countdown
        let remaining = CAPTURE_DURATION / 1000;
        countdownOverlay.style.display = 'flex';
        countdownOverlay.textContent = remaining;
        const countTick = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                countdownOverlay.textContent = remaining;
            } else {
                clearInterval(countTick);
                countdownOverlay.style.display = 'none';
                mediaRecorder.stop();
            }
        }, 1000);
    }

    async function handleRecordingStop() {
        setStatus('analyzing');
        spinner.style.display = 'block';

        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];

        const bph = parseInt(bphSelect.value);
        const liftAngle = parseFloat(liftAngleSelect.value);

        try {
            const results = await analyzeBlob(blob, bph, liftAngle);
            displayMetrics(results);
            drawAveragedWaveformChart(results.avgWaveform);
            drawBeatErrorChart(results.beatIntervals);
            addToHistory(results);

            if (results.quality < 0.3) {
                qualityWarning.style.display = 'block';
            }
        } catch (err) {
            console.error('Analysis error:', err);
            alert(`Analysis failed: ${err.message}\n\nEnsure the watch is close to the microphone and quiet surroundings.`);
        } finally {
            spinner.style.display = 'none';
            captureBtn.disabled = false;
            isCapturing = false;
            setStatus('monitoring');

            if (continuousToggle.checked) {
                continuousTimer = setTimeout(() => startCapture(), 500);
            }
        }
    }

    // ── Waveform ──
    function drawWaveform() {
        requestAnimationFrame(drawWaveform);
        if (!analyser) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);

        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            const v = Math.abs(data[i] - 128);
            if (v > peak) peak = v;
        }
        const pct = (peak / 128) * 100;
        peakMeterBar.style.width = pct + '%';
        peakMeterBar.style.backgroundColor = pct > 95 ? '#ff6b6b' : pct > 85 ? '#f4a23d' : '#4caf50';

        const w = waveformCanvas.width, h = waveformCanvas.height;
        waveformCtx.fillStyle = '#111418';
        waveformCtx.fillRect(0, 0, w, h);
        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = '#3d98f4';
        waveformCtx.beginPath();
        const sw = w / data.length;
        for (let i = 0; i < data.length; i++) {
            const x = i * sw;
            const y = (data[i] / 128.0) * h / 2;
            i === 0 ? waveformCtx.moveTo(x, y) : waveformCtx.lineTo(x, y);
        }
        waveformCtx.lineTo(w, h / 2);
        waveformCtx.stroke();
    }

    // ── Display Metrics ──
    function metricColor(id, value) {
        const thresholds = {
            rate:       { el: 'rateResult',      good: 10,  warn: 20,  abs: true  },
            beatError:  { el: 'beatErrorResult', good: 0.5, warn: 1.0, abs: false },
            amplitude:  { el: 'amplitudeResult', goodLo: 200, goodHi: 310, warnLo: 150, warnHi: 330 },
        };
        const t = thresholds[id];
        if (!t) return;
        const el = document.getElementById(t.el);
        const metric = el.closest('.metric');
        metric.classList.remove('good', 'warn', 'bad');
        if (id === 'amplitude') {
            if (value >= t.goodLo && value <= t.goodHi) metric.classList.add('good');
            else if (value >= t.warnLo && value <= t.warnHi) metric.classList.add('warn');
            else metric.classList.add('bad');
        } else {
            const v = t.abs ? Math.abs(value) : value;
            if (v <= t.good) metric.classList.add('good');
            else if (v <= t.warn) metric.classList.add('warn');
            else metric.classList.add('bad');
        }
    }

    function displayMetrics(r) {
        document.getElementById('rateResult').textContent = r.rate.toFixed(1);
        document.getElementById('beatErrorResult').textContent = r.beatError.toFixed(2);
        document.getElementById('amplitudeResult').textContent = r.amplitude > 0 ? r.amplitude.toFixed(0) : '—';
        metricColor('rate', r.rate);
        metricColor('beatError', r.beatError);
        if (r.amplitude > 0) metricColor('amplitude', r.amplitude);
    }

    // ── History ──
    function addToHistory(r) {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        measurementHistory.unshift({ time, rate: r.rate, beatError: r.beatError, amplitude: r.amplitude });
        if (measurementHistory.length > 8) measurementHistory.pop();
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        measurementHistory.forEach(m => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="hist-time">${m.time}</span>
                <span>Rate: <b>${m.rate.toFixed(1)} s/d</b></span>
                <span>BE: <b>${m.beatError.toFixed(2)} ms</b></span>
                <span>Amp: <b>${m.amplitude > 0 ? m.amplitude.toFixed(0) + '°' : '—'}</b></span>`;
            historyList.appendChild(li);
        });
    }

    // ── Export ──
    function copyResults() {
        if (measurementHistory.length === 0) return;
        const lines = ['Watch Timegrapher Results', '─'.repeat(30)];
        measurementHistory.forEach(m => {
            lines.push(`${m.time}  Rate: ${m.rate.toFixed(1)} s/d  Beat Error: ${m.beatError.toFixed(2)} ms  Amplitude: ${m.amplitude > 0 ? m.amplitude.toFixed(0) + '°' : '—'}`);
        });
        navigator.clipboard.writeText(lines.join('\n')).then(() => {
            exportBtn.textContent = 'Copied!';
            setTimeout(() => exportBtn.textContent = 'Copy Results', 1500);
        });
    }

    // ── Charts ──
    const CHART_DEFAULTS = {
        scales: {
            x: { grid: { color: '#2a3540' }, ticks: { color: '#9cabba' }, title: { color: '#9cabba' } },
            y: { grid: { color: '#2a3540' }, ticks: { color: '#9cabba' }, title: { color: '#9cabba' } },
        },
        plugins: { legend: { labels: { color: '#f0f2f5' } } },
        animation: { duration: 300 },
    };

    function drawAveragedWaveformChart(waveform) {
        if (averagedWaveformChart) averagedWaveformChart.destroy();
        const ctx = document.getElementById('averagedWaveformCanvas').getContext('2d');
        Chart.defaults.color = '#9cabba';
        Chart.defaults.borderColor = '#2a3540';
        averagedWaveformChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: waveform.map((_, i) => i),
                datasets: [{
                    label: 'Averaged Beat Cycle',
                    data: waveform,
                    borderColor: '#3d98f4',
                    backgroundColor: 'rgba(61,152,244,0.08)',
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 1.5,
                }],
            },
            options: {
                ...CHART_DEFAULTS,
                scales: {
                    x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: 'Samples', color: '#9cabba' } },
                    y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Envelope', color: '#9cabba' } },
                },
            },
        });
    }

    function drawBeatErrorChart(intervals) {
        if (beatErrorChart) beatErrorChart.destroy();
        const ctx = document.getElementById('beatErrorCanvas').getContext('2d');
        beatErrorChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Beat Interval (ms)',
                    data: intervals.map((v, i) => ({ x: i + 1, y: v })),
                    backgroundColor: '#ff6b6b',
                    borderColor: '#ff6b6b',
                    pointRadius: 4,
                }],
            },
            options: {
                ...CHART_DEFAULTS,
                scales: {
                    x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: 'Beat #', color: '#9cabba' } },
                    y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Interval (ms)', color: '#9cabba' }, beginAtZero: false },
                },
            },
        });
    }
});
