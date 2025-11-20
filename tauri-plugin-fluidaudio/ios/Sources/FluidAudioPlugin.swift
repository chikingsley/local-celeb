import SwiftRs
import Tauri
import FluidAudio
import AVFoundation
import CoreML

// MARK: - Request/Response Models

class TranscribeFileArgs: Decodable {
    let path: String
    let modelVersion: String?
    let withDiarization: Bool?
    let clusteringThreshold: Double?
}

class LoadModelArgs: Decodable {
    let modelVersion: String?
    let loadDiarizer: Bool?
}

class DiarizeFileArgs: Decodable {
    let path: String
    let clusteringThreshold: Double?
}

// MARK: - Response Models

struct TranscriptionResponse: Encodable {
    let text: String
    let confidence: Double?
    let segments: [TranscriptionSegment]?
    let language: String?
}

struct TranscriptionSegment: Encodable {
    let text: String
    let startTime: Double
    let endTime: Double
    let speakerId: String?
    let confidence: Double?
}

struct DiarizationResponse: Encodable {
    let segments: [DiarizationSegment]
    let speakerCount: Int
}

struct DiarizationSegment: Encodable {
    let speakerId: String
    let startTime: Double
    let endTime: Double
}

// MARK: - FluidAudio Manager

class FluidAudioManager {
    static let shared = FluidAudioManager()

    private var asrManager: AsrManager?
    private var asrModels: AsrModels?
    private var diarizerManager: OfflineDiarizerManager?
    private var diarizerModels: OfflineDiarizerModels?
    private var currentModelVersion: AsrModelVersion?
    private var isAsrReady = false
    private var isDiarizerReady = false

    private init() {}

    // MARK: - Model Management

    func loadModels(version: AsrModelVersion = .v3, withDiarization: Bool = false) async throws {
        // Load ASR models if not already loaded for this version
        if asrModels == nil || currentModelVersion != version {
            asrModels = try await AsrModels.downloadAndLoad(version: version)
            asrManager = AsrManager(config: .default)
            try await asrManager?.initialize(models: asrModels!)
            currentModelVersion = version
            isAsrReady = true
        }

        // Load diarization models if requested and not already loaded
        if withDiarization && !isDiarizerReady {
            let config = OfflineDiarizerConfig()
            diarizerManager = OfflineDiarizerManager(config: config)
            diarizerModels = try await OfflineDiarizerModels.downloadAndLoad()
            try await diarizerManager?.initialize(models: diarizerModels!)
            isDiarizerReady = true
        }
    }

    func unloadModels() {
        asrManager = nil
        asrModels = nil
        diarizerManager = nil
        diarizerModels = nil
        currentModelVersion = nil
        isAsrReady = false
        isDiarizerReady = false
    }

    // MARK: - Transcription

    func transcribeAudioFile(at path: String, withDiarization: Bool = false, clusteringThreshold: Double = 0.7) async throws -> TranscriptionResponse {
        guard let asrManager = asrManager, isAsrReady else {
            throw FluidAudioError.modelsNotLoaded
        }

        // Convert audio file to URL
        let audioURL = URL(fileURLWithPath: path)

        // Load and convert audio to 16kHz mono Float32
        let samples: [Float]
        do {
            samples = try AudioConverter.resampleAudioFile(path: path)
        } catch {
            throw FluidAudioError.audioProcessingFailed("Failed to convert audio: \(error.localizedDescription)")
        }

        // Transcribe audio
        let asrResult = try await asrManager.transcribe(audioURL, source: .system)

        var segments: [TranscriptionSegment]?

        if withDiarization {
            // Perform speaker diarization if requested
            guard let diarizerManager = diarizerManager, isDiarizerReady else {
                throw FluidAudioError.diarizationNotAvailable
            }

            let diarizationResult = try await diarizerManager.process(audio: samples)

            // Combine transcription with diarization
            segments = buildSegmentsWithSpeakers(
                transcription: asrResult,
                diarization: diarizationResult
            )
        } else {
            // Basic segments without speaker info
            segments = buildBasicSegments(from: asrResult)
        }

        return TranscriptionResponse(
            text: asrResult.text,
            confidence: asrResult.confidence,
            segments: segments,
            language: currentModelVersion == .v2 ? "en" : nil
        )
    }

    // MARK: - Diarization Only

    func diarizeAudioFile(at path: String, clusteringThreshold: Double = 0.7) async throws -> DiarizationResponse {
        guard let diarizerManager = diarizerManager, isDiarizerReady else {
            throw FluidAudioError.diarizationNotAvailable
        }

        // Load and convert audio
        let samples = try AudioConverter.resampleAudioFile(path: path)

        // Perform diarization
        let result = try await diarizerManager.process(audio: samples)

        // Convert to response format
        let segments = result.segments.map { segment in
            DiarizationSegment(
                speakerId: segment.speakerId,
                startTime: segment.startTimeSeconds,
                endTime: segment.endTimeSeconds
            )
        }

        // Count unique speakers
        let speakerCount = Set(result.segments.map { $0.speakerId }).count

        return DiarizationResponse(
            segments: segments,
            speakerCount: speakerCount
        )
    }

    // MARK: - Helper Methods

