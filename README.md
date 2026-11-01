# Visitas da Patrice

App para iPhone que mostra quais médicos da carteira ABC estão há mais tempo sem visita,
com dados puxados automaticamente do minhavisita.

## Como funciona

- `.github/workflows/sync.yml` roda 4 vezes por dia (e a cada push). Ele entra no minhavisita
  com o login da Patrice, baixa o histórico de check-ins, cruza com a carteira ABC e publica
  o app no GitHub Pages.
- Os dados (carteira e visitas) ficam **criptografados** com AES-256-GCM. O repositório e o
  site são públicos, mas sem a chave ninguém lê a lista de médicos.
- A chave fica no celular: a Patrice abre uma vez o link de configuração (`…/#k=CHAVE`).
  A parte depois do `#` nunca é enviada ao servidor.

## Segredos necessários (Settings → Secrets and variables → Actions)

| Nome       | Conteúdo                                  |
|------------|-------------------------------------------|
| `MV_EMAIL` | e-mail de login da Patrice no minhavisita |
| `MV_SENHA` | senha da Patrice no minhavisita           |
| `APP_KEY`  | chave do app (32 bytes em base64url)      |

E em Settings → Pages, em "Source", escolha **GitHub Actions**.

## Atualizar a carteira ABC

Quando sair uma nova planilha, gere um JSON `[{grupo, posicao, nome, total, mesesAtivos}]`
e rode:

```
APP_KEY=... node scripts/encrypt-carteira.mjs carteira.json
```

Faça commit de `data/carteira.enc` (nunca da planilha ou do JSON).

## Regras

- "Visita" = qualquer check-in/check-out presencial. Reuniões online não contam.
- Prazos padrão: Grupo A a cada 30 dias, B a cada 60, C a cada 90. Dá para mudar no ⚙️ do app.
