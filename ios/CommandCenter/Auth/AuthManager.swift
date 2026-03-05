import Foundation
import AuthenticationServices
import SwiftUI

/// Manages Clerk authentication via Google OAuth.
/// Handles Clerk **development instance** dev-browser token requirement.
/// Flow:
///   1. POST /v1/dev_browser → get __clerk_db_jwt (dev instances only)
///   2. POST /v1/client/sign_ins { strategy: oauth_google } → get Google redirect URL
///   3. Open redirect in ASWebAuthenticationSession → Google consent → callback
///   4. Clerk creates session → extract JWT
@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()
    
    // MARK: - Published State
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var currentUser: ClerkUser?
    @Published var sessionToken: String?
    @Published var errorMessage: String?
    
    // MARK: - Internal Tokens
    private var clientToken: String?
    /// Dev browser JWT — required for Clerk development instances
    private var devBrowserToken: String?
    
    // MARK: - Storage Keys
    private let sessionTokenKey = "cc_session_token"
    private let clientTokenKey = "cc_client_token"
    private let devBrowserTokenKey = "cc_dev_browser_token"
    private let userDataKey = "cc_user_data"
    
    private var clerkAPI: String { Config.clerkFrontendAPI }
    private let redirectScheme = "commandcenter"
    
    private init() {
        loadStoredSession()
    }
    
    // MARK: - Session Persistence
    
    private func loadStoredSession() {
        clientToken = UserDefaults.standard.string(forKey: clientTokenKey)
        devBrowserToken = UserDefaults.standard.string(forKey: devBrowserTokenKey)
        
        if let token = UserDefaults.standard.string(forKey: sessionTokenKey) {
            self.sessionToken = token
            if let userData = UserDefaults.standard.data(forKey: userDataKey),
               let user = try? JSONDecoder().decode(ClerkUser.self, from: userData) {
                self.currentUser = user
                self.isAuthenticated = true
            }
            Task {
                await refreshSession()
                self.isLoading = false
            }
        } else {
            self.isLoading = false
        }
    }
    
    private func persistSession() {
        UserDefaults.standard.set(sessionToken, forKey: sessionTokenKey)
        UserDefaults.standard.set(clientToken, forKey: clientTokenKey)
        UserDefaults.standard.set(devBrowserToken, forKey: devBrowserTokenKey)
        if let user = currentUser, let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userDataKey)
        }
    }
    
    private func clearSession() {
        UserDefaults.standard.removeObject(forKey: sessionTokenKey)
        UserDefaults.standard.removeObject(forKey: clientTokenKey)
        UserDefaults.standard.removeObject(forKey: userDataKey)
        // Keep devBrowserToken — it's reusable across sessions
        sessionToken = nil
        clientToken = nil
        currentUser = nil
        isAuthenticated = false
    }
    
    // MARK: - Dev Browser Initialization
    
    /// Clerk dev instances require a "dev browser" token before any API call works.
    /// This calls POST /v1/dev_browser to obtain __clerk_db_jwt.
    private func ensureDevBrowser() async throws {
        // If we already have one, verify it's still valid
        if devBrowserToken != nil {
            return
        }
        
        guard let url = URL(string: "\(clerkAPI)/v1/dev_browser") else {
            throw AuthError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue(clerkAPI, forHTTPHeaderField: "Origin")
        request.setValue(clerkAPI, forHTTPHeaderField: "Referer")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode < 400 else {
            throw AuthError.custom("Failed to initialize Clerk dev browser session.")
        }
        
        // The token comes back in the response JSON as "token"
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let token = json["token"] as? String {
            self.devBrowserToken = token
            UserDefaults.standard.set(token, forKey: devBrowserTokenKey)
            print("[Clerk] Dev browser token acquired")
            return
        }
        
        // Also check Set-Cookie for __clerk_db_jwt
        extractDevBrowserToken(from: response)
        
        if devBrowserToken == nil {
            throw AuthError.custom("Could not obtain dev browser token from Clerk.")
        }
    }
    
    // MARK: - Google Sign-In via Clerk
    
    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil
        
        do {
            // Step 0: Initialize dev browser (required for dev instances)
            try await ensureDevBrowser()
            
            let callbackURI = "\(redirectScheme)://oauth-callback"
            
            // Step 1: Create OAuth sign-in via Clerk Frontend API
            guard let createRequest = clerkRequest(
                path: "/v1/client/sign_ins",
                method: "POST",
                body: [
                    "strategy": "oauth_google",
                    "redirect_url": callbackURI,
                    "action_complete_redirect_url": callbackURI
                ]
            ) else {
                throw AuthError.invalidURL
            }
            
            let (createData, createResponse) = try await URLSession.shared.data(for: createRequest)
            extractClientToken(from: createResponse)
            
            guard let createHTTP = createResponse as? HTTPURLResponse else {
                throw AuthError.invalidResponse
            }
            
            guard let createJSON = try? JSONSerialization.jsonObject(with: createData) as? [String: Any] else {
                let raw = String(data: createData, encoding: .utf8) ?? "empty"
                print("[Clerk] sign_ins raw response: \(raw)")
                throw AuthError.invalidResponse
            }
            
            print("[Clerk] sign_ins status: \(createHTTP.statusCode)")
            print("[Clerk] sign_ins response: \(createJSON)")
            
            if createHTTP.statusCode >= 400 {
                // Check if we are already signed in
                if let errors = createJSON["errors"] as? [[String: Any]],
                   errors.first(where: { $0["code"] as? String == "session_exists" }) != nil {
                    print("[Clerk] Session already exists. Fetching existing session.")
                    
                    if let meta = createJSON["meta"] as? [String: Any],
                       let client = meta["client"] as? [String: Any],
                       let sessionInfo = extractSession(from: ["client": client]) {
                        // Extract directly from the error response
                        print("[Clerk] Extracted session directly from error response metadata")
                        self.sessionToken = sessionInfo.jwt
                        if let userDict = sessionInfo.user, let user = parseUser(from: userDict) {
                            self.currentUser = user
                        }
                        persistSession()
                        isAuthenticated = true
                    } else {
                        // Fallback to a network fetch
                        await fetchClientSession()
                    }
                    
                    if isAuthenticated {
                        Task { try? await APIService.shared.syncUser() }
                        isLoading = false
                        return
                    } else {
                        throw AuthError.custom("You are already signed in, but we couldn't retrieve your session data. Please restart the app.")
                    }
                }
                
                let msg = parseClerkError(createJSON) ?? "Could not start Google sign-in. Status: \(createHTTP.statusCode)"
                throw AuthError.custom(msg)
            }
            
            // Extract the external verification redirect URL
            let signInResponse = createJSON["response"] as? [String: Any] ?? createJSON
            guard var externalRedirectURL = extractOAuthRedirectURL(from: signInResponse) else {
                throw AuthError.custom("No Google redirect URL returned from Clerk. Make sure Google OAuth is enabled in your Clerk dashboard.")
            }
            
            // IMPORTANT: Append __clerk_db_jwt to the redirect URL for dev instances
            if let dbToken = devBrowserToken {
                let separator = externalRedirectURL.contains("?") ? "&" : "?"
                externalRedirectURL += "\(separator)__clerk_db_jwt=\(dbToken)"
            }
            
            guard let oauthURL = URL(string: externalRedirectURL) else {
                throw AuthError.custom("Invalid OAuth redirect URL.")
            }
            
            print("[Clerk] Opening OAuth URL: \(oauthURL)")
            
            // Step 2: Open Google OAuth in ASWebAuthenticationSession
            let callbackURL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                let session = ASWebAuthenticationSession(
                    url: oauthURL,
                    callbackURLScheme: self.redirectScheme
                ) { callbackURL, error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else if let callbackURL = callbackURL {
                        continuation.resume(returning: callbackURL)
                    } else {
                        continuation.resume(throwing: AuthError.noCallback)
                    }
                }
                session.prefersEphemeralWebBrowserSession = false
                session.presentationContextProvider = WebAuthContextProvider.shared
                session.start()
            }
            
            print("[Clerk] Callback URL: \(callbackURL)")
            
            // Step 3: Process the callback
            await processOAuthCallback(callbackURL)
            
            // Step 4: If no token yet, fetch client session
            if sessionToken == nil || !isAuthenticated {
                await fetchClientSession()
            }
            
            if sessionToken != nil {
                if currentUser == nil {
                    await fetchCurrentUser()
                }
                persistSession()
                isAuthenticated = true
                
                // Sync user to backend after successful auth
                Task {
                    try? await APIService.shared.syncUser()
                }
            } else {
                throw AuthError.custom("Google sign-in completed but no session was created. Please try again.")
            }
            
        } catch {
            if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                // User cancelled — not an error
            } else if let authError = error as? AuthError {
                errorMessage = authError.errorDescription
            } else {
                errorMessage = error.localizedDescription
            }
        }
        
        isLoading = false
    }
    
    // MARK: - OAuth Callback Processing
    
    private func processOAuthCallback(_ callbackURL: URL) async {
        guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else { return }
        
        let allParams = components.queryItems ?? []
        
        // Check for rotating_token (Clerk returns this after OAuth)
        if let rotatingToken = allParams.first(where: { $0.name == "__clerk_created_session" })?.value, !rotatingToken.isEmpty {
            // Clerk created a session — fetch it
            await fetchClientSession()
            return
        }
        
        // Check for session token directly
        let tokenKeys = ["session_token", "__clerk_session", "token", "__session", "session_id"]
        for key in tokenKeys {
            if let value = allParams.first(where: { $0.name == key })?.value, !value.isEmpty {
                self.sessionToken = value
                return
            }
        }
        
        // Check fragment
        if let fragment = components.fragment {
            let fragmentItems = URLComponents(string: "?\(fragment)")?.queryItems ?? []
            for key in tokenKeys {
                if let value = fragmentItems.first(where: { $0.name == key })?.value, !value.isEmpty {
                    self.sessionToken = value
                    return
                }
            }
        }
        
        // If we get here with any callback at all, try fetching the client session
        // (Clerk may have set cookies during the OAuth redirect chain)
        await fetchClientSession()
    }
    
    // MARK: - Sign Out
    
    func signOut() {
        clearSession()
    }
    
    // MARK: - Clerk API Helpers
    
    /// Build a URLRequest to the Clerk Frontend API, attaching dev browser + client tokens.
    private func clerkRequest(path: String, method: String = "GET", body: [String: Any]? = nil) -> URLRequest? {
        // Append __clerk_db_jwt as query parameter for dev instances
        var urlString = "\(clerkAPI)\(path)"
        if let dbToken = devBrowserToken {
            let separator = urlString.contains("?") ? "&" : "?"
            urlString += "\(separator)__clerk_db_jwt=\(dbToken)"
        }
        
        guard let url = URL(string: urlString) else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue(clerkAPI, forHTTPHeaderField: "Origin")
        request.setValue(clerkAPI, forHTTPHeaderField: "Referer")
        
        // Build cookie header with both tokens
        var cookieParts: [String] = []
        if let clientToken {
            cookieParts.append("__client=\(clientToken)")
        }
        if let devBrowserToken {
            cookieParts.append("__clerk_db_jwt=\(devBrowserToken)")
        }
        if !cookieParts.isEmpty {
            request.setValue(cookieParts.joined(separator: "; "), forHTTPHeaderField: "Cookie")
        }
        
        if let body {
            let formBody = body.map { key, value in
                let k = key.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? key
                let v = String(describing: value).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                return "\(k)=\(v)"
            }.joined(separator: "&")
            request.httpBody = formBody.data(using: .utf8)
        }
        
        return request
    }
    
    private func extractClientToken(from response: URLResponse) {
        guard let httpResponse = response as? HTTPURLResponse else { return }
        
        // HTTPURLResponse might merge Set-Cookie headers; also check via HTTPCookieStorage
        let allHeaders = httpResponse.allHeaderFields
        
        for (key, value) in allHeaders {
            guard let headerName = key as? String,
                  headerName.lowercased() == "set-cookie",
                  let headerValue = value as? String else { continue }
            
            parseCookies(from: headerValue)
        }
        
        // Also try the direct accessor
        if let setCookie = httpResponse.value(forHTTPHeaderField: "Set-Cookie") {
            parseCookies(from: setCookie)
        }
    }
    
    private func parseCookies(from headerValue: String) {
        // Set-Cookie values might be comma-separated (multiple cookies)
        // but also cookie values can contain commas in expires dates
        // Split on pattern: ", <cookiename>=" to be safer
        let segments = headerValue.components(separatedBy: ";")
        
        for segment in segments {
            let trimmed = segment.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("__client=") {
                let token = String(trimmed.dropFirst("__client=".count))
                if !token.isEmpty && token != "\"\"" {
                    self.clientToken = token
                }
            }
            if trimmed.hasPrefix("__clerk_db_jwt=") {
                let token = String(trimmed.dropFirst("__clerk_db_jwt=".count))
                if !token.isEmpty && token != "\"\"" {
                    self.devBrowserToken = token
                    UserDefaults.standard.set(token, forKey: devBrowserTokenKey)
                }
            }
        }
    }
    
    private func extractDevBrowserToken(from response: URLResponse) {
        guard let httpResponse = response as? HTTPURLResponse else { return }
        
        if let setCookie = httpResponse.value(forHTTPHeaderField: "Set-Cookie") {
            parseCookies(from: setCookie)
        }
        
        for (key, value) in httpResponse.allHeaderFields {
            guard let headerName = key as? String,
                  headerName.lowercased() == "set-cookie",
                  let headerValue = value as? String else { continue }
            parseCookies(from: headerValue)
        }
    }
    
    /// Extract the OAuth redirect URL from Clerk's sign_in response.
    private func extractOAuthRedirectURL(from response: [String: Any]) -> String? {
        // Path 1: response.external_verification_redirect_url (top-level on the sign_in object)
        if let url = response["external_verification_redirect_url"] as? String, !url.isEmpty {
            return url
        }
        
        // Path 2: response.external_verification.redirect_url
        if let ev = response["external_verification"] as? [String: Any] {
            if let url = ev["redirect_url"] as? String, !url.isEmpty { return url }
            if let url = ev["external_verification_redirect_url"] as? String, !url.isEmpty { return url }
        }
        
        // Path 3: response.first_factor_verification.external_verification_redirect_url
        if let ffv = response["first_factor_verification"] as? [String: Any] {
            if let url = ffv["external_verification_redirect_url"] as? String, !url.isEmpty { return url }
            if let url = ffv["redirect_url"] as? String, !url.isEmpty { return url }
        }
        
        // Path 4: top-level redirect_url
        if let url = response["redirect_url"] as? String, !url.isEmpty {
            return url
        }
        
        return nil
    }
    
    private func extractSession(from json: [String: Any]) -> (jwt: String, user: [String: Any]?)? {
        let response = json["response"] as? [String: Any] ?? json
        let client = json["client"] as? [String: Any] ?? response
        
        let sessions = (client["sessions"] as? [[String: Any]])
            ?? (response["sessions"] as? [[String: Any]])
            ?? ((response["client"] as? [String: Any])?["sessions"] as? [[String: Any]])
        
        if let session = sessions?.last {
            if let tokenObj = session["last_active_token"] as? [String: Any],
               let jwt = tokenObj["jwt"] as? String {
                let user = session["user"] as? [String: Any]
                return (jwt, user)
            }
        }
        
        if let createdSessionId = response["created_session_id"] as? String,
           let sessions = sessions {
            for session in sessions where (session["id"] as? String) == createdSessionId {
                if let tokenObj = session["last_active_token"] as? [String: Any],
                   let jwt = tokenObj["jwt"] as? String {
                    let user = session["user"] as? [String: Any]
                    return (jwt, user)
                }
            }
        }
        
        return nil
    }
    
    private func parseUser(from dict: [String: Any]) -> ClerkUser? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(ClerkUser.self, from: data)
    }
    
    // MARK: - Session Management
    
    private func fetchClientSession() async {
        guard let request = clerkRequest(path: "/v1/client") else { return }
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            extractClientToken(from: response)
            
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let sessionInfo = extractSession(from: json) {
                self.sessionToken = sessionInfo.jwt
                if let userDict = sessionInfo.user, let user = parseUser(from: userDict) {
                    self.currentUser = user
                }
                persistSession()
                isAuthenticated = true
            }
        } catch {
            // Silent failure
        }
    }
    
    private func refreshSession() async {
        guard clientToken != nil else {
            clearSession()
            return
        }
        // Re-establish dev browser if needed
        try? await ensureDevBrowser()
        await fetchClientSession()
    }
    
    private func fetchCurrentUser() async {
        guard let token = sessionToken else { return }
        
        var urlString = "\(clerkAPI)/v1/me"
        if let dbToken = devBrowserToken {
            urlString += "?__clerk_db_jwt=\(dbToken)"
        }
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        var cookieParts: [String] = []
        if let clientToken { cookieParts.append("__client=\(clientToken)") }
        if let devBrowserToken { cookieParts.append("__clerk_db_jwt=\(devBrowserToken)") }
        if !cookieParts.isEmpty {
            request.setValue(cookieParts.joined(separator: "; "), forHTTPHeaderField: "Cookie")
        }
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let response = json["response"] as? [String: Any] ?? json
                if let user = parseUser(from: response) {
                    self.currentUser = user
                }
            }
        } catch {
            // Not critical
        }
    }
    
    private func parseClerkError(_ json: [String: Any]) -> String? {
        if let errors = json["errors"] as? [[String: Any]], let first = errors.first {
            return first["long_message"] as? String
                ?? first["message"] as? String
                ?? first["code"] as? String
        }
        return nil
    }
}

// MARK: - Models

struct ClerkUser: Codable, Identifiable {
    let id: String
    let firstName: String?
    let lastName: String?
    let emailAddresses: [ClerkEmail]?
    let imageUrl: String?
    
    var displayName: String {
        if let first = firstName, let last = lastName, !first.isEmpty {
            return "\(first) \(last)"
        }
        return firstName ?? emailAddresses?.first?.emailAddress ?? "User"
    }
    
    var email: String {
        emailAddresses?.first?.emailAddress ?? ""
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
        case emailAddresses = "email_addresses"
        case imageUrl = "image_url"
    }
}

struct ClerkEmail: Codable {
    let id: String
    let emailAddress: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case emailAddress = "email_address"
    }
}

// MARK: - Errors

enum AuthError: LocalizedError {
    case noCallback
    case invalidResponse
    case invalidURL
    case custom(String)
    
    var errorDescription: String? {
        switch self {
        case .noCallback: return "No authentication callback received"
        case .invalidResponse: return "Invalid response from authentication server"
        case .invalidURL: return "Could not build request URL"
        case .custom(let msg): return msg
        }
    }
}

// MARK: - Web Auth Context

class WebAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthContextProvider()
    
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
