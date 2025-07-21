# WhisperKit Tauri Plugin Integration Tasks

## Overview
This document outlines the tasks needed to integrate WhisperKit into our Tauri v2 application following the plugin architecture described in `tauri-plugin-swift.md`.

## Current Setup Analysis
- **Tauri Version**: v2.5.1 (Compatible ✅)
- **Existing Plugins**: tauri-plugin-opener
- **Model Available**: Parakeet model in `argmaxinc/` directory
- **WhisperKit Repo**: Cloned locally for reference

## Task List

### Phase 1: Plugin Structure Setup

- [ ] **1.1 Create Plugin Directory Structure**
  ```
  mkdir -p src-tauri/plugins/whisperkit/{src,swift,permissions,guest-js}
  ```
  - Create the base plugin structure as outlined in the documentation
  - Set up proper directory hierarchy

- [ ] **1.2 Initialize Plugin Cargo.toml**
  - Create `src-tauri/plugins/whisperkit/Cargo.toml`
  - Add dependencies: tauri, serde, swift-bridge, tokio
  - Configure lib type for FFI

- [ ] **1.3 Create Swift Package**
  - Create `src-tauri/plugins/whisperkit/swift/Package.swift`
  - Add WhisperKit dependency from local clone
  - Configure for macOS 14.0+ (matches our requirements)

### Phase 2: Swift-Rust Bridge Implementation

- [ ] **2.1 Define Swift Bridge Interface**
  - Create `src/swift_bridge.rs` with FFI definitions
  - Define data structures for transcription results
  - Set up callback mechanisms

- [ ] **2.2 Implement WhisperKitBridge.swift**
  - Create Swift wrapper around WhisperKit
  - Implement transcribe_file method
  - Add real-time transcription support
  - Handle model initialization

- [ ] **2.3 Create Rust Plugin Core**
  - Implement `src/lib.rs` with plugin initialization
  - Create command handlers in `src/commands.rs`
  - Set up error handling

### Phase 3: Model Integration

- [ ] **3.1 Configure Model Path**
  - Update WhisperKitBridge to use our local models
  - Test with Parakeet model from `argmaxinc/` directory
  - Fallback to WhisperKit default models if needed

- [ ] **3.2 Create Model Loading Logic**
  - Implement model detection and loading
  - Add model validation
  - Set up proper error handling for missing models

### Phase 4: Build System Configuration

- [ ] **4.1 Update Main Project build.rs**
  - Add swift-bridge-build configuration
  - Link Swift framework
  - Configure model resources

- [ ] **4.2 Create Build Scripts**
  - Create `scripts/build-whisperkit-plugin.sh`
  - Add universal binary support for arm64/x86_64
  - Integrate with existing build process

- [ ] **4.3 Update Tauri Configuration**
  - Add plugin to main `Cargo.toml`
  - Register in `src/lib.rs`
  - Update `tauri.conf.json` for bundle resources

### Phase 5: Frontend Integration

- [ ] **5.1 Create TypeScript API**
  - Create `guest-js/index.ts` with TypeScript definitions
  - Implement WhisperKitPlugin class
  - Add event listeners for streaming

- [ ] **5.2 Update React Components**
  - Integrate with existing TranscriptionEditor components
  - Replace placeholder transcription with WhisperKit
  - Add progress indicators

- [ ] **5.3 Connect to Audio Player**
  - Link transcription results to AudioPlayer component
  - Implement word-level timing display
  - Add segment navigation

### Phase 6: Permissions and Security

- [ ] **6.1 Configure Plugin Permissions**
  - Create `permissions/default.toml`
  - Define allowed commands
  - Set up microphone permissions

- [ ] **6.2 Update Entitlements**
  - Create/update `Entitlements.plist`
  - Add audio input permissions
  - Configure Core ML entitlements

- [ ] **6.3 Update Capabilities**
  - Add to `capabilities/default.json`
  - Include whisperkit permissions
  - Test permission flow

### Phase 7: Testing and Validation

- [ ] **7.1 Create Test Audio Files**
  - Prepare sample audio files for testing
  - Test various formats (mp3, wav, m4a)
  - Include different languages

- [ ] **7.2 Implement Basic Tests**
  - Test file transcription
  - Test real-time transcription
  - Verify word-level timing accuracy

- [ ] **7.3 Integration Testing**
  - Run full app with transcription
  - Test UI updates and progress
  - Verify memory usage and performance

### Phase 8: Optimization and Polish

- [ ] **8.1 Performance Optimization**
  - Enable Neural Engine support
  - Optimize chunk sizes
  - Implement streaming for large files

- [ ] **8.2 Error Handling**
  - Add comprehensive error messages
  - Implement retry logic
  - Add fallback mechanisms

- [ ] **8.3 UI/UX Improvements**
  - Add transcription status indicators
  - Implement cancel functionality
  - Show model loading progress

## Implementation Order

1. **Start with**: Phase 1 & 2 (Basic structure and bridge)
2. **Then**: Phase 3 & 4 (Model integration and build)
3. **Next**: Phase 5 & 6 (Frontend and permissions)
4. **Finally**: Phase 7 & 8 (Testing and optimization)

## Key Differences from Documentation

1. **Model**: We'll try to use the Parakeet model first, then fall back to WhisperKit defaults
2. **Tauri Version**: We're on v2.5.1 (newer than doc examples)
3. **Build Tool**: Using Bun instead of npm
4. **Existing Structure**: We have a working Tauri app, not starting from scratch

## Success Criteria

- [ ] Can transcribe audio files through Tauri commands
- [ ] Real-time transcription works with microphone
- [ ] Word-level timing is accurate
- [ ] Integration with existing UI components
- [ ] Performance is acceptable on M1/M2 Macs
- [ ] No memory leaks or crashes

## Notes

- The Parakeet model might not be directly compatible with WhisperKit
- We may need to use WhisperKit's own models initially
- Swift-Rust bridge adds complexity but is necessary for WhisperKit
- Consider starting with file transcription before real-time