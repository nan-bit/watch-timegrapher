# Web-based Mechanical Watch Analyzer

A browser-based application that uses your microphone to analyze the performance of a mechanical watch, providing key metrics like Rate, Beat Error, and Amplitude. This tool leverages a sophisticated signal processing pipeline on the backend to deliver accurate, real-time results, inspired by professional timegrapher software.

---

## Features

*   **Live Audio Monitoring:** Real-time waveform and peak-meter visualizations to ensure a clean audio capture.
*   **Adjustable Microphone Gain:** A UI slider allows you to tune the input signal to prevent clipping or noise issues.
*   **One-Click Automated Analysis:** A single button captures a 6-second audio sample and sends it for a complete analysis.
*   **Accurate Metrics Calculation:**
    *   **Rate (s/day):** Measures the watch's daily accuracy.
    *   **Beat Error (ms):** Measures the consistency between each tick and tock.
    *   **Amplitude (°):** Measures the balance wheel's rotation, a key indicator of movement health.
*   **Rich Diagnostic Visualizations:**
    *   **Averaged Waveform Chart:** See a clean, noise-free representation of a single beat cycle.
    *   **Beat Error Timeline:** A scatter plot visualizing the stability of the watch's beat rate over the full sample.

## Technology Stack

The application is built with a modern, efficient stack designed for a responsive user experience and a powerful analysis backend.

| Category      | Technology                                       | Purpose                                            |
|---------------|--------------------------------------------------|----------------------------------------------------|
| **Frontend**  | HTML5, CSS3, Vanilla JavaScript                  | Core web technologies for the user interface.      |
|               | Chart.js                                         | For rendering all data visualizations.             |
| **Backend**   | Python 3 with FastAPI                            | A high-performance, modern web framework for the API.|
|               | NumPy & SciPy                                    | The foundation for all numerical and signal processing.|
|               | SoundFile                                        | Robustly reads audio data from in-memory streams.  |
| **Environment**| Firebase Studio (Google IDX)                     | The cloud-based development environment.           |
|               | NixOS (`dev.nix`)                                | For declarative and reproducible environment setup.|
|               | FFmpeg                                           | For high-speed, reliable audio format conversion.  |

---

## Getting Started

This project is configured to run out-of-the-box in **Firebase Studio**.

### Prerequisites

*   A Firebase Studio account.
*   A microphone to capture the watch audio.
*   Good vibes.

### Running the Application

The environment is almost entirely automated by the Nix configuration file.

1.  **Clone the Repository:** Clone this project into your local machine.
2.  **Open in Firebase Studio:** Import and open the cloned folder in your Firebase Studio workspace.
3.  **Wait for Environment Build:** On first launch, Nix will automatically read the `.idx/dev.nix` file and install all required packages (Python, FFmpeg, etc.). This may take a few minutes.
4.  **Automatic Start:** Once the environment is built, the `start-server.sh` script is triggered automatically. This script will:
    *   Create a Python virtual environment (`.venv`).
    *   Install all dependencies from `requirements.txt`.
    *   Start the FastAPI backend server.
5.  **View the App:** A preview of the application will automatically appear in the preview panel.

If you need to manually restart the server at any time, open a terminal in the IDE and run:
```bash
bash start-server.sh
```

---

## How It Works: The Analysis Pipeline

The core of this application is the backend's signal processing pipeline, which turns a noisy audio recording into precise measurements.

### 1. Audio Ingestion & Conversion
The frontend captures a 6-second audio clip as a `.webm` file. This is sent to the `/api/analyze-audio` endpoint. The backend immediately uses **FFmpeg** to convert the audio into a standardized, uncompressed 48kHz WAV format in memory. This raw audio data is then safely read using the **`soundfile`** library.

### 2. Signal Conditioning (Envelope Generation)
To isolate the watch's sounds, a multi-stage conditioning process is applied:
*   A **band-pass filter** (2000-8000 Hz) removes low-frequency hum and high-frequency hiss.
*   The absolute value of the filtered signal is taken to create a raw signal "envelope."
*   This envelope is then **smoothed** with a moving average filter. This is a critical step that creates clean, unambiguous peaks for each beat, making subsequent analysis far more reliable.

### 3. Period Detection via Fast Autocorrelation
To find the precise time between beats (the period), a **fast autocorrelation** is performed on the smoothed envelope. This is implemented using the Wiener-Khinchin theorem: the signal is transformed into the frequency domain via an **FFT**, multiplied by its complex conjugate, and then transformed back into the time domain via an **Inverse FFT**.

### 4. Sub-Sample Peak Refinement
The algorithm finds the highest peak of the autocorrelation result within a small window around the expected beat period. To achieve high accuracy, the location of this peak is refined to **sub-sample precision** using **quadratic interpolation**. The integer index of the peak and its two neighbors are used to define a parabola, and the true mathematical vertex of that parabola is calculated. This provides a high-precision floating-point value for the measured beat period, which is essential for an accurate rate calculation.

### 5. Metrics Calculation
*   **Rate:** Calculated by comparing the watch's theoretical period (derived from the user's BPH input) with the high-precision measured period. The difference is scaled to produce the seconds/day error.
*   **Beat Error:** All prominent peaks are detected in the smoothed envelope. The time intervals between these peaks are separated into two groups ("tick-tock" and "tock-tick"), and the absolute difference between the average of these two groups gives the beat error in milliseconds.
*   **Amplitude:** An averaged waveform of a single, full oscillation (two beats) is generated. The time difference between the two main peaks (representing the unlocking and locking of the pallet fork) is measured. This time, along with the beat period and the user-provided **Lift Angle**, is used in a trigonometric `arcsin` formula to calculate the balance wheel's total angle of rotation in degrees.

---

## File Structure

Here is an overview of the key files in this project:

```
/
├── static/
│   ├── script.js        # All frontend JavaScript logic
│   ├── style.css        # All UI styling
│   └── index.html       # The main HTML file
├── .idx/
│   └── dev.nix          # Nix configuration for the development environment
├── main.py              # FastAPI backend server and all analysis logic
├── requirements.txt     # Python package dependencies
├── start-server.sh      # Script to set up the venv and run the server
└── README.md            # You are here!
```
