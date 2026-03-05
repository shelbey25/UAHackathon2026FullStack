import Foundation

// MARK: - Report Priority (from backend)

enum ReportPriority: String, Codable, CaseIterable {
    case avengersLevelThreat = "AVENGERS_LEVEL_THREAT"
    case high = "HIGH"
    case medium = "MEDIUM"
    case low = "LOW"
    
    var displayName: String {
        switch self {
        case .avengersLevelThreat: return "AVENGERS"
        case .high: return "High"
        case .medium: return "Medium"
        case .low: return "Low"
        }
    }
    
    var color: String {
        switch self {
        case .avengersLevelThreat: return "red"
        case .high: return "orange"
        case .medium: return "yellow"
        case .low: return "green"
        }
    }
}

// MARK: - Report Summary (ML-processed)

struct ReportSummary: Codable {
    let id: Int?
    let reportId: Int?
    let redactedText: String?
    let resource: String?
    let urgency: String?
    let entitiesJson: AnyCodable?
    let riskScore: Double?
    
    enum CodingKeys: String, CodingKey {
        case id, resource, urgency
        case reportId = "reportId"
        case redactedText = "redactedText"
        case entitiesJson = "entitiesJson"
        case riskScore = "riskScore"
    }
}

// MARK: - Report (combined RawReport + optional Summary)

struct Report: Codable, Identifiable {
    // RawReport fields
    let id: IntOrString
    let sector: String?
    let receivedAt: String?   // ISO date string from backend
    let rawText: String?
    
    // Extra fields the API may include
    let priority: String?
    let cleared: Bool?
    let status: String?
    
    // Nested summary (ML output)
    let summary: ReportSummary?
    
    // Flattened summary fields (some APIs flatten these)
    let redactedText: String?
    let resource: String?
    let urgency: String?
    let riskScore: Double?
    let entitiesJson: AnyCodable?
    
    // Legacy/alternative field names
    let title: String?
    let content: String?
    let author: String?
    let authorEmail: String?
    let category: String?
    let createdAt: String?
    let updatedAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, sector, rawText, priority, cleared, status, summary
        case receivedAt, redactedText, resource, urgency, riskScore, entitiesJson
        case title, content, author, category, createdAt, updatedAt
        case authorEmail = "authorEmail"
    }
    
    // Convenience accessors
    var displayTitle: String {
        title ?? sector ?? "Field Report"
    }
    
    var displayContent: String {
        summary?.redactedText ?? redactedText ?? rawText ?? content ?? ""
    }
    
    var displaySector: String {
        sector ?? category ?? "Unknown Sector"
    }
    
    var displayPriority: ReportPriority? {
        guard let p = priority ?? urgency ?? summary?.urgency else { return nil }
        return ReportPriority(rawValue: p)
    }
    
    var displayRiskScore: Double? {
        riskScore ?? summary?.riskScore
    }
    
    var displayResource: String? {
        resource ?? summary?.resource
    }
    
    var displayDate: Date {
        let dateStr = receivedAt ?? createdAt
        guard let str = dateStr else { return Date() }
        
        // Try multiple ISO 8601 formats
        let formatters: [DateFormatter] = {
            let f1 = DateFormatter()
            f1.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
            let f2 = DateFormatter()
            f2.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
            let f3 = DateFormatter()
            f3.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
            f3.timeZone = TimeZone(abbreviation: "UTC")
            let f4 = DateFormatter()
            f4.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
            f4.timeZone = TimeZone(abbreviation: "UTC")
            return [f1, f2, f3, f4]
        }()
        
        for formatter in formatters {
            if let date = formatter.date(from: str) { return date }
        }
        
        // Try ISO8601DateFormatter
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: str) { return date }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: str) { return date }
        
        return Date()
    }
    
    var displayAuthor: String {
        author ?? sector ?? "Field Agent"
    }
    
    var isCleared: Bool {
        cleared ?? false
    }
    
    // Flexible init from decoder — tolerates missing/extra fields
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        
        // ID can be Int or String
        self.id = (try? c.decode(IntOrString.self, forKey: .id)) ?? .string("0")
        self.sector = try? c.decode(String.self, forKey: .sector)
        self.receivedAt = try? c.decode(String.self, forKey: .receivedAt)
        self.rawText = try? c.decode(String.self, forKey: .rawText)
        self.priority = try? c.decode(String.self, forKey: .priority)
        self.cleared = try? c.decode(Bool.self, forKey: .cleared)
        self.status = try? c.decode(String.self, forKey: .status)
        self.summary = try? c.decode(ReportSummary.self, forKey: .summary)
        self.redactedText = try? c.decode(String.self, forKey: .redactedText)
        self.resource = try? c.decode(String.self, forKey: .resource)
        self.urgency = try? c.decode(String.self, forKey: .urgency)
        self.riskScore = try? c.decode(Double.self, forKey: .riskScore)
        self.entitiesJson = try? c.decode(AnyCodable.self, forKey: .entitiesJson)
        self.title = try? c.decode(String.self, forKey: .title)
        self.content = try? c.decode(String.self, forKey: .content)
        self.author = try? c.decode(String.self, forKey: .author)
        self.authorEmail = try? c.decode(String.self, forKey: .authorEmail)
        self.category = try? c.decode(String.self, forKey: .category)
        self.createdAt = try? c.decode(String.self, forKey: .createdAt)
        self.updatedAt = try? c.decode(String.self, forKey: .updatedAt)
    }
    
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(sector, forKey: .sector)
        try c.encodeIfPresent(rawText, forKey: .rawText)
        try c.encodeIfPresent(priority, forKey: .priority)
    }
}

