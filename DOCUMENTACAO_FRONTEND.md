# 📚 Documentação Completa do Frontend — Caicó Estoque

Esta documentação contém todas as especificações técnicas, regras de negócio, fluxos de usuário e requisições à API necessárias para a recriação do frontend do zero.

---

## 1. Arquitetura Geral e Stack Tecnológica

### 1.1. Tecnologias Utilizadas
* **Core**: React 19, TypeScript, Vite
* **Roteamento**: React Router v7 (`react-router-dom`)
* **Gerenciamento de Estado Global**: Zustand
* **Estilização & Componentes UI**: Tailwind CSS v4, Flowbite React, React Icons (`react-icons/hi`, `react-icons/hi2`, `react-icons/fa`), Lucide React (`lucide-react`)
* **Gráficos**: Recharts (`LineChart`, `BarChart`, `PieChart`) e Chart.js
* **Manipulação de Datas**: Day.js com locale `pt-br` e plugins (`isoWeek`, `utc`, `isSameOrBefore`, `isSameOrAfter`)
* **Requisições HTTP**: Axios com interceptors para token JWT e renovação/logout
* **Animações & Efeitos**: Framer Motion, `canvas-confetti`
* **Exportação & Utilitários**: `html2canvas`, `jspdf`, `file-saver`, `jwt-decode`

---

## 2. Autenticação, Armazenamento Global e Layout Base

### 2.1. Configuração da API (`api.ts`)
* **Base URL**: `import.meta.env.VITE_API_URL`
* **Interceptor de Request**:
  * Obtém o token de `localStorage.getItem("token")`.
  * Se existir, adiciona o header: `Authorization: Bearer <token>`.
* **Interceptor de Response**:
  * Se a resposta retornar status `401 Unauthorized`:
    * Executa `useAuthStore.getState().clearUser()`.
    * Redireciona o usuário para `/login` (caso não esteja nela).

---

### 2.2. Estado Global de Autenticação (`authStore.ts`)
Decodifica o token JWT para extrair os dados do usuário.

#### Estrutura do Payload JWT (`UserPayload`):
```typescript
interface UserPayload {
  sub: string;
  id: number;
  name: string;
  email: string;
  local: number;
  admin: number; // 1 = Admin, 0 = Operador
  exp: number; // Timestamp de expiração em segundos
  profile_photo: string;
}
```

#### Métodos da Store:
* `setUserFromToken(token: string)`: Valida expiração (`exp < Date.now()/1000`), grava no `localStorage` sob a chave `"token"`, atualiza `isAuthenticated: true` e `user`.
* `updateUser(newData: Partial<UserPayload>)`: Atualiza propriedades parciais do usuário ativo.
* `clearUser()`: Remove `"token"` do `localStorage` e limpa o estado.
* `checkTokenValidity()`: Checa no carregamento inicial se o token ainda é válido.

---

### 2.3. Estado Global do Local de Estoque (`localEstoque.ts`)
Mantém o estoque selecionado pelo operador ativo:
```typescript
interface LocalDeEstoqueStore {
  idLocal: number; // ID do local (ex: 1 = Matriz, 2 = Parnamirim, etc.)
  localName: string;
  setLocal: (id: number, name: string) => void;
}
```

---

### 2.4. Roteamento e Proteção de Rotas (`protect.tsx` & `routes.tsx`)
* **Rota Pública**: `/login`, `/vencimentos/visualizar`
* **Rotas Protegidas (`protected: true`)**: Requer `isAuthenticated === true`, caso contrário redireciona para `/login`.
* **Rotas Administrativas (`adminOnly: true`)**: Requer `user.admin === 1`, caso contrário redireciona para `/`.

---

### 2.5. Layout Base (`layout.tsx`) & Componentes Globais

#### Layout Geral:
* **TopBar com Barra de Navegação**:
  * Botões diretos para: `Vencimentos` (`/vencimentos`), `Avarias` (`/avarias`), `Conferências` (`/conferencias`), `Recebimentos` (`/recebimento`), `Metas` (`/metas`), `Pontos` (`/pontos`), `Checklist` (`/checklist`), `Auditoria` (`/auditoria`).
