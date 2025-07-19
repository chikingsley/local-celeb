import json
import pandas as pd  # type: ignore
from pydub import AudioSegment  # type: ignore
from pathlib import Path
from datasets import load_dataset, Audio  # type: ignore
import librosa  # type: ignore
import soundfile as sf  # type: ignore

# --- Configuration ---
# Assuming this script is in data_prep/ and run from there.
# The input files are in the parent directory.
JSON_PATH = Path("../scar_isolated.json")
AUDIO_PATH = Path("../scar_isolated.mp3")
OUTPUT_DIR = Path("output")
AUDIO_OUTPUT_DIR = OUTPUT_DIR / "audio"
METADATA_PATH = OUTPUT_DIR / "metadata.csv"
TARGET_SAMPLING_RATE = 24000
REMOVE_SPECIAL_TAGS = True # Set to False to keep tags like <laugh>

def create_dataset():
    """
    Processes the input JSON and audio file to create a dataset for TTS fine-tuning.
    """
    # 1. Create output directories
    AUDIO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 2. Load JSON and Audio
    print("Loading input files...")
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
    
    # The JSON structure seems to be a dictionary with a 'segments' key
    segments = data.get('segments', [])
    if not segments:
        print("Warning: 'segments' key not found in JSON, assuming the root is a list of segments.")
        segments = data


    # pydub loads the full audio file
    # This might take a moment depending on the file size
    try:
        audio = AudioSegment.from_mp3(AUDIO_PATH)
        print("Audio file loaded successfully.")
    except Exception as e:
        print(f"Error loading audio file: {e}")
        print("Please ensure ffmpeg is installed and accessible in your system's PATH.")
        print("On macOS, you can install it with: brew install ffmpeg")
        return

    # 3. Process each segment
    print(f"Processing {len(segments)} segments...")
    metadata = []
    for i, segment in enumerate(segments):
        start_time = float(segment['start_time']) * 1000  # pydub uses milliseconds
        end_time = float(segment['end_time']) * 1000
        text = segment['text'].strip()

        # Skip segments marked with "---"
        if "---" in text:
            print(f"Skipping segment {i} containing '---'")
            continue

        if REMOVE_SPECIAL_TAGS:
            # Basic tag removal, can be expanded
            text = "".join(c for c in text if c not in '<>')


        if not text:
            print(f"Skipping segment {i} due to empty transcript.")
            continue
            
        # Slice audio
        clip = audio[start_time:end_time]
        
        # pydub can be memory intensive for resampling. Let's use librosa for robust resampling.
        # Export to a temporary in-memory format, then load with librosa
        # Get raw audio data from pydub clip
        samples = clip.get_array_of_samples()
        
        # Convert to numpy array
        audio_np = librosa.util.buf_to_float(samples, n_bytes=clip.sample_width, dtype=float)


        # Resample if necessary
        if clip.frame_rate != TARGET_SAMPLING_RATE:
            audio_np_resampled = librosa.resample(audio_np, orig_sr=clip.frame_rate, target_sr=TARGET_SAMPLING_RATE)
        else:
            audio_np_resampled = audio_np

        # Save the resampled audio clip
        clip_path = AUDIO_OUTPUT_DIR / f"segment_{i}.wav"
        sf.write(clip_path, audio_np_resampled, TARGET_SAMPLING_RATE)

        metadata.append({
            "audio": str(clip_path),
            "text": text
        })

    # 4. Create and save metadata CSV
    print(f"Saving metadata to {METADATA_PATH}...")
    df = pd.DataFrame(metadata)
    df.to_csv(METADATA_PATH, index=False)

    # 5. Demonstrate loading with Hugging Face datasets
    print("Creating Hugging Face Dataset...")
    # The 'audio' column in the CSV is just a path. We need to load the audio data.
    # We explicitly load the CSV into the 'train' split.
    dataset = load_dataset("csv", data_files={"train": str(METADATA_PATH)})
    
    # Use cast_column to load and resample audio
    # The files are already resampled, but this is good practice and verifies the sampling rate.
    dataset = dataset.cast_column("audio", Audio(sampling_rate=TARGET_SAMPLING_RATE))

    print("\nDataset created successfully!")
    print(dataset)
    print("\nFirst sample:")
    print(dataset['train'][0])

    # 6. Optionally push to Hub
    upload_to_hub = input("\nDo you want to upload this dataset to the Hugging Face Hub? (y/n): ")
    if upload_to_hub.lower() == 'y':
        try:
            repo_name = input("Enter the repository name (e.g., your-username/dataset-name): ")
            if not repo_name:
                print("Upload cancelled. No repository name provided.")
                return

            print(f"Uploading to {repo_name}...")
            # We push the entire DatasetDict to the Hub
            dataset.push_to_hub(repo_name)
            print("Upload complete!")
            print(f"You can find your dataset at: https://huggingface.co/datasets/{repo_name}")
        except Exception as e:
            print(f"An error occurred during upload: {e}")
            print("Please ensure you are logged in via 'huggingface-cli login' and have the correct permissions.")


if __name__ == "__main__":
    create_dataset() 