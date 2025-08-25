console.log("--- SCRIPT VERSION 2.02 ---"); // Diagnostic line

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements that MUST exist in the HTML ---
    const startMonitoringButton = document.getElementById('startMonitoring');
    const captureSampleButton = document.getElementById('captureSample');
    const gainSlider = document.getElementById('gainSlider');
    const spinner = document.getElementById('loadingSpinner');
    const peakMeterBar = document.getElementById('peak-meter-bar');
    const waveformCanvas = document.getElementById('waveformCanvas');
    const waveformCtx = waveformCanvas.getContext('2d');
    
    // Web Audio API variables
    let audioContext;
    let analyser;
    let gainNode;
    let mediaRecorder;
    let audioChunks = [];

    // Chart variables
    let averagedWaveformChart = null;
    let beatErrorChart = null;

    const CAPTURE_DURATION = 6000;
    
    // Event Listeners
    startMonitoringButton.addEventListener('click', initAudio);
    captureSampleButton.addEventListener('click', startCapture);
    gainSlider.addEventListener('input', () => {
        if (gainNode) {
            gainNode.gain.value = parseFloat(gainSlider.value);
        }
    });

    async function initAudio() {
        if (!audioContext) {
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
                mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
                
                mediaRecorder.onstop = () => {
                    spinner.style.display = 'block';
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    analyzeAudioAndGetResults(audioBlob); 
                    audioChunks = [];
                };
    
                startMonitoringButton.disabled = true;
                startMonitoringButton.textContent = "Monitoring...";
                gainSlider.disabled = false;
                captureSampleButton.disabled = false;
                
                drawWaveform();

            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert(`Could not access microphone.\n\nError: ${err.name}\nMessage: ${err.message}`);
            }
        }
    }
    
    function drawWaveform() {
        requestAnimationFrame(drawWaveform);
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        let peak = 0;
        for (let i = 0; i < bufferLength; i++) {
            const value = Math.abs(dataArray[i] - 128);
            if (value > peak) peak = value;
        }
        const peakPercent = (peak / 128) * 100;
        
        peakMeterBar.style.width = peakPercent + '%';

        if (peakPercent > 95) {
            peakMeterBar.style.backgroundColor = 'red';
        } else if (peakPercent > 85) {
            peakMeterBar.style.backgroundColor = 'orange';
        } else {
            peakMeterBar.style.backgroundColor = '#4caf50';
        }

        waveformCtx.fillStyle = '#f4f4f4';
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = '#0056b3';
        waveformCtx.beginPath();
        const sliceWidth = waveformCanvas.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * waveformCanvas.height / 2;
            i === 0 ? waveformCtx.moveTo(x, y) : waveformCtx.lineTo(x, y);
            x += sliceWidth;
        }
        waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
        waveformCtx.stroke();
    }

    function startCapture() {
        if (!mediaRecorder) return;
        
        document.getElementById('rateResult').textContent = '-';
        document.getElementById('beatErrorResult').textContent = '-';
        document.getElementById('amplitudeResult').textContent = '-';
        if (averagedWaveformChart) averagedWaveformChart.destroy();
        if (beatErrorChart) beatErrorChart.destroy();

        captureSampleButton.disabled = true;
        audioChunks = [];
        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), CAPTURE_DURATION);
    }

    async function analyzeAudioAndGetResults(audioBlob) {
        const bph = document.getElementById('bph').value;
        const liftAngle = document.getElementById('liftAngle').value;

        const formData = new FormData();
        formData.append('file', audioBlob, 'watch_sample.webm');
        formData.append('bph', bph);
        formData.append('lift_angle', liftAngle);

        try {
            const response = await fetch('/api/analyze-audio', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error(`Server error: ${await response.text()}`);
            
            const results = await response.json();
            
            displayMetrics(results);
            drawAveragedWaveformChart(results.avg_waveform);
            drawBeatErrorChart(results.beat_intervals);

        } catch (error) {
            console.error('Error during audio analysis:', error);
            alert(`Analysis failed: ${error.message}`);
        } finally {
            spinner.style.display = 'none';
            captureSampleButton.disabled = false;
        }
    }

    function displayMetrics(results) {
        document.getElementById('rateResult').textContent = results.rate.toFixed(2);
        document.getElementById('beatErrorResult').textContent = results.beat_error.toFixed(2);
        document.getElementById('amplitudeResult').textContent = results.amplitude.toFixed(2);
    }

    function drawAveragedWaveformChart(waveform) {
        if (averagedWaveformChart) averagedWaveformChart.destroy();
        const ctx = document.getElementById('averagedWaveformCanvas').getContext('2d');
        averagedWaveformChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: waveform.length }, (_, i) => i),
                datasets: [{
                    label: 'Averaged Beat Cycle',
                    data: waveform,
                    borderColor: '#0056b3',
                    fill: false,
                    pointRadius: 0,
                    borderWidth: 1
                }]
            },
            options: { scales: { x: { title: { display: true, text: 'Samples' } }, y: { title: { display: true, text: 'Amplitude' } } } }
        });
    }

    function drawBeatErrorChart(intervals) {
        if (beatErrorChart) beatErrorChart.destroy();
        const ctx = document.getElementById('beatErrorCanvas').getContext('2d');
        beatErrorChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Beat-to-Beat Interval (ms)',
                    data: intervals.map((interval, i) => ({ x: i + 1, y: interval })),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)'
                }]
            },
            options: { scales: { x: { title: { display: true, text: 'Beat Number' } }, y: { title: { display: true, text: 'Interval (ms)' }, beginAtZero: false } } }
        });
    }
});