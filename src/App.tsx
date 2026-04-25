import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoute } from "@/components/AdminRoute";
import Index from "./pages/Index";
import CheckoutReturn from "./pages/CheckoutReturn";
import Subscription from "./pages/Subscription";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ChannelSearch from "./pages/ChannelSearch";
import NicheExplorer from "./pages/NicheExplorer";
import Onboarding from "./pages/Onboarding";
import Scripts from "./pages/Scripts";
import Channels from "./pages/Channels";
import Pricing from "./pages/Pricing";
import Titles from "./pages/Titles";
import ViralDatabase from "./pages/ViralDatabase";
import MultiChannel from "./pages/MultiChannel";
import KnowledgeAdmin from "./pages/KnowledgeAdmin";
import Tracker30Days from "./pages/Tracker30Days";
import GrowthTools from "./pages/GrowthTools";
import ShortsTrends from "./pages/ShortsTrends";
import Squads from "./pages/Squads";
import AutoPilot from "./pages/AutoPilot";
import AutoPilotPerformance from "./pages/AutoPilotPerformance";
import AutoPilotScheduler from "./pages/AutoPilotScheduler";
import AutoPilotDiagnostics from "./pages/AutoPilotDiagnostics";
import WorkerMonitor from "./pages/WorkerMonitor";
import ChannelSettings from "./pages/ChannelSettings";
import CalendarPage from "./pages/CalendarPage";
import MyChannelIntelligence from "./pages/MyChannelIntelligence";
import ChannelStudio from "./pages/ChannelStudio";
import AdminTraces from "./pages/AdminTraces";
import NotFound from "./pages/NotFound";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><ErrorBoundary>{children}</ErrorBoundary></ProtectedRoute>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <KeyboardShortcuts />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/channels" element={<P><Channels /></P>} />
            <Route path="/search" element={<P><ChannelSearch /></P>} />
            <Route path="/niches" element={<P><NicheExplorer /></P>} />
            <Route path="/scripts" element={<P><Scripts /></P>} />
            <Route path="/studio" element={<P><ChannelStudio /></P>} />
            <Route path="/autopilot" element={<P><AutoPilot /></P>} />
            <Route path="/autopilot/performance" element={<P><AutoPilotPerformance /></P>} />
            <Route path="/autopilot/scheduler" element={<P><AutoPilotScheduler /></P>} />
            <Route path="/autopilot/diagnostics" element={<P><AutoPilotDiagnostics /></P>} />
            <Route path="/autopilot/worker-monitor" element={<P><WorkerMonitor /></P>} />
            <Route path="/calendar" element={<P><CalendarPage /></P>} />
            <Route path="/channels/:id/settings" element={<P><ChannelSettings /></P>} />
            <Route path="/titles" element={<P><Titles /></P>} />
            <Route path="/viral-db" element={<P><ViralDatabase /></P>} />
            <Route path="/multichannel" element={<P><MultiChannel /></P>} />
            <Route path="/tracker" element={<P><Tracker30Days /></P>} />
            <Route path="/growth-tools" element={<P><GrowthTools /></P>} />
            <Route path="/shorts-trends" element={<P><ShortsTrends /></P>} />
            <Route path="/squads" element={<P><Squads /></P>} />

            {/* Consolidated redirects — old routes point to merged pages */}
            <Route path="/branding" element={<Navigate to="/growth-tools" replace />} />
            <Route path="/workflow" element={<Navigate to="/tracker" replace />} />
            <Route path="/intelligence" element={<P><MyChannelIntelligence /></P>} />
            <Route path="/power-tools" element={<Navigate to="/growth-tools" replace />} />
            <Route path="/knowledge" element={<P><AdminRoute><KnowledgeAdmin /></AdminRoute></P>} />
            <Route path="/admin/traces" element={<P><AdminRoute><AdminTraces /></AdminRoute></P>} />

            <Route path="/onboarding" element={<P><Onboarding /></P>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            <Route path="/subscription" element={<P><Subscription /></P>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
