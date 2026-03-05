# Command Center iOS

Companion iOS app for the SentinelSupply Command Center. Built with **SwiftUI** and **Clerk** authentication.

## Requirements

- **Xcode 15+**
- **iOS 17.0+**
- macOS Sonoma or later

## Setup

1. Open `CommandCenter.xcodeproj` in Xcode
2. Update `Config.swift` with your **backend URL** and **API key**:
   ```swift
   static let backendBaseURL = "https://your-backend-url.up.railway.app"
   static let apiKey = "your-api-key"
   ```
3. Select your team under Signing & Capabilities
4. Build and run on a simulator or device

## Features

| Feature | Description |
|---|---|
| **Clerk Auth** | Sign in via browser-based OAuth or email/password through Clerk |
| **Dashboard** | Overview with stats cards and recent reports |
| **Reports** | Browse, filter, and search reports by priority and cleared status |
| **Create Report** | Submit new field reports directly to the backend API |
| **Heroes** | View hero assignment status |
| **Inventory** | Browse inventory records by sector/resource |
| **Profile** | View account info and sign out |

## API Integration

The app communicates with the backend via `APIService.swift`:

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/users/sync` | Sync Clerk user on login |
| GET | `/api/reports?page=&limit=&priority=&cleared=` | Fetch paginated reports |
| POST | `/api/reports/upload` | Submit a new field report |
| GET | `/api/heroes` | Fetch hero list |
| GET | `/api/inventory?sector=&resource=&days=` | Fetch inventory records |
| GET | `/api/forecast` | Fetch forecast data |
| GET | `/api/auth/check` | Verify auth token |

All requests include:
- `x-api-key` header with the configured API key
- `Authorization: Bearer <clerk_token>` when authenticated

## Architecture

```
CommandCenter/
├── Auth/
│   └── AuthManager.swift            # Clerk auth (OAuth + email/password)
├── Models/
│   └── Report.swift                 # Report, ReportSummary, Hero, Inventory models
├── Services/
│   └── APIService.swift             # REST API client (singleton)
├── ViewModels/
│   ├── ReportsViewModel.swift       # Reports list state management
│   └── CreateReportViewModel.swift  # Report creation state
├── Views/
│   ├── LoginView.swift              # Dark-themed login screen
│   ├── MainTabView.swift            # Tab bar (Dashboard/Reports/New/Profile)
│   ├── DashboardView.swift          # Stats + recent reports
│   ├── ReportsListView.swift        # Filterable reports list + detail
│   ├── CreateReportView.swift       # Report submission form
│   └── ProfileView.swift            # User profile + sign out
├── CommandCenterApp.swift           # @main app entry point
├── ContentView.swift                # Auth routing (loading → login → main)
├── Config.swift                     # API keys & endpoint configuration
├── ShieldTheme.swift                # Custom dark theme styling
└── Assets.xcassets/                 # App icons & colors
```

## Custom URL Scheme

The app registers `commandcenter://` for Clerk OAuth callbacks. This is configured in `Info.plist`.

## Regenerating the Xcode Project

If you modify `project.yml`:

```bash
brew install xcodegen  # if not installed
xcodegen generate
```
