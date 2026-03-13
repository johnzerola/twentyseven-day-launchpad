import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />

      <div className="text-center relative z-10 max-w-md mx-4">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold font-['Space_Grotesk']">{APP_NAME}</span>
        </div>

        <div className="text-8xl font-black font-['Space_Grotesk'] gradient-text mb-4">404</div>
        <h2 className="text-xl font-semibold mb-2">Página não encontrada</h2>
        <p className="text-muted-foreground mb-8">
          A rota <code className="bg-secondary px-2 py-0.5 rounded text-sm text-foreground">{location.pathname}</code> não existe.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" /> Ir para Home
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button className="gradient-hero border-0 gap-2 w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