    private func buildBasicSegments(from asrResult: ASRResult) -> [TranscriptionSegment]? {
        // FluidAudio ASRResult structure may vary - adapt as needed
        // For now, return a single segment for the full transcription
        guard !asrResult.text.isEmpty else { return nil }

        return [
            TranscriptionSegment(
                text: asrResult.text,
                startTime: 0.0,
                endTime: 0.0, // Would need audio duration
                speakerId: nil,
                confidence: asrResult.confidence
            )
        ]
    }

    private func buildSegmentsWithSpeakers(
        transcription: ASRResult,
        diarization: DiarizationResult
    ) -> [TranscriptionSegment] {
        // This is a simplified approach - in production, you'd want
        // more sophisticated alignment between words and speaker segments
        var segments: [TranscriptionSegment] = []

        for diarizationSegment in diarization.segments {
            segments.append(
                TranscriptionSegment(
                    text: transcription.text, // Simplified - would need proper word alignment
                    startTime: diarizationSegment.startTimeSeconds,
                    endTime: diarizationSegment.endTimeSeconds,
                    speakerId: diarizationSegment.speakerId,
                    confidence: transcription.confidence
                )
            )
        }

        return segments
    }

    // MARK: - Utility Methods

    func getAvailableModels() -> [String] {
        return ["v2-english", "v3-multilingual"]
    }

    func getCurrentModel() -> String? {
        switch currentModelVersion {
        case .v2:
            return "v2-english"
        case .v3:
            return "v3-multilingual"
        case .none:
            return nil
        }
    }

    func isReady() -> Bool {
        return isAsrReady
    }

    func isDiarizerLoaded() -> Bool {
        return isDiarizerReady
    }
}

// MARK: - Error Handling

enum FluidAudioError: Error, LocalizedError {
    case modelsNotLoaded
    case diarizationNotAvailable
    case audioProcessingFailed(String)
    case transcriptionFailed(String)

    var errorDescription: String? {
        switch self {
        case .modelsNotLoaded:
            return "ASR models are not loaded. Please load models first."
        case .diarizationNotAvailable:
            return "Diarization models are not loaded. Please load with diarization enabled."
        case .audioProcessingFailed(let message):
            return "Audio processing failed: \(message)"
        case .transcriptionFailed(let message):
            return "Transcription failed: \(message)"
        }
    }
}

// MARK: - Plugin Implementation

class FluidAudioPlugin: Plugin {
    private let manager = FluidAudioManager.shared

    @objc public func loadModel(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(LoadModelArgs.self)

        Task {
            do {
                let version: AsrModelVersion = args.modelVersion == "v2" ? .v2 : .v3
                let withDiarization = args.loadDiarizer ?? false

                try await manager.loadModels(
                    version: version,
                    withDiarization: withDiarization
                )

                invoke.resolve([
                    "success": true,
                    "model": manager.getCurrentModel() ?? "",
                    "diarizationLoaded": manager.isDiarizerLoaded()
                ])
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }

    @objc public func unloadModel(_ invoke: Invoke) throws {
        manager.unloadModels()
        invoke.resolve(["success": true])
    }

    @objc public func transcribeFile(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(TranscribeFileArgs.self)

        Task {
            do {
                // Load models if needed
                let version: AsrModelVersion = args.modelVersion == "v2" ? .v2 : .v3
                let withDiarization = args.withDiarization ?? false

                if !manager.isReady() || (withDiarization && !manager.isDiarizerLoaded()) {
                    try await manager.loadModels(
                        version: version,
                        withDiarization: withDiarization
                    )
                }

                // Transcribe
                let result = try await manager.transcribeAudioFile(
                    at: args.path,
                    withDiarization: withDiarization,
                    clusteringThreshold: args.clusteringThreshold ?? 0.7
                )

                // Convert to dictionary
                let encoder = JSONEncoder()
                let resultData = try encoder.encode(result)
                let resultDict = try JSONSerialization.jsonObject(with: resultData) as? [String: Any] ?? [:]

                invoke.resolve(resultDict)
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }

    @objc public func diarizeFile(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(DiarizeFileArgs.self)

        Task {
            do {
                // Ensure diarizer is loaded
                if !manager.isDiarizerLoaded() {
                    try await manager.loadModels(withDiarization: true)
                }

                // Diarize
                let result = try await manager.diarizeAudioFile(
                    at: args.path,
                    clusteringThreshold: args.clusteringThreshold ?? 0.7
                )

                // Convert to dictionary
                let encoder = JSONEncoder()
                let resultData = try encoder.encode(result)
                let resultDict = try JSONSerialization.jsonObject(with: resultData) as? [String: Any] ?? [:]

                invoke.resolve(resultDict)
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }

    @objc public func transcribeAudio(_ invoke: Invoke) throws {
        // For base64 audio data - similar to transcribeFile but with data handling
        invoke.reject("Not yet implemented - use transcribeFile instead")
    }

    @objc public func getAvailableModels(_ invoke: Invoke) throws {
        let models = manager.getAvailableModels()
        invoke.resolve(["models": models])
    }

    @objc public func getCurrentModel(_ invoke: Invoke) throws {
        invoke.resolve(["model": manager.getCurrentModel() ?? NSNull()])
    }

    @objc public func isReady(_ invoke: Invoke) throws {
        invoke.resolve([
            "ready": manager.isReady(),
            "diarizationReady": manager.isDiarizerLoaded()
        ])
    }
}

@_cdecl("init_plugin_fluidaudio")
func initPlugin() -> Plugin {
    return FluidAudioPlugin()
}
