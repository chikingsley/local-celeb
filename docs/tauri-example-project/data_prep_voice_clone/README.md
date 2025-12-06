# Data Preparation for TTS Fine-tuning

This directory contains scripts and resources to prepare a custom speech dataset for fine-tuning a Text-to-Speech (TTS) model. The process involves taking a single audio file and a JSON file with transcriptions and timestamps, and converting them into a structured dataset format.

## Plan

1. **Parse JSON**: Read the `scar_isolated.json` file to get the text, start times, and end times for each audio segment.
2. **Slice Audio**: Use the timestamps to slice the main `scar_isolated.mp3` audio file into individual segments.
3. **Resample Audio**: Convert each audio segment to a 24kHz sampling rate, as recommended for the Orpheus TTS model. The sliced audio will be saved in WAV format, which is better for processing.
4. **Create Metadata**: Generate a `metadata.csv` file that maps each audio segment to its corresponding transcription. This file will be the basis for the Hugging Face dataset.
5. **Build Hugging Face Dataset**: Use the `datasets` library to load the data from the CSV and the audio files into a Hugging Face `Dataset` object, making it easy to use for training.

## Project Structure

```markdown
.
├── data_prep/
│   ├── pyproject.toml
│   ├── README.md
│   ├── prepare_dataset.py
│   └── output/
│       ├── audio/
│       │   ├── segment_0.wav
│       │   └── ...
│       └── metadata.csv
├── scar_isolated.json
└── scar_isolated.mp3
```

## How to Run

1. Make sure you have `ffmpeg` installed on your system. On macOS, you can install it with Homebrew:

    ```bash
    brew install ffmpeg
    ```

2. Install the project dependencies using Poetry:

    ```bash
    cd data_prep
    poetry install
    ```

3. Run the preparation script from the root of the repository:

    ```bash
    poetry run python prepare_dataset.py
    ```
