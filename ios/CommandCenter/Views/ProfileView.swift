import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthManager
    
    var body: some View {
        NavigationStack {
            List {
                // User Info Section
                Section {
                    HStack(spacing: 14) {
                        // Avatar
                        if let imageUrl = authManager.currentUser?.imageUrl,
                           let url = URL(string: imageUrl) {
                            AsyncImage(url: url) { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            } placeholder: {
                                profileInitials
                            }
                            .frame(width: 56, height: 56)
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(ShieldTheme.accentCyan.opacity(0.4), lineWidth: 1.5)
                            )
                            .shadow(color: ShieldTheme.glowCyan, radius: 8)
                        } else {
                            profileInitials
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(authManager.currentUser?.displayName ?? "User")
                                .font(.headline)
                                .foregroundColor(ShieldTheme.textPrimary)
                            Text(authManager.currentUser?.email ?? "")
                                .font(.subheadline)
                                .foregroundColor(ShieldTheme.textSecondary)
                        }
                    }
                    .padding(.vertical, 8)
                    .listRowBackground(ShieldTheme.panelBackground)
                }
                
                // App Info Section
                Section {
                    HStack {
                        Label {
                            Text("Version")
                                .foregroundColor(ShieldTheme.textPrimary)
                        } icon: {
                            Image(systemName: "info.circle")
                                .foregroundColor(ShieldTheme.accentCyan)
                        }
                        Spacer()
                        Text("1.0.0")
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundColor(ShieldTheme.textMuted)
                    }
                    .listRowBackground(ShieldTheme.panelBackground)
                    
                    HStack {
                        Label {
                            Text("Environment")
                                .foregroundColor(ShieldTheme.textPrimary)
                        } icon: {
                            Image(systemName: "server.rack")
                                .foregroundColor(ShieldTheme.accentCyan)
                        }
                        Spacer()
                        Text("Development")
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundColor(ShieldTheme.textMuted)
                    }
                    .listRowBackground(ShieldTheme.panelBackground)
                } header: {
                    Text("SYSTEM INFO")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundColor(ShieldTheme.accentCyan)
                        .tracking(1.5)
                }
                
                // Connection Info
                Section {
                    HStack {
                        Label {
                            Text("Backend")
                                .foregroundColor(ShieldTheme.textPrimary)
                        } icon: {
                            Image(systemName: "link")
                                .foregroundColor(ShieldTheme.accentCyan)
                        }
                        Spacer()
                        Text(Config.backendBaseURL)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(ShieldTheme.textMuted)
                            .lineLimit(1)
                    }
                    .listRowBackground(ShieldTheme.panelBackground)
                    
                    HStack {
                        Label {
                            Text("Auth Provider")
                                .foregroundColor(ShieldTheme.textPrimary)
                        } icon: {
                            Image(systemName: "shield.checkered")
                                .foregroundColor(ShieldTheme.accentCyan)
                        }
                        Spacer()
                        HStack(spacing: 4) {
                            Circle()
                                .fill(ShieldTheme.statusGreen)
                                .frame(width: 5, height: 5)
                            Text("Clerk")
                                .font(.system(.subheadline, design: .monospaced))
                                .foregroundColor(ShieldTheme.textMuted)
                        }
                    }
                    .listRowBackground(ShieldTheme.panelBackground)
                } header: {
                    Text("CONNECTION")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundColor(ShieldTheme.accentCyan)
                        .tracking(1.5)
                }
                
                // Sign Out
                Section {
                    Button(role: .destructive) {
                        authManager.signOut()
                    } label: {
                        HStack {
                            Spacer()
                            Label("SIGN OUT", systemImage: "rectangle.portrait.and.arrow.right")
                                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                .tracking(1)
                            Spacer()
                        }
                    }
                    .foregroundColor(ShieldTheme.statusRed)
                    .listRowBackground(ShieldTheme.statusRed.opacity(0.08))
                }
            }
            .scrollContentBackground(.hidden)
            .background(
                ZStack {
                    ShieldTheme.background
                    ScanlineOverlay().opacity(0.3)
                }
                .ignoresSafeArea()
            )
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    private var profileInitials: some View {
        Circle()
            .fill(ShieldTheme.panelSurface)
            .frame(width: 56, height: 56)
            .overlay(
                Text(String((authManager.currentUser?.displayName ?? "U").prefix(1)))
                    .font(.title2.bold())
                    .foregroundColor(ShieldTheme.accentCyan)
            )
            .overlay(
                Circle()
                    .stroke(ShieldTheme.accentCyan.opacity(0.4), lineWidth: 1.5)
            )
            .shadow(color: ShieldTheme.glowCyan, radius: 8)
    }
}
