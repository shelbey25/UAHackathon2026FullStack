import SwiftUI

struct ReportsListView: View {
    @StateObject private var viewModel = ReportsViewModel()
    @State private var searchText = ""
    @State private var showFilterSheet = false
    @State private var showArchived = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Active filter indicators
                if viewModel.selectedPriority != nil || showArchived {
                    activeFilterBar
                }
                
                // Report list
                if viewModel.isLoading && viewModel.reports.isEmpty {
                    loadingState
                } else if filteredReports.isEmpty {
                    emptyState
                } else {
                    reportsList
                }
            }
            .background(
                ZStack {
                    ShieldTheme.background
                    ScanlineOverlay().opacity(0.3)
                }
                .ignoresSafeArea()
            )
            .navigationTitle("Reports")
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $searchText, prompt: "Search reports...")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showFilterSheet = true
                    } label: {
                        Image(systemName: viewModel.selectedPriority != nil ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                            .foregroundColor(ShieldTheme.accentCyan)
                    }
                }
            }
            .sheet(isPresented: $showFilterSheet) {
                PriorityFilterSheet(
                    selectedPriority: $viewModel.selectedPriority,
                    showArchived: $showArchived
                )
            }
            .refreshable {
                await viewModel.loadReports()
            }
            .task {
                await viewModel.loadReports()
            }
            .onChange(of: viewModel.selectedPriority) { _, _ in
                Task { await viewModel.loadReports() }
            }
            .onChange(of: showArchived) { _, newValue in
                viewModel.showCleared = newValue
                Task { await viewModel.loadReports() }
            }
        }
    }
    
    // MARK: - Filtered Reports (client-side search)
    
    private var filteredReports: [Report] {
        if searchText.isEmpty {
            return viewModel.reports
        }
        return viewModel.reports.filter { report in
            report.displayTitle.localizedCaseInsensitiveContains(searchText) ||
            report.displayContent.localizedCaseInsensitiveContains(searchText) ||
            report.displaySector.localizedCaseInsensitiveContains(searchText) ||
            (report.displayResource ?? "").localizedCaseInsensitiveContains(searchText)
        }
    }
    
    // MARK: - Active Filter Bar
    
    private var activeFilterBar: some View {
        HStack {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.caption)
                .foregroundColor(ShieldTheme.accentCyan)
            
            if let priority = viewModel.selectedPriority {
                Text("PRIORITY: \(priority.displayName.uppercased())")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(ShieldTheme.textPrimary)
                    .tracking(0.5)
            }
            if showArchived {
                Text("SHOWING ARCHIVED")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(ShieldTheme.textPrimary)
                    .tracking(0.5)
            }
            
            Spacer()
            Button {
                viewModel.selectedPriority = nil
                showArchived = false
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(ShieldTheme.textSecondary)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(ShieldTheme.accentCyan.opacity(0.06))
    }
    
    // MARK: - Reports List
    
    private var reportsList: some View {
        List {
            ForEach(filteredReports) { report in
                NavigationLink {
                    ReportDetailView(report: report)
                } label: {
                    ReportListItem(report: report)
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                .listRowBackground(Color.clear)
            }
            
            if viewModel.hasMore {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(ShieldTheme.accentCyan)
                        .task {
                            await viewModel.loadMore()
                        }
                    Spacer()
                }
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
    
    // MARK: - States
    
    private var loadingState: some View {
        VStack {
            Spacer()
            ProgressView("LOADING REPORTS...")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .tint(ShieldTheme.accentCyan)
                .foregroundColor(ShieldTheme.textSecondary)
            Spacer()
        }
    }
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(ShieldTheme.textMuted)
            Text("NO REPORTS FOUND")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundColor(ShieldTheme.textSecondary)
                .tracking(1)
            if viewModel.selectedPriority != nil {
                Text("No reports found with this priority filter")
                    .font(.subheadline)
                    .foregroundColor(ShieldTheme.textMuted)
                    .multilineTextAlignment(.center)
            } else if let error = viewModel.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .foregroundColor(ShieldTheme.statusRed.opacity(0.7))
                    .multilineTextAlignment(.center)
            } else {
                Text("Pull to refresh or create a new report")
                    .font(.subheadline)
                    .foregroundColor(ShieldTheme.textMuted)
                    .multilineTextAlignment(.center)
            }
            Spacer()
        }
        .padding()
    }
}

// MARK: - Report List Item

struct ReportListItem: View {
    let report: Report
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(report.displayTitle)
                        .font(.body.weight(.semibold))
                        .foregroundColor(ShieldTheme.textPrimary)
                        .lineLimit(1)
                    
                    HStack(spacing: 6) {
                        Text(report.displaySector.uppercased())
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundColor(ShieldTheme.accentCyan)
                            .tracking(0.5)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(ShieldTheme.accentCyan.opacity(0.1))
                            .cornerRadius(4)
                        
                        if let resource = report.displayResource {
                            Text(resource.uppercased())
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundColor(.purple)
                                .tracking(0.5)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.purple.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                }
                
                Spacer()
                
                if let priority = report.displayPriority {
                    PriorityBadge(priority: priority)
                }
            }
            
