import { Navigate, Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import ChatPage from "../pages/UserChatPage";
import AiChat from "../pages/AIChatPage";
import Login from "../pages/AuthPage";
import Home from "../pages/Home";
import Credits from "../pages/Credits";
import GroupsPage from "../pages/GroupsPage";
import SettingsPage from "../pages/SettingsPage";
import AiAvatarPage from "../pages/AiAvatarPage";
import ProfilePage from "../pages/ProfilePage";
import NotFoundPage from "../pages/NotFoundPage";
import ChatMediaPage from "../pages/ChatMediaPage";
import JoinGroupPage from "../pages/JoinGroupPage";
import OpsTodayPage from "../pages/admin/OpsTodayPage";
import OpsTrendsPage from "../pages/admin/OpsTrendsPage";
import OpsHealthPage from "../pages/admin/OpsHealthPage";
import OpsBillingPage from "../pages/admin/OpsBillingPage";
import AdminRolesPage from "../pages/admin/AdminRolesPage";
import AdminRoute from "../components/routes/AdminRoute";
import AdminOverviewPage from "../pages/admin/AdminOverviewPage";
import AdminUsersPage from "../pages/admin/AdminUsersPage";
import AdminEntitlementsPage from "../pages/admin/AdminEntitlementsPage";
import AdminAiUsagePage from "../pages/admin/AdminAiUsagePage";
import AiThreadPage from "../pages/AiThreadPage";
import AdminReportsPage from "../pages/admin/AdminReportsPage";
import AdminGroupsPage from "../pages/admin/AdminGroupsPage";
import AdminCallsPage from "../pages/admin/AdminCallsPage";
import AdminAuditLogsPage from "../pages/admin/AdminAuditLogsPage";
import AdminSystemHealthPage from "../pages/admin/AdminSystemHealthPage";
import SemanticSearchPage from "../pages/SemanticSearchPage";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:chatId/media" element={<ChatMediaPage />} />
      <Route path="/chat/:chatId" element={<ChatPage />} />
      <Route path="/chat/:chatTitle/:chatId" element={<ChatPage />} />
      <Route path="/ai/" element={<AiChat />} />
      <Route path="/ai/:chatId" element={<AiChat />} />
      <Route path="/ai/thread/:threadId" element={<AiThreadPage />} />
      <Route path="/ai/avatar/:avatarId" element={<AiAvatarPage />} />
      <Route path="/search" element={<SemanticSearchPage />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/groups/:groupId" element={<GroupsPage />} />
      <Route path="/groups/join/:token" element={<JoinGroupPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/admin" element={<AdminRoute><Navigate to="/admin/overview" replace /></AdminRoute>} />
      <Route path="/admin/overview" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
      <Route path="/admin/entitlements" element={<AdminRoute><AdminEntitlementsPage /></AdminRoute>} />
      <Route path="/admin/ai/usage" element={<AdminRoute><AdminAiUsagePage /></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><AdminReportsPage /></AdminRoute>} />
      <Route path="/admin/groups" element={<AdminRoute><AdminGroupsPage /></AdminRoute>} />
      <Route path="/admin/calls" element={<AdminRoute><AdminCallsPage /></AdminRoute>} />
      <Route path="/admin/audit" element={<AdminRoute><AdminAuditLogsPage /></AdminRoute>} />
      <Route path="/admin/system-health" element={<AdminRoute allow={["ADMIN", "SUPERADMIN"]}><AdminSystemHealthPage /></AdminRoute>} />
      <Route
        path="/admin/ops"
        element={
          <AdminRoute>
            <Navigate to="/admin/ops/today" replace />
          </AdminRoute>
        }
      />
      <Route path="/admin/ops/today" element={<AdminRoute><OpsTodayPage /></AdminRoute>} />
      <Route path="/admin/ops/trends" element={<AdminRoute><OpsTrendsPage /></AdminRoute>} />
      <Route path="/admin/ops/health" element={<AdminRoute><OpsHealthPage /></AdminRoute>} />
      <Route path="/admin/ops/billing" element={<AdminRoute><OpsBillingPage /></AdminRoute>} />
      <Route path="/admin/security/roles" element={<AdminRoute allow={["ADMIN", "SUPERADMIN"]}><AdminRolesPage /></AdminRoute>} />
      <Route path="/profilepage" element={<ProfilePage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

