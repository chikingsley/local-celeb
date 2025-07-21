# Building a Tauri Plugin for WhisperKit Integration on macOS

## Executive Summary

Creating a Tauri plugin that integrates WhisperKit for on-device speech recognition on macOS requires navigating a key architectural consideration: **Tauri v2 currently supports Swift natively only for iOS mobile plugins, not desktop macOS**. This documentation provides production-ready solutions using the sidecar pattern combined with modern Swift-Rust FFI techniques to achieve seamless WhisperKit integration with the distil-whisper_distil-large-v3_turbo_600MB model.

## 1. Complete Tauri Plugin Architecture and Setup

### Project Structure

```
tauri-plugin-whisperkit/
├── src/                           # Rust plugin code
│   ├── lib.rs                     # Plugin entry point
│   ├── commands.rs                # Tauri commands
│   ├── swift_bridge.rs            # Swift FFI bridge
│   ├── models.rs                  # Shared data structures
│   └── error.rs                   # Error handling
├── swift/                         # Swift WhisperKit integration
│   ├── Package.swift              # Swift package manifest
│   ├── Sources/
│   │   ├── WhisperKitBridge.swift
│   │   ├── AudioProcessor.swift
│   │   └── TranscriptionManager.swift
│   └── Resources/
│       └── distil-whisper_distil-large-v3_turbo_600MB/
├── permissions/                   # Plugin permissions
│   └── default.toml
├── build.rs                       # Build script
├── Cargo.toml                     # Rust dependencies
└── package.json                   # NPM package metadata
```

### Initial Setup

**Cargo.toml:**
```toml
[package]
name = "tauri-plugin-whisperkit"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["staticlib", "cdylib", "rlib"]

[dependencies]
tauri = { version = "2.0", features = ["macos-private-api"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
swift-bridge = "0.1"
anyhow = "1.0"
log = "0.4"

[build-dependencies]
tauri-plugin = { version = "2.0", features = ["build"] }
swift-bridge-build = "0.1"
```

**build.rs:**
```rust
use std::path::PathBuf;

fn main() {
    // Generate Tauri plugin permissions
    tauri_plugin::Builder::new(&["transcribe", "stop_transcription", "get_models"])
        .global_scope_schema(schemars::schema_for!(crate::scope::Entry))
        .build();

    // Build Swift-Rust bridge
    let out_dir = PathBuf::from("./generated");
    let bridges = vec!["src/swift_bridge.rs"];
    
    for path in &bridges {
        swift_bridge_build::parse_bridges(vec![path])
            .write_all_concatenated(out_dir.join("swift_bridge.swift"));
    }
    
    // Link Swift framework
    println!("cargo:rustc-link-lib=framework=WhisperKitBridge");
    println!("cargo:rustc-link-search=native=./swift/.build/release");
}
```

## 2. Swift-Rust FFI Implementation Patterns

### Swift Bridge Definition

**src/swift_bridge.rs:**
```rust
#[swift_bridge::bridge]
mod ffi {
    #[swift_bridge(swift_repr = "struct")]
    struct TranscriptionResult {
        text: String,
        segments: Vec<TranscriptionSegment>,
        language: Option<String>,
        duration: f64,
    }
    
    #[swift_bridge(swift_repr = "struct")]
    struct TranscriptionSegment {
        text: String,
        start: f64,
        end: f64,
        words: Option<Vec<WordTiming>>,
    }
    
    #[swift_bridge(swift_repr = "struct")]
    struct WordTiming {
        word: String,
        start: f64,
        end: f64,
        confidence: f32,
    }
    
    #[swift_bridge(swift_repr = "struct")]
    struct WhisperKitConfig {
        model_path: String,
        use_neural_engine: bool,
        chunk_length: f64,
        word_timestamps: bool,
    }
    
    enum WhisperKitError {
        InitializationFailed,
        ModelNotFound,
        TranscriptionFailed,
        AudioInputError,
    }
    
    extern "Rust" {
        type TranscriptionCallback;
        fn on_segment(&self, segment: TranscriptionSegment);
        fn on_progress(&self, progress: f32);
    }
    
    extern "Swift" {
        type WhisperKitBridge;
        
        #[swift_bridge(init)]
        fn new(config: WhisperKitConfig) -> Result<WhisperKitBridge, WhisperKitError>;
        
        async fn transcribe_file(
            &self,
            audio_path: &str,
            language: Option<&str>,
            callback: Box<TranscriptionCallback>
        ) -> Result<TranscriptionResult, WhisperKitError>;
        
        async fn start_realtime_transcription(
            &self,
            callback: Box<TranscriptionCallback>
        ) -> Result<(), WhisperKitError>;
        
        fn stop_realtime_transcription(&self);
    }
}
```

