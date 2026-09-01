# Caicó Estoque - Frontend

Aplicação frontend em React + TypeScript + Vite para gestão operacional de estoque, vencimentos, avarias, conferências, metas e auditoria.

## Visão geral

Este projeto fornece uma interface web para o fluxo diário de operação da unidade. A aplicação conecta-se a uma API backend para:

- controlar produtos próximos do vencimento;
- registrar avarias e anexar fotos;
- registrar conferências de estoque;
- acompanhar metas e indicadores;
- disponibilizar ferramentas administrativas para supervisão.

## Stack utilizada

- React 19
- TypeScript
- Vite
- React Router DOM
- Zustand para estado global
- Flowbite React para componentes UI
- Axios para comunicação com a API
- Day.js para manipulação de datas
- Recharts / React Chart.js 2 para gráficos
- Framer Motion para animações

## Funcionalidades principais

### 1. Vencimentos

Página dedicada ao acompanhamento de produtos com validade próxima. Permite:

- listar produtos por local de estoque;
- calcular dias restantes até a validade;
- cadastrar, editar e excluir registros;
- abrir opção de impressão/compartilhamento.

### 2. Avarias

Módulo para registrar problemas de estoque e perdas. Inclui:

- listagem de avarias por local;
- filtros por período;
- relatório consolidado;
- visualização de fotos relacionadas ao registro.

### 3. Conferências

Tela para registrar conferências de estoque com base em produtos conferidos. Oferece:

- cadastro de conferências;
- resumo de produtos conferidos no dia e no mês;
- tabela dinâmica;
- gráfico com indicadores do período.

### 4. Metas

Seção para acompanhar metas e indicadores de desempenho, incluindo:

- calendário de conferência;
- indicadores relacionados a avarias e metas;
- visão consolidada para tomada de decisão.

### 5. Outros módulos

A aplicação também possui telas para:

- recebimentos;
- tarefas;
- pontos;
- checklist;
- auditoria;
- perfil do usuário;
- mensagens internas.

### 6. Administração

Usuários com perfil administrativo podem acessar rotas como:

- logs;
- checklist admin;
- pontos admin;
- rank e análise;
- análise de conferência;
- definição de metas administrativas.

## Fluxo de funcionamento

1. O usuário acessa a tela de login.
2. O login envia as credenciais para a API em /auth/login.
3. O token JWT retornado é armazenado no localStorage e carregado na store global de autenticação.
4. O layout principal é exibido com barra superior, navegação, avatar e caixa de mensagens.
5. Cada módulo consome endpoints específicos da API e filtra os dados pelo local de estoque do usuário.
6. Em caso de token inválido ou expirado, a sessão é encerrada e o usuário é redirecionado para a tela de login.

## Rotas principais

| Rota | Descrição |
| --- | --- |
| /login | Tela de autenticação |
| / | Página inicial da aplicação |
| /vencimentos | Gestão de vencimentos |
| /avarias | Gestão de avarias |
| /conferencias | Conferências de estoque |
| /recebimento | Página de recebimentos |
| /metas | Acompanhamento de metas |
| /pontos | Indicadores e pontuação |
| /checklist | Checklist operacional |
| /auditoria | Auditoria |
| /profile | Perfil do usuário |
| /admin/* | Recursos restritos para administradores |

## Estrutura de pastas

- src/ - código principal da aplicação
  - api.ts - configuração central do Axios e interceptors
  - routes.tsx - definição das rotas e proteção por autenticação
  - pages/ - telas e componentes por módulo
  - static/ - assets estáticos como logos e imagens

## Requisitos

- Node.js 20+ recomendado
- npm ou pnpm

## Como rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie um arquivo .env na raiz do projeto com a URL da API backend:

```env
VITE_API_URL=http://localhost:3000
```

3. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

4. Acesse a aplicação no endereço informado pelo Vite.

## Build e validação

```bash
npm run build
npm run lint
```

## Observações importantes

- A aplicação depende fortemente de uma API backend funcional.
- O local de estoque é carregado a partir do token do usuário e do endpoint de locais.
- Algumas telas são restritas a administradores, controladas pelo campo admin no token.
- O fluxo atual foi mapeado a partir da estrutura das rotas e dos módulos principais do projeto.

## Próximo passo recomendado

A próxima etapa de evolução da interface pode concentrar-se em:

- padronizar cores e componentes;
- melhorar responsividade em telas menores;
- simplificar navegação;
- unificar visual dos cards, tabelas e modais.
