import { Switch, Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Recorder from "@/pages/Recorder";
import RecordingDetails from "@/pages/RecordingDetails";
import Settings from "@/pages/Settings";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Recorder} />
      <Route path="/recordings" component={Home} />
      <Route path="/recordings/:id" component={RecordingDetails} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const basePath = import.meta.env.PROD ? "/FlagIt/" : "/";
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router base={basePath}>
          <AppRoutes />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
