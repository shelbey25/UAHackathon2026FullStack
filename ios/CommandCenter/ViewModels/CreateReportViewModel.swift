import Foundation

@MainActor
class CreateReportViewModel: ObservableObject {
    @Published var rawText = ""
    @Published var selectedSector: String = KnownSector.avengersCompound.rawValue
    @Published var selectedPriority: ReportPriority = .medium
    @Published var isSubmitting = false
    @Published var errorMessage: String?
    @Published var showSuccess = false
    
    let sectors = KnownSector.allCases.map { $0.rawValue }
    let priorities = ReportPriority.allCases
    
    var isValid: Bool {
        !rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    func submit() async {
        guard isValid else { return }
        
        isSubmitting = true
        errorMessage = nil
        
        // Get the current user's email from AuthManager
        let email = AuthManager.shared.currentUser?.email
        
        let newReport = NewReport(
            rawText: rawText.trimmingCharacters(in: .whitespacesAndNewlines),
            sector: selectedSector,
            priority: selectedPriority.rawValue,
            email: email
        )
        
        do {
            _ = try await APIService.shared.submitReport(newReport)
            showSuccess = true
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isSubmitting = false
    }
    
    func reset() {
        rawText = ""
        selectedSector = KnownSector.avengersCompound.rawValue
        selectedPriority = .medium
        errorMessage = nil
        showSuccess = false
    }
}
