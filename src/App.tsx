import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/search" element={<ChannelSearch />} />
            <Route path="/scripts" element={<Scripts />} />
            <Route path="/narration" element={<Narration />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