// MARK: - Flexible ID (Int or String)

enum IntOrString: Codable, Hashable {
    case int(Int)
    case string(String)
    
    var stringValue: String {
        switch self {
        case .int(let v): return "\(v)"
        case .string(let v): return v
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(Int.self) {
            self = .int(v)
        } else if let v = try? container.decode(String.self) {
            self = .string(v)
        } else {
            self = .string("0")
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .int(let v): try container.encode(v)
        case .string(let v): try container.encode(v)
        }
    }
}

// MARK: - AnyCodable (for entitiesJson which can be any JSON)

struct AnyCodable: Codable {
    let value: Any
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else if let arr = try? container.decode([AnyCodable].self) {
            value = arr.map { $0.value }
        } else if let str = try? container.decode(String.self) {
            value = str
        } else if let num = try? container.decode(Double.self) {
            value = num
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else {
            value = NSNull()
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let v = value as? String { try container.encode(v) }
        else if let v = value as? Double { try container.encode(v) }
        else if let v = value as? Bool { try container.encode(v) }
        else if let v = value as? Int { try container.encode(v) }
        else { try container.encodeNil() }
    }
}

// MARK: - Report Response (paginated)

struct ReportResponse: Codable {
    let reports: [Report]
    let total: Int?
    let page: Int?
    let limit: Int?
    let hasMore: Bool?
    
    enum CodingKeys: String, CodingKey {
        case reports, total, page, limit
        case hasMore = "has_more"
        // alternative keys
        case data, items, results, pagination, meta
        case totalPages = "totalPages"
        case totalCount = "totalCount"
    }
    
    init(reports: [Report], total: Int?, page: Int?, limit: Int?, hasMore: Bool?) {
        self.reports = reports
        self.total = total
        self.page = page
        self.limit = limit
        self.hasMore = hasMore
    }
    
