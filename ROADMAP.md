# ROADMAP — CarCheck (produtização / pós-produção)

> **O que é este arquivo.** Roadmap **técnico** de médio prazo — o que fazer **depois** que o
> app estiver estável em produção para torná-lo um produto robusto, portável e implantável por
> cliente. NÃO é a lista de tarefas ativa: o trabalho do dia-a-dia vive em
> [`BACKLOG.md`](BACKLOG.md).
>
> Legenda: 🆕 item novo (não estava no backlog) · 🔗 item já existente no `BACKLOG.md`
> (referenciado/elevado aqui, **não** duplicado).

---

## Direção arquitetural

- **Modelo de implantação:** **instância single-tenant por cliente** primeiro (cada cliente com
  sua própria instância + banco). Isolamento total, baixo risco, deploy simples de raciocinar.
  **Multi-tenant compartilhado** fica como **opção arquitetural futura** (M6/M9), não pré-requisito.
- **Três eixos de trabalho:** **Confiabilidade & operação** · **Portabilidade & deploy** ·
  **Prontidão enterprise** (segurança, auditoria, migração de dados).
- **Regra geral:** cada item empurra uma garantia para uma camada mais baixa (app → banco → infra)
  ou reduz o custo de operar o sistema em ambientes que não controlamos.

---

## Índice

| ID | Eixo | Resumo | Origem |
|------|------|--------|--------|
| R1 | Confiabilidade | Backups automáticos de banco + restore testado | 🆕 |
| R2 | Confiabilidade | Supervisão de processo / auto-restart (recuperação de crash) | 🔗 estende B8 |
| R3 | Confiabilidade | Monitoramento-lite: logs persistentes + polling do `/health` + alerta básico | 🆕 |
| R4 | Portabilidade | Containerizar + tirar config hardcoded (env-driven, setup 1-comando) | 🆕 |
| R5 | Enterprise | Caminho de importação/migração de dados do sistema anterior | 🆕 |
| R6 | Enterprise | Log de auditoria de ações privilegiadas (usuários, logins, acesso a relatório) | 🆕 |
| R7 | Enterprise | Colunas de auditoria (`created_at`/`updated_at`/autor) nas tabelas core | 🆕 |
| R8 | Enterprise | Fluxo de reset de senha (admin-triggered + troca forçada) | 🆕 |
| R9 | Enterprise | Revogação de JWT / kill-switch de sessão | 🆕 depende de M2 |
| R10 | Confiabilidade | Auditoria de timezone (consistência mobile + servidor) | 🆕 |

**Elevações de itens existentes** (permanecem no `BACKLOG.md`, prioritários neste roadmap):
🔗 **B5/B9** (testes — começar pelos serviços transacionais) · 🔗 **B10** (migrations) ·
🔗 **B17** (`schema.sql` versionado) · 🔗 **M6** (RFC multi-tenancy, não-iniciado) ·
🔗 **M9** (chokepoint de tenant — desenhar cedo, mesmo single-tenant).

---

## Eixo 1 — Confiabilidade & operação

> Confiabilidade é uma alegação até o primeiro incidente. Estes itens fazem o sistema se
> comportar bem — e se recuperar sozinho — em ambientes não supervisionados.

- 🆕 **R1 — Backups automáticos + restore testado**
  Hoje só houve um `mysqldump` manual (no B20). Falta backup **agendado** e — igualmente
  crítico — um procedimento de **restore documentado e efetivamente testado**. Para um sistema de
  registro (odômetro/auditoria), perda de dados é catastrófica. Não confundir com B14
  (retenção/particionamento) nem B17 (schema): isto é **backup & DR**.

- 🔗 **R2 — Supervisão de processo / auto-restart** *(estende B8)*
  O B8 (serviço NSSM) está bloqueado por falta de admin, então o node provavelmente roda num
  terminal — se cair de madrugada, fica fora até alguém notar. O shutdown gracioso (B18) já existe,
  mas assume que **algo** envia o SIGTERM e **reinicia** o processo. Num site não supervisionado,
  isso precisa ser automático (serviço/container com restart).

- 🆕 **R3 — Monitoramento-lite**
  Sem métricas, sem agregação/rotação de log, sem alerta. O `/health` existe mas ninguém o consulta.
  Modo de falha atual: descobrir pela reclamação do usuário. Mínimo viável: logs de erro
  **persistentes** (arquivo, não só console), **polling** externo do `/health`, e um **alerta**
  simples (e-mail/webhook) quando cair. Não é o stack completo de observabilidade — só o suficiente
  para saber antes do usuário.

