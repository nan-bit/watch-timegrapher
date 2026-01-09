import { COMMON_MOVEMENTS } from './movements.js';

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

    // --- Movement Database Logic ---
    const movementSearch = document.getElementById('movementSearch');
    const movementList = document.getElementById('movementList');
    const liftAngleSelect = document.getElementById('liftAngle');

    if (movementSearch && movementList) {
        COMMON_MOVEMENTS.forEach(m => {
            const option = document.createElement('option');
            option.value = `${m.brand} ${m.caliber}`;
            movementList.appendChild(option);
        });

        movementSearch.addEventListener('input', (e) => {
            const value = e.target.value;
            const movement = COMMON_MOVEMENTS.find(m => `${m.brand} ${m.caliber}` === value);
            if (movement) {
                // Check if the options has this exact value
                // The current select has discrete values. If the movement has a value not in the list (e.g. 52.5), it might fail?
                // The select options are: 42,43,44,45,46,48,49,50,51,52,53,54,54.5,55,56,57,58,60
                // Most movements in our DB are 44, 49, 50, 51, 52, 53.
                // 3235 is 53 or 55. 6497 is 44.
                // Let's try to set it. If it doesn't match, we might need to add it dynamically or warn.

                // Better approach: Check if it exists, if not create it.
                let optionExists = Array.from(liftAngleSelect.options).some(o => parseFloat(o.value) === movement.liftAngle);

                if (!optionExists) {
                    const newOption = document.createElement('option');
                    newOption.value = movement.liftAngle;
                    newOption.textContent = `${movement.liftAngle}°`;
                    liftAngleSelect.appendChild(newOption);
                    // Sort options? slightly complex for now. Just append.
                }

                liftAngleSelect.value = movement.liftAngle;

                // Visual feedback
                liftAngleSelect.style.transition = 'background-color 0.3s';
                liftAngleSelect.style.backgroundColor = '#d4edda'; // light green
                setTimeout(() => liftAngleSelect.style.backgroundColor = '', 1000);
            }
        });
    }

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
                let helpMsg = `Could not access microphone.\n\nError: ${err.name}\nMessage: ${err.message}`;
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== 'https:') {
                    helpMsg += '\n\nNOTE: Browsers often block microphone access on insecure (non-HTTPS) connections unless you are using "localhost". Try accessing the site via http://localhost:8000 instead of an IP address.';
                } else {
                    helpMsg += '\n\nPlease check your browser address bar permissions (lock icon) to ensure microphone access is allowed for this site.';
                }
                alert(helpMsg);
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

        waveformCtx.fillStyle = '#1b2127';
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = '#3d98f4';
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
        Chart.defaults.color = '#9cabba';
        Chart.defaults.borderColor = '#3b4754';
        
        averagedWaveformChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: waveform.length }, (_, i) => i),
                datasets: [{
                    label: 'Averaged Beat Cycle',
                    data: waveform,
                    borderColor: '#3d98f4',
                    backgroundColor: 'rgba(61, 152, 244, 0.1)',
                    fill: true,
                    pointRadius: 0,
                    borderWidth: 2
                }]
            },
            options: { 
                scales: { 
                    x: { 
                        title: { display: true, text: 'Samples', color: '#9cabba' },
                        grid: { color: '#3b4754' }
                    }, 
                    y: { 
                        title: { display: true, text: 'Amplitude', color: '#9cabba' },
                        grid: { color: '#3b4754' } 
                    } 
                },
                plugins: {
                    legend: { labels: { color: '#f0f2f5' } }
                }
            }
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
                    backgroundColor: '#ff6b6b',
                    borderColor: '#ff6b6b'
                }]
            },
            options: { 
                scales: { 
                    x: { 
                        title: { display: true, text: 'Beat Number', color: '#9cabba' },
                        grid: { color: '#3b4754' }
                    }, 
                    y: { 
                        title: { display: true, text: 'Interval (ms)', color: '#9cabba' },
                        grid: { color: '#3b4754' },
                        beginAtZero: false 
                    } 
                },
                plugins: {
                    legend: { labels: { color: '#f0f2f5' } }
                }
            }
        });
    }
});