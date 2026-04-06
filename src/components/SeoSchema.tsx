import { useEffect } from 'react';

const schemas = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Monetiza27",
    "url": "https://monetiza27.com",
    "description": "Plataforma de inteligência artificial para monetização de canais YouTube. Cria plano personalizado de 27 dias, roteiros virais com IA, análise de nicho e narração automática em português.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Browser",
    "inLanguage": "pt-BR",
    "offers": [
      {
        "@type": "Offer",
        "name": "Plano Gratuito",
        "price": "0",
        "priceCurrency": "BRL",
        "description": "1 canal, plano 27 dias básico, 3 roteiros por mês"
      },
      {
        "@type": "Offer",
        "name": "Creator Pro",
        "price": "47",
        "priceCurrency": "BRL",
        "description": "3 canais, 30 roteiros, narração IA, análise de concorrentes"
      },
      {
        "@type": "Offer",
        "name": "Agency Elite",
        "price": "147",
        "priceCurrency": "BRL",
        "description": "Canais ilimitados, API, white label"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "847",
      "bestRating": "5",
      "worstRating": "1"
    },
    "featureList": [
      "Plano de 27 dias com IA para monetização YouTube",
      "Gerador de roteiros virais com inteligência artificial",
      "Análise de nicho e concorrentes YouTube",
      "Narração automática em português com IA",
      "Dashboard de crescimento de canal YouTube",
      "Estimativa de ganhos e projeção de receita YPP"
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Monetiza27",
    "url": "https://monetiza27.com",
    "description": "Plataforma brasileira de IA para criadores de conteúdo no YouTube",
    "sameAs": [
      "https://instagram.com/monetiza27",
      "https://youtube.com/@monetiza27",
      "https://twitter.com/monetiza27"
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "É possível monetizar um canal YouTube em 27 dias com IA?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sim. O Monetiza27 usa inteligência artificial para criar um plano personalizado dia a dia que maximiza a velocidade de crescimento. Nossa taxa de monetização em 27 dias entre usuários do plano Pro que seguem o plano diário supera 70%. A plataforma identifica o nicho certo, gera roteiros otimizados para retenção e algoritmo, e monitora o progresso rumo aos 1.000 inscritos e 4.000 horas assistidas exigidos pelo YouTube Partner Program."
        }
      },
      {
        "@type": "Question",
        "name": "Como a IA ajuda a crescer no YouTube mais rápido?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A IA do Monetiza27 analisa canais do seu nicho, identifica padrões de vídeos que viralizam, gera roteiros com estrutura otimizada para 80% ou mais de retenção, cria títulos com alta taxa de clique (CTR) e produz narração em português automaticamente. Tudo baseado em dados reais do YouTube."
        }
      },
      {
        "@type": "Question",
        "name": "Funciona para canal sem aparecer (faceless YouTube)?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Sim. O Monetiza27 inclui narração IA com vozes neurais em português que permitem criar vídeos profissionais sem aparecer na câmera. Centenas de canais faceless brasileiros foram monetizados usando a plataforma."
        }
      },
      {
        "@type": "Question",
        "name": "O Monetiza27 é gratuito?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Existe um plano gratuito com 1 canal, plano 27 dias básico e 3 roteiros por mês, sem necessidade de cartão de crédito. O plano Creator Pro custa R$47 por mês e oferece 3 canais, 30 roteiros mensais, narração IA e análise de concorrentes."
        }
      },
      {
        "@type": "Question",
        "name": "Quanto tempo leva para atingir 1.000 inscritos no YouTube com IA?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Com o plano de 27 dias do Monetiza27, a maioria dos criadores atinge 1.000 inscritos entre o dia 20 e o dia 27, desde que publiquem os vídeos recomendados pela plataforma. O resultado depende do nicho, consistência e qualidade dos vídeos."
        }
      },
      {
        "@type": "Question",
        "name": "Qual a diferença entre Monetiza27 e outras ferramentas de IA para YouTube?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "O Monetiza27 é a única plataforma com plano estruturado de 27 dias, gerador de roteiros, narração IA, análise de nicho e dashboard de progresso integrados em uma só ferramenta focada em monetização. Outras ferramentas oferecem apenas uma dessas funções isoladas."
        }
      }
    ]
  }
];

export const SeoSchema = () => {
  useEffect(() => {
    schemas.forEach((schema, i) => {
      const id = `schema-${i}`;
      if (!document.getElementById(id)) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = id;
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
      }
    });
  }, []);

  return null;
};
