import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StudyCoachSkeleton, ChatSkeleton, SettingsSkeleton } from "@/components/SkeletonLoaders";
import { useIsMobile } from "@/hooks/use-mobile";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { GlobalTimerProvider } from "@/contexts/GlobalTimerContext";

// Lazy load pages
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


const PageFallback = () => {
  const location = useLocation();
  if (location.pathname === "/chat") return <ChatSkeleton />;
  if (location.pathname === "/settings") return <SettingsSkeleton />;
  return <StudyCoachSkeleton />;
};

const AnimatedRoutes = () => {
  return (
    <div className="page-enter">
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<StudyCoach />} />
          <Route path="/chat" element={<Index />} />
          <Route path="/ai-memory" element={<AIMemory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
};

const AppLayout = () => {
  const isMobile = useIsMobile();
  
  return (
    <SidebarProvider>
      <OfflineIndicator />
      <div className="flex min-h-screen w-full">
        {!isMobile && <AppSidebar />}
        
        <div className="flex flex-1 flex-col">
          {!isMobile && (
            <header className="flex h-14 items-center border-b px-4">
              <SidebarTrigger />
            </header>
          )}
          
          <main className="flex-1 pb-16 md:pb-0">
            <AnimatedRoutes />
          </main>
        </div>
        
        {isMobile && <MobileBottomNav />}
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
