import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = ReportsViewModel()
    
    init() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(ShieldTheme.background)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    welcomeHeader
                        .shieldFadeIn(delay: 0.05)
                    
                    statsGrid
                        .shieldFadeIn(delay: 0.15)
                    
                    recentReportsSection
                        .shieldFadeIn(delay: 0.25)
                }
                .padding()
            }
            .background(
                ZStack {
                    ShieldTheme.background
                    ScanlineOverlay().opacity(0.3)
                }
                .ignoresSafeArea()
            )
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await viewModel.loadReports()
            }
            .task {
                await viewModel.loadReports()
            }
        }
    }
    
    // MARK: - Welcome Header
    
    private var welcomeHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("WELCOME BACK")
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundColor(ShieldTheme.accentCyan)
                    .tracking(2)
                Text(authManager.currentUser?.displayName ?? "Commander")
                    .font(.title2.bold())
                    .foregroundColor(ShieldTheme.textPrimary)
            }
            Spacer()
            
            // Avatar
            if let imageUrl = authManager.currentUser?.imageUrl,
               let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    avatarPlaceholder
                }
                .frame(width: 48, height: 48)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(ShieldTheme.accentCyan.opacity(0.4), lineWidth: 1.5)
                )
                .shadow(color: ShieldTheme.glowCyan, radius: 8)
            } else {
                avatarPlaceholder
            }
        }
        .padding()
        .shieldPanel()
    }
    
    private var avatarPlaceholder: some View {
        Circle()
            .fill(ShieldTheme.panelSurface)
            .frame(width: 48, height: 48)
            .overlay(
                Text(String((authManager.currentUser?.displayName ?? "U").prefix(1)))
                    .font(.title3.bold())
                    .foregroundColor(ShieldTheme.accentCyan)
            )
            .overlay(
                Circle()
                    .stroke(ShieldTheme.accentCyan.opacity(0.4), lineWidth: 1.5)
            )
            .shadow(color: ShieldTheme.glowCyan, radius: 8)
    }
    
    // MARK: - Stats Grid
    
    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12)
        ], spacing: 12) {
            StatCard(
                title: "Total Reports",
                value: "\(viewModel.totalCount)",
                icon: "doc.text.fill",
                color: .blue
            )
            StatCard(
                title: "Avengers Level",
                value: "\(viewModel.avengersCount)",
                icon: "exclamationmark.shield.fill",
                color: .red
            )
            StatCard(
                title: "High Priority",
                value: "\(viewModel.highCount)",
                icon: "exclamationmark.triangle.fill",
                color: .orange
            )
            StatCard(
                title: "Active / Cleared",
                value: "\(viewModel.activeCount) / \(viewModel.clearedCount)",
                icon: "checkmark.seal.fill",
                color: .green
            )
        }
    }
    
    // MARK: - Recent Reports
    
    private var recentReportsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                ShieldSectionHeader("Recent Reports", subtitle: "Field Intel")
                Spacer()
                NavigationLink {
                    ReportsListView()
                } label: {
                    Text("SEE ALL")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundColor(ShieldTheme.accentCyan)
                        .tracking(1)
                }
            }
            
            Rectangle()
                .fill(ShieldTheme.accentCyan.opacity(0.2))
                .frame(height: 1)
            
            if viewModel.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(ShieldTheme.accentCyan)
                        .padding()
                    Spacer()
                }
            } else if viewModel.reports.isEmpty {
                emptyState
            } else {
                ForEach(Array(viewModel.reports.prefix(5).enumerated()), id: \.element.id) { index, report in
                    ReportRowView(report: report)
                        .shieldFadeIn(delay: 0.3 + Double(index) * 0.07)
                }
            }
            
            if let error = viewModel.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(ShieldTheme.statusOrange)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(ShieldTheme.textSecondary)
                }
                .padding(.top, 4)
            }
        }
        .padding()
        .shieldPanel()
    }
    
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 40))
                .foregroundColor(ShieldTheme.textMuted)
            Text("NO REPORTS")
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(ShieldTheme.textSecondary)
                .tracking(1)
            Text("Create your first report to get started")
                .font(.caption)
                .foregroundColor(ShieldTheme.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    private var glowColor: Color {
        color == .red ? ShieldTheme.statusRed :
        color == .orange ? ShieldTheme.statusOrange :
        color == .green ? ShieldTheme.statusGreen :
        ShieldTheme.accentCyan
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(glowColor)
                    .shadow(color: glowColor.opacity(0.5), radius: 6)
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(ShieldTheme.textPrimary)
            
            Text(title.uppercased())
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundColor(ShieldTheme.textSecondary)
                .tracking(0.5)
        }
        .padding()
        .shieldPanel(glow: glowColor, intensity: 0.12)
    }
}

// MARK: - Report Row

struct ReportRowView: View {
    let report: Report
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(report.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(ShieldTheme.textPrimary)
                    .lineLimit(1)
                Spacer()
                if let priority = report.displayPriority {
                    PriorityBadge(priority: priority)
                }
            }
            
            Text(report.displayContent)
                .font(.caption)
                .foregroundColor(ShieldTheme.textSecondary)
                .lineLimit(2)
            
            HStack {
                Label(report.displaySector, systemImage: "mappin.circle.fill")
                    .font(.caption2)
                    .foregroundColor(ShieldTheme.accentCyan.opacity(0.7))
                
                if let score = report.displayRiskScore {
                    Spacer()
                    HStack(spacing: 2) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.caption2)
                        Text(String(format: "%.0f%%", score * 100))
                            .font(.caption2)
                    }
                    .foregroundColor(score > 0.7 ? ShieldTheme.statusRed : score > 0.4 ? ShieldTheme.statusOrange : ShieldTheme.statusGreen)
                }
                
                Spacer()
                
                Text(report.displayDate, style: .relative)
                    .font(.caption2)
                    .foregroundColor(ShieldTheme.textMuted)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(ShieldTheme.panelSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(ShieldTheme.border, lineWidth: 0.5)
                )
        )
    }
}

// MARK: - Priority Badge

struct PriorityBadge: View {
    let priority: ReportPriority
    
    private var badgeColor: Color {
        switch priority {
        case .avengersLevelThreat: return ShieldTheme.statusRed
        case .high: return ShieldTheme.statusOrange
        case .medium: return ShieldTheme.statusYellow
        case .low: return ShieldTheme.statusGreen
        }
    }
    
    var body: some View {
        Text(priority.displayName.uppercased())
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundColor(badgeColor)
            .tracking(0.5)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(badgeColor.opacity(0.15))
                    .overlay(
                        Capsule()
                            .stroke(badgeColor.opacity(0.3), lineWidth: 0.5)
                    )
            )
    }
}
