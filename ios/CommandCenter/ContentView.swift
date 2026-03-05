import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isLoading {
                LoadingView()
            } else if authManager.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
    }
}

// MARK: - Loading View

struct LoadingView: View {
    @State private var logoOpacity: Double = 0
    @State private var pulseScale: CGFloat = 0.9
    
    var body: some View {
        ZStack {
            ShieldTheme.background
                .ignoresSafeArea()
            
            VStack(spacing: 20) {
                Image(systemName: "shield.checkered")
                    .font(.system(size: 48, weight: .thin))
                    .foregroundStyle(ShieldTheme.accentGradient)
                    .scaleEffect(pulseScale)
                    .opacity(logoOpacity)
                    .shadow(color: ShieldTheme.glowCyan, radius: 20)
                
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: ShieldTheme.accentCyan))
                    .scaleEffect(1.1)
                
                Text("INITIALIZING...")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(ShieldTheme.textMuted)
                    .tracking(3)
            }
            .onAppear {
                withAnimation(.easeOut(duration: 0.8)) { logoOpacity = 1 }
                withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) { pulseScale = 1.05 }
            }
        }
    }
}
