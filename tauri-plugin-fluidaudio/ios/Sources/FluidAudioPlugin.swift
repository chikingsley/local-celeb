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
    private var audioConverter: AudioConverter?
    private var currentModelVersion: AsrModelVersion?
    private var isAsrReady = false
    private var isDiarizerReady = false

    private init() {
        // Initialize audio converter once
        audioConverter = AudioConverter()
    }

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
            // prepareModels() downloads and initializes models internally
            try await diarizerManager?.prepareModels()
            isDiarizerReady = true
        }
    }

    func unloadModels() {
        asrManager = nil
        asrModels = nil
        diarizerManager = nil
        currentModelVersion = nil
        isAsrReady = false
        isDiarizerReady = false
    }

    // MARK: - Transcription

    func transcribeAudioFile(at path: String, withDiarization: Bool = false, clusteringThreshold: Double = 0.7) async throws -> TranscriptionResponse {
        guard let asrManager = asrManager, isAsrReady else {
            throw FluidAudioError.modelsNotLoaded
        }

        guard let audioConverter = audioConverter else {
            throw FluidAudioError.audioProcessingFailed("Audio converter not initialized")
        }

        // Load and convert audio to 16kHz mono Float32
        let samples: [Float]
        do {
            samples = try audioConverter.resampleAudioFile(path: path)
        } catch {
            throw FluidAudioError.audioProcessingFailed("Failed to convert audio: \(error.localizedDescription)")
        }

        // Transcribe audio using samples
        let asrResult = try await asrManager.transcribe(samples)

        // Extract word timing if available from FluidAudio result
        // FluidAudio's TranscriptionResult may have .words property
        var wordTimings: [WordTiming]? = nil
        // Note: Uncomment and adjust if FluidAudio provides word-level timing
        // if let words = asrResult.words {
        //     wordTimings = words.map { WordTiming(word: $0.word, start: $0.start, end: $0.end) }
        // }

        var segments: [TranscriptionSegment]?

        if withDiarization {
            // Perform speaker diarization if requested
            guard let diarizerManager = diarizerManager, isDiarizerReady else {
                throw FluidAudioError.diarizationNotAvailable
            }

            let diarizationResult = try await diarizerManager.process(audio: samples)

            // Combine transcription with diarization
            segments = buildSegmentsWithSpeakers(
                text: asrResult.text,
                words: wordTimings,
                diarization: diarizationResult
            )
        } else {
            // Basic segments without speaker info
            segments = buildBasicSegments(text: asrResult.text, words: wordTimings)
        }

        return TranscriptionResponse(
            text: asrResult.text,
            confidence: nil, // FluidAudio may not provide overall confidence
            segments: segments,
            language: currentModelVersion == .v2 ? "en" : nil
        )
    }

    // MARK: - Diarization Only

    func diarizeAudioFile(at path: String, clusteringThreshold: Double = 0.7) async throws -> DiarizationResponse {
        guard let diarizerManager = diarizerManager, isDiarizerReady else {
            throw FluidAudioError.diarizationNotAvailable
        }

        guard let audioConverter = audioConverter else {
            throw FluidAudioError.audioProcessingFailed("Audio converter not initialized")
        }

        // Load and convert audio
        let samples = try audioConverter.resampleAudioFile(path: path)

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

    /// Build basic segments from ASR result (no diarization)
    /// Uses FluidAudio's TranscriptionResult which has .text and optionally .words
    private func buildBasicSegments(text: String, words: [WordTiming]?) -> [TranscriptionSegment]? {
        guard !text.isEmpty else { return nil }

        // If we have word-level timing, create segments from words
        if let words = words, !words.isEmpty {
            return words.map { word in
                TranscriptionSegment(
                    text: word.word,
                    startTime: word.start,
                    endTime: word.end,
                    speakerId: nil,
                    confidence: nil
                )
            }
        }

        // Otherwise return a single segment with the full text
        return [
            TranscriptionSegment(
                text: text,
                startTime: 0.0,
                endTime: 0.0,
                speakerId: nil,
                confidence: nil
            )
        ]
    }

    /// Build segments with speaker attribution by aligning words with diarization
    private func buildSegmentsWithSpeakers(
        text: String,
        words: [WordTiming]?,
        diarization: DiarizationResult
    ) -> [TranscriptionSegment] {
        var segments: [TranscriptionSegment] = []

        // If we have word-level timing, align words with speaker segments
        if let words = words, !words.isEmpty {
            for diarizationSegment in diarization.segments {
                // Find words that fall within this speaker segment
                let segmentWords = words.filter { word in
                    word.start >= diarizationSegment.startTimeSeconds &&
                    word.end <= diarizationSegment.endTimeSeconds
                }

                if !segmentWords.isEmpty {
                    let segmentText = segmentWords.map { $0.word }.joined(separator: " ")
                    segments.append(
                        TranscriptionSegment(
                            text: segmentText,
                            startTime: diarizationSegment.startTimeSeconds,
                            endTime: diarizationSegment.endTimeSeconds,
                            speakerId: diarizationSegment.speakerId,
                            confidence: nil
                        )
                    )
                }
            }
        } else {
            // No word-level timing - create segments with speaker/timing only
            // Text alignment not possible without word timestamps
            for diarizationSegment in diarization.segments {
                segments.append(
                    TranscriptionSegment(
                        text: "", // Cannot accurately split text without word timing
                        startTime: diarizationSegment.startTimeSeconds,
                        endTime: diarizationSegment.endTimeSeconds,
                        speakerId: diarizationSegment.speakerId,
                        confidence: nil
                    )
                )
            }
        }

        // If no segments were created but we have text, add full text as single segment
        if segments.isEmpty && !text.isEmpty {
            let firstSpeaker = diarization.segments.first?.speakerId
            segments.append(
                TranscriptionSegment(
                    text: text,
                    startTime: diarization.segments.first?.startTimeSeconds ?? 0.0,
                    endTime: diarization.segments.last?.endTimeSeconds ?? 0.0,
                    speakerId: firstSpeaker,
                    confidence: nil
                )
            )
        }

        return segments
    }

    /// Helper struct for word timing (matches FluidAudio's word structure)
    struct WordTiming {
        let word: String
        let start: Double
        let end: Double
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
