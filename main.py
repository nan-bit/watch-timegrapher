import io
import subprocess
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import numpy as np
import soundfile as sf
from scipy.signal import butter, lfilter, find_peaks

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

def filter_audio(data, rate, low_cut=2000, high_cut=8000, order=4):
    """Applies a bandpass filter to the audio data."""
    nyquist = 0.5 * rate
    low = low_cut / nyquist
    high = high_cut / nyquist
    b, a = butter(order, [low, high], btype='band')
    return lfilter(b, a, data)

def smooth_envelope(data, window_size=100):
    """Applies a simple moving average to smooth the data."""
    return np.convolve(data, np.ones(window_size)/window_size, mode='valid')

def quadratic_interpolation_peak(data, peak_index):
    """Finds the sub-sample peak location using quadratic interpolation."""
    if peak_index < 1 or peak_index >= len(data) - 1:
        return float(peak_index)
    y0, y1, y2 = data[peak_index - 1], data[peak_index], data[peak_index + 1]
    denominator = 2 * (y0 - 2 * y1 + y2)
    if denominator == 0: return float(peak_index)
    p = (y0 - y2) / denominator
    return peak_index + p

def create_averaged_waveform(envelope, period_samples):
    """Folds the envelope signal to create a clean, averaged waveform of one full oscillation."""
    full_period = int(period_samples * 2)
    # Ensure we have at least one full period to analyze
    if len(envelope) < full_period: return None
    num_periods = len(envelope) // full_period
    if num_periods < 1: return None
    
    truncated_len = num_periods * full_period
    reshaped_envelope = envelope[:truncated_len].reshape(num_periods, full_period)
    return np.mean(reshaped_envelope, axis=0)

def calculate_amplitude(avg_waveform, period_samples, rate, lift_angle_deg):
    """Calculates the amplitude from the averaged signal waveform."""
    if avg_waveform is None or not avg_waveform.any():
        return 0.0

    try:
        # Find the primary peak (the "tic") in the averaged waveform
        peaks, _ = find_peaks(avg_waveform, height=np.max(avg_waveform) * 0.3, distance=period_samples * 0.5)
        if len(peaks) < 2:
            return 0.0 # Need at least a "tic" and a "toc"
        
        # The two highest peaks are the tic and toc
        peak_heights = avg_waveform[peaks]
        sorted_peak_indices = np.argsort(peak_heights)[::-1] # Sort descending
        
        # Find the time difference between the two main escapement sounds
        # This is the time between the unlocking and locking of the impulse jewel.
        time_diff_samples = np.abs(peaks[sorted_peak_indices[0]] - peaks[sorted_peak_indices[1]])
        
        # Convert the time difference to an angle of rotation
        rotation_angle = (time_diff_samples * np.pi) / period_samples
        
        # The core amplitude formula
        sin_of_rotation = np.sin(rotation_angle)
        if sin_of_rotation <= 0: return 0.0
            
        amplitude_rad = np.arcsin(1 / sin_of_rotation) * (lift_angle_deg / 57.2958) # 57.2958 is rad -> deg
        amplitude_deg = np.rad2deg(amplitude_rad)

        # Return a plausible value, otherwise return 0
        return amplitude_deg if 100 < amplitude_deg < 360 else 0.0
    except Exception:
        return 0.0

@app.post("/api/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), bph: int = File(...), lift_angle: float = File(...)):
    """Final, robust analysis using sub-sample peak detection for high accuracy."""
    try:
        webm_contents = await file.read()
        ffmpeg_command = ["ffmpeg", "-i", "pipe:0", "-f", "wav", "-ar", "48000", "pipe:1"]
        process = subprocess.run(ffmpeg_command, input=webm_contents, capture_output=True, check=True)
        wav_contents = process.stdout
        data, rate = sf.read(io.BytesIO(wav_contents))

        if data.ndim > 1: data = data.T[0]
        data = data.astype(np.float32)

        filtered_data = filter_audio(data, rate)
        envelope = np.abs(filtered_data)
        smoothing_window_size = int(rate * 0.002)
        smoothed_envelope = smooth_envelope(envelope, window_size=smoothing_window_size)

        n = len(smoothed_envelope)
        fft_env = np.fft.rfft(smoothed_envelope, n=2*n)
        autocorr = np.fft.irfft(fft_env * np.conj(fft_env))[:n]

        expected_period_samples = (3600.0 / bph) * rate
        search_window = int(0.05 * expected_period_samples)
        min_search, max_search = int(expected_period_samples - search_window), int(expected_period_samples + search_window)

        integer_peak_index = min_search + np.argmax(autocorr[min_search:max_search])
        measured_period_samples = quadratic_interpolation_peak(autocorr, integer_peak_index)
        
        rate_error_spd = ((expected_period_samples / measured_period_samples) - 1) * 86400

        peaks, _ = find_peaks(smoothed_envelope, height=np.max(smoothed_envelope) * 0.1, distance=measured_period_samples * 0.75)
        
        beat_error_ms = 0.0
        beat_intervals = []
        if len(peaks) >= 3:
            intervals = np.diff(peaks) * 1000.0 / rate
            beat_intervals = intervals.tolist()
            intervals_t1 = intervals[0::2]
            intervals_t2 = intervals[1::2]
            if len(intervals_t1) > 0 and len(intervals_t2) > 0:
                avg_t1 = np.mean(intervals_t1)
                avg_t2 = np.mean(intervals_t2)
                beat_error_ms = np.abs(avg_t1 - avg_t2)

        # --- FINAL STEP: Calculate Amplitude ---
        avg_waveform = create_averaged_waveform(smoothed_envelope, measured_period_samples)
        amplitude_deg = calculate_amplitude(avg_waveform, measured_period_samples, rate, lift_angle)

        return {
            "rate": rate_error_spd,
            "beat_error": beat_error_ms,
            "amplitude": amplitude_deg,
            "avg_waveform": avg_waveform.tolist() if avg_waveform is not None else [],
            "beat_intervals": beat_intervals,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")