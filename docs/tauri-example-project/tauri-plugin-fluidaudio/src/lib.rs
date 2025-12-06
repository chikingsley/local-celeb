use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Fluidaudio;
#[cfg(mobile)]
use mobile::Fluidaudio;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the fluidaudio APIs.
pub trait FluidaudioExt<R: Runtime> {
  fn fluidaudio(&self) -> &Fluidaudio<R>;
}

impl<R: Runtime, T: Manager<R>> crate::FluidaudioExt<R> for T {
  fn fluidaudio(&self) -> &Fluidaudio<R> {
    self.state::<Fluidaudio<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("fluidaudio")
    .invoke_handler(tauri::generate_handler![
      commands::load_model,
      commands::unload_model,
      commands::transcribe_file,
      commands::transcribe_audio,
      commands::diarize_file,
      commands::get_available_models,
      commands::get_current_model,
      commands::is_ready
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let fluidaudio = mobile::init(app, api)?;
      #[cfg(desktop)]
      let fluidaudio = desktop::init(app, api)?;
      app.manage(fluidaudio);
      Ok(())
    })
    .build()
}
