import Foundation

/// Service layer for Command Center backend API.
/// Base URL: https://fullstackuainnovatebackend-production.up.railway.app
/// Auth: Clerk JWT bearer token + x-api-key header
class APIService {
    static let shared = APIService()
    
    private let baseURL: String
    private let apiKey: String
    
    private init() {
        self.baseURL = Config.backendBaseURL
        self.apiKey = Config.apiKey
    }
    
    // MARK: - Generic Request Builder
    
    private func makeRequest(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async -> URLRequest? {
        var components = URLComponents(string: "\(baseURL)\(path)")
        if let queryItems, !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        
        guard let url = components?.url else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        
        // Attach Clerk session token if available
        let token = await MainActor.run { AuthManager.shared.sessionToken }
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let devBrowserToken = await MainActor.run { UserDefaults.standard.string(forKey: "cc_dev_browser_token") }
        if let devBrowserToken {
            request.setValue("__clerk_db_jwt=\(devBrowserToken)", forHTTPHeaderField: "Cookie")
            // Optional: Also pass it in origin header to spoof a browser to middleware
            request.setValue("http://localhost:3000", forHTTPHeaderField: "Origin")
        }
        
        request.httpBody = body
        return request
    }
    
    // MARK: - User Sync
    
    /// Syncs the Clerk user into the backend's PostgreSQL User table.
    /// Should be called after successful authentication.
    func syncUser() async throws {
        guard let request = await makeRequest(path: "/api/users/sync", method: "POST") else {
            throw APIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("[API] syncUser status: \(httpResponse.statusCode)")
            if let raw = String(data: data, encoding: .utf8) {
                print("[API] syncUser response: \(raw.prefix(500))")
            }
        }
        
        // 2xx is success; don't throw on error — sync is best-effort
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode >= 400 {
            print("[API] syncUser failed with status \(httpResponse.statusCode)")
        }
    }
    
    // MARK: - Reports
    
    /// Fetch reports from /api/reports.
    /// Params: page, limit, priority (AVENGERS_LEVEL_THREAT / HIGH / MEDIUM / LOW), cleared (true/null)
    func fetchReports(
        priority: ReportPriority? = nil,
        cleared: Bool? = nil,
        page: Int = 1,
        limit: Int = 10000
    ) async throws -> ReportResponse {
        var queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)")
        ]
        
        if let priority {
            queryItems.append(URLQueryItem(name: "priority", value: priority.rawValue))
        }
        
        if let cleared {
            queryItems.append(URLQueryItem(name: "cleared", value: cleared ? "true" : "false"))
        }
        
        guard let request = await makeRequest(path: "/api/reports", queryItems: queryItems) else {
            throw APIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Debug logging
        if let httpResponse = response as? HTTPURLResponse {
            print("[API] fetchReports status: \(httpResponse.statusCode)")
        }
        if let raw = String(data: data, encoding: .utf8) {
            print("[API] fetchReports raw (\(data.count) bytes): \(raw.prefix(1000))")
        }
        
        try validateResponse(response)
        
        let decoder = JSONDecoder()
        
        // Try decoding as ReportResponse (object with reports key)
        if let result = try? decoder.decode(ReportResponse.self, from: data), !result.reports.isEmpty {
            return result
        }
        
        // Try decoding as plain array
        if let reports = try? decoder.decode([Report].self, from: data) {
            return ReportResponse(reports: reports, total: reports.count, page: page, limit: limit, hasMore: false)
        }
        
        // If we get here, log the raw response and return empty
        print("[API] Could not decode reports response")
        return ReportResponse(reports: [], total: 0, page: page, limit: limit, hasMore: false)
    }
    
