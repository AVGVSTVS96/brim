import SafariServices
import SwiftUI

@main
struct BrimApp: App {
    var body: some Scene {
        WindowGroup { Setup() }
    }
}

enum Brim {
    static let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "Span"
    static let extensionID = (Bundle.main.bundleIdentifier ?? "") + ".extension"
}

struct Setup: View {
    @Environment(\.scenePhase) private var phase
    @State private var enabled: Bool?

    var body: some View {
        GeometryReader { window in
            let wide = window.size.width > 600 && window.size.width > window.size.height
            ScrollView {
                Group {
                    if wide {
                        HStack(spacing: 48) {
                            Preview().frame(maxWidth: 360)
                            details.frame(maxWidth: 360)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 32) {
                            Preview()
                            details
                        }
                        .frame(maxWidth: 420)
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, minHeight: window.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .task(id: phase) {
            guard phase == .active else { return }
            enabled = try? await SFSafariExtensionManager.stateOfExtension(withIdentifier: Brim.extensionID).isEnabled
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 8) {
                Text(Brim.name).font(.largeTitle.bold())
                Text("Safari pages, edge to edge on the front screen of iPhone Duo.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !isDuo {
                Card(symbol: "iphone", style: AnyShapeStyle(.secondary), title: "Made for iPhone Duo", detail: "Other iPhones already give pages the whole width.")
            } else if enabled == true {
                Card(symbol: "checkmark.circle.fill", style: AnyShapeStyle(.tint), title: "On in Safari", detail: "If a page isn't full width, set All Websites to Allow.")
                SettingsButton(title: "Safari Settings").buttonStyle(.glass)
            } else {
                Steps()
                SettingsButton(title: "Open Settings").buttonStyle(.glassProminent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // iOS gives apps on the front screen a narrower window and screen than it is, so the model is checked instead:
    // the Duo's, the one whose screen widths the extension knows (content.js).
    private var isDuo: Bool {
        var system = utsname()
        uname(&system)
        let machine = withUnsafeBytes(of: system.machine) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
        return (ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? machine) == "iPhone19,4"
    }
}

// Safari's front screen in miniature: the page's colors run under the button column, its text stops beside it.
private struct Preview: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(Color(.secondarySystemBackground))
            .overlay {
                GeometryReader { box in
                    let column = box.size.width * 84 / 466
                    let edge: CGFloat = 16
                    ZStack(alignment: .topLeading) {
                        VStack(alignment: .leading, spacing: 10) {
                            UnevenRoundedRectangle(topLeadingRadius: 12, bottomLeadingRadius: 12, style: .continuous)
                                .fill(LinearGradient(colors: [Color(red: 1, green: 0.70, blue: 0.28), Color(red: 1, green: 0.31, blue: 0.55)],
                                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                                .frame(height: box.size.height * 0.34)
                                .padding(.bottom, 6)
                            ForEach([1.0, 0.86, 0.94, 0.6], id: \.self) { length in
                                Capsule()
                                    .fill(Color(.tertiaryLabel).opacity(0.5))
                                    .frame(width: (box.size.width - edge - column - 6) * length, height: 8)
                            }
                        }
                        .padding([.top, .leading], edge)
                        VStack(spacing: 0) {
                            ForEach(["square.and.arrow.up", "book", "square.on.square"], id: \.self) { symbol in
                                Image(systemName: symbol)
                                    .font(.system(size: 13, weight: .medium))
                                    .frame(maxHeight: .infinity)
                            }
                        }
                        .foregroundStyle(.primary)
                        .frame(width: column - 16)
                        .padding(.vertical, 6)
                        .glassEffect(.regular, in: .capsule)
                        .padding(.vertical, edge)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
                        .padding(.trailing, 8)
                    }
                }
            }
            .clipShape(.rect(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(.separator, lineWidth: 0.5))
            .aspectRatio(466 / 280, contentMode: .fit)
            .accessibilityHidden(true)
    }
}

private struct Steps: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("In Safari settings").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
            VStack(spacing: 0) {
                Step(number: 1, text: "Allow Extension")
                Divider().padding(.leading, Row.text)
                Step(number: 2, text: "All Websites › Allow")
            }
            .modifier(Panel())
        }
    }
}

private struct SettingsButton: View {
    let title: LocalizedStringKey

    var body: some View {
        Button {
            Task { try? await SFSafariSettings.openExtensionsSettings(forIdentifiers: [Brim.extensionID]) }
        } label: {
            Text(title).font(.headline).frame(maxWidth: .infinity)
        }
        .controlSize(.large)
    }
}

// Rows in both cards share one grid: a 26-point mark, then text.
private enum Row {
    static let inset: CGFloat = 14
    static let mark: CGFloat = 26
    static let text = inset + mark + inset
}

private struct Panel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.separator, lineWidth: 0.5))
    }
}

private struct Step: View {
    let number: Int
    let text: LocalizedStringKey

    var body: some View {
        HStack(spacing: Row.inset) {
            Text("\(number)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: Row.mark, height: Row.mark)
                .background(.fill.tertiary, in: .circle)
            Text(text)
            Spacer(minLength: 0)
        }
        .padding(Row.inset)
        .accessibilityElement(children: .combine)
    }
}

private struct Card: View {
    let symbol: String
    let style: AnyShapeStyle
    let title: LocalizedStringKey
    let detail: LocalizedStringKey

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Row.inset) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(style)
                .frame(width: Row.mark)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.body.weight(.semibold))
                Text(detail).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(Row.inset)
        .modifier(Panel())
        .accessibilityElement(children: .combine)
    }
}
