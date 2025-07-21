use serde::{Deserialize, Serialize};

// Load Model
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadModelRequest {
    pub model_name: String,
    pub download_if_needed: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadModelResponse {
    pub success: bool,
    pub model: String,
}

// Transcribe File
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeFileRequest {
    pub path: String,
    pub model_name: Option<String>,
    pub language: Option<String>,
    pub task: Option<String>,
}

// Transcribe Audio
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeAudioRequest {
    pub audio_data: String, // Base64 encoded
    pub model_name: Option<String>,
    pub language: Option<String>,
    pub task: Option<String>,
}

// Transcription Response
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResponse {
    pub text: String,
    pub segments: Option<Vec<TranscriptionSegment>>,
    pub language: Option<String>,
    pub timings: Option<TranscriptionTimings>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    pub id: i32,
    pub seek: i32,
    pub start: f32,
    pub end: f32,
    pub text: String,
    pub tokens: Vec<i32>,
    pub temperature: f32,
    pub avg_logprob: f32,
    pub compression_ratio: f32,
    pub no_speech_prob: f32,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionTimings {
    pub full_pipeline: f64,
    pub tokens_per_second: f64,
    pub real_time_factor: f64,
    pub first_token_time: f64,
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
}

// Generic Success Response
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub success: bool,
}