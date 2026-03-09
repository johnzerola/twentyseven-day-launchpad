import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ChannelSearch from "./pages/ChannelSearch";
import Onboarding from "./pages/Onboarding";
import Scripts from "./pages/Scripts";
import Narration from "./pages/Narration";
import Plan from "./pages/Plan";
import Channels from "./pages/Channels";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/channels" element={<P><Channels /></P>} />
            <Route path="/search" element={<P><ChannelSearch /></P>} />
            <Route path="/scripts" element={<P><Scripts /></P>} />
            <Route path="/narration" element={<P><Narration /></P>} />
            <Route path="/plan" element={<P><Plan /></P>} />
            <Route path="/onboarding" element={<P><Onboarding /></P>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
