import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { FCMNotifications } from "./components/FCMNotifications";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Overtime from "./pages/Overtime";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import EmployeeView from "./pages/EmployeeView";
import FaceEnrollment from "./pages/FaceEnrollment";
import LeaveRequest from "./pages/LeaveRequest";
import OvertimeRequest from "./pages/OvertimeRequest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FCMNotifications />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/employees" element={<ProtectedRoute requireAdmin><Employees /></ProtectedRoute>} />
            <Route path="/dashboard/attendance" element={<ProtectedRoute requireAdmin><Attendance /></ProtectedRoute>} />
            <Route path="/dashboard/leave" element={<ProtectedRoute requireAdmin><Leave /></ProtectedRoute>} />
            <Route path="/dashboard/overtime" element={<ProtectedRoute requireAdmin><Overtime /></ProtectedRoute>} />
            <Route path="/dashboard/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/notifications" element={<ProtectedRoute requireAdmin><Notifications /></ProtectedRoute>} />
            <Route path="/employee" element={<ProtectedRoute><EmployeeView /></ProtectedRoute>} />
            <Route path="/employee/face-enrollment" element={<ProtectedRoute><FaceEnrollment /></ProtectedRoute>} />
            <Route path="/employee/leave-request" element={<ProtectedRoute><LeaveRequest /></ProtectedRoute>} />
            <Route path="/employee/overtime-request" element={<ProtectedRoute><OvertimeRequest /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
