import SwiftRs
import Tauri
import WhisperKit
import AVFoundation
import CoreML

// MARK: - Request/Response Models

class TranscribeFileArgs: Decodable {
    let path: String
    let modelName: String?
    let language: String?
    let task: String?
}

class TranscribeAudioArgs: Decodable {
    let audioData: String // Base64 encoded audio data
    let modelName: String?
    let language: String?
    let task: String?
}

class LoadModelArgs: Decodable {
    let modelName: String
    let downloadIfNeeded: Bool?
}

class TranscriptionResponse: Encodable {
    let text: String
    let segments: [TranscriptionSegment]?
    let language: String?
    let timings: TranscriptionTimings?
}

class TranscriptionTimings: Encodable {
    let fullPipeline: Double
    let tokensPerSecond: Double
    let realTimeFactor: Double
    let firstTokenTime: Double
}

// MARK: - WhisperKit Manager

class WhisperKitManager {
    static let shared = WhisperKitManager()
    
    private var whisperKit: WhisperKit?
    private var currentModel: String?
    private var isModelLoaded = false
    
    private init() {}
    
    // MARK: - Model Management
    
    func loadModel(_ modelName: String, downloadIfNeeded: Bool = true) async throws {
        // Skip if already loaded
        if currentModel == modelName && isModelLoaded {
            return
        }
        
        // Configure compute options
        let computeOptions = ModelComputeOptions(
            audioEncoderCompute: .cpuAndNeuralEngine,
            textDecoderCompute: .cpuAndNeuralEngine
        )
        
        // Initialize WhisperKit
        let config = WhisperKitConfig(
            computeOptions: computeOptions,
            verbose: true,
            logLevel: .info,
            prewarm: false,
            load: false,
            download: false
        )
        
        whisperKit = try await WhisperKit(config)
        
        guard let whisperKit = whisperKit else {
            throw WhisperError.modelsUnavailable()
        }
        
        // Download model if needed
        var modelFolder: URL?
        if downloadIfNeeded {
            modelFolder = try await WhisperKit.download(
                variant: modelName,
                from: "argmaxinc/whisperkit-coreml"
            )
        } else {
            // Check if model exists locally
            if let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                let localModelPath = documentsURL
                    .appendingPathComponent("huggingface/models/argmaxinc/whisperkit-coreml")
                    .appendingPathComponent(modelName)
                
                if FileManager.default.fileExists(atPath: localModelPath.path) {
                    modelFolder = localModelPath
                }
            }
        }
        
        guard let folder = modelFolder else {
            throw WhisperError.modelsUnavailable()
        }
        
        whisperKit.modelFolder = folder
        
        // Prewarm and load models
        try await whisperKit.prewarmModels()
        try await whisperKit.loadModels()
        
        currentModel = modelName
        isModelLoaded = true
    }
    
    func unloadModel() {
        whisperKit = nil
        currentModel = nil
        isModelLoaded = false
    }
    
    // MARK: - Transcription
    
    func transcribeAudioFile(at path: String, options: DecodingOptions? = nil) async throws -> TranscriptionResponse {
        guard let whisperKit = whisperKit, isModelLoaded else {
            throw WhisperError.modelsUnavailable()
        }
        
        // Load audio file
        let audioSamples = try await Task {
            try autoreleasepool {
                try AudioProcessor.loadAudioAsFloatArray(fromPath: path)
            }
        }.value
        
        return try await transcribeAudioSamples(audioSamples, options: options)
    }
    
    func transcribeAudioData(_ base64Data: String, options: DecodingOptions? = nil) async throws -> TranscriptionResponse {
        guard let whisperKit = whisperKit, isModelLoaded else {
            throw WhisperError.modelsUnavailable()
        }
        
        // Decode base64 to Data
        guard let audioData = Data(base64Encoded: base64Data) else {
            throw WhisperError.audioProcessingFailed("Invalid base64 audio data")
        }
        
        // Save to temporary file
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("wav")
        
        try audioData.write(to: tempURL)
        defer { try? FileManager.default.removeItem(at: tempURL) }
        
        // Load and transcribe
        let audioSamples = try await Task {
            try autoreleasepool {
                try AudioProcessor.loadAudioAsFloatArray(fromPath: tempURL.path)
            }
        }.value
        
        return try await transcribeAudioSamples(audioSamples, options: options)
    }
    
    private func transcribeAudioSamples(_ samples: [Float], options: DecodingOptions? = nil) async throws -> TranscriptionResponse {
        guard let whisperKit = whisperKit else {
            throw WhisperError.modelsUnavailable()
        }
        
        let decodingOptions = options ?? DecodingOptions(
            verbose: false,
            task: .transcribe,
            language: "en",
            temperature: 0.0,
            temperatureFallbackCount: 4,
            sampleLength: 224,
            usePrefillPrompt: true,
            usePrefillCache: true,
            skipSpecialTokens: true,
            withoutTimestamps: false,
            wordTimestamps: true,
            concurrentWorkerCount: 4,
            chunkingStrategy: .vad
        )
        
        let results = try await whisperKit.transcribe(
            audioArray: samples,
            decodeOptions: decodingOptions
        )
        
        // Merge results if multiple
        let mergedResult = TranscriptionUtilities.mergeTranscriptionResults(results)
        
        // Build response
        let response = TranscriptionResponse(
            text: mergedResult.text,
            segments: mergedResult.segments,
            language: mergedResult.language,
            timings: mergedResult.timings.map { timings in
                TranscriptionTimings(
                    fullPipeline: timings.fullPipeline,
                    tokensPerSecond: timings.tokensPerSecond,
                    realTimeFactor: timings.realTimeFactor,
                    firstTokenTime: timings.firstTokenTime
                )
            }
        )
        
        return response
    }
    
    // MARK: - Utility Methods
    
    func getAvailableModels() -> [String] {
        return WhisperKit.recommendedModels().supported
    }
    
    func getCurrentModel() -> String? {
        return currentModel
    }
    
    func isReady() -> Bool {
        return isModelLoaded && whisperKit != nil
    }
}