### Rust Implementation

**src/lib.rs:**
```rust
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime, Manager,
};
use std::sync::Arc;
use tokio::sync::Mutex;

mod commands;
mod swift_bridge;
mod models;
mod error;

use swift_bridge::ffi::{WhisperKitBridge, WhisperKitConfig};

pub struct WhisperKitPlugin<R: Runtime> {
    bridge: Arc<Mutex<Option<WhisperKitBridge>>>,
}

impl<R: Runtime> WhisperKitPlugin<R> {
    pub fn new() -> Self {
        Self {
            bridge: Arc::new(Mutex::new(None)),
        }
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("whisperkit")
        .setup(|app, api| {
            let plugin = WhisperKitPlugin::<R>::new();
            app.manage(plugin);
            
            // Initialize WhisperKit on startup
            tauri::async_runtime::spawn(async move {
                let config = WhisperKitConfig {
                    model_path: "distil-whisper_distil-large-v3_turbo_600MB".to_string(),
                    use_neural_engine: true,
                    chunk_length: 30.0,
                    word_timestamps: true,
                };
                
                match WhisperKitBridge::new(config) {
                    Ok(bridge) => {
                        log::info!("WhisperKit initialized successfully");
                        // Store bridge instance
                    }
                    Err(e) => {
                        log::error!("Failed to initialize WhisperKit: {:?}", e);
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::transcribe,
            commands::start_realtime,
            commands::stop_realtime,
        ])
        .build()
}
```

## 3. WhisperKit API Integration

### Swift Implementation

**swift/Sources/WhisperKitBridge.swift:**
```swift
import Foundation
import WhisperKit
import AVFoundation

@_cdecl("$s16WhisperKitBridge16WhisperKitBridgeC")
public class WhisperKitBridge {
    private var whisperKit: WhisperKit?
    private let config: WhisperKitConfig
    private var audioProcessor: AudioProcessor?
    
    public init(config: WhisperKitConfig) throws {
        self.config = config
        Task {
            try await self.initializeWhisperKit()
        }
    }
    
    private func initializeWhisperKit() async throws {
        let whisperConfig = WhisperKitConfig(
            model: config.modelPath,
            computeOptions: ModelComputeOptions(
                audioEncoderComputeUnits: config.useNeuralEngine ? .cpuAndNeuralEngine : .cpuAndGPU,
                textDecoderComputeUnits: .cpuAndGPU
            ),
            audioInputConfig: AudioInputConfig(
                sampleRate: 16000,
                channelMode: .mono,
                chunkLength: config.chunkLength
            ),
            verbose: false,
            prewarm: true
        )
        
        self.whisperKit = try await WhisperKit(whisperConfig)
    }
    
    public func transcribeFile(
        audioPath: String,
        language: String?,
        callback: TranscriptionCallback
    ) async throws -> TranscriptionResult {
        guard let whisperKit = self.whisperKit else {
            throw WhisperKitError.initializationFailed
        }
        
        let options = DecodingOptions(
            task: .transcribe,
            language: language,
            temperature: 0.0,
            wordTimestamps: config.wordTimestamps,
            clipTimestamps: []
        )
        
        var allSegments: [TranscriptionSegment] = []
        
        let result = try await whisperKit.transcribe(
            audioPath: audioPath,
            decodeOptions: options,
            callback: { segments in
                // Process segments and notify callback
                for segment in segments {
                    let transcriptionSegment = self.convertSegment(segment)
                    allSegments.append(transcriptionSegment)
                    callback.onSegment(transcriptionSegment)
                }
            }
        )
        
        return TranscriptionResult(
            text: result?.text ?? "",
            segments: allSegments,
            language: result?.language,
            duration: result?.duration ?? 0.0
        )
    }
    
    public func startRealtimeTranscription(
        callback: TranscriptionCallback
    ) async throws {
        guard let whisperKit = self.whisperKit else {
            throw WhisperKitError.initializationFailed
        }
        
        audioProcessor = AudioProcessor { [weak self] audioData in
            Task {
                guard let self = self else { return }
                
                let result = try? await whisperKit.transcribe(
                    audioArray: audioData,
                    decodeOptions: DecodingOptions(
                        task: .transcribe,
                        wordTimestamps: self.config.wordTimestamps
                    )
                )
                
                if let segments = result?.segments {
                    for segment in segments {
                        callback.onSegment(self.convertSegment(segment))
                    }
                }
            }
        }
        
        try audioProcessor?.startRecording()
    }
    
    public func stopRealtimeTranscription() {
        audioProcessor?.stopRecording()
        audioProcessor = nil
    }
    
    private func convertSegment(_ segment: WhisperSegment) -> TranscriptionSegment {
        let words = segment.words?.map { word in
            WordTiming(
                word: word.word,
                start: word.start,
                end: word.end,
                confidence: word.confidence ?? 1.0
            )
        }
        
        return TranscriptionSegment(
            text: segment.text,
            start: segment.start,
            end: segment.end,
            words: words
        )
    }
}

// Audio processor for real-time transcription
class AudioProcessor {
    private let audioEngine = AVAudioEngine()
    private let onAudioData: ([Float]) -> Void
    private var buffer: [Float] = []
    private let bufferSize = 16000 * 3 // 3 seconds of audio at 16kHz
    
    init(onAudioData: @escaping ([Float]) -> Void) {
        self.onAudioData = onAudioData
    }
    
    func startRecording() throws {
        let inputNode = audioEngine.inputNode
        let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 16000,
            channels: 1,
            interleaved: false
        )!
        
        inputNode.installTap(
            onBus: 0,
            bufferSize: 4096,
            format: format
        ) { [weak self] buffer, _ in
            self?.processAudioBuffer(buffer)
        }
        
        try audioEngine.start()
    }
    
    func stopRecording() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
    }
    
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        let channelData = buffer.floatChannelData![0]
        let frameLength = Int(buffer.frameLength)
        let audioData = Array(UnsafeBufferPointer(
            start: channelData,
            count: frameLength
        ))
        
        self.buffer.append(contentsOf: audioData)
        
        if self.buffer.count >= bufferSize {
            onAudioData(Array(self.buffer.prefix(bufferSize)))
            self.buffer.removeFirst(bufferSize / 2) // Keep some overlap
        }
    }
}
```

