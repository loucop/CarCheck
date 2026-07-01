# ROADMAP — CarCheck (pós-produção / go-to-market)

> **O que é este arquivo.** Direção de **produto/negócio** de médio prazo — o que fazer
> **depois** que o app estiver estável em produção. NÃO é a lista de tarefas ativa: o
> trabalho do dia-a-dia vive em [`BACKLOG.md`](BACKLOG.md). Aqui ficam os itens que
> transformam "um sistema interno que funciona" em "um produto vendável a outras empresas".
>
> Legenda: 🆕 item novo (não estava no backlog) · 🔗 item já existente no `BACKLOG.md`
> (referenciado/elevado aqui, **não** duplicado).

---

## Contexto estratégico (north-star)

- **Lighthouse:** Angels e Cemax são as **primeiras implantações reais** (single-tenant).
  Um sistema rodando em produção numa empresa com contratos estaduais (RJ) é a **prova de
  confiança** que destrava a venda para o resto do mercado (outras empresas de licitação/
  frota no mesmo nicho se veem no case).
- **Modelo de implantação:** **single-tenant por empresa primeiro** — receita rápida, risco
  baixo, e a história de *isolamento de dados* vende justamente para o comprador preocupado
  com segurança. **Multi-tenant SaaS** fica como opção futura (maior teto, maior risco),
  financiada pela receita do single-tenant.
- **Três pilares da tese** ("melhor, mais barato, mais rápido, confiável, impossível dizer
  não"): **Confiável** (merecer a palavra) · **Fácil de implantar / barato de rodar** (o que
  torna o "metade do preço" sustentável) · **Impossível dizer não** (baixo custo de troca +
  diferenciais de segurança/auditoria).
- **Fora do escopo técnico:** a questão de **propriedade de IP** com a diretoria é
  pré-requisito de negócio (a resolver em conversa separada) — nada aqui depende dela para
  ser construído.

---

## Índice

| ID | Pilar | Resumo | Origem |
|------|-------|--------|--------|
| R1 | Confiável | Backups automáticos de banco + restore testado | 🆕 |
| R2 | Confiável | Supervisão de processo / auto-restart (recuperação de crash) | 🔗 estende B8 |
| R3 | Confiável | Monitoramento-lite: logs persistentes + polling do `/health` + alerta básico | 🆕 |
| R4 | Deploy | Containerizar + tirar config hardcoded (env-driven, setup 1-comando) | 🆕 |
| R5 | Impossível-não | Caminho de importação/migração de dados do sistema atual do cliente | 🆕 |
| R6 | Impossível-não | Log de auditoria de ações privilegiadas (usuários, logins, acesso a relatório) | 🆕 |
| R7 | Impossível-não | Colunas de auditoria (`created_at`/`updated_at`/autor) nas tabelas core | 🆕 |
| R8 | Impossível-não | Fluxo de reset de senha (admin-triggered + troca forçada) | 🆕 |
| R9 | Impossível-não | Revogação de JWT / kill-switch de sessão | 🆕 depende de M2 |
| R10 | Confiável | Auditoria de timezone (consistência mobile + servidor) | 🆕 |

**Elevações de itens existentes** (permanecem no `BACKLOG.md`, mas são prioritários neste roadmap):
🔗 **B5/B9** (testes — começar pelos serviços transacionais) · 🔗 **B10** (migrations) ·
🔗 **B17** (`schema.sql` versionado) · 🔗 **M6** (RFC multi-tenancy, não-iniciado) ·
🔗 **M9** (chokepoint de tenant — **desenhar cedo, mesmo single-tenant**).

---

## Tier 1 — Confiável (merecer a palavra antes de vendê-la)

> "Confiável" é uma alegação até o primeiro incidente. Se Angels cai durante uma auditoria
> de contrato, o melhor case vira a pior história. Estes itens tornam *seguro* colocar o
> logo deles no pitch.

- 🆕 **R1 — Backups automáticos + restore testado**
  Hoje só houve um `mysqldump` manual (no B20). Falta backup **agendado** e — igualmente
  crítico — um procedimento de **restore documentado e efetivamente testado**. Para um
  sistema de registro (odômetro/auditoria), perda de dados é catastrófica. Não confundir
  com B14 (retenção/particionamento) nem B17 (schema): isto é **backup & DR**.

- 🔗 **R2 — Supervisão de processo / auto-restart** *(estende B8)*
  O B8 (serviço NSSM) está bloqueado por falta de admin, então o node provavelmente roda num
  terminal — se cair de madrugada, fica fora até alguém notar. O shutdown gracioso (B18) já
  existe, mas assume que **algo** envia o SIGTERM e **reinicia** o processo. Num site não
  supervisionado (outra empresa), isso precisa ser automático (serviço/container com restart).

