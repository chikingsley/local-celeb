use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::FluidaudioExt;

#[command]
pub(crate) async fn load_model<R: Runtime>(
    app: AppHandle<R>,
    payload: LoadModelRequest,
) -> Result<LoadModelResponse> {
    app.fluidaudio().load_model(payload)
}

#[command]
pub(crate) async fn unload_model<R: Runtime>(
    app: AppHandle<R>,
) -> Result<SuccessResponse> {
    app.fluidaudio().unload_model()
}

#[command]
pub(crate) async fn transcribe_file<R: Runtime>(
    app: AppHandle<R>,
    payload: TranscribeFileRequest,
) -> Result<TranscriptionResponse> {
    app.fluidaudio().transcribe_file(payload)
}

#[command]
pub(crate) async fn transcribe_audio<R: Runtime>(
    app: AppHandle<R>,
    payload: TranscribeAudioRequest,
) -> Result<TranscriptionResponse> {
    app.fluidaudio().transcribe_audio(payload)
}

#[command]
pub(crate) async fn diarize_file<R: Runtime>(
    app: AppHandle<R>,
    payload: DiarizeFileRequest,
) -> Result<DiarizationResponse> {
    app.fluidaudio().diarize_file(payload)
}

#[command]
pub(crate) async fn get_available_models<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AvailableModelsResponse> {
    app.fluidaudio().get_available_models()
}

#[command]
pub(crate) async fn get_current_model<R: Runtime>(
    app: AppHandle<R>,
) -> Result<CurrentModelResponse> {
    app.fluidaudio().get_current_model()
}

#[command]
pub(crate) async fn is_ready<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ReadyResponse> {
    app.fluidaudio().is_ready()
}