    /// Submit a new field report via POST /api/reports/upload.
    /// The backend will run PII redaction + LLM entity extraction.
    func submitReport(_ report: NewReport) async throws -> Report? {
        let body = try JSONEncoder().encode(report)
        
        guard let request = await makeRequest(path: "/api/reports/upload", method: "POST", body: body) else {
            throw APIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("[API] submitReport status: \(httpResponse.statusCode)")
        }
        if let raw = String(data: data, encoding: .utf8) {
            print("[API] submitReport response: \(raw.prefix(1000))")
        }
        
        try validateResponse(response)
        
        // Try to decode the new backend format: { report: {...}, summary: {...}, mlResult: {...} }
        if let wrapper = try? JSONDecoder().decode(UploadResponse.self, from: data) {
            return wrapper.report
        }
        
        return try? JSONDecoder().decode(Report.self, from: data)
    }
    
    // MARK: - Heroes
    
    /// Fetch hero roster from /api/heroes
    func fetchHeroes() async throws -> [Hero] {
        guard let request = await makeRequest(path: "/api/heroes") else {
            throw APIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("[API] fetchHeroes status: \(httpResponse.statusCode)")
        }
        
        try validateResponse(response)
        
        // Try as array directly
        if let heroes = try? JSONDecoder().decode([Hero].self, from: data) {
            return heroes
        }
        
        // Try as { heroes: [...] } or { data: [...] }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for key in ["heroes", "data", "items", "results"] {
                if let arr = json[key] {
                    let arrData = try JSONSerialization.data(withJSONObject: arr)
                    if let heroes = try? JSONDecoder().decode([Hero].self, from: arrData) {
                        return heroes
                    }
                }
            }
        }
        
        return []
    }
    
    // MARK: - Inventory
    
    /// Fetch inventory records from /api/inventory
    func fetchInventory(
        sector: String? = nil,
        resource: String? = nil,
        days: Int? = nil
    ) async throws -> [InventoryRecord] {
        var queryItems: [URLQueryItem] = []
        if let sector { queryItems.append(URLQueryItem(name: "sector", value: sector)) }
        if let resource { queryItems.append(URLQueryItem(name: "resource", value: resource)) }
        if let days { queryItems.append(URLQueryItem(name: "days", value: "\(days)")) }
        
        guard let request = await makeRequest(
            path: "/api/inventory",
            queryItems: queryItems.isEmpty ? nil : queryItems
        ) else {
            throw APIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response)
        
        if let records = try? JSONDecoder().decode([InventoryRecord].self, from: data) {
            return records
        }
        
        // Try wrapped response
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for key in ["inventory", "data", "items", "records"] {
                if let arr = json[key] {
                    let arrData = try JSONSerialization.data(withJSONObject: arr)
                    if let records = try? JSONDecoder().decode([InventoryRecord].self, from: arrData) {
                        return records
                    }
                }
            }
        }
        
        return []
    }
    
    // MARK: - Forecast
    
    /// Fetch ML forecasts from /api/forecast
    func fetchForecast() async throws -> [[String: Any]] {
        guard let request = await makeRequest(path: "/api/forecast") else {
            throw APIError.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateResponse(response)
        
        // Return raw JSON since forecast structure can vary
        if let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            return json
        }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let forecasts = json["forecasts"] as? [[String: Any]] ?? json["data"] as? [[String: Any]] {
            return forecasts
        }
        
        return []
    }
    
    // MARK: - Auth Check
    
    /// Check if the current session is still authorized
    func checkAuth() async throws -> Bool {
        guard let request = await makeRequest(path: "/api/auth/check") else {
            return false
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { return false }
        return httpResponse.statusCode == 200
    }
    
    // MARK: - Validation
    
    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            throw APIError.unexpectedStatus(httpResponse.statusCode)
        }
    }
}

// MARK: - Upload Response Wrapper
struct UploadResponse: Codable {
    let report: Report
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int)
    case unexpectedStatus(Int)
    case decodingError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid request URL"
        case .invalidResponse: return "Invalid server response"
        case .unauthorized: return "Session expired. Please sign in again."
        case .forbidden: return "Access denied. You don't have permission."
        case .notFound: return "Resource not found."
        case .serverError(let code): return "Server error (\(code)). Please try again later."
        case .unexpectedStatus(let code): return "Unexpected response (\(code))."
        case .decodingError(let msg): return "Data error: \(msg)"
        }
    }
}
