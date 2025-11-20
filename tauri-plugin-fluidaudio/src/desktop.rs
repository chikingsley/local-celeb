use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;
use crate::Error;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<Fluidaudio<R>> {
  Ok(Fluidaudio(app.clone()))
}

/// Access to the fluidaudio APIs.
pub struct Fluidaudio<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Fluidaudio<R> {
  pub fn load_model(&self, _payload: LoadModelRequest) -> crate::Result<LoadModelResponse> {
    // FluidAudio only works on macOS/iOS
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn unload_model(&self) -> crate::Result<SuccessResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn transcribe_file(&self, _payload: TranscribeFileRequest) -> crate::Result<TranscriptionResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn transcribe_audio(&self, _payload: TranscribeAudioRequest) -> crate::Result<TranscriptionResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn diarize_file(&self, _payload: DiarizeFileRequest) -> crate::Result<DiarizationResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn get_available_models(&self) -> crate::Result<AvailableModelsResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn get_current_model(&self) -> crate::Result<CurrentModelResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }

  pub fn is_ready(&self) -> crate::Result<ReadyResponse> {
    Err(Error::String("FluidAudio is only available on macOS and iOS platforms".into()))
  }
}
