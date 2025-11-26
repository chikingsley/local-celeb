use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_fluidaudio);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Fluidaudio<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("", "FluidAudioPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_fluidaudio)?;
  Ok(Fluidaudio(handle))
}

/// Access to the fluidaudio APIs.
pub struct Fluidaudio<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Fluidaudio<R> {
  pub fn load_model(&self, payload: LoadModelRequest) -> crate::Result<LoadModelResponse> {
    self
      .0
      .run_mobile_plugin("loadModel", payload)
      .map_err(Into::into)
  }

  pub fn unload_model(&self) -> crate::Result<SuccessResponse> {
    self
      .0
      .run_mobile_plugin("unloadModel", ())
      .map_err(Into::into)
  }

  pub fn transcribe_file(&self, payload: TranscribeFileRequest) -> crate::Result<TranscriptionResponse> {
    self
      .0
      .run_mobile_plugin("transcribeFile", payload)
      .map_err(Into::into)
  }

  pub fn transcribe_audio(&self, payload: TranscribeAudioRequest) -> crate::Result<TranscriptionResponse> {
    self
      .0
      .run_mobile_plugin("transcribeAudio", payload)
      .map_err(Into::into)
  }

  pub fn diarize_file(&self, payload: DiarizeFileRequest) -> crate::Result<DiarizationResponse> {
    self
      .0
      .run_mobile_plugin("diarizeFile", payload)
      .map_err(Into::into)
  }

  pub fn get_available_models(&self) -> crate::Result<AvailableModelsResponse> {
    self
      .0
      .run_mobile_plugin("getAvailableModels", ())
      .map_err(Into::into)
  }

  pub fn get_current_model(&self) -> crate::Result<CurrentModelResponse> {
    self
      .0
      .run_mobile_plugin("getCurrentModel", ())
      .map_err(Into::into)
  }

  pub fn is_ready(&self) -> crate::Result<ReadyResponse> {
    self
      .0
      .run_mobile_plugin("isReady", ())
      .map_err(Into::into)
  }
}
