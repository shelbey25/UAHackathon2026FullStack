# Command Center iOS

Companion iOS app for the Command Center web dashboard. Built with **SwiftUI** and **Clerk** authentication.

## Requirements

- **Xcode 15+**
- **iOS 17.0+**
- macOS Sonoma or later

## Setup

1. Open `CommandCenter.xcodeproj` in Xcode
2. Update `Config.swift` with your **backend URL**:
   ```swift
   static let backendBaseURL = "https://your-backend-url.vercel.app"
   ```
3. Select your team under Signing & Capabilities
4. Build and run on a simulator or device

## Features

| Feature | Description |
|---|---|
| **Clerk Auth** | Sign in via browser-based OAuth or email/password through Clerk |
| **Dashboard** | Overview with stats cards and recent reports |
| **Reports** | Browse, search, and filter reports by person |
| **Create Report** | Submit new reports directly to the backend API |
| **Profile** | View account info and sign out |

## Architecture

```
CommandCenter/
├── Auth/
│   └── AuthManager.swift        # Clerk auth (OAuth + email/password)
├── Models/
│   └── Report.swift             # Report, Person, NewReport models
├── Services/
│   └── APIService.swift         # REST API client
├── ViewModels/
│   ├── ReportsViewModel.swift   # Reports list state
│   └── CreateReportViewModel.swift
├── Views/
│   ├── LoginView.swift          # Dark-themed login screen
│   ├── MainTabView.swift        # Tab bar (Dashboard/Reports/New/Profile)
│   ├── DashboardView.swift      # Stats + recent reports
│   ├── ReportsListView.swift    # Filterable reports list + detail
│   ├── CreateReportView.swift   # Report submission form
│   └── ProfileView.swift        # User profile + sign out
├── CommandCenterApp.swift       # App entry point
├── ContentView.swift            # Auth routing
└── Config.swift                 # API keys & endpoints
```

## API Integration

The app communicates with your backend via REST:

- `GET /api/reports?person=&page=&limit=` — Fetch reports with optional filter
- `POST /api/reports` — Submit a new report
- `GET /api/people` — Fetch list of people for filtering

All requests include:
- `x-api-key` header with the configured API key
- `Authorization: Bearer <clerk_token>` when authenticated

## Custom URL Scheme

The app registers `commandcenter://` for Clerk OAuth callbacks. This is configured in `Info.plist`.

## Regenerating the Xcode Project

If you modify `project.yml`:

```bash
brew install xcodegen  # if not installed
xcodegen generate
```
