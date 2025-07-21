// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "tauri-plugin-whisperkit",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-whisperkit",
            type: .static,
            targets: ["tauri-plugin-whisperkit"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/argmaxinc/WhisperKit.git", from: "0.9.4"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-whisperkit",
            dependencies: [
                .product(name: "WhisperKit", package: "WhisperKit"),
            ],
            path: "ios/Sources"
        ),
    ]
)
