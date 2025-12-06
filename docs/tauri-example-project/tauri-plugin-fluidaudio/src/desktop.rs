use serde::de::DeserializeOwned;
use swift_rs::{swift, SRString};
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;
use crate::Error;

// Import Swift functions via swift-rs
// Simple synchronous functions
swift!(fn fluidaudio_is_ready() -> bool);
swift!(fn fluidaudio_is_diarizer_ready() -> bool);
swift!(fn fluidaudio_get_current_model() -> SRString);
swift!(fn fluidaudio_get_available_models() -> SRString);
swift!(fn fluidaudio_unload_models());

// Blocking async functions (Swift uses semaphores internally)
swift!(fn fluidaudio_load_models_sync(model_version: i32, with_diarization: bool) -> SRString);
swift!(fn fluidaudio_transcribe_file_sync(
    path: &SRString,
    model_version: i32,
    with_diarization: bool,
    clustering_threshold: f64
) -> SRString);
swift!(fn fluidaudio_diarize_file_sync(
    path: &SRString,
    clustering_threshold: f64
) -> SRString);

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Fluidaudio<R>> {
    Ok(Fluidaudio(app.clone()))
}

/// Access to the FluidAudio APIs via Swift FFI.
pub struct Fluidaudio<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Fluidaudio<R> {
    pub fn load_model(&self, payload: LoadModelRequest) -> crate::Result<LoadModelResponse> {
        let model_version = match payload.model_version.as_deref() {
            Some("v2") => 0i32,
            _ => 1i32, // Default to v3
        };
        let with_diarization = payload.load_diarizer.unwrap_or(false);

        let result = unsafe { fluidaudio_load_models_sync(model_version, with_diarization) };
        let result_str = result.as_str();

        // Check for error
        let json: serde_json::Value =
            serde_json::from_str(result_str).map_err(|e| Error::String(e.to_string()))?;

        if let Some(error) = json.get("error") {
            return Err(Error::String(error.as_str().unwrap_or("Unknown error").to_string()));
        }

        Ok(LoadModelResponse {
            success: json["success"].as_bool().unwrap_or(false),
            model: json["model"].as_str().unwrap_or("").to_string(),
            diarization_loaded: json["diarizationLoaded"].as_bool().unwrap_or(false),
        })
    }

    pub fn unload_model(&self) -> crate::Result<SuccessResponse> {
        unsafe {
            fluidaudio_unload_models();
        }
        Ok(SuccessResponse { success: true })
    }

    pub fn transcribe_file(
        &self,
        payload: TranscribeFileRequest,
    ) -> crate::Result<TranscriptionResponse> {
        let path = SRString::from(payload.path.as_str());
        let model_version = match payload.model_version.as_deref() {
            Some("v2") => 0i32,
            _ => 1i32,
        };
        let with_diarization = payload.with_diarization.unwrap_or(false);
        let clustering_threshold = payload.clustering_threshold.unwrap_or(0.7);

        let result = unsafe {
            fluidaudio_transcribe_file_sync(
                &path,
                model_version,
                with_diarization,
                clustering_threshold,
            )
        };
        let result_str = result.as_str();

        // Check for error
        let json: serde_json::Value =
            serde_json::from_str(result_str).map_err(|e| Error::String(e.to_string()))?;

        if let Some(error) = json.get("error") {
            return Err(Error::String(error.as_str().unwrap_or("Unknown error").to_string()));
        }

        // Parse as TranscriptionResponse
        let response: TranscriptionResponse =
            serde_json::from_str(result_str).map_err(|e| Error::String(e.to_string()))?;

        Ok(response)
    }

    pub fn transcribe_audio(
        &self,
        _payload: TranscribeAudioRequest,
    ) -> crate::Result<TranscriptionResponse> {
        Err(Error::String(
            "Base64 audio transcription not yet implemented".into(),
        ))
    }

    pub fn diarize_file(&self, payload: DiarizeFileRequest) -> crate::Result<DiarizationResponse> {
        let path = SRString::from(payload.path.as_str());
        let clustering_threshold = payload.clustering_threshold.unwrap_or(0.7);

        let result = unsafe { fluidaudio_diarize_file_sync(&path, clustering_threshold) };
        let result_str = result.as_str();

        // Check for error
        let json: serde_json::Value =
            serde_json::from_str(result_str).map_err(|e| Error::String(e.to_string()))?;

        if let Some(error) = json.get("error") {
            return Err(Error::String(error.as_str().unwrap_or("Unknown error").to_string()));
        }

        // Parse as DiarizationResponse
        let response: DiarizationResponse =
            serde_json::from_str(result_str).map_err(|e| Error::String(e.to_string()))?;

        Ok(response)
    }

    pub fn get_available_models(&self) -> crate::Result<AvailableModelsResponse> {
        let result = unsafe { fluidaudio_get_available_models() };
        let json_str = result.as_str();

        let models: Vec<String> =
            serde_json::from_str(json_str).map_err(|e| Error::String(e.to_string()))?;

        Ok(AvailableModelsResponse { models })
    }

    pub fn get_current_model(&self) -> crate::Result<CurrentModelResponse> {
        let result = unsafe { fluidaudio_get_current_model() };
        let model_str = result.as_str();

        let model = if model_str.is_empty() {
            None
        } else {
            Some(model_str.to_string())
        };

        Ok(CurrentModelResponse { model })
    }

    pub fn is_ready(&self) -> crate::Result<ReadyResponse> {
        let ready = unsafe { fluidaudio_is_ready() };
        let diarization_ready = unsafe { fluidaudio_is_diarizer_ready() };

        Ok(ReadyResponse {
            ready,
            diarization_ready,
        })
    }
}
