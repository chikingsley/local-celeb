fn main() {
    // Add rpath for Swift runtime on macOS
    // On macOS 13+, Swift Concurrency is in the system dyld cache at /usr/lib/swift
    #[cfg(target_os = "macos")]
    {
        // System Swift libraries (in dyld shared cache on modern macOS)
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }

    tauri_build::build()
}