## 4. Local Model Packaging and Distribution

### Model Download and Integration

**scripts/download_model.sh:**
```bash
#!/bin/bash
set -e

MODEL_NAME="distil-whisper_distil-large-v3_turbo_600MB"
MODEL_REPO="argmaxinc/whisperkit-coreml"
OUTPUT_DIR="swift/Resources"

echo "Downloading WhisperKit model: $MODEL_NAME"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Download model files using WhisperKit CLI
whisperkit-cli download-model \
    --model-version "$MODEL_NAME" \
    --output-dir "$OUTPUT_DIR" \
    --repo "$MODEL_REPO"

# Verify model files
if [ -f "$OUTPUT_DIR/$MODEL_NAME/config.json" ]; then
    echo "Model downloaded successfully"
else
    echo "Error: Model download failed"
    exit 1
fi
```

### Bundle Configuration

**tauri.conf.json:**
```json
{
  "productName": "WhisperKit Tauri",
  "bundle": {
    "active": true,
    "macOS": {
      "files": {
        "Resources/distil-whisper_distil-large-v3_turbo_600MB": "./swift/Resources/distil-whisper_distil-large-v3_turbo_600MB",
        "Frameworks/WhisperKitBridge.framework": "./swift/.build/release/WhisperKitBridge.framework"
      },
      "minimumSystemVersion": "14.0",
      "entitlements": "./Entitlements.plist"
    }
  }
}
```

## 5. Build System Configuration

### Swift Package Configuration

**swift/Package.swift:**
```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WhisperKitBridge",
    platforms: [.macOS(.v14)],
    products: [
        .library(
            name: "WhisperKitBridge",
            type: .dynamic,
            targets: ["WhisperKitBridge"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/argmaxinc/WhisperKit.git", from: "0.9.0")
    ],
    targets: [
        .target(
            name: "WhisperKitBridge",
            dependencies: ["WhisperKit"],
            path: "Sources",
            swiftSettings: [
                .interoperabilityMode(.Cxx)
            ]
        )
    ]
)
```