* **Dropdown do Avatar / Perfil**:
  * Mostra foto de perfil `${API_URL}/${user.profile_photo}` ou avatar padrão.
  * Nome do usuário.
  * Local de estoque ativo.
  * Botão de Mensagens (com Badge numérica de mensagens não lidas).
  * Link para Perfil (`/profile`).
  * Links Administrativos (se `admin === 1`):
    * `Adm: Logs` (`/admin/logs`)
    * `Adm: Checklist` (`/admin/checklist`)
    * `Adm: Pontos` (`/admin/pontos`)
    * `Adm: Rank` (`/admin/rank`)
    * `Adm: Rank Análise` (`/admin/rank/analise`)
    * `Adm: Conferência Análise` (`/admin/conferencia/analise`)
    * `Adm: Conferência Meta` (`/admin/metas`)
  * Botão Sair (Logout).

#### Componente WarningBar (`warning.tsx`):
* Executado globalmente no topo da aplicação.
* **Requisição**: `GET /warning/`
* **Regra de Negócio**:
  * Filtra avisos não lidos (`!w.read`).
  * **Detector de Ranking**: Analisa o texto com Regex procurando por `(\d+)\s*º?\s*lugar`.
    * **Se for premiação de ranking**: Abre o modal comemorativo `<CongratsRank />` com animação Framer Motion, explosão de confetes coloridos (cores específicas para 1º, 2º e 3º lugares) e troféu.
    * **Se for aviso comum**: Exibe banner flutuante amarelo no topo com botão "OK".
  * **Ação "Marcar como lido"**: Dispara `PUT /warning/read/:id` com `{ read: true }`.

#### Componente Mailbox Modal (`Mailbox.tsx`):
* Caixa de entrada em Modal.
* **Requisições**:
  * Listar: `GET /message/mailbox`
  * Marcar leitura: `PUT /message/:id` com `{ read: true }`
  * Confirmar ciência: `PUT /message/:id` com `{ ok_: true }`
* **Regras de Negócio**:
  * Abas de filtro: "Todas", "Não lidas", "Lidas".
  * Paginação de 7 mensagens por página.
  * Ordenação decrescente por data (`timestamp` ou `create_date`).
  * Modal interno para ler corpo completo da mensagem com botão "OK — estou ciente" (`ok_: true`) e Badge "Pendente de ciência".

---

## 3. Documentação Detalhada Página por Página

---

### Página 1: Login
* **Rota**: `/login`
* **Acesso**: Público

#### Requisições:
| Método | Endpoint | Headers | Payload | Resposta Esperada |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | `Content-Type: application/json` | `{ username: string, password: string }` | `{ access_token: string }` |

#### Regras de Negócio e Estados:
1. Formulário com campos **Usuário** e **Senha**.
2. Ao submeter com sucesso, salva o token no `authStore` via `setUserFromToken(token)`.
3. Redireciona imediatamente para a tela de pontos: `/pontos`.
4. Em caso de erro HTTP (ex: 400/401/500), exibe mensagem de erro na tela: *"Usuário ou senha inválidos!"* ou *"Erro ao conectar com o servidor"*.

---

### Página 2: Perfil do Usuário
* **Rota**: `/profile`
* **Acesso**: Protegido (Operador / Admin)

