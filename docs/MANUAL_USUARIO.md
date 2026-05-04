# Manual do Usuário — DFS Avaliação de Desempenho 180°

**Versão:** 1.0 · Abril 2026

---

## Acesso ao Sistema

Abra o navegador e acesse o endereço fornecido pelo RH.

Na tela de login, informe seu **e-mail** e **senha**. Caso seja seu primeiro acesso, você receberá uma senha provisória por e-mail e será obrigado a criar uma nova senha antes de continuar.

> Se esqueceu sua senha, clique em **"Esqueci minha senha"** e siga as instruções enviadas por e-mail.

---

## Perfis de Acesso

O sistema possui três perfis:

| Perfil | Quem é | O que pode fazer |
|---|---|---|
| **Colaborador** | Todo funcionário avaliado | Preencher autoavaliação, acompanhar PDI, ver histórico |
| **Gestor** | Líder de equipe | Tudo do Colaborador + avaliar equipe, criar/monitorar PDI, validar ações |
| **Administrador RH** | Equipe de RH | Tudo + gerenciar ciclos, usuários, configurações e auditoria |

---

## Menu do Sistema

O menu lateral é organizado em três blocos:

- **Eu** — ações pessoais (autoavaliação, PDI, histórico, perfil)
- **Equipe** — visível apenas para Gestores
- **Administração RH** — visível apenas para Administradores

---

# Para o Colaborador

## Dashboard (Tela Inicial)

Ao fazer login, você verá seu painel pessoal com:
- Alerta de autoavaliação aberta (se houver um ciclo em andamento)
- Progresso do seu PDI ativo
- Atalho para seu histórico de avaliações

## Autoavaliação

**Quando:** O RH abre um ciclo de avaliação e você recebe o acesso.

**Como fazer:**
1. No menu lateral, clique em **"Autoavaliação"** (aparece somente quando há avaliação aberta)
2. Leia cada competência com atenção
3. Escolha a nota de 1 a 4:
   - **1 — Abaixo do esperado:** Não atende ao que é esperado para a função
   - **2 — Em desenvolvimento:** Atende parcialmente; ainda precisa evoluir
   - **3 — Atende ao esperado:** Desempenho adequado e consistente
   - **4 — Supera o esperado:** Referência positiva para os colegas
4. Pode adicionar comentários opcionais em cada competência
5. Responda também as **perguntas discursivas** ao final
6. Clique em **"Finalizar Avaliação"** quando estiver pronto

> **Atenção:** Após finalizar, não é possível editar. Revise bem antes de confirmar.

## Meu PDI (Plano de Desenvolvimento Individual)

O PDI é criado pelo seu gestor após a etapa de consenso. Você receberá uma notificação quando estiver disponível.

**Como acompanhar:**
1. No menu, clique em **"Minhas Ações de PDI"**
2. Você verá as ações definidas pelo gestor
3. Para cada ação, atualize o **progresso** conforme evolui
4. Quando concluir uma ação, marque como **"Concluída"** para que o gestor possa validar
5. Clique em **"Confirmar Ciência"** para dar sua assinatura no PDI quando o gestor finalizar o plano

## Histórico

No menu **"Histórico"**, você pode ver:
- Todas as suas avaliações passadas por ciclo
- Histórico de PDIs anteriores

---

# Para o Gestor

## Dashboard (Tela Inicial)

Seu painel exibe:
- Tamanho da sua equipe
- Avaliações de gestor pendentes
- Ações de PDI aguardando sua validação
- Alerta de autoavaliação própria aberta

## Minha Equipe

No menu **"Minha Equipe"**, você vê todos os seus liderados com o status atual de cada avaliação:
- **Ícone de lápis** → Iniciar/continuar avaliação de gestor
- **Ícone de gráfico** → Abrir sessão de consenso
- **Ícone de PDI** → Criar ou editar PDI do colaborador

## Avaliar Colaborador

**Quando:** O ciclo está na fase de avaliações (aberto_auto_gestor).

**Como fazer:**
1. Acesse **"Minha Equipe"**
2. Clique no ícone de avaliação ao lado do colaborador
3. Preencha as notas (1 a 4) para cada competência com sua visão
4. Adicione comentários relevantes
5. Finalize a avaliação

> **Importante:** Você NÃO consegue ver a autoavaliação do colaborador enquanto não finalizar a sua própria avaliação. Isso garante imparcialidade.

## Consenso

**Quando:** Tanto a autoavaliação do colaborador quanto a avaliação do gestor estão finalizadas.

**Como fazer:**
1. Na tela da equipe, clique no ícone de gráfico do colaborador
2. Visualize as notas lado a lado: autoavaliação, avaliação do gestor
3. Defina a **nota de consenso** para cada competência (a nota que será registrada oficialmente)
4. Marque as **3 ou mais competências** com menor desempenho — essas formarão o PDI
5. Clique em **"Fechar Consenso e Gerar PDI"**

## Criar e Gerenciar PDI

