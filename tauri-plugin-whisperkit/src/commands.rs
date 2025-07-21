use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::WhisperkitExt;

#[command]
pub(crate) async fn load_model<R: Runtime>(
    app: AppHandle<R>,
    payload: LoadModelRequest,
) -> Result<LoadModelResponse> {
    app.whisperkit().load_model(payload)
}

#[command]
pub(crate) async fn unload_model<R: Runtime>(
    app: AppHandle<R>,
) -> Result<SuccessResponse> {
    app.whisperkit().unload_model()
}

#[command]
pub(crate) async fn transcribe_file<R: Runtime>(
    app: AppHandle<R>,
    payload: TranscribeFileRequest,
) -> Result<TranscriptionResponse> {
    app.whisperkit().transcribe_file(payload)
}

#[command]
pub(crate) async fn transcribe_audio<R: Runtime>(
    app: AppHandle<R>,
    payload: TranscribeAudioRequest,
) -> Result<TranscriptionResponse> {
    app.whisperkit().transcribe_audio(payload)
}

#[command]
pub(crate) async fn get_available_models<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AvailableModelsResponse> {
    app.whisperkit().get_available_models()
}

#[command]
pub(crate) async fn get_current_model<R: Runtime>(
    app: AppHandle<R>,
) -> Result<CurrentModelResponse> {
    app.whisperkit().get_current_model()
}

#[command]
pub(crate) async fn is_ready<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ReadyResponse> {
    app.whisperkit().is_ready()
}