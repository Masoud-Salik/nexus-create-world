import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { useIsMobile } from "@/hooks/use-mobile";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { GlobalTimerProvider } from "@/contexts/GlobalTimerContext";
import { Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Settings = lazy(() => import("./pages/Settings"));
const StudyCoach = lazy(() => import("./pages/StudyCoach"));

const AIMemory = lazy(() => import("./pages/AIMemory"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const FloatingSettingsButton = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // On mobile, settings is in bottom nav, so only show floating button on desktop
  if (isMobile) return null;
  return (
    <button
      onClick={() => navigate("/settings")}
      className="fixed z-50 rounded-full bg-primary/90 backdrop-blur-sm shadow-lg hover:bg-primary transition-all active:scale-95 bottom-6 right-6 p-3"
      aria-label="Settings"
    >
      <SettingsIcon className="h-5 w-5 text-primary-foreground" />
    </button>
  );
};

const AppLayout = () => {
  const isMobile = useIsMobile();
  
  return (
    <SidebarProvider>
      <OfflineIndicator />
      <FloatingSettingsButton />
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar */}
        {!isMobile && <AppSidebar />}
        
        <div className="flex flex-1 flex-col">
          {/* Desktop header with sidebar trigger */}
          {!isMobile && (
            <header className="flex h-14 items-center border-b px-4">
              <SidebarTrigger />
            </header>
          )}
          
          <main className="flex-1 pb-16 md:pb-0">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<StudyCoach />} />
                <Route path="/chat" element={<Index />} />
                <Route path="/ai-memory" element={<AIMemory />} />
                <Route path="/settings" element={<Settings />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        
        {/* Mobile bottom navigation */}
        {isMobile && <MobileBottomNav />}
        
        {/* PWA Install Prompt */}
        {isMobile && <InstallPrompt />}
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <GlobalTimerProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppLayout />
            </BrowserRouter>
          </TooltipProvider>
        </GlobalTimerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
