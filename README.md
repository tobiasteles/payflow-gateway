# PayFlow — Gateway de Pagamentos & Conciliação

Next.js (App Router) + TypeScript + Tailwind + Vitest.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest em modo watch
npm run test:run   # execução única
npm run coverage
```

Regras de negócio em `src/lib` (puras e testáveis), UI em `src/components`, API em `src/app/api/charges`.
Dinheiro é sempre inteiro em centavos; taxas em basis points. Variáveis opcionais: `WEBHOOK_URL`, `WEBHOOK_SECRET`.
