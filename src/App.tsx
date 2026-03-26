import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ChannelSearch from "./pages/ChannelSearch";
import NicheExplorer from "./pages/NicheExplorer";
import Branding from "./pages/Branding";
import Onboarding from "./pages/Onboarding";
import Scripts from "./pages/Scripts";
import Channels from "./pages/Channels";
import Pricing from "./pages/Pricing";
import Titles from "./pages/Titles";
import ViralDatabase from "./pages/ViralDatabase";
import Workflow from "./pages/Workflow";
import MultiChannel from "./pages/MultiChannel";
import KnowledgeAdmin from "./pages/KnowledgeAdmin";
import ChannelIntelligence from "./pages/ChannelIntelligence";
import Tracker30Days from "./pages/Tracker30Days";
import GrowthTools from "./pages/GrowthTools";
import PowerTools from "./pages/PowerTools";
import ShortsTrends from "./pages/ShortsTrends";
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
            <Route path="/titles" element={<P><Titles /></P>} />
            <Route path="/viral-db" element={<P><ViralDatabase /></P>} />
            <Route path="/multichannel" element={<P><MultiChannel /></P>} />
            <Route path="/tracker" element={<P><Tracker30Days /></P>} />
            <Route path="/growth-tools" element={<P><GrowthTools /></P>} />
            <Route path="/shorts-trends" element={<P><ShortsTrends /></P>} />
            <Route path="/power-tools" element={<P><PowerTools /></P>} />

            {/* Merged/redirect routes */}
            <Route path="/branding" element={<Navigate to="/growth-tools" replace />} />
            <Route path="/workflow" element={<Navigate to="/tracker" replace />} />
            <Route path="/intelligence" element={<Navigate to="/channels" replace />} />
            <Route path="/knowledge" element={<P><KnowledgeAdmin /></P>} />

            <Route path="/onboarding" element={<P><Onboarding /></P>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