- 🔗 **Testes no núcleo transacional primeiro** *(reframe de B5/B9)*
  Antes de cobertura ampla, testar o que **corrompe dado** se quebrar: transações atômicas de
  checklist/BDV + guards de KM (`SELECT ... FOR UPDATE`, KM monotônico, posse do BDV). Um teste aqui
  teria pego a quebra do B20 (posse com BigInt) na hora. É a rede de segurança que hoje não existe
  (toda verificação é curl manual ao vivo).

- 🆕 **R10 — Auditoria de timezone**
  `data_inspecao` e horários de parada vêm de celulares + servidor. Confirmar que há disciplina de TZ
  consistente (fonte clássica de "o relatório mostra o dia errado"). Barato de checar.

---

## Eixo 2 — Portabilidade & deploy

> "Rodar em qualquer sistema" exige que instalar e manter cada instância seja barato e repetível —
> não uma cirurgia manual por site.

- 🆕 **R4 — Containerizar + tirar config hardcoded**
  Hoje é Windows/XAMPP, deploy manual, e há referências de host **cravadas no código** (ex.:
  `http://10.10.1.100` no log de startup). Portabilidade real significa: setup de **um comando**,
  tudo **env-driven** (host/porta/DB/segredos), reprodutível. Container (Docker) resolve isso + o
  restart do R2 de uma vez, e reduz o onboarding de dias para horas.

- 🔗 **Sistema de migrations** *(elevar B10)*
  Aplicar SQL à mão por site não escala. Migrations versionadas = subir/atualizar N instâncias sem
  cirurgia manual no banco. Pré-requisito de qualquer implantação repetível.

- 🔗 **`schema.sql` versionado no repo** *(elevar B17)*
  Hoje a única fonte de verdade do schema é o banco vivo (por isso documentamos cada DDL no
  `BACKLOG_DONE.md`). Snapshot versionado é base do R4/B10 e seguro contra perda do host.

---

## Eixo 3 — Prontidão enterprise (segurança, auditoria, migração)

> O que um cliente exigente (compliance, contratos) espera de um sistema de registro.

- 🆕 **R5 — Caminho de importação / migração de dados**
  Trocar de sistema é assustador se a migração for manual/arriscada. Poder **importar os dados do
  sistema anterior** do cliente e ir ao ar **sem downtime** reduz drasticamente o custo/risco de
  adoção. Não existe no backlog hoje.

- 🆕 **R6 — Log de auditoria de ações privilegiadas**
  As tabelas `correcoes` já auditam **correções** (append-only). Estender essa disciplina ao resto:
  criar/editar usuário, login (sucesso/falha), acesso a relatório admin. Trilha de auditoria é
  requisito comum em ambientes de compliance.

- 🆕 **R7 — Colunas de auditoria nas tabelas core**
  `created_at`/`updated_at` (+ autor) nas tabelas principais. Sem isso, "quando/quem mudou esta
  linha?" é sem resposta. **Verificar o que já existe** antes de adicionar.

- 🆕 **R8 — Fluxo de reset de senha**
  Hoje, se um usuário esquece a senha, o único caminho é o admin recriar a conta. Num deploy externo
  isso não escala. Reset admin-triggered + troca forçada no próximo login. (MFA fica de fora por ora.)

- 🆕 **R9 — Revogação de JWT / kill-switch de sessão** *(depende de M2)*
  Token é stateless com expiração de 2h; um token copiado vale as 2h inteiras e **não dá para matar**.
  Blocklist de token (usa o store compartilhado do **M2**) ou tokens curtos + refresh. Mitigado em
  parte pela expiração curta, mas necessário para encerrar uma sessão comprometida.

- 🔗 **RFC de multi-tenancy** *(M6, não-iniciado)* — caminho para deploy compartilhado. Só quando
  houver necessidade; instâncias single-tenant atendem até lá.

- 🔗 **Chokepoint de escopo de tenant — desenhar cedo** *(promover M9)*
  Rotear **todo** acesso ao banco por um ponto único que *poderia* injetar o filtro de tenant. Barato
  de desenhar agora (mesmo com 1 tenant), caro de retrofitar depois. Faz a eventual virada para
  multi-tenant ser uma mudança controlada, não um rewrite.