    init(from decoder: Decoder) throws {
        // Try keyed container first
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            // Try various keys for the report array
            let reportArray: [Report]? =
                (try? container.decode([Report].self, forKey: .reports)) ??
                (try? container.decode([Report].self, forKey: .data)) ??
                (try? container.decode([Report].self, forKey: .items)) ??
                (try? container.decode([Report].self, forKey: .results))
            
            self.reports = reportArray ?? []
            self.total = (try? container.decode(Int.self, forKey: .total))
                ?? (try? container.decode(Int.self, forKey: .totalCount))
            self.page = try? container.decode(Int.self, forKey: .page)
            self.limit = try? container.decode(Int.self, forKey: .limit)
            
            let totalPages = try? container.decode(Int.self, forKey: .totalPages)
            if let hasMore = try? container.decode(Bool.self, forKey: .hasMore) {
                self.hasMore = hasMore
            } else if let page = self.page, let totalPages {
                self.hasMore = page < totalPages
            } else if let total = self.total, let page = self.page, let limit = self.limit, limit > 0 {
                self.hasMore = (page * limit) < total
            } else {
                self.hasMore = false
            }
            
            // If no reports found at any key, it might be the array itself is the response
            if self.reports.isEmpty, reportArray == nil {
                // Try as pagination wrapper
                if let meta = try? container.decode([String: Int].self, forKey: .meta),
                   let _ = meta["total"] {
                    // Some other structure
                }
            }
        }
        // Try as plain array
        else if let reports = try? [Report](from: decoder) {
            self.reports = reports
            self.total = reports.count
            self.page = 1
            self.limit = reports.count
            self.hasMore = false
        } else {
            self.reports = []
            self.total = 0
            self.page = 1
            self.limit = 0
            self.hasMore = false
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(reports, forKey: .reports)
        try container.encodeIfPresent(total, forKey: .total)
        try container.encodeIfPresent(page, forKey: .page)
        try container.encodeIfPresent(limit, forKey: .limit)
        try container.encodeIfPresent(hasMore, forKey: .hasMore)
    }
}

// MARK: - New Report (for POST)

struct NewReport: Codable {
    let rawText: String
    let sector: String?
    let priority: String?
    let email: String?
    
    enum CodingKeys: String, CodingKey {
        case rawText, sector, priority, email
    }
}

// MARK: - Hero

struct Hero: Codable, Identifiable {
    let id: IntOrString
    let name: String?
    let assignedSector: String?
    let status: String?
    
    var displayName: String { name ?? "Unknown" }
    
    enum CodingKeys: String, CodingKey {
        case id, name, status
        case assignedSector = "assignedSector"
    }
    
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? c.decode(IntOrString.self, forKey: .id)) ?? .string("0")
        self.name = try? c.decode(String.self, forKey: .name)
        self.assignedSector = try? c.decode(String.self, forKey: .assignedSector)
        self.status = try? c.decode(String.self, forKey: .status)
    }
    
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(assignedSector, forKey: .assignedSector)
        try c.encodeIfPresent(status, forKey: .status)
    }
}

// MARK: - Inventory Record

struct InventoryRecord: Codable, Identifiable {
    let id: IntOrString
    let sector: String?
    let resource: String?
    let timestamp: String?
    let quantity: Double?
    let anomaly: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id, sector, resource, timestamp, quantity, anomaly
    }
    
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = (try? c.decode(IntOrString.self, forKey: .id)) ?? .string("0")
        self.sector = try? c.decode(String.self, forKey: .sector)
        self.resource = try? c.decode(String.self, forKey: .resource)
        self.timestamp = try? c.decode(String.self, forKey: .timestamp)
        self.quantity = try? c.decode(Double.self, forKey: .quantity)
        self.anomaly = try? c.decode(Bool.self, forKey: .anomaly)
    }
    
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(sector, forKey: .sector)
        try c.encodeIfPresent(resource, forKey: .resource)
        try c.encodeIfPresent(timestamp, forKey: .timestamp)
        try c.encodeIfPresent(quantity, forKey: .quantity)
        try c.encodeIfPresent(anomaly, forKey: .anomaly)
    }
}

// MARK: - Known Sectors & Resources

enum KnownSector: String, CaseIterable {
    case avengersCompound = "Avengers Compound"
    case newAsgard = "New Asgard"
    case sanctumSanctorum = "Sanctum Sanctorum"
    case sokovia = "Sokovia"
    case wakanda = "Wakanda"
}

enum KnownResource: String, CaseIterable {
    case arcReactorCores = "Arc Reactor Cores"
    case cleanWater = "Clean Water (L)"
    case medicalKits = "Medical Kits"
    case pymParticles = "Pym Particles"
    case vibranium = "Vibranium (kg)"
}

// MARK: - Legacy Person (kept for compatibility)

struct Person: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let email: String?
    
    var displayName: String { name }
}
