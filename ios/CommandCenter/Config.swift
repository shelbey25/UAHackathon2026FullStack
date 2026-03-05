import Foundation

enum Config {
    // MARK: - Clerk
    static let clerkPublishableKey = "pk_test_ZXhvdGljLWtpd2ktMTcuY2xlcmsuYWNjb3VudHMuZGV2JA"
    
    /// Derived Clerk Frontend API host from publishable key
    static var clerkFrontendAPI: String {
        // Decode the base64 portion after "pk_test_" to get the Clerk domain
        let prefix = "pk_test_"
        let encoded = String(clerkPublishableKey.dropFirst(prefix.count))
        if let data = Data(base64Encoded: encoded),
           let decoded = String(data: data, encoding: .utf8) {
            // decoded looks like "exotic-kiwi-17.clerk.accounts.dev$"
            let host = decoded.replacingOccurrences(of: "$", with: "")
            return "https://\(host)"
        }
        return "https://exotic-kiwi-17.clerk.accounts.dev"
    }
    
    // MARK: - Backend API
    static let apiKey = "0d0eec5ad3d2a58b7fbc5947614fc20c54d6a082dad3650e1a112af11ed87f97"
    
    /// Base URL for your Command Center backend API.
    static let backendBaseURL = "https://fullstackuainnovatebackend-production.up.railway.app"
}
