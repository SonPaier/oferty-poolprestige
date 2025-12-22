import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import NewOffer from "./pages/NewOffer";
import Login from "./pages/Login";
import ImportProducts from "./pages/ImportProducts";
import OfferView from "./pages/OfferView";
import OfferHistory from "./pages/OfferHistory";
import OfferQueue from "./pages/OfferQueue";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/oferta/:shareUid",
    element: <OfferView />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/nowa-oferta",
    element: (
      <ProtectedRoute>
        <NewOffer />
      </ProtectedRoute>
    ),
  },
  {
    path: "/historia",
    element: (
      <ProtectedRoute>
        <OfferHistory />
      </ProtectedRoute>
    ),
  },
  {
    path: "/kolejka",
    element: (
      <ProtectedRoute>
        <OfferQueue />
      </ProtectedRoute>
    ),
  },
  {
    path: "/import-products",
    element: (
      <ProtectedRoute>
        <ImportProducts />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SettingsProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} />
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
