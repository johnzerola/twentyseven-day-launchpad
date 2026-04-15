import { useSearchParams, Link } from "react-router-dom";
import { Check, ArrowLeft } from "lucide-react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {sessionId ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Pagamento confirmado! 🎉</h1>
            <p className="text-muted-foreground mb-6">
              Sua assinatura foi ativada com sucesso. Você já tem acesso a todas as funcionalidades do seu plano.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Ir para o Dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Sessão não encontrada</h1>
            <p className="text-muted-foreground mb-6">
              Não foi possível verificar o pagamento. Tente novamente.
            </p>
            <Link to="/pricing" className="text-primary underline">
              Voltar para Planos
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