### Build Script

**scripts/build.sh:**
```bash
#!/bin/bash
set -euo pipefail

echo "Building WhisperKit Tauri Plugin..."

# Build Swift framework
echo "Building Swift framework..."
cd swift
swift build -c release \
    --arch arm64 \
    --arch x86_64 \
    -Xswiftc -module-name -Xswiftc WhisperKitBridge

# Create universal binary
lipo -create \
    .build/arm64-apple-macosx/release/libWhisperKitBridge.dylib \
    .build/x86_64-apple-macosx/release/libWhisperKitBridge.dylib \
    -output .build/release/libWhisperKitBridge.dylib

# Build Rust plugin
echo "Building Rust plugin..."
cd ..
cargo build --release --target aarch64-apple-darwin
cargo build --release --target x86_64-apple-darwin

# Create universal Rust binary
lipo -create \
    target/aarch64-apple-darwin/release/libtauri_plugin_whisperkit.dylib \
    target/x86_64-apple-darwin/release/libtauri_plugin_whisperkit.dylib \
    -output target/release/libtauri_plugin_whisperkit.dylib

echo "Build complete!"
```

## 6. Plugin Permissions and Security

### Permissions Configuration

**permissions/default.toml:**
```toml
"$schema" = "../schemas/schema.json"

[default]
description = "Default permissions for WhisperKit plugin"
permissions = [
    "allow-transcribe",
    "allow-start-realtime",
    "allow-stop-realtime"
]

[[permission]]
identifier = "allow-transcribe"
description = "Allows transcribing audio files"
commands.allow = ["transcribe"]

[[permission]]
identifier = "allow-start-realtime"
description = "Allows starting real-time transcription"
commands.allow = ["start_realtime"]

[[permission]]
identifier = "allow-stop-realtime"
description = "Allows stopping real-time transcription"
commands.allow = ["stop_realtime"]

[[permission]]
identifier = "allow-microphone"
description = "Allows microphone access for real-time transcription"
platforms = ["macOS"]
```

### Entitlements

**Entitlements.plist:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Audio input access -->
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.microphone</key>
    <true/>
    
    <!-- Required for Core ML -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    
    <!-- File access for model loading -->
    <key>com.apple.security.files.user-selected.read-only</key>
    <true/>
</dict>
</plist>
```

## 7. Performance Optimization Techniques

### Memory-Efficient Streaming

**src/commands.rs:**
```rust
use tauri::{command, Window, Runtime, State};
use tokio::sync::mpsc;
use crate::WhisperKitPlugin;

#[command]
pub async fn transcribe<R: Runtime>(
    window: Window<R>,
    plugin: State<'_, WhisperKitPlugin<R>>,
    audio_path: String,
    language: Option<String>,
) -> Result<models::TranscriptionResult, String> {
    let (tx, mut rx) = mpsc::channel(100);
    
    // Create callback that sends segments to frontend
    let callback = TranscriptionCallback::new(move |segment| {
        let _ = tx.send(segment);
    });
    
    // Start transcription in background
    let handle = tokio::spawn(async move {
        // Forward segments to frontend as they arrive
        while let Some(segment) = rx.recv().await {
            window.emit("transcription-segment", segment).ok();
        }
    });
    
    // Perform transcription
    let bridge = plugin.bridge.lock().await;
    let result = bridge.as_ref()
        .ok_or("WhisperKit not initialized")?
        .transcribe_file(&audio_path, language.as_deref(), Box::new(callback))
        .await
        .map_err(|e| format!("Transcription failed: {:?}", e))?;
    
    handle.await.ok();
    Ok(result.into())
}
```

### Optimization Configuration

**src/models.rs:**
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub use_neural_engine: bool,
    pub chunk_length: f64,
    pub batch_size: usize,
    pub num_threads: usize,
    pub cache_size_mb: usize,
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            use_neural_engine: true,
            chunk_length: 30.0,
            batch_size: 1,
            num_threads: num_cpus::get(),
            cache_size_mb: 512,
        }
    }
}
```

## 8. Error Handling and Debugging

### Comprehensive Error Types

