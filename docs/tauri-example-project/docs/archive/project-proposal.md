# Cinematic Voice Weaver - Local AI Character Cloning

This document outlines an ambitious idea for an application that allows users to extract, process, and clone character voices from movies for use in local AI conversational agents. It synthesizes a raw "braindump" into a structured proposal, categorizing the various technical components and resources suggested by the user.

---

## Project Concept: Cinematic Voice Weaver - Local AI Character Cloning

**Overarching Goal:** To create a user-friendly application that enables individuals to extract specific character voices from movies, clean and prepare their audio, train a Text-to-Speech (TTS) model on these voices, and then integrate these custom voice models into a local AI assistant for personalized interaction. The emphasis is on local, personal use, aiming for maximum control and privacy.

---

### Core Idea Breakdown (Phases of Development)

The project can be conceptualized in three primary phases, building upon each other to achieve the ultimate goal:

#### Phase 1: Content Acquisition & Preparation

* **Objective:** To reliably obtain movie transcripts/subtitles and prepare the corresponding audio/video content for processing.
* **Components:**
  * **Movie Script/Subtitle Database:**
    * **Concept:** Develop or leverage a robust database of movie scripts and/or official subtitles. The user expresses a preference for a vast, possibly "infinite" database.
    * **Sources to Explore:**
      * Existing GitHub projects (e.g., `Aveek-Saha/Movie-Script-Database`) as a starting point, evaluating their modernity, accuracy, and format (JSON preferred).
      * Script websites (e.g., SimplyScripts.com).
      * Subtitle repositories (e.g., Subscene.com), investigating API availability or web scraping potential.
      * Explore international sources (Russian, Chinese, Indian movies) for broader coverage beyond IMDb.
    * **Storage:** A PostgreSQL database is suggested, with a potential consideration for a vector database for faster retrieval.
  * **Movie File Ingestion:**
    * **Concept:** Allow users to input a local movie file (e.g., purchased/downloaded MP4/MKV).
    * **Synchronization & Transcription:**
      * **Official Subtitles:** If available, official subtitles are the preferred "source of truth."
      * **Automatic Transcription (ASR):** If official subtitles are absent or need correction, automatic speech recognition (ASR) will be used to transcribe the movie's audio. This generated transcript would then be aligned with the provided (or generated) script/subtitles.
      * **Alignment:** Crucially, align the script/subtitles with the actual audio/video timestamps for precise segmentation.

#### Phase 2: Character Voice Extraction & Enhancement

* **Objective:** To isolate individual character dialogue clips from the movie, clean their audio, and prepare them for voice model training.
* **Components:**
  * **Character-Specific Segmentation (Audio & Video):**
    * **Concept:** Given a synchronized script/subtitle and movie file, automatically identify and segment all dialogue (and potentially singing) for a specific character.
    * **Output:** The system should generate individual audio clips (e.g., `.wav`, `.mp3`) and corresponding video clips for each segment where the chosen character speaks. Video inclusion is important for visual context during potential manual adjustments.
    * **Manual Adjustment:** Provide a user interface (similar to transcript-based video editors) allowing minor temporal adjustments (extending/trimming clips) to ensure complete dialogue capture or handle overlaps.
    * **Tools to Explore:**
      * `smlum/scription` (for transcript-based editing concepts).
      * `bugbakery/audapolis`, `WyattBlue/auto-editor`, `Zulko/moviepy`, `aregrid/frame` (for programmatic audio/video manipulation and segmentation).
  * **Audio Enhancement & Isolation:**
    * **Concept:** Clean the extracted audio clips to remove background noise, music, or other voices, focusing solely on the character's voice. This is critical for high-quality voice cloning.
    * **Tools/APIs to Explore:**
      * **Proprietary APIs:** Eleven Labs (preferred for quality), PlayHT (investigate their isolation/cleaning endpoints).
      * **Open-Source/Local:** `descriptinc/descript-audio-codec` or other state-of-the-art open-source audio separation tools. Research for the best local, AI-driven audio isolation.

#### Phase 3: TTS Model Creation & Agent Integration

