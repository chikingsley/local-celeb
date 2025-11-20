// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "tauri-plugin-fluidaudio",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-fluidaudio",
            type: .static,
            targets: ["tauri-plugin-fluidaudio"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/FluidInference/FluidAudio.git", from: "0.7.9"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-fluidaudio",
            dependencies: [
                .product(name: "FluidAudio", package: "FluidAudio"),
            ],
            path: "ios/Sources"
        ),
    ]
)
