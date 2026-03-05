import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var logoScale: CGFloat = 0.8
    @State private var logoOpacity: Double = 0
    @State private var contentOpacity: Double = 0
    @State private var glowPulse = false
    
    var body: some View {
        ZStack {
            // Base background
            ShieldTheme.background
                .ignoresSafeArea()
            
            // Subtle grid overlay
            ScanlineOverlay()
                .ignoresSafeArea()
                .opacity(0.5)
            
            VStack(spacing: 0) {
                Spacer()
                
                // Logo & Title
                VStack(spacing: 18) {
                    ZStack {
                        // Glow ring
                        Circle()
                            .stroke(ShieldTheme.accentCyan.opacity(glowPulse ? 0.25 : 0.08), lineWidth: 1.5)
                            .frame(width: 100, height: 100)
                            .shadow(color: ShieldTheme.glowCyan, radius: glowPulse ? 20 : 8)
                        
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 52, weight: .thin))
                            .foregroundStyle(ShieldTheme.accentGradient)
                            .shadow(color: ShieldTheme.glowCyan, radius: 15)
                    }
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)
                    
                    VStack(spacing: 6) {
                        Text("S.H.I.E.L.D.")
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .foregroundColor(ShieldTheme.accentCyan)
                            .tracking(4)
                        
                        Text("Command Center")
                            .font(.system(size: 30, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text("STRATEGIC HOMELAND INTERVENTION")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .foregroundColor(ShieldTheme.textMuted)
                            .tracking(2)
                    }
                    .opacity(contentOpacity)
                }
                .padding(.bottom, 48)
                
                // Sign-In Button
                VStack(spacing: 16) {
                    Button {
                        Task { await authManager.signInWithGoogle() }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "g.circle.fill")
                                .font(.title2)
                                .foregroundColor(.white)
                            
                            if authManager.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            
                            Text(authManager.isLoading ? "AUTHENTICATING..." : "SIGN IN WITH GOOGLE")
                                .font(.system(size: 14, weight: .semibold))
                                .tracking(1)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(ShieldTheme.panelBackground)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(ShieldTheme.accentCyan.opacity(0.3), lineWidth: 1)
                                )
                                .shadow(color: ShieldTheme.glowCyan, radius: 8)
                        )
                    }
                    .disabled(authManager.isLoading)
                    .padding(.horizontal, 32)
                    .opacity(contentOpacity)
                    
                    // Error
                    if let error = authManager.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(ShieldTheme.statusRed)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                            .transition(.opacity)
                    }
                }
                
                Spacer()
                
                // Footer
                HStack(spacing: 4) {
                    Circle()
                        .fill(ShieldTheme.statusGreen)
                        .frame(width: 5, height: 5)
                    Text("SECURE CONNECTION // CLERK AUTH")
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .foregroundColor(ShieldTheme.textMuted)
                        .tracking(1)
                }
                .opacity(contentOpacity)
                .padding(.bottom, 32)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.7).delay(0.1)) {
                logoScale = 1.0
                logoOpacity = 1
            }
            withAnimation(.easeOut(duration: 0.6).delay(0.4)) {
                contentOpacity = 1
            }
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true).delay(0.8)) {
                glowPulse = true
            }
        }
    }
}