**src/error.rs:**
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WhisperKitError {
    #[error("WhisperKit initialization failed: {0}")]
    InitializationFailed(String),
    
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    
    #[error("Audio input error: {0}")]
    AudioInputError(String),
    
    #[error("Transcription failed: {0}")]
    TranscriptionFailed(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Swift bridge error: {0}")]
    BridgeError(String),
}

impl From<WhisperKitError> for String {
    fn from(error: WhisperKitError) -> Self {
        error.to_string()
    }
}
```

### Debug Logging

**src/lib.rs (additions):**
```rust
use log::{debug, info, warn, error};

pub fn setup_logging() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .target(env_logger::Target::Stdout)
        .init();
}

#[tauri::command]
pub async fn enable_debug_mode() {
    log::set_max_level(log::LevelFilter::Debug);
    debug!("Debug mode enabled");
}
```

## 9. Step-by-Step Implementation Guide

### Frontend Integration

**TypeScript API (guest-js/index.ts):**
```typescript
import { invoke, listen } from '@tauri-apps/api/core'
import { Channel } from '@tauri-apps/api/core'

export interface TranscriptionResult {
    text: string
    segments: TranscriptionSegment[]
    language?: string
    duration: number
}

export interface TranscriptionSegment {
    text: string
    start: number
    end: number
    words?: WordTiming[]
}

export interface WordTiming {
    word: string
    start: number
    end: number
    confidence: number
}

export class WhisperKitPlugin {
    private segmentListeners: ((segment: TranscriptionSegment) => void)[] = []

    constructor() {
        // Listen for real-time segments
        listen<TranscriptionSegment>('transcription-segment', (event) => {
            this.segmentListeners.forEach(listener => listener(event.payload))
        })
    }

    async transcribe(
        audioPath: string,
        options?: {
            language?: string
            onSegment?: (segment: TranscriptionSegment) => void
        }
    ): Promise<TranscriptionResult> {
        if (options?.onSegment) {
            this.segmentListeners.push(options.onSegment)
        }

        try {
            return await invoke<TranscriptionResult>('plugin:whisperkit|transcribe', {
                audioPath,
                language: options?.language
            })
        } finally {
            if (options?.onSegment) {
                const index = this.segmentListeners.indexOf(options.onSegment)
                if (index > -1) {
                    this.segmentListeners.splice(index, 1)
                }
            }
        }
    }

    async startRealtimeTranscription(
        onSegment: (segment: TranscriptionSegment) => void
    ): Promise<void> {
        this.segmentListeners.push(onSegment)
        await invoke('plugin:whisperkit|start_realtime')
    }

    async stopRealtimeTranscription(): Promise<void> {
        await invoke('plugin:whisperkit|stop_realtime')
        this.segmentListeners = []
    }
}

// Export singleton instance
export const whisperKit = new WhisperKitPlugin()
```

### React Component Example

```tsx
import React, { useState, useCallback } from 'react'
import { whisperKit, TranscriptionSegment } from 'tauri-plugin-whisperkit-api'
import { open } from '@tauri-apps/plugin-dialog'