**Após fechar o consenso**, o PDI é gerado automaticamente com as competências selecionadas.

**Como editar:**
1. Acesse o PDI pelo ícone na tela da equipe ou pelo menu **"Construir PDI"**
2. Para cada ponto de desenvolvimento, defina:
   - **Objetivo:** O que se espera alcançar
   - **Ação:** O que o colaborador deve fazer concretamente
   - **Prazo:** Data-limite para conclusão
3. Salve e aguarde o colaborador confirmar ciência

## Validar Ações do PDI

Quando um colaborador marca uma ação como concluída, ela aparece na tela **"Validar Ações"**.

**Como validar:**
1. Revise a ação e o progresso descrito pelo colaborador
2. Clique em **"Finalizar"** para registrar a conclusão
3. Se precisar reverter, use **"Desfinalizar"** com uma justificativa

## Histórico da Equipe

No menu **"Histórico da Equipe"**, você vê todas as avaliações passadas e PDIs de todos os seus liderados (atuais), organizados por ciclo.

---

# Para o Administrador RH

## Dashboard Administrativo

O painel exibe:
- Total de colaboradores ativos
- Ciclos em andamento
- Ações de PDI pendentes e em atraso
- Atalhos rápidos para as principais tarefas

## Gerenciar Ciclos

**Ciclos** são os períodos de avaliação. Cada ciclo passa pelos seguintes estados:

| Status | O que significa |
|---|---|
| **Planejado** | Ciclo criado, mas ainda não iniciado |
| **Aberto Auto+Gestor** | Colaboradores e gestores podem preencher avaliações |
| **Aberto Consolidação** | Fase de consenso e construção do PDI |
| **Encerrado** | Ciclo finalizado, apenas consulta |

**Como criar um ciclo:**
1. Acesse **Admin RH > Ciclos**
2. Clique em **"Novo Ciclo"**
3. Defina o nome, período de avaliação e datas das fases
4. Salve — o ciclo estará como "Planejado"

**Como avançar as fases:**
1. Na lista de ciclos, clique em **"Avançar Status"** para mover para a próxima fase
2. A mudança dispara automaticamente a criação das avaliações para todos os colaboradores ativos

## Gerenciar Colaboradores

Acesse **Admin RH > Colaboradores** para:

**Criar novo colaborador:**
1. Clique em **"Novo"**
2. Preencha nome, e-mail e papel (Colaborador, Gestor ou Admin RH)
3. Clique em **"Criar"** — uma senha provisória é enviada ao e-mail
4. O usuário será obrigado a trocar a senha no primeiro acesso

**Transferir gestor:**
- Clique no ícone de transferência ao lado do colaborador
- Selecione o novo gestor
- Avaliações em aberto são automaticamente migradas para o novo gestor

**Desativar acesso:**
- Clique no ícone de bloqueio ao lado do colaborador ativo
- Confirme a desativação
- O colaborador perde acesso imediatamente

## Visão Global de Avaliações

Acesse **Admin RH > Avaliações** para:
- Ver todas as avaliações de todos os ciclos
- Filtrar por tipo, status ou buscar por nome
- **Reabrir** uma avaliação finalizada (requer justificativa de mínimo 30 caracteres)

## Visão Global de PDIs

Acesse **Admin RH > PDI** para ver todos os planos de desenvolvimento, com informações de ciclo, colaborador e gestor responsável.

## Ações Pendentes e Atrasadas

Acesse **Admin RH > Ações Pendentes** para um painel de acompanhamento com:
- Todas as ações em aberto e seus prazos
- Ações atrasadas em destaque
- Filtro por ciclo

## Auditoria

**Admin RH > Auditoria** registra todas as ações sensíveis do sistema:
- Criação e transferência de usuários
- Reabertura de avaliações
- Avançamento de ciclos

## Configurações

**Admin RH > Configurações** permite gerenciar:
- **Blocos de Competência** — grupos de avaliação (Globais, Comportamentais, Técnicas, Culturais)
- **Departamentos** — áreas da empresa
- **Cargos** — cargos cadastrados

---

## Perguntas Frequentes

**Esqueci minha senha, o que faço?**
Na tela de login, clique em "Esqueci minha senha". Um e-mail com o link de redefinição será enviado.

**Posso editar uma avaliação após finalizar?**
Não. Após finalizar, a avaliação fica bloqueada para garantir integridade. O RH pode reabrir com justificativa.

**Não vejo o menu de autoavaliação, por quê?**
O menu aparece apenas quando existe um ciclo ativo na fase de avaliações e você tem uma avaliação em aberto.

**Meu gestor mudou durante o ciclo. Minhas avaliações são transferidas?**
Sim. Quando o RH realiza a transferência de gestor, as avaliações em aberto são migradas automaticamente para o novo gestor.

**Como sei quando o PDI está disponível para mim?**
O item "Minhas Ações de PDI" aparecerá no menu quando o gestor criar e finalizar seu PDI.

---

*Para suporte técnico, entre em contato com a equipe de RH ou TI responsável pelo sistema.*