- 🆕 **R3 — Monitoramento-lite**
  Sem métricas, sem agregação/rotação de log, sem alerta. O `/health` existe mas ninguém o
  consulta. Modo de falha atual: "o cliente liga avisando que quebrou". Mínimo viável: logs
  de erro **persistentes** (arquivo, não só console), **polling** externo do `/health`, e um
  **alerta** simples (e-mail/webhook) quando cair. Não é o stack completo de observabilidade
  (isso é apoteose) — é o suficiente para *saber antes do cliente*.

- 🔗 **Testes no núcleo transacional primeiro** *(reframe de B5/B9)*
  Antes de cobertura ampla, testar o que **corrompe dado** se quebrar: transações atômicas de
  checklist/BDV + guards de KM (`SELECT ... FOR UPDATE`, KM monotônico, posse do BDV). Um teste
  aqui teria pego a quebra do B20 (posse com BigInt) na hora. É a rede de segurança que hoje
  não existe (toda verificação é curl manual ao vivo).

- 🆕 **R10 — Auditoria de timezone**
  `data_inspecao` e horários de parada vêm de celulares + servidor. Confirmar que há disciplina
  de TZ consistente (fonte clássica de "o relatório mostra o dia errado"). Barato de checar.

---

## Tier 2 — Fácil de implantar / barato de rodar (o que sustenta o "metade do preço")

> Undercut de 50% só é arma se o **custo de servir** for baixo. Se cada cliente custa uma
> semana de RDP manual + apagar incêndios, metade do preço quebra você mais rápido que o
> incumbente. Barato-de-comprar exige barato-de-rodar.

- 🆕 **R4 — Containerizar + tirar config hardcoded**
  Hoje é Windows/XAMPP, RDP manual, e há referências de host **cravadas no código** (ex.:
  `http://10.10.1.100` no log de startup). "Rodar em qualquer sistema" significa: setup de
  **um comando**, tudo **env-driven** (host/porta/DB/segredos), reprodutível. Container
  (Docker) resolve isso + o restart do R2 de uma vez. Onboarding cai de ~1 semana para ~1 hora.

- 🔗 **Sistema de migrations** *(elevar B10)*
  Aplicar SQL à mão por site não escala. Migrations versionadas = subir/atualizar N clientes
  sem cirurgia manual no banco. Pré-requisito de qualquer implantação repetível.

- 🔗 **`schema.sql` versionado no repo** *(elevar B17)*
  Hoje a única fonte de verdade do schema é o banco vivo (por isso documentamos cada DDL no
  `BACKLOG_DONE.md`). Snapshot versionado é base do R4/B10 e seguro contra perda do host.

---

## Tier 3 — Impossível dizer não (baixo custo de troca + diferenciais)

> Preço é o fosso mais fraco (qualquer um abaixa; o incumbente pode zerar por um trimestre pra
> te esmagar). O "impossível dizer não" durável é: **troca sem dor** + **segurança/auditoria**
> que o nicho de licitação exige.

- 🆕 **R5 — Caminho de importação / migração de dados**
  Empresas não trocam de sistema por 50% de economia se a migração for assustadora. Poder
  **importar os dados do sistema atual** do cliente e ir ao ar **sem downtime** remove a maior
  razão de ficar com o sistema que odeiam. É o *matador de custo de troca* — e não está em
  lugar nenhum do backlog hoje.

- 🆕 **R6 — Log de auditoria de ações privilegiadas**
  As tabelas `correcoes` já auditam **correções** (append-only). Estender essa disciplina ao
  resto: criar/editar usuário, login (sucesso/falha), acesso a relatório admin. Num mercado de
  licitação/compliance, trilha de auditoria é **argumento de venda**, não overhead.

- 🆕 **R7 — Colunas de auditoria nas tabelas core**
  `created_at`/`updated_at` (+ autor) nas tabelas principais. Sem isso, "quando/quem mudou esta
  linha?" é sem resposta. **Verificar o que já existe** antes de adicionar.

- 🆕 **R8 — Fluxo de reset de senha**
  Hoje, se um usuário esquece a senha, o único caminho é o admin recriar a conta. Em outra
  empresa você não pode ser quem recria cada conta. Reset admin-triggered + troca forçada no
  próximo login. (MFA fica de fora por ora — apoteose.)

- 🆕 **R9 — Revogação de JWT / kill-switch de sessão** *(depende de M2)*
  Token é stateless com expiração de 2h; um token copiado vale as 2h inteiras e **não dá para
  matar**. Blocklist de token (usa o store compartilhado do **M2**) ou tokens curtos + refresh.
  Mitigado em parte pela expiração curta, mas necessário para "matar sessão comprometida".

- 🔗 **RFC de multi-tenancy** *(M6, não-iniciado)* — o caminho para SaaS compartilhado (maior
  teto). Só quando houver demanda; single-tenant financia até lá.

- 🔗 **Chokepoint de escopo de tenant — desenhar cedo** *(promover M9)*
  Rotear **todo** acesso ao banco por um ponto único que *poderia* injetar o filtro de tenant.
  Barato de desenhar agora (mesmo com 1 tenant), brutalmente caro de retrofitar depois. Faz a
  virada para SaaS ser uma mudança controlada, não um rewrite. Cheap insurance.
