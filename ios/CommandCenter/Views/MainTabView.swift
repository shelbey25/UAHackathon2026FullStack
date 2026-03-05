import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager
    
    init() {
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithOpaqueBackground()
        tabBarAppearance.backgroundColor = UIColor(ShieldTheme.background)
        tabBarAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(ShieldTheme.textMuted)
        tabBarAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(ShieldTheme.textMuted)]
        tabBarAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(ShieldTheme.accentCyan)
        tabBarAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(ShieldTheme.accentCyan)]
        UITabBar.appearance().standardAppearance = tabBarAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
    }
    
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "square.grid.2x2.fill")
                }
            
            ReportsListView()
                .tabItem {
                    Label("Reports", systemImage: "doc.text.fill")
                }
            
            CreateReportView()
                .tabItem {
                    Label("New Report", systemImage: "plus.circle.fill")
                }
            
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle.fill")
                }
        }
        .tint(ShieldTheme.accentCyan)
    }
}