// MARK: - Plugin Implementation

class WhisperKitPlugin: Plugin {
    private let manager = WhisperKitManager.shared
    
    @objc public func loadModel(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(LoadModelArgs.self)
        
        Task {
            do {
                try await manager.loadModel(
                    args.modelName,
                    downloadIfNeeded: args.downloadIfNeeded ?? true
                )
                invoke.resolve(["success": true, "model": args.modelName])
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }
    
    @objc public func unloadModel(_ invoke: Invoke) throws {
        manager.unloadModel()
        invoke.resolve(["success": true])
    }
    
    @objc public func transcribeFile(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(TranscribeFileArgs.self)
        
        Task {
            do {
                // Load model if specified and different
                if let modelName = args.modelName {
                    try await manager.loadModel(modelName)
                }
                
                // Ensure model is loaded
                guard manager.isReady() else {
                    invoke.reject("No model loaded. Please load a model first.")
                    return
                }
                
                // Build decoding options
                var options = DecodingOptions()
                if let language = args.language {
                    options.language = language
                }
                if let task = args.task {
                    options.task = task == "translate" ? .translate : .transcribe
                }
                
                // Transcribe
                let result = try await manager.transcribeAudioFile(
                    at: args.path,
                    options: options
                )
                
                // Convert to dictionary for response
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
        let args = try invoke.parseArgs(TranscribeAudioArgs.self)
        
        Task {
            do {
                // Load model if specified
                if let modelName = args.modelName {
                    try await manager.loadModel(modelName)
                }
                
                // Ensure model is loaded
                guard manager.isReady() else {
                    invoke.reject("No model loaded. Please load a model first.")
                    return
                }
                
                // Build decoding options
                var options = DecodingOptions()
                if let language = args.language {
                    options.language = language
                }
                if let task = args.task {
                    options.task = task == "translate" ? .translate : .transcribe
                }
                
                // Transcribe
                let result = try await manager.transcribeAudioData(
                    args.audioData,
                    options: options
                )
                
                // Convert to dictionary for response
                let encoder = JSONEncoder()
                let resultData = try encoder.encode(result)
                let resultDict = try JSONSerialization.jsonObject(with: resultData) as? [String: Any] ?? [:]
                
                invoke.resolve(resultDict)
            } catch {
                invoke.reject(error.localizedDescription)
            }
        }
    }
    
    @objc public func getAvailableModels(_ invoke: Invoke) throws {
        let models = manager.getAvailableModels()
        invoke.resolve(["models": models])
    }
    
    @objc public func getCurrentModel(_ invoke: Invoke) throws {
        invoke.resolve(["model": manager.getCurrentModel() ?? NSNull()])
    }
    
    @objc public func isReady(_ invoke: Invoke) throws {
        invoke.resolve(["ready": manager.isReady()])
    }
}

@_cdecl("init_plugin_whisperkit")
func initPlugin() -> Plugin {
    return WhisperKitPlugin()
}