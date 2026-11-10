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
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                Preview()
                VStack(alignment: .leading, spacing: 8) {
                    Text(Brim.name).font(.largeTitle.bold())
                    Text("Web pages in Safari use the whole front screen of iPhone Duo, with text and buttons kept clear of Safari's column.")
                        .foregroundStyle(.secondary)
                }
                if isDuo {
                    Steps(enabled: enabled)
                } else {
                    Elsewhere()
                }
            }
            .frame(maxWidth: 420, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
            .frame(maxWidth: .infinity)
        }
        .task(id: phase) {
            guard phase == .active else { return }
            enabled = try? await SFSafariExtensionManager.stateOfExtension(withIdentifier: Brim.extensionID).isEnabled
        }
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
                                .frame(height: box.size.height * 0.42)
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
                        .padding(.vertical, 12)
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
    let enabled: Bool?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("In Safari settings").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                if let enabled {
                    Label(enabled ? "On" : "Off", systemImage: "circle.fill")
                        .labelStyle(Status(on: enabled))
                }
            }
            VStack(spacing: 0) {
                Step(number: 1, text: "Allow Extension", done: enabled == true)
                Divider().padding(.leading, 52)
                Step(number: 2, text: "All Websites › Allow", done: false)
            }
            .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.separator, lineWidth: 0.5))
            Button {
                Task { try? await SFSafariSettings.openExtensionsSettings(forIdentifiers: [Brim.extensionID]) }
            } label: {
                Text("Open Settings").font(.headline).frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
        }
    }
}

private struct Status: LabelStyle {
    let on: Bool

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon.font(.system(size: 7)).foregroundStyle(on ? Color.green : Color.secondary)
            configuration.title.font(.subheadline.weight(.medium))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(.fill.tertiary, in: .capsule)
        .contentTransition(.opacity)
    }
}

private struct Step: View {
    let number: Int
    let text: String
    let done: Bool

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(done ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.fill.tertiary))
                if done {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                } else {
                    Text("\(number)").font(.subheadline.weight(.semibold).monospacedDigit()).foregroundStyle(.secondary)
                }
            }
            .frame(width: 26, height: 26)
            Text(text).font(.body)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(done ? .isSelected : [])
    }
}

private struct Elsewhere: View {
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "iphone").font(.title3).foregroundStyle(.tint).frame(width: 26)
            Text("Made for iPhone Duo. On this iPhone, Safari already gives pages the whole width, so \(Brim.name) leaves them as they are.")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.separator, lineWidth: 0.5))
    }
}