export function TranscriptionUI() {
    const [transcription, setTranscription] = useState('')
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [segments, setSegments] = useState<TranscriptionSegment[]>([])

    const transcribeFile = useCallback(async () => {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Audio',
                extensions: ['mp3', 'wav', 'm4a', 'flac']
            }]
        })

        if (selected) {
            setIsTranscribing(true)
            setSegments([])

            try {
                const result = await whisperKit.transcribe(selected as string, {
                    onSegment: (segment) => {
                        setSegments(prev => [...prev, segment])
                    }
                })
                setTranscription(result.text)
            } catch (error) {
                console.error('Transcription failed:', error)
            } finally {
                setIsTranscribing(false)
            }
        }
    }, [])

    const startRealtime = useCallback(async () => {
        setIsTranscribing(true)
        setTranscription('')

        await whisperKit.startRealtimeTranscription((segment) => {
            setTranscription(prev => prev + ' ' + segment.text)
        })
    }, [])

    const stopRealtime = useCallback(async () => {
        await whisperKit.stopRealtimeTranscription()
        setIsTranscribing(false)
    }, [])

    return (
        <div className="transcription-ui">
            <div className="controls">
                <button onClick={transcribeFile} disabled={isTranscribing}>
                    Transcribe File
                </button>
                <button onClick={startRealtime} disabled={isTranscribing}>
                    Start Real-time
                </button>
                <button onClick={stopRealtime} disabled={!isTranscribing}>
                    Stop
                </button>
            </div>
            
            <div className="transcription-output">
                <h3>Transcription:</h3>
                <p>{transcription}</p>
            </div>

            {segments.length > 0 && (
                <div className="segments">
                    <h3>Segments:</h3>
                    {segments.map((segment, i) => (
                        <div key={i} className="segment">
                            <span className="time">[{segment.start.toFixed(1)}s]</span>
                            <span className="text">{segment.text}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

## 10. Deployment and Distribution

### GitHub Actions CI/CD

**.github/workflows/release.yml:**
```yaml
name: Release WhisperKit Plugin

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

env:
  RUST_BACKTRACE: 1

jobs:
  build-and-release:
    runs-on: macos-13
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin
      
      - name: Setup Swift
        run: |
          sudo xcode-select -s /Applications/Xcode_15.1.app
          swift --version
      
      - name: Download WhisperKit Model
        run: |
          brew install whisperkit-cli
          ./scripts/download_model.sh
      
      - name: Build Plugin
        run: ./scripts/build.sh
      
      - name: Run Tests
        run: |
          cargo test
          cd swift && swift test
      
      - name: Package Plugin
        run: |
          mkdir -p dist
          cp target/release/libtauri_plugin_whisperkit.dylib dist/
          cp -r swift/.build/release/WhisperKitBridge.framework dist/
          cp -r swift/Resources dist/
          tar -czf tauri-plugin-whisperkit-macos.tar.gz -C dist .
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: tauri-plugin-whisperkit-macos.tar.gz
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Publish to crates.io
        run: cargo publish --token ${{ secrets.CRATES_TOKEN }}
      
      - name: Publish to NPM
        run: |
          cd guest-js
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### App Integration

**Main app's Cargo.toml:**
```toml
[dependencies]
tauri-plugin-whisperkit = "0.1"
# Or from git:
# tauri-plugin-whisperkit = { git = "https://github.com/yourusername/tauri-plugin-whisperkit" }
```

**src-tauri/src/main.rs:**
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_whisperkit::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**src-tauri/capabilities/default.json:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:default",
    "whisperkit:default",
    "whisperkit:allow-microphone"
  ]
}
```

### Distribution Package

**install.sh:**
```bash
#!/bin/bash
# Installation script for the plugin

INSTALL_DIR="$HOME/.tauri-plugins/whisperkit"
MODEL_DIR="$HOME/Library/Application Support/WhisperKit/Models"

echo "Installing Tauri WhisperKit Plugin..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$MODEL_DIR"

# Copy plugin files
cp -r dist/* "$INSTALL_DIR/"

# Copy model files
cp -r Resources/distil-whisper_distil-large-v3_turbo_600MB "$MODEL_DIR/"

# Set permissions
chmod +x "$INSTALL_DIR"/*.dylib

echo "Installation complete!"
echo "Add the following to your Tauri app's Cargo.toml:"
echo "tauri-plugin-whisperkit = { path = \"$INSTALL_DIR\" }"
```

## Production Considerations

### Performance Monitoring

```rust
// Add performance metrics
use std::time::Instant;

#[tauri::command]
pub async fn get_performance_metrics() -> PerformanceMetrics {
    PerformanceMetrics {
        model_load_time_ms: MODEL_LOAD_TIME.load(Ordering::Relaxed),
        average_transcription_speed: TRANSCRIPTION_SPEED.load(Ordering::Relaxed),
        memory_usage_mb: get_memory_usage(),
    }
}
```

### Security Best Practices

1. **Model Integrity**: Verify model checksums before loading
2. **Audio Privacy**: Process audio locally, never transmit
3. **Permission Checks**: Validate microphone permissions before access
4. **Sandboxing**: Use macOS app sandbox for App Store distribution

### Troubleshooting Guide

Common issues and solutions:

1. **Model Loading Failures**
   - Verify model path in bundle
   - Check file permissions
   - Ensure sufficient memory

2. **Audio Permission Denied**
   - Request permission explicitly
   - Check Info.plist descriptions
   - Reset privacy settings if needed

3. **Performance Issues**
   - Enable Neural Engine
   - Adjust chunk size
   - Monitor memory usage

This comprehensive documentation provides a complete guide for building a production-ready Tauri plugin that integrates WhisperKit for on-device speech recognition on macOS, with practical workarounds for current architectural limitations and modern best practices for 2025.