            Text(report.displayContent)
                .font(.subheadline)
                .foregroundColor(ShieldTheme.textSecondary)
                .lineLimit(2)
            
            HStack {
                if let score = report.displayRiskScore {
                    HStack(spacing: 2) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.caption2)
                        Text("Risk: \(String(format: "%.0f%%", score * 100))")
                            .font(.caption)
                    }
                    .foregroundColor(score > 0.7 ? ShieldTheme.statusRed : score > 0.4 ? ShieldTheme.statusOrange : ShieldTheme.statusGreen)
                }
                
                Spacer()
                
                Text(report.displayDate, format: .dateTime.month(.abbreviated).day().hour().minute())
                    .font(.caption)
                    .foregroundColor(ShieldTheme.textMuted)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Priority Filter Sheet

struct PriorityFilterSheet: View {
    @Binding var selectedPriority: ReportPriority?
    @Binding var showArchived: Bool
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                Section("Filter by Priority") {
                    // "All" option
                    Button {
                        selectedPriority = nil
                        dismiss()
                    } label: {
                        HStack {
                            Text("All Priorities")
                                .foregroundColor(ShieldTheme.textPrimary)
                            Spacer()
                            if selectedPriority == nil {
                                Image(systemName: "checkmark")
                                    .foregroundColor(ShieldTheme.accentCyan)
                            }
                        }
                    }
                    
                    ForEach(ReportPriority.allCases, id: \.rawValue) { priority in
                        Button {
                            selectedPriority = priority
                            dismiss()
                        } label: {
                            HStack {
                                Circle()
                                    .fill(colorForPriority(priority))
                                    .frame(width: 10, height: 10)
                                    .shadow(color: colorForPriority(priority).opacity(0.5), radius: 4)
                                Text(priority.displayName)
                                    .foregroundColor(ShieldTheme.textPrimary)
                                Spacer()
                                if selectedPriority == priority {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(ShieldTheme.accentCyan)
                                }
                            }
                        }
                    }
                }
                
                Section("Report Status") {
                    Toggle("Show Archived", isOn: $showArchived)
                        .tint(ShieldTheme.accentCyan)
                }
            }
            .scrollContentBackground(.hidden)
            .background(ShieldTheme.background)
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Reset") {
                        selectedPriority = nil
                        showArchived = false
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
    
    private func colorForPriority(_ priority: ReportPriority) -> Color {
        switch priority {
        case .avengersLevelThreat: return ShieldTheme.statusRed
        case .high: return ShieldTheme.statusOrange
        case .medium: return ShieldTheme.statusYellow
        case .low: return ShieldTheme.statusGreen
        }
    }
}

// MARK: - Report Detail View

struct ReportDetailView: View {
    let report: Report
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    if let priority = report.displayPriority {
                        PriorityBadge(priority: priority)
                    }
                    
                    Text(report.displayTitle)
                        .font(.title2.bold())
                        .foregroundColor(ShieldTheme.textPrimary)
                    
                    HStack(spacing: 16) {
                        Label(report.displaySector, systemImage: "mappin.circle.fill")
                            .font(.subheadline)
                            .foregroundColor(ShieldTheme.textSecondary)
                        
                        if let resource = report.displayResource {
                            Label(resource, systemImage: "cube.fill")
                                .font(.subheadline)
                                .foregroundColor(ShieldTheme.textSecondary)
                        }
                    }
                    
                    Text(report.displayDate, format: .dateTime.month(.wide).day().year().hour().minute())
                        .font(.caption)
                        .foregroundColor(ShieldTheme.textMuted)
                    
                    if let score = report.displayRiskScore {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text("Risk Score: \(String(format: "%.0f%%", score * 100))")
                                .font(.subheadline.weight(.medium))
                        }
                        .foregroundColor(score > 0.7 ? ShieldTheme.statusRed : score > 0.4 ? ShieldTheme.statusOrange : ShieldTheme.statusGreen)
                        .padding(.top, 4)
                    }
                }
                .shieldFadeIn(delay: 0.05)
                
                Rectangle()
                    .fill(ShieldTheme.accentCyan.opacity(0.15))
                    .frame(height: 1)
                
                // Content
                if !report.displayContent.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ShieldSectionHeader("Report Content", subtitle: "Processed")
                        Text(report.displayContent)
                            .font(.body)
                            .foregroundColor(ShieldTheme.textPrimary)
                            .lineSpacing(6)
                    }
                    .shieldFadeIn(delay: 0.15)
                }
                
                // Raw text
                if let rawText = report.rawText,
                   rawText != report.displayContent,
                   !rawText.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ShieldSectionHeader("Original Text", subtitle: "Raw Input")
                        Text(rawText)
                            .font(.body)
                            .lineSpacing(6)
                            .foregroundColor(ShieldTheme.textSecondary)
                    }
                    .shieldFadeIn(delay: 0.25)
                }
                
                Spacer()
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
        .navigationBarTitleDisplayMode(.inline)
    }
}
