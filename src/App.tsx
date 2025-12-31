import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import NewOffer from "./pages/NewOffer";
import Login from "./pages/Login";
import ImportProducts from "./pages/ImportProducts";
import Products from "./pages/Products";
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
        <AppLayout>
          <Dashboard />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/nowa-oferta",
    element: (
      <ProtectedRoute>
        <AppLayout>
          <NewOffer />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/historia",
    element: (
      <ProtectedRoute>
        <AppLayout>
          <OfferHistory />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/kolejka",
    element: (
      <ProtectedRoute>
        <AppLayout>
          <OfferQueue />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/import-products",
    element: (
      <ProtectedRoute>
        <AppLayout>
          <ImportProducts />
        </AppLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/produkty",
    element: (
      <ProtectedRoute>
        <AppLayout>
          <Products />
        </AppLayout>
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
          <Toaster position="top-right" richColors duration={2000} />
          <RouterProvider router={router} />
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
