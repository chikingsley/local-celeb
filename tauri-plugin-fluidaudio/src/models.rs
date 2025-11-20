use serde::{Deserialize, Serialize};

// Load Model
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadModelRequest {
    pub model_version: Option<String>, // "v2" or "v3"
    pub load_diarizer: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadModelResponse {
    pub success: bool,
    pub model: String,
    pub diarization_loaded: bool,
}

// Transcribe File
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeFileRequest {
    pub path: String,
    pub model_version: Option<String>, // "v2" or "v3"
    pub with_diarization: Option<bool>,
    pub clustering_threshold: Option<f64>,
}

// Transcribe Audio (for future base64 support)
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeAudioRequest {
    pub audio_data: String, // Base64 encoded
    pub model_version: Option<String>,
    pub with_diarization: Option<bool>,
}

// Diarize File
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiarizeFileRequest {
    pub path: String,
    pub clustering_threshold: Option<f64>,
}

// Transcription Response
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResponse {
    pub text: String,
    pub confidence: Option<f64>,
    pub segments: Option<Vec<TranscriptionSegment>>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    pub text: String,
    pub start_time: f64,
    pub end_time: f64,
    pub speaker_id: Option<String>,
    pub confidence: Option<f64>,
}

// Diarization Response
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiarizationResponse {
    pub segments: Vec<DiarizationSegment>,
    pub speaker_count: i32,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiarizationSegment {
    pub speaker_id: String,
    pub start_time: f64,
    pub end_time: f64,
}

// Available Models
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableModelsResponse {
    pub models: Vec<String>,
}

// Current Model
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentModelResponse {
    pub model: Option<String>,
}

// Ready Status
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadyResponse {
    pub ready: bool,
    pub diarization_ready: bool,
}

// Generic Success Response
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub success: bool,
}
