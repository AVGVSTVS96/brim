import SwiftUI

@main
struct BrimApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(alignment: .leading, spacing: 16) {
                Text("Brim").font(.largeTitle.bold())
                Text("Lets pages in Safari run under its button column on the iPhone Duo's front screen. Text and buttons stay where you can read and tap them.")
                Text("Turn it on in Settings › Apps › Safari › Extensions › Brim: Allow Extension, and All Websites › Allow.")
                    .foregroundStyle(.secondary)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}
