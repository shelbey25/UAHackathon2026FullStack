import SwiftUI

struct CreateReportView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = CreateReportViewModel()
    @FocusState private var focusedField: Field?
    
    enum Field {
        case rawText
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Form card
                    VStack(spacing: 18) {
                        // Sector Picker
                        FormField(label: "Sector", icon: "mappin.circle") {
                            Picker("Sector", selection: $viewModel.selectedSector) {
                                ForEach(viewModel.sectors, id: \.self) { sector in
                                    Text(sector).tag(sector)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        
                        // Priority Picker
                        FormField(label: "Priority", icon: "exclamationmark.triangle") {
                            Picker("Priority", selection: $viewModel.selectedPriority) {
                                ForEach(viewModel.priorities, id: \.rawValue) { priority in
                                    Text(priority.displayName).tag(priority)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // Raw Text (field report content)
                        FormField(label: "Field Report", icon: "text.alignleft") {
                            TextEditor(text: $viewModel.rawText)
                                .focused($focusedField, equals: .rawText)
                                .frame(minHeight: 200)
                                .scrollContentBackground(.hidden)
                        }
                        
                        Text("Your report will be processed through PII redaction and AI entity extraction.")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundColor(ShieldTheme.textMuted)
                            .padding(.horizontal, 4)
                    }
                    .padding()
                    .shieldPanel()
                    
                    // Author info
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(ShieldTheme.accentCyan)
                        Text("Submitting as: \(authManager.currentUser?.displayName ?? "You")")
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundColor(ShieldTheme.textSecondary)
                        Spacer()
                    }
                    .padding(.horizontal, 4)
                    
                    // Submit button
                    Button {
                        focusedField = nil
                        Task {
                            await viewModel.submit()
                        }
                    } label: {
                        HStack(spacing: 8) {
                            if viewModel.isSubmitting {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "paperplane.fill")
                            }
                            Text(viewModel.isSubmitting ? "Submitting..." : "Submit Report")
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(
                                    viewModel.isValid
                                        ? ShieldTheme.panelBackground
                                        : Color.gray.opacity(0.2)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(
                                            viewModel.isValid
                                                ? ShieldTheme.accentCyan.opacity(0.4)
                                                : Color.clear,
                                            lineWidth: 1
                                        )
                                )
                                .shadow(color: viewModel.isValid ? ShieldTheme.glowCyan : .clear, radius: 8)
                        )
                    }
                    .disabled(!viewModel.isValid || viewModel.isSubmitting)
                    
                    if let error = viewModel.errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(ShieldTheme.statusRed)
                            Text(error)
                                .font(.caption)
                                .foregroundColor(ShieldTheme.statusRed)
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(ShieldTheme.statusRed.opacity(0.08))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(ShieldTheme.statusRed.opacity(0.2), lineWidth: 0.5)
                                )
                        )
                    }
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
            .navigationTitle("New Report")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        focusedField = nil
                    }
                }
            }
            .alert("Report Submitted!", isPresented: $viewModel.showSuccess) {
                Button("OK") {
                    viewModel.reset()
                }
            } message: {
                Text("Your field report has been submitted for processing. It will go through PII redaction and AI analysis.")
            }
        }
    }
}

// MARK: - Form Field

struct FormField<Content: View>: View {
    let label: String
    let icon: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundColor(ShieldTheme.accentCyan)
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .foregroundColor(ShieldTheme.textSecondary)
                    .tracking(1)
            }
            
            content
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
}
