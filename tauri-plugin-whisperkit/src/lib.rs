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
use desktop::Whisperkit;
#[cfg(mobile)]
use mobile::Whisperkit;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the whisperkit APIs.
pub trait WhisperkitExt<R: Runtime> {
  fn whisperkit(&self) -> &Whisperkit<R>;
}

impl<R: Runtime, T: Manager<R>> crate::WhisperkitExt<R> for T {
  fn whisperkit(&self) -> &Whisperkit<R> {
    self.state::<Whisperkit<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("whisperkit")
    .invoke_handler(tauri::generate_handler![
      commands::load_model,
      commands::unload_model,
      commands::transcribe_file,
      commands::transcribe_audio,
      commands::get_available_models,
      commands::get_current_model,
      commands::is_ready
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let whisperkit = mobile::init(app, api)?;
      #[cfg(desktop)]
      let whisperkit = desktop::init(app, api)?;
      app.manage(whisperkit);
      Ok(())
    })
    .build()
}
