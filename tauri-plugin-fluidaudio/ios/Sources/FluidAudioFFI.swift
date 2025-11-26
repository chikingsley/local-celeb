import Foundation
import FluidAudio
import AVFoundation
import CoreML

// MARK: - FFI Bridge for macOS Desktop
// These functions use @_cdecl to be callable from Rust via swift-rs
// Using SRString for string returns (swift-rs compatible)

import SwiftRs

// MARK: - Synchronous Functions

/// Check if models are ready
@_cdecl("fluidaudio_is_ready")
public func fluidaudioIsReady() -> Bool {
    return FluidAudioManager.shared.isReady()
}

/// Check if diarizer is ready
@_cdecl("fluidaudio_is_diarizer_ready")
public func fluidaudioIsDiarizerReady() -> Bool {
    return FluidAudioManager.shared.isDiarizerLoaded()
}

/// Get current model name
@_cdecl("fluidaudio_get_current_model")
public func fluidaudioGetCurrentModel() -> SRString {
    let model = FluidAudioManager.shared.getCurrentModel() ?? ""
    return SRString(model)
}

/// Get available models (returns JSON array string)
@_cdecl("fluidaudio_get_available_models")
public func fluidaudioGetAvailableModels() -> SRString {
    let models = FluidAudioManager.shared.getAvailableModels()
    if let jsonData = try? JSONSerialization.data(withJSONObject: models),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        return SRString(jsonString)
    }
    return SRString("[]")
}

/// Unload all models
@_cdecl("fluidaudio_unload_models")
public func fluidaudioUnloadModels() {
    FluidAudioManager.shared.unloadModels()
}

// MARK: - Blocking Async Functions
// These run async code synchronously using semaphores for FFI compatibility

/// Load models (blocking)
/// Returns JSON: {"success": bool, "model": string, "diarizationLoaded": bool} or {"error": string}
@_cdecl("fluidaudio_load_models_sync")
public func fluidaudioLoadModelsSync(modelVersion: Int32, withDiarization: Bool) -> SRString {
    let semaphore = DispatchSemaphore(value: 0)
    var resultJson = ""

    Task {
        do {
            let version: AsrModelVersion = modelVersion == 0 ? .v2 : .v3
            try await FluidAudioManager.shared.loadModels(
                version: version,
                withDiarization: withDiarization
            )

            let result: [String: Any] = [
                "success": true,
                "model": FluidAudioManager.shared.getCurrentModel() ?? "",
                "diarizationLoaded": FluidAudioManager.shared.isDiarizerLoaded()
            ]

            if let jsonData = try? JSONSerialization.data(withJSONObject: result),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                resultJson = jsonString
            }
        } catch {
            let errorResult: [String: Any] = ["error": error.localizedDescription]
            if let jsonData = try? JSONSerialization.data(withJSONObject: errorResult),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                resultJson = jsonString
            }
        }
        semaphore.signal()
    }

    semaphore.wait()
    return SRString(resultJson)
}

/// Transcribe audio file (blocking)
/// Returns JSON TranscriptionResponse or {"error": string}
@_cdecl("fluidaudio_transcribe_file_sync")
public func fluidaudioTranscribeFileSync(
    path: SRString,
    modelVersion: Int32,
    withDiarization: Bool,
    clusteringThreshold: Double
) -> SRString {
    let pathString = path.toString()
    let semaphore = DispatchSemaphore(value: 0)
    var resultJson = ""

    Task {
        do {
            let version: AsrModelVersion = modelVersion == 0 ? .v2 : .v3

            // Load models if needed
            if !FluidAudioManager.shared.isReady() ||
               (withDiarization && !FluidAudioManager.shared.isDiarizerLoaded()) {
                try await FluidAudioManager.shared.loadModels(
                    version: version,
                    withDiarization: withDiarization
                )
            }

            // Transcribe
            print("[FluidAudio.FFI] Starting transcription of: \(pathString)")
            let result = try await FluidAudioManager.shared.transcribeAudioFile(
                at: pathString,
                withDiarization: withDiarization,
                clusteringThreshold: clusteringThreshold
            )
            print("[FluidAudio.FFI] Transcription completed, text length: \(result.text.count)")
            print("[FluidAudio.FFI] Text preview: \(result.text.prefix(300))...")

            // Convert to JSON
            let encoder = JSONEncoder()
            let resultData = try encoder.encode(result)
            if let jsonString = String(data: resultData, encoding: .utf8) {
                resultJson = jsonString
                print("[FluidAudio.FFI] JSON result length: \(jsonString.count) bytes")
            }
        } catch {
            let errorResult: [String: Any] = ["error": error.localizedDescription]
            if let jsonData = try? JSONSerialization.data(withJSONObject: errorResult),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                resultJson = jsonString
            }
        }
        semaphore.signal()
    }

    semaphore.wait()
    return SRString(resultJson)
}

/// Diarize audio file (blocking)
/// Returns JSON DiarizationResponse or {"error": string}
@_cdecl("fluidaudio_diarize_file_sync")
public func fluidaudioDiarizeFileSync(
    path: SRString,
    clusteringThreshold: Double
) -> SRString {
    let pathString = path.toString()
    let semaphore = DispatchSemaphore(value: 0)
    var resultJson = ""

    Task {
        do {
            // Load diarizer if needed
            if !FluidAudioManager.shared.isDiarizerLoaded() {
                try await FluidAudioManager.shared.loadModels(withDiarization: true)
            }

            // Diarize
            let result = try await FluidAudioManager.shared.diarizeAudioFile(
                at: pathString,
                clusteringThreshold: clusteringThreshold
            )

            // Convert to JSON
            let encoder = JSONEncoder()
            let resultData = try encoder.encode(result)
            if let jsonString = String(data: resultData, encoding: .utf8) {
                resultJson = jsonString
            }
        } catch {
            let errorResult: [String: Any] = ["error": error.localizedDescription]
            if let jsonData = try? JSONSerialization.data(withJSONObject: errorResult),
               let jsonString = String(data: jsonData, encoding: .utf8) {
                resultJson = jsonString
            }
        }
        semaphore.signal()
    }

    semaphore.wait()
    return SRString(resultJson)
}
