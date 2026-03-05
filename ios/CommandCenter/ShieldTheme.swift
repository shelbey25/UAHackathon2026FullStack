import SwiftUI

// MARK: - S.H.I.E.L.D. Theme System

enum ShieldTheme {
    // MARK: Base Colors
    static let background = Color(red: 0.04, green: 0.05, blue: 0.09)       // #0B0E17
    static let panelBackground = Color(red: 0.07, green: 0.09, blue: 0.19)  // #131830
    static let panelSurface = Color(red: 0.09, green: 0.11, blue: 0.22)     // #161C38
    static let border = Color.white.opacity(0.08)
    
    // MARK: Accent Colors
    static let accentCyan = Color(red: 0.0, green: 0.83, blue: 1.0)         // #00D4FF
    static let accentBlue = Color(red: 0.23, green: 0.51, blue: 0.96)       // #3B82F6
    static let accentTeal = Color(red: 0.0, green: 0.69, blue: 0.78)        // #00B0C7
    
    // MARK: Text Colors
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.55)
    static let textMuted = Color.white.opacity(0.35)
    
    // MARK: Status Colors
    static let statusRed = Color(red: 1.0, green: 0.27, blue: 0.27)
    static let statusOrange = Color(red: 1.0, green: 0.6, blue: 0.2)
    static let statusYellow = Color(red: 1.0, green: 0.85, blue: 0.3)
    static let statusGreen = Color(red: 0.2, green: 0.9, blue: 0.5)
    
    // MARK: Glow
    static let glowCyan = Color(red: 0.0, green: 0.83, blue: 1.0).opacity(0.3)
    static let glowBlue = Color(red: 0.23, green: 0.51, blue: 0.96).opacity(0.2)
    
    // MARK: Gradients
    static let backgroundGradient = LinearGradient(
        colors: [background, Color(red: 0.05, green: 0.07, blue: 0.14)],
        startPoint: .top,
        endPoint: .bottom
    )
    
    static let accentGradient = LinearGradient(
        colors: [accentCyan, accentBlue],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let panelGradient = LinearGradient(
        colors: [panelBackground, panelSurface],
        startPoint: .top,
        endPoint: .bottom
    )
}

// MARK: - Panel Modifier

struct ShieldPanel: ViewModifier {
    var glowColor: Color = ShieldTheme.accentCyan
    var glowIntensity: CGFloat = 0.15
    
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(ShieldTheme.panelBackground)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(ShieldTheme.border, lineWidth: 1)
                    )
                    .shadow(color: glowColor.opacity(glowIntensity), radius: 12, y: 2)
            )
    }
}

extension View {
    func shieldPanel(glow: Color = ShieldTheme.accentCyan, intensity: CGFloat = 0.15) -> some View {
        modifier(ShieldPanel(glowColor: glow, glowIntensity: intensity))
    }
}

// MARK: - Fade-In Animation Modifier

struct ShieldFadeIn: ViewModifier {
    let delay: Double
    @State private var appeared = false
    
    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 12)
            .onAppear {
                withAnimation(.easeOut(duration: 0.5).delay(delay)) {
                    appeared = true
                }
            }
    }
}

extension View {
    func shieldFadeIn(delay: Double = 0) -> some View {
        modifier(ShieldFadeIn(delay: delay))
    }
}

// MARK: - Pulsing Glow Modifier

struct PulsingGlow: ViewModifier {
    let color: Color
    @State private var isPulsing = false
    
    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(isPulsing ? 0.4 : 0.15), radius: isPulsing ? 16 : 8)
            .onAppear {
                withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                    isPulsing = true
                }
            }
    }
}

extension View {
    func pulsingGlow(_ color: Color = ShieldTheme.accentCyan) -> some View {
        modifier(PulsingGlow(color: color))
    }
}

// MARK: - Section Header Style

struct ShieldSectionHeader: View {
    let title: String
    let subtitle: String?
    
    init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let subtitle {
                Text(subtitle.uppercased())
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .foregroundColor(ShieldTheme.accentCyan)
                    .tracking(1.5)
            }
            Text(title.uppercased())
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(ShieldTheme.textPrimary)
                .tracking(1.2)
        }
    }
}

// MARK: - Scanline Overlay (subtle)

struct ScanlineOverlay: View {
    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 4) {
                ForEach(0..<Int(geo.size.height / 4), id: \.self) { _ in
                    Rectangle()
                        .fill(Color.white.opacity(0.012))
                        .frame(height: 1)
                    Spacer().frame(height: 3)
                }
            }
        }
        .allowsHitTesting(false)
    }
}
