const COMMANDS: &[&str] = &[
    "load_model",
    "unload_model",
    "transcribe_file",
    "transcribe_audio",
    "diarize_file",
    "get_available_models",
    "get_current_model",
    "is_ready",
];

fn main() {
    // Build Tauri plugin
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();

    // On macOS, link the Swift package for FFI
    #[cfg(target_os = "macos")]
    {
        use swift_rs::SwiftLinker;

        // Get the directory containing Cargo.toml (plugin root)
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR not set");

        // Link Swift package - name must match Package.swift, path is directory
        SwiftLinker::new("14.0")
            .with_package("tauri-plugin-fluidaudio", &manifest_dir)
            .link();

        // Link C++ standard library (required by FluidAudio's FastClusterWrapper)
        println!("cargo:rustc-link-lib=c++");

        // Add rpath for Swift runtime libraries
        // On macOS 13+, Swift Concurrency is in the system dyld shared cache
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }
}
