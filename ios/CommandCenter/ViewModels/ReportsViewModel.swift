import Foundation

@MainActor
class ReportsViewModel: ObservableObject {
    @Published var reports: [Report] = []
    @Published var isLoading = false
    @Published var hasMore = false
    @Published var errorMessage: String?
    @Published var selectedPriority: ReportPriority?
    @Published var showCleared = false
    
    private var currentPage = 1
    private let pageSize = 10000  // Match web: fetch all client-side
    
    // MARK: - Load Reports
    
    func loadReports() async {
        isLoading = true
        errorMessage = nil
        currentPage = 1
        
        do {
            let response = try await APIService.shared.fetchReports(
                priority: selectedPriority,
                cleared: showCleared ? true : nil,
                page: currentPage,
                limit: pageSize
            )
            reports = response.reports
            hasMore = response.hasMore ?? false
            print("[ReportsVM] Loaded \(reports.count) reports")
        } catch {
            errorMessage = error.localizedDescription
            print("[ReportsVM] Error: \(error)")
        }
        
        isLoading = false
    }
    
    // MARK: - Load More (if using pagination)
    
    func loadMore() async {
        guard !isLoading && hasMore else { return }
        
        currentPage += 1
        
        do {
            let response = try await APIService.shared.fetchReports(
                priority: selectedPriority,
                cleared: showCleared ? true : nil,
                page: currentPage,
                limit: pageSize
            )
            reports.append(contentsOf: response.reports)
            hasMore = response.hasMore ?? false
        } catch {
            currentPage -= 1
        }
    }
    
    // MARK: - Stats
    
    var totalCount: Int { reports.count }
    
    var avengersCount: Int {
        reports.filter { $0.displayPriority == .avengersLevelThreat }.count
    }
    
    var highCount: Int {
        reports.filter { $0.displayPriority == .high }.count
    }
    
    var mediumCount: Int {
        reports.filter { $0.displayPriority == .medium }.count
    }
    
    var lowCount: Int {
        reports.filter { $0.displayPriority == .low }.count
    }
    
    var clearedCount: Int {
        reports.filter { $0.isCleared }.count
    }
    
    var activeCount: Int {
        reports.filter { !$0.isCleared }.count
    }
    
    /// Unique sectors from loaded reports
    var sectors: [String] {
        Array(Set(reports.compactMap { $0.sector })).sorted()
    }
}