#### Requisições:
| Método | Endpoint | Headers | Payload | Resposta Esperada |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/profile/upload-photo` | `multipart/form-data` | `FormData: { file: File }` | `{ profile_photo: string }` |
| `PUT` | `/profile/change-password` | `Content-Type: application/json` | `{ password: string, new_password: string }` | Status 200 |

#### Regras de Negócio e Estados:
1. **Exibição**: Foto atual, Nome e E-mail obtidos do `authStore`.
2. **Troca de Foto de Perfil**:
   * Modal com input de arquivo de imagem (`image/*`) e pré-visualização instantânea (`URL.createObjectURL`).
   * Ao confirmar, faz upload para `/profile/upload-photo` e atualiza o estado local do Zustand via `updateUser({ profile_photo })`.
3. **Alteração de Senha**:
   * Modal solicitando "Senha atual" e "Nova senha".
   * Ao confirmar com sucesso, emite alerta de confirmação, executa `clearUser()` e desloga o usuário para `/login`.

---

### Página 3: Vencimentos (Shelf Life)
* **Rota**: `/vencimentos` (ou `/`)
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Payload / Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/shelflife/` | — | Lista todos os produtos com validade cadastrada. |
| `GET` | `/product/:code` | `code: number` | Busca nome do produto pelo código de barras/interno. |
| `POST` | `/shelflife/` | `{ product_code, quantity, shelflife_date, local }` | Cadastra novo vencimento no estoque ativo. |
| `PUT` | `/shelflife/` | `{ id, quantity }` | Atualiza quantidade do registro existente. |
| `DELETE` | `/shelflife/:id` | — | Remove o produto da lista de vencimentos. |
| `GET` | `/damaged/origin/` | — | Lista origens de avaria para formulário integrado. |
| `GET` | `/damaged/type/` | — | Lista tipos de avaria para formulário integrado. |
| `POST` | `/damaged/` | `{ product_code, quantity, shelflife_date, type, origin, local, damaged_date }` | Registra avaria direto do botão de edição. |

#### Regras de Negócio e Estados:
1. **Cálculo de Dias Restantes**:
   $$\text{diasRestantes} = \lceil \text{shelflife\_date} - \text{hoje} \rceil \text{ em dias}$$
2. **Filtro e Ordenação**:
   * Filtra registros onde `produto.local === idLocal` do estado global.
   * Ordena cronologicamente por `shelflife_date` ascendente (vencimentos mais próximos no topo).
3. **Modal de Cadastro**:
   * Ao digitar o código do produto, busca o nome automaticamente via `/product/:code`.
   * Bloqueia submissão se o nome não for encontrado ou se a quantidade for menor que 0.
   * Validade padrão inicializada com a data atual (`YYYY-MM-DD`).
4. **Modal de Edição & Avaria Direta**:
   * Permite editar a quantidade ou clicar no botão **"Avaria"**.
   * Ao clicar em "Avaria", abre formulário para converter aquele vencimento em avaria, selecionando **Tipo de Avaria**, **Origem da Avaria**, data da avaria e quantidade, enviando para `/damaged/` e redirecionando para `/avarias`.
5. **Modal de Exclusão**:
   * Modal de confirmação exibindo o nome do produto e data de validade antes do `DELETE`.

---

### Página 4: Visualização e Impressão de Vencimentos
* **Rota**: `/vencimentos/visualizar`
* **Acesso**: Público / Operador

#### Requisições:
| Método | Endpoint | Resposta |
| :--- | :--- | :--- |
| `GET` | `/external/shelflife/visualization` | Lista completa de vencimentos de todas as lojas |

#### Regras de Negócio e Estados:
1. **Seletor de Local**:
   * Permite alternar entre `1 - Matriz`, `2 - Parnamirim`, `3 - Zona Norte`, `4 - Lagoa Nova`.
2. **Cores de Alerta Visual (Dias Restantes)**:
   * **Vermelho** (`bg-red-500`): $\text{dias} < 15$
   * **Amarelo** (`bg-yellow-400`): $15 \le \text{dias} < 30$
   * **Verde** (`bg-green-500`): $\text{dias} \ge 30$
3. **Salvar como Imagem (Exportação PNG)**:
   * Clona a tabela e adiciona cabeçalho personalizado `"Vencimentos da [Nome da Loja]"`.
   * Renderiza temporariamente via `html2canvas` com scale 2x e dispara download do arquivo `relatorio_vencimentos_[Loja].png`.
4. **Impressão Nativa**:
   * Abre nova janela com CSS de impressão (`@page { margin: 10mm; }`), ocultando colunas desnecessárias e acionando `window.print()`.

---

### Página 5: Avarias (Damaged Products)
* **Rota**: `/avarias`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Payload / Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/damaged/` | — | Lista todas as avarias registradas. |
| `GET` | `/damaged/type/` | — | Lista os tipos de avaria (`TypesProps: { id, name }`). |
| `GET` | `/damaged/origin/` | — | Lista as origens de avaria (`OriginProps: { id, name }`). |
| `GET` | `/damaged/between` | `?date1=YYYY-MM-DD&date2=YYYY-MM-DD` | Filtra avarias por intervalo de datas. |
| `POST` | `/damaged/` | `{ product_code, quantity, shelflife_date, damaged_date, type, origin, local }` | Cria registro de avaria. Retorna o objeto criado com `id`. |
| `POST` | `/damaged/:id/photos` | `FormData: { files: File[] }` | Faz upload de múltiplas fotos vinculadas à avaria. |
| `DELETE` | `/damaged/:id` | — | Exclui uma avaria registrada. |
| `GET` | `/damaged/photo/:id` | — | Busca fotos vinculadas à avaria: `{ photos: [{ id, filename, url }] }`. |

#### Regras de Negócio e Estados:
1. **Gráficos Integrados no Topo**:
   * **Gráfico de Linha (Total por Dia)**: Agrupa custos somados (`cost_total`) por data (`damaged_date`) em ordem cronológica.
   * **Gráfico de Pizza (Distribuição por Tipo)**: Agrupa o custo financeiro por tipo de avaria com paleta de cores.
2. **Cadastro com Fotos & Rollback**:
   * Formulário busca o produto por código `/product/:code`.
   * Permite anexar múltiplas fotos com pré-visualização e exclusão prévia.
   * **Lógica de Transação**: Primeiro envia o POST em `/damaged/`. Se houver fotos, envia em seguida para `/damaged/:id/photos`. Se o upload de fotos falhar, executa rollback disparando `DELETE /damaged/:id`.
3. **Filtro por Período**:
   * Modal solicitando Data Inicial e Data Final disparando `GET /damaged/between`.
4. **Relatório Imprimível**:
   * Modal que exibe somatório total do custo das avarias e tabela formatada em moeda brasileira (BRL).
5. **Galeria de Fotos da Avaria**:
   * Botão "Fotos" em cada linha da tabela abre modal com grid das fotos anexadas daquela avaria específica (`${API_URL}${photo.url}`).

---

### Página 6: Conferências
* **Rota**: `/conferencias`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Payload / Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/conference/` | — | Lista todas as conferências. Frontend filtra `created_by === user.name`. |
| `GET` | `/product/:code` | `code: number` | Busca nome do produto pelo código. |
| `POST` | `/conference/` | `{ product_code, quantity_real, quantity_system, date_, local }` | Salva cada linha de conferência realizada. |
| `DELETE` | `/conference/:id` | — | Deleta conferência normal. |
| `DELETE` | `/work_conference/items/:id` | — | Deleta item de conferência gerado via tarefa/work item. |

#### Regras de Negócio e Estados:
1. **Cards Informativos de Topo**:
   * Total de produtos conferidos **hoje** (compara `date_` com `YYYY-MM-DD` atual).
   * Total de produtos conferidos **no mês**.
   * Gráfico de linha da quantidade de conferências por dia.
2. **Cadastro em Grade Multi-Linhas (Batch Modal)**:
   * Modal em tela cheia com tabela dinâmica: botão **"+ Adicionar Produto"** adiciona linhas.
   * Ao digitar o código do produto, preenche o nome automaticamente.
   * Formatação monetária/decimal de quantidades com 3 casas decimais (ex: `1000,500`).
   * Exibe linha de rodapé com somatórios de **Total Físico** e **Total Sistema**.
   * Ao clicar em "Enviar Todos", itera sobre todas as linhas válidas disparando `POST /conference/`.
3. **Tabela e Filtros Dinâmicos**:
   * Filtros combinados por Código, Nome e Operador de Diferença (`diference > X`, `< X` ou `= X`).
   * Paginação client-side (5 itens por página).
   * Exclusão inteligente com base na origem do item (`/work_conference/items/:id` ou `/conference/:id`).

---

### Página 7: Recebimento de Mercadorias (Receipts)
* **Rota**: `/recebimento`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Payload / Headers | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/receipt/` | — | Lista recebimentos. Frontend filtra `user_id === user.id`. |
| `POST` | `/receipt/` | `FormData: { user_id, user_name, local, created_date, quantity, photo: File }` (Multipart) | Cria novo recebimento com foto obrigatória. |
| `PATCH` | `/receipt/:id` | `{ completed: true }` | Marca o recebimento como finalizado/concluído. |
| `DELETE` | `/receipt/:id` | — | Exclui recebimento pendente. |

#### Regras de Negócio e Estados:
1. **Upload Obrigatório de Foto**:
   * O cadastro exige anexo de foto comprovatória (com preview).
2. **Status**:
   * `completed === false`: Badge Amarela ("Em andamento") e botões "Visualizar" e "Deletar".
   * `completed === true`: Badge Verde ("Completo") e botão "Visualizar".
3. **Modal de Detalhes**:
   * Mostra data, quantidade e local.
   * Botão "Ver Foto" abre a imagem em nova aba.
   * Botão "Marcar como Finalizado" altera `completed` para `true`.

---

### Página 8: Metas do Usuário
* **Rotas**: `/metas`, `/metas/conferencia`, `/metas/avarias`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Query Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/conference/between` | `?date1=YYYY-MM-DD&date2=YYYY-MM-DD&user=user_id` | Busca conferências do usuário no mês. |
| `GET` | `/work_conference/items/` | `?date1=YYYY-MM-DD&date2=YYYY-MM-DD` | Busca itens de tarefas conferidos no período. |
| `GET` | `/damaged/between` | `?date1=YYYY-MM-DD&date2=YYYY-MM-DD` | Busca avarias do mês filtrando por `local === idLocal`. |

#### Regras de Negócio e Estados:
1. **Meta de Conferência Semanal (`ConferenciaCalendario`)**:
   * **Meta Semanal Fixa**: `150` produtos.
   * **Regra do Ciclo Semanal**: A semana inicia na **sexta-feira** e termina na **quinta-feira**.
   * Calcula para cada semana do mês o total de produtos conferidos (conferências normais + work items).
   * **Status da Semana**:
     * `total >= 150` $\rightarrow$ `✔️ Meta atingida` (Verde).
     * `total < 150` $\rightarrow$ `✖️ Abaixo da meta` (Vermelho).
   * Barra de progresso geral do mês com porcentagem de semanas cumpridas e cores dinâmicas:
     * $< 50\%$: `failure` (Vermelho)
     * $50\% \text{ a } 79\%$: `warning` (Amarelo)
     * $\ge 80\%$: `success` (Verde)
2. **Indicador de Meta de Avarias (`IndicadorAvaria`)**:
   * **Teto Máximo Mensal de Avaria**: `R$ 5.000,00`.
   * Soma todos os custos de avarias do local no mês selecionado.
   * Barra de progresso:
     * $< 50\%$ do teto: `success` (Verde - Dentro do esperado).
     * $50\% \text{ a } 80\%$: `warning` (Amarelo - Alerta).
     * $> 80\%$: `failure` (Vermelho - Risco/Estourado).

---

### Página 9: Sistema de Pontos / Rank do Usuário
* **Rota**: `/pontos`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Descrição / Resposta |
| :--- | :--- | :--- |
| `GET` | `/rank/points/:YYYY-MM` | Retorna lista de pontuações de todos os usuários no mês selecionado. |

#### Estrutura do Objeto de Pontos (`PontosProps`):
```typescript
interface PontosProps {
  id: number;
  user_id: number;
  action_id: number;
  local_id: number;
  value: number; // Valor dos pontos ganhos
  time_stamp: string;
  name: string; // Nome da ação (ex: "Conferência", "Validade", etc.)
  product_code: number;
}
```

#### Regras de Negócio e Estados:
1. **Painel do Usuário Logado**:
   * **Card de Destaque**: Soma total de pontos obtidos no mês selecionado.
   * **Últimos 5 Pontos**: Lista as 5 ações mais recentes do usuário com data, nome da ação, código do produto e pontuação ganha (`+X`).
2. **Ranking Mensal Geral**:
   * Agrupa os pontos de todos os usuários no mês selecionado e calcula o percentual em relação ao maior pontuador.
   * Exibe Top 10 com Medalhas:
     * 🥇 1º Lugar (Ícone Ouro)
     * 🥈 2º Lugar (Ícone Prata)
     * 🥉 3º Lugar (Ícone Bronze)
     * 4º+ (`#posição`)
   * Destaca a linha do próprio usuário logado com estilo especial.
3. **Histórico Completo de Pontuações**:
   * Tabela com scroll infinito/scrollbars contendo todas as ações do usuário logado, com filtro por mês ou "Todos os meses".

---

### Página 10: Checklist Semanal do Operador
* **Rota**: `/checklist`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/target/conference/:YYYY-MM` | — | Busca meta de conferência do usuário no mês. |
| `GET` | `/conference/between` | `?date1=...&date2=...&user=user_id` | Busca conferências da semana (e do mês). |
| `GET` | `/logs/` | — | Busca logs do sistema para auditoria de ações. |
| `GET` | `/damaged/between` | `?date1=...&date2=...` | Busca avarias da semana. |
| `GET` | `/receipt/` | — | Busca recebimentos de mercadoria. |

#### Regras de Negócio dos 5 Itens de Checklist Diário:
A semana é calculada de **Segunda a Sábado** (6 dias):
1. **Conferência**:
   * Meta diária dinâmica calculada dividindo a meta mensal restante pelos dias úteis restantes do mês.
   * Status do dia é `✅` se a quantidade conferida no dia $\ge \text{meta diária}$, senão `❌`.
2. **Validades**:
   * Analisa os logs do usuário (`/logs/`) com ação `"Cadastrar"`, `"Editar"` ou `"Excluir"` contendo `"vencimento"` na descrição.
   * Status é `✅` se houver pelo menos 1 registro no dia.
3. **Avarias**:
   * Status é `✅` se o usuário registrou alguma avaria no dia.
4. **Recebimento**:
   * Status é `✅` se o usuário registrou recebimento no dia.
5. **Negativos (Estoque Negativo)**:
   * Status é `✅` se o usuário conferiu no mínimo **5 itens com quantidade no sistema negativa** (`quantity_system < 0`) no dia.
6. **Interatividade & Modais**:
   * Clicar no ícone `✅`/`❌` de qualquer tarefa e dia abre um modal detalhado listando todos os registros que compuseram aquele status.
   * Botão **"🖨️ Imprimir"** gera visualização limpa para impressão via `window.print()`.

---

### Página 11: Auditoria de Produto
* **Rota**: `/auditoria`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/audit/` | `?code_product=:codigo` | Retorna histórico de todas as conferências realizadas para o código informado |

#### Regras de Negócio e Estados:
1. Input numérico para busca por código de barras/produto.
2. Exibe grid de cards contendo:
   * Nome do produto e código.
   * Data da conferência e usuário responsável (`created_by`).
   * Quantidade do Sistema vs. Quantidade Real.
   * **Badge de Diferença**:
     * Verde (`bg-green-600`) se diferença $> 0$ (sobra).
     * Vermelho (`bg-red-600`) se diferença $< 0$ (falta).
     * Cinza se diferença $= 0$.

---

### Página 12: Tarefas / Work Conference
* **Rota**: `/tarefas`
* **Acesso**: Protegido

#### Requisições:
| Método | Endpoint | Payload / Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/work_conference/` | — | Lista as tarefas de conferência geradas |
| `GET` | `/work_conference/items/:workId` | — | Lista os itens de produtos de uma tarefa específica |
| `POST` | `/work_conference/` | `{ quantity: number, local: number }` | Cria uma nova tarefa com X itens aleatórios para conferir |
| `PATCH` | `/work_conference/items/batch` | `WorkItem[]` | Salva alterações das quantidades físicas/sistema dos itens |

#### Regras de Negócio e Estados:
1. **Criação de Tarefa**:
   * O operador informa a quantidade de itens que deseja auditar. O backend seleciona produtos e gera a lista.
2. **Execução / Edição da Tarefa**:
   * Modal exibe cada produto com inputs para: **Quantidade Sistema** e **Quantidade Físico**.
   * Todo item deve receber as quantidades normalmente. Produtos sem estoque físico na loja devem ser enviados com `quantity_real: 0` (não existe mais marcação de produto inativo via `active: false`).
3. **Bloqueio de Edição**:
   * Se a tarefa estiver com `completed === true`, todos os campos ficam desabilitados (apenas leitura).
4. **Impressão da Folha de Tarefa**:
   * Botão "Imprimir Itens" abre janela formatada A4 com tabela em preto e branco pronta para prancheta/contagem física.

---

## 4. Módulos Administrativos (`adminOnly: true`)

---

### Página 13: Admin — Logs de Servidor & Antifraude
* **Rota**: `/admin/logs`
* **Acesso**: Admin

#### Requisições:
| Método | Endpoint | Params | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/logs/` | `?user=...&date1=...&date2=...` | Lista todos os logs de ações |
| `GET` | `/admin/users` | — | Lista todos os usuários do sistema |
| `GET` | `/admin/logged-users` | — | Lista usuários atualmente logados (com IP, Hostname, expiração do token) |
| `GET` | `/admin/login-history` | — | Histórico de tentativas de login com status de sucesso/falha |

#### Regras de Negócio:
1. **Filtros Combinados**: Usuário, Data Inicial e Data Final.
2. **Motor Antifraude Client-Side**:
   * Analisa registros do mesmo produto:
     * Alerta se um produto teve mais de 3 alterações no período.
     * Alerta se houver alterações consecutivas com intervalo menor que 60 segundos.
     * Alerta de alto volume de cadastros/exclusões repetidas.
3. **Modais Administrativos**:
   * Modal de **Usuários Ativos**: visualiza conexões ativas com IP e expiração.
   * Modal de **Histórico de Logins**: visualiza falhas e sucessos de autenticação.

---

### Página 14: Admin — Checklist dos Usuários
* **Rota**: `/admin/checklist`
* **Acesso**: Admin

#### Requisições:
* `GET /admin/users`
* `GET /target/conference/:YYYY-MM`
* `GET /conference/between?date1=...&date2=...&user=id`
* `GET /logs/`
* `GET /damaged/between?date1=...&date2=...`
* `GET /receipt/`

#### Regras de Negócio:
1. Permite selecionar qualquer usuário cadastrado e qualquer semana retroativa.
2. Executa as mesmas regras de validação do checklist individual do operador.
3. **Exportação CSV**: Botão **"⬇️ Baixar CSV"** gera arquivo estruturado com todos os registros e colunas do checklist selecionado para download local.

---

### Página 15: Admin — Auditoria de Pontos & Antifraude
* **Rota**: `/admin/pontos`
* **Acesso**: Admin

#### Requisições:
| Método | Endpoint | Descrição / Resposta |
| :--- | :--- | :--- |
| `GET` | `/rank/?user=...&date1=...&date2=...` | Busca registros de pontuação com filtros |
| `GET` | `/admin/users` | Mapeia nomes de usuários |
| `GET` | `/product/:code` | Mapeia nomes de produtos pelos códigos |

#### Regras de Negócio:
1. Enriquece cada registro de ponto cruzando o `user_id` com a lista de usuários e o `product_code` com a API de produtos.
2. **Algoritmo Antifraude de Pontuação**:
   * Agrupa pontos por `user_id + product_code`.
   * Detecta se o mesmo usuário pontuou 3 ou mais vezes sobre o **mesmo produto** em uma janela de até 24 horas.
   * Exibe alerta no modal detalhando as ocorrências suspeitas.

---

### Página 16: Admin — Análise Comparativa de Pontos
* **Rota**: `/admin/rank/analise`
* **Acesso**: Admin

#### Requisições:
* Carrega os 12 meses via loops para `/rank/points/:YYYY-MM`
* `GET /admin/users`
* `GET /local/`

#### Regras de Negócio:
1. **Comparação de Dois Períodos Temporais**:
   * 4 seletores de data: **Período 1** (Início e Fim) vs. **Período 2** (Início e Fim).
2. **Modos de Visão**: Alterna entre **Usuários** e **Lojas**.
3. **Cálculo de Desempenho e Variação**:
   $$\Delta\% = \frac{\text{Pontos}_{P2} - \text{Pontos}_{P1}}{\text{Pontos}_{P1}} \times 100$$
   * Badges de Desempenho em relação à média geral:
     * $> 110\%$ da média $\rightarrow$ `"Acima"` (Verde).
     * $< 90\%$ da média $\rightarrow$ `"Abaixo"` (Vermelho).
     * Entre $90\%$ e $110\%$ $\rightarrow$ `"Na média"` (Azul).
4. **Gráficos e Detalhes**:
   * Gráfico de barras comparando Período 1 vs. Período 2 lado a lado.
   * Clicar em um usuário abre modal com gráfico de linha da evolução dos pontos nos últimos 6 meses.

---

### Página 17: Admin — Ranking Geral & Lojas
* **Rota**: `/admin/rank`
* **Acesso**: Admin

#### Requisições:
* `GET /admin/users`
* `GET /local/`
* `GET /rank/points/:YYYY-MM`

#### Regras de Negócio:
1. Visualização em Cards com barras de progresso proporcionais ao 1º colocado.
2. **Visão por Loja**:
   * Soma todos os pontos dos operadores daquela filial.
   * Mostra tags com a quebra de pontos por tipo de ação.
   * Botão **"Ver Ranking Interno"**: abre modal com o ranking apenas dos funcionários daquela loja.
3. **Exportação CSV**: Exporta ranking completo do mês formatado.

---

### Página 18: Admin — Análise de Conferências
* **Rota**: `/admin/conferencia/analise`
* **Acesso**: Admin

#### Requisições:
* `GET /admin/users`
* `GET /target/conference/:YYYY-MM`
* `GET /conference/between?date1=...&date2=...` (intervalo de todas as semanas do mês)

#### Regras de Negócio:
1. **Regra de Semanas**: Ciclo de **Sexta a Quinta**.
2. **Meta Semanal Fixa**: `150` itens.
3. **Cálculo de Semanas Batidas**:
   * Conta quantas semanas do mês o usuário atingiu $\ge 150$ conferências.
   * Compara com a meta mensal cadastrada.
4. **Modal de Detalhe Semanal**:
   * Clicar no usuário abre modal detalhando cada semana (Período, Conferências Feitas, Meta e Status `Meta atingida` / `Abaixo da meta`).

---

### Página 19: Admin — Cadastro & Gestão de Metas
* **Rota**: `/admin/metas`
* **Acesso**: Admin

#### Requisições:
| Método | Endpoint | Payload | Descrição / Resposta |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | — | Lista usuários |
| `GET` | `/target/conference/:YYYY-MM` | — | Lista metas cadastradas para o mês |
| `GET` | `/conference/` | — | Lista conferências para cálculo de progresso |
| `POST` | `/target/conference` | `{ moth: "YYYY-MM", quantity: number, completed: boolean, user_id: number }` | Cadastra meta para um ou todos os usuários |

#### Regras de Negócio:
1. **Cadastro Individual ou em Massa**:
   * Checkbox **"Aplicar para todos"**: se marcado, itera sobre todos os usuários enviando a mesma meta mensal para cada um.
2. **Visualização por Cards**:
   * Mostra cada usuário com foto, username e a lista de metas cadastradas.
   * Barra de progresso comparando o total de conferências realizadas no mês vs. a quantidade da meta.
   * Badge de status: `Concluído` (Verde) ou `Pendente` (Vermelho).

---

## 5. Dicionário Consolidado de Endpoints da API

| Método | Endpoint | Descrição Resumida |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Autenticação e obtenção do token JWT |
| `GET` | `/local/` | Lista lojas / locais de estoque |
| `GET` | `/admin/users` | Lista todos os usuários cadastrados |
| `GET` | `/admin/logged-users` | Lista sessões ativas |
| `GET` | `/admin/login-history` | Histórico de logins (sucessos/falhas) |
| `POST` | `/profile/upload-photo` | Upload de foto de perfil |
| `PUT` | `/profile/change-password` | Alteração de senha do usuário autenticado |
| `GET` | `/shelflife/` | Listagem geral de vencimentos |
| `POST` | `/shelflife/` | Cadastro de vencimento de produto |
| `PUT` | `/shelflife/` | Edição da quantidade de um vencimento |
| `DELETE` | `/shelflife/:id` | Exclusão de registro de vencimento |
| `GET` | `/external/shelflife/visualization` | Listagem pública/otimizada para impressão de vencimentos |
| `GET` | `/product/:code` | Consulta informações e nome de um produto |
| `GET` | `/damaged/` | Listagem geral de avarias |
| `GET` | `/damaged/type/` | Lista tipos de avaria |
| `GET` | `/damaged/origin/` | Lista origens de avaria |
| `GET` | `/damaged/between` | Filtra avarias por período de datas |
| `POST` | `/damaged/` | Cadastra registro de avaria |
| `POST` | `/damaged/:id/photos` | Upload de fotos da avaria |
| `GET` | `/damaged/photo/:id` | Lista fotos de uma avaria específica |
| `DELETE` | `/damaged/:id` | Exclusão de avaria |
| `GET` | `/conference/` | Listagem geral de conferências |
| `GET` | `/conference/between` | Filtra conferências por período e/ou usuário |
| `POST` | `/conference/` | Registro de conferência |
| `DELETE` | `/conference/:id` | Exclusão de conferência |
| `GET` | `/work_conference/` | Lista tarefas de conferência (Work Conferences) |
| `POST` | `/work_conference/` | Cria tarefa gerando produtos aleatórios |
| `GET` | `/work_conference/items/:id` | Itens de uma tarefa |
| `PATCH` | `/work_conference/items/batch` | Atualiza em lote itens de tarefa |
| `DELETE` | `/work_conference/items/:id` | Exclusão de item de tarefa |
| `GET` | `/receipt/` | Listagem de recebimentos de mercadoria |
| `POST` | `/receipt/` | Cadastro de recebimento com foto |
| `PATCH` | `/receipt/:id` | Finalização de recebimento (`completed: true`) |
| `DELETE` | `/receipt/:id` | Exclusão de recebimento |
| `GET` | `/target/conference/:YYYY-MM` | Metas mensais de conferência |
| `POST` | `/target/conference` | Cadastro de meta mensal |
| `GET` | `/rank/points/:YYYY-MM` | Pontuações do ranking mensal |
| `GET` | `/rank/` | Listagem de pontuações com filtros |
| `GET` | `/logs/` | Logs de ações do sistema |
| `GET` | `/warning/` | Lista avisos e notificações |
| `PUT` | `/warning/read/:id` | Marca aviso como lido |
| `GET` | `/message/mailbox` | Mensagens da caixa de entrada |
| `PUT` | `/message/:id` | Atualiza leitura ou ciência de mensagem |
| `GET` | `/audit/` | Auditoria de conferências por código de produto |

---

## 6. Recomendações para a Recriação do Zero

1. **Camada de Serviços / API Client**: Crie uma pasta `src/services/` com módulos isolados (`auth.service.ts`, `shelflife.service.ts`, `conference.service.ts`, etc.) em vez de chamar `api.get` diretamente dentro dos componentes.
2. **Gerenciamento de Requisições**: Recomenda-se adotar **TanStack Query (React Query)** para cuidar de caching, refetch automático, loading states e paginação de forma mais performática e declarativa.
3. **Formulários e Validação**: Utilize **React Hook Form** + **Zod** para tipagem e validação rigorosa de campos antes do envio.
4. **Design System / Componentes**: Utilize componentes headless como Radix UI / shadcn/ui ou Tailwind UI para manter controle absoluto do design e acessibilidade.