* **Objective:** To train a TTS model on the cleaned character voice and integrate it into a conversational AI agent.
* **Components:**
  * **Text-to-Speech (TTS) Model Training/Fine-tuning:**
    * **Concept:** Use the prepared character audio clips to fine-tune or train a TTS model capable of synthesizing speech in that character's voice.
    * **Key Question:** How are models stored? The user asks if each voice requires a new model instance or if a single model can manage multiple voices. It's likely that each distinct voice profile requires its own fine-tuned model (or adapter), potentially consuming more storage per voice. Confirmation is needed based on the chosen TTS framework.
    * **Tools/Frameworks to Explore (emphasizing Unsloth due to user's praise):**
      * **Unsloth (Recommended):** `Orpheus 3B TTS` (pretrained and fine-tuned versions), `Sesame CSM (1B)` (with Unsloth's fine-tuning notebooks). Unsloth's 4-bit quantization is highly valued for local execution.
      * **Other Open-Source TTS:** Fish-Speech, F5 TTS, XTTS V2, Mellow TTS, Style TTS, `TrelisResearch/ADVANCED-transcription` (for reference, though Unsloth scripts seem preferred).
      * **Proprietary APIs:** PlayHT (for state-of-the-art alternative).
  * **AI Agent Integration & Usage:**
    * **Concept:** Allow the user to select their newly trained character voice model and use it within a local AI conversational agent.
    * **Features:** Full control over agent configuration (system prompt, model selection, etc.).
    * **Tools/Frameworks to Explore:**
      * **Local Inference:** Ollama (highly recommended as "GOAT" for local models), LM Studio.
      * **Agent Frameworks:** `disler/always-on-ai-assistant` (highlighted as a top example), `a16z-infra/ai-town`, `a16z-infra/companion-app`, `get-convex/agent`, `stack.convex.dev` (for concepts on durable agents/workflows).

#### Phase 4: Advanced Features & Future Scope

* **Live Content Capture:**
  * **Objective:** Extend the application to capture audio (and potentially video) directly from system output (e.g., streaming services) for voice extraction, bypassing the need for local movie files.
  * **Audio Capture:** Recording system audio is feasible.
  * **Video Capture:** More challenging without direct file access. Possible approaches:
    * Screenshots/screen recording APIs (native OS APIs or tools like Hammerspoon for macOS scripting).
    * Investigate legal implications of screen recording copyrighted content, even for local personal use.

---

### Technical Deep Dive & Resource Evaluation

This section evaluates the provided resources and suggests best practices for each component.

#### Script/Subtitle Management

* **`Aveek-Saha/Movie-Script-Database`:** A good starting point. Prioritize extracting TXT data and converting to JSON for metadata and script content.
* **SimplyScripts.com / Subscene.com:** Investigate programmatically accessing these (APIs, scraping) for a comprehensive database.
* **Recommendation:** A cron job to periodically update and populate a local PostgreSQL (or vector) database with scripts and metadata from multiple sources, handling formatting and missing data.

#### Audio/Video Processing & Segmentation

* **`smlum/scription`:** Useful for understanding the concept of transcript-based editing, though direct editing functionality might not be its primary focus.
* **`bugbakery/audapolis` / `WyattBlue/auto-editor` / `Zulko/moviepy` / `aregrid/frame`:** These are excellent candidates for programmatic audio/video cutting, manipulation, and potentially scene/character detection. `MoviePy` is a strong general-purpose Python library for video editing.
* **Recommendation:** Use a combination of `MoviePy` for robust video/audio operations and potentially `auto-editor` for smart cutting based on ASR output.

#### Transcription (ASR) & Alignment

* **Whisper Variants (for ASR):**
  * **`m-bain/whisperX`:** Known for speed and accurate word-level timestamps, making it ideal for alignment. Uses VAD (Voice Activity Detection) and speaker diarization.
  * **`ggml-org/whisper.cpp`:** A highly optimized C++ implementation. Excellent for local, offline inference due to its lightweight nature and speed. Often used in offline voice assistants.
  * **`SYSTRAN/faster-whisper`:** A re-implementation of Whisper using CTranslate2, offering significant speedups (4x-5x faster than original Whisper) with comparable accuracy.
  * **Unsloth's Whisper Fine-tuning:** Unsloth provides notebooks for fine-tuning Whisper (even `large-v3`) with 4-bit quantization, making it highly efficient on local hardware.
  * **`kaldi-asr/kaldi`:** The "OG" of ASR toolkits. Powerful but has a steeper learning curve and might be overkill given the advancements in Whisper-based models for general-purpose ASR.
* **`MontrealCorpusTools/Montreal-Forced-Aligner (MFA)`:** Absolutely essential for precise alignment between transcripts/subtitles and audio. It uses pre-trained acoustic models (`mfa-models`) to align phonetic transcriptions to speech.
* **Recommendation:**
    1. **Primary ASR:** `WhisperX` for its VAD/diarization and word-level timestamps.
    2. **Fast Local Inference:** `whisper.cpp` or `faster-whisper` for quick transcriptions when needed.
    3. **Alignment:** `Montreal Forced Aligner (MFA)` is the gold standard for accurate alignment of provided text (script/subtitle) with audio. This is crucial for precise character clip extraction.

#### Audio Cleaning & Isolation

* **Eleven Labs / PlayHT APIs:** Offer high-quality, potentially state-of-the-art audio isolation. Consider these as premium options for users willing to pay for API access.
* **`descriptinc/descript-audio-codec`:** While focused on efficient audio compression, Descript itself has excellent audio editing and cleaning capabilities. Investigate if their underlying audio processing technologies are open-sourced or usable in other contexts.
* **Open-Source Solutions:** Research current open-source projects for "source separation" or "vocal isolation." Many AI models exist (e.g., Demucs, Spleeter) that can separate vocals from music or other audio sources.
* **Recommendation:** Provide options for both cloud-based (Eleven Labs/PlayHT) and local open-source solutions. Start with widely-used open-source tools for vocal separation, and implement API integrations for higher quality.

#### Text-to-Speech (TTS) & Voice Cloning

* **Unsloth (Highly Recommended):**
  * `Orpheus 3B TTS` (pretrained & fine-tuned 4-bit versions): User-cited as potentially state-of-the-art. Unsloth's efficient fine-tuning on consumer hardware is a huge advantage.
  * `Sesame CSM (1B)`: Unsloth also supports fine-tuning for CSM. While the user noted initial doubts about CSM, Unsloth's work might make it a viable option.
  * **Unsloth Notebooks:** Provide direct paths for users to fine-tune models on their local setup.
* **Other Open-Source TTS for comparison/options:**
  * **Fish-Speech, F5 TTS, XTTS V2:** These are popular open-source voice cloning projects.
  * **`TrelisResearch/ADVANCED-transcription/text-to-speech`:** Can be a reference, but Unsloth's integrations are likely more streamlined.
* **TTS Model Storage:** The question of whether each voice requires a new model or if a single model can house many voices is critical for resource management. For most current state-of-the-art voice cloning methods (especially fine-tuning a base model), each cloned voice typically results in a unique set of model weights (or adapters/LoRAs) specific to that voice. This means separate storage for each trained voice model.
* **Recommendation:** Prioritize Unsloth for efficient local fine-tuning of models like Orpheus. Offer multiple fine-tuning options (e.g., Orpheus, XTTSv2, potentially CSM) and allow users to experiment with which produces the best results for a given voice. Clearly explain the storage implications of training multiple voice models.

#### AI Agent & Local Inference

* **Ollama (GOAT):** The primary recommendation for running local LLMs and connecting them with the custom TTS voices. Ollama simplifies model downloading and inference.
* **LM Studio:** Another excellent option for managing and running local LLMs with a user-friendly GUI.
* **Agent Frameworks (for conversational logic):**
  * `disler/always-on-ai-assistant`: A strong example of a functional, always-on AI assistant. Study its architecture for inspiration.
  * `a16z-infra/ai-town`, `a16z-infra/companion-app`, `get-convex/agent`, `stack.convex.dev`: Provide conceptual frameworks and examples for building robust, stateful AI agents.
* **Recommendation:** Use Ollama/LM Studio for local LLM inference. Build the agent's conversational logic on top of these, leveraging concepts from `disler/always-on-ai-assistant` for a robust local experience.

#### System Integration (Future/Advanced)

* **Hammerspoon (macOS specific):** A powerful scripting engine for macOS. Could be used for system-level audio capture or automating UI interactions, though full screen recording might be limited by OS security/DRM.
* **Native OS APIs:** For cross-platform support, direct use of Windows/macOS/Linux audio/video capture APIs would be necessary. This is more complex than a generic Python solution.
* **Recommendation:** Start with file-based processing. Explore system audio capture as a Level 2 feature. Video capture from streaming services is significantly more complex and has legal/DRM hurdles.

---

### Key Questions & Considerations Summary

* **Script API:** Building a custom scraper/database is more reliable than relying on external APIs that may not exist or be stable.
* **Whisper Differences:**
  * `whisper.cpp`: Fastest, most efficient for local inference (C++ implementation).
  * `faster-whisper`: Faster Python implementation (CTranslate2).
  * `whisperX`: Adds VAD and diarization, crucial for accurate segmentation in multi-speaker audio.
  * **Recommended:** Use `WhisperX` for initial processing (VAD/diarization) and `MFA` for precise alignment. For general ASR, `whisper.cpp` or `faster-whisper` are excellent for speed. Unsloth's fine-tuned Whisper models offer optimized performance on quantized hardware.
* **TTS Model Storage:** Each distinct voice will likely require its own fine-tuned model (or adapter), consuming separate storage space.
* **Legality:** The user clearly states the intent is for **local, personal, non-commercial use**. This significantly mitigates legal risks compared to public or commercial applications. The application should emphasize and facilitate this local-only usage model.
* **Open-Source vs. API:** Provide options for both. Users can start with robust open-source solutions and upgrade to API-based services (e.g., for audio cleaning or higher-quality TTS) if desired and willing to pay.

---

### Vision for the Application

The **Cinematic Voice Weaver** would be a desktop application that:

1. **Ingests Movies:** Allows users to input a movie file.
2. **Automates Script/Subtitle Integration:** Automatically finds or generates a transcript/subtitles, aligning them precisely with the movie's audio/video using ASR and forced alignment (MFA).
3. **Character Voice Extraction:** Presents a list of characters. Upon selection, it automatically extracts all their dialogue (audio and video clips) and cleans the audio.
4. **TTS Model Training:** Offers a simple interface to fine-tune a TTS model (e.g., Unsloth's Orpheus) on the extracted voice data, optimized for local hardware.
5. **AI Agent Integration:** Allows users to instantly select and deploy the newly trained voice model within a local AI conversational agent, enabling them to "talk" to their favorite movie characters using their actual voices.
6. **User Control & Customization:** Provides granular control over the AI agent's behavior (system prompts) and the choice of local LLM models (via Ollama/LM Studio).

This application would empower users to create unique, locally-run AI experiences directly from their favorite cinematic content, focusing on the immersive aspect of interacting with familiar voices.
