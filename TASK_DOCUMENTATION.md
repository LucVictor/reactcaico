# Documentação do Módulo de Tasks — Integração Android (App Viewer)

Guia de integração para o app Android (viewer) dos endpoints de **geração** e **resposta** de tarefas de conferência (`/task`).

---

## 1. Visão Geral do Fluxo

```
1. GERAR      → POST /task/ (operador)  ou  POST /task/admin/ (admin → outro usuário)
2. LISTAR     → GET  /task/             → obtém os IDs das tasks do usuário logado
3. BUSCAR     → GET  /task/items/{task_id} → obtém os ITENS (produtos p/ conferir)
4. RESPONDER  → PUT  /task/items/       → envia a contagem (sistema x real) dos itens
```

> **Ponto de atenção (importante):**
> O `items` da resposta de **geração** traz os **produtos sorteados** (com o `id` do produto).
> Para **responder**, use os IDs vindo de `GET /task/items/{task_id}` (campo `id`), que são os IDs dos **itens da task** — são valores diferentes!

---

## 2. Autenticação

Todas as rotas exigem o token JWT no cabeçalho:

```
Authorization: Bearer <token_jwt>
```

O token é obtido em `POST /auth/login` (`{"username": "...", "password": "..."}`).
O payload do token contém `id`, `name`, `email`, `local` (filial) e `admin` (0 ou 1).

---

## 3. Gerar Task

### 3.1 `POST /task/` — Operador gera a própria task

Sorteia aleatoriamente `quantity` produtos **do estoque da filial** (`branch_code`) que ainda **não foram conferidos naquela filial dentro da janela de dias configurada** (padrão: 30) e com **quantidade em estoque > 0**.

**Request Body (JSON):**

```json
{
  "quantity": 3,
  "branch_code": 1,
  "days": 30
}
```

Campo | Tipo | Descrição
:--- | :--- | :---
`quantity` | int | Quantidade de produtos a sortear.
`branch_code` | int | Filial do estoque.
`days` | int (opcional) | Janela de bloqueio em dias. Padrão: `30`. Deve ser `>= 1`. Aplica-se tanto às verificações de task quanto às conferências manuais (`/conference`) daquela filial.

**Resposta `200 OK`:**

```json
{
  "message": "Task created successfully",
  "task": {
    "id": 1,
    "user_id": 2,
    "user_name": "Carlos",
    "quantity": 3,
    "completed": false,
    "branch_code": 1,
    "created_date": "2026-09-24"
  },
  "items": [
    {
      "id": 5,
      "code": "c5",
      "external_id": 5,
      "name": "Produto 5",
      "price": "0",
      "last_verification": "2026-01-01"
    }
  ]
}
```

Campo | Tipo | Descrição
:--- | :--- | :---
`task.id` | int | ID da task gerada (use com `GET /task/items/{task_id}`)
`task.completed` | bool | `false` enquanto pendente; vira `true` ao responder
`items[].id` | int | **ID do produto** (NÃO usar no PUT)
`items[].code` / `.external_id` | str/int | Códigos do produto p/ exibição/busca
`items[].last_verification` | date\|null | Última verificação registrada (pode ser `null`)
`items[].stock_quantity` | decimal | Quantidade em estoque **daquela filial** (`branch_code` da task) no momento da criação

**Erros:**
* `400 Bad Request` — `quantity` <= 0, ou maior que o nº de produtos disponíveis (a resposta detalha quantos estão disponíveis).
* `404 Not Found` — `"No products pending verification"`: não há produtos na filial com estoque > 0 e pendentes de conferência dentro da janela configurada de dias.

---

### 3.2 `POST /task/admin/` — Admin gera task para outro usuário

Igual ao anterior, porém o admin informa para **qual usuário** a task será direcionada. A task fica na lista do usuário-alvo (filtro do `GET /task/` pela `user_id`).

**Restrição:** apenas usuários com `admin = 1`.

**Request Body (JSON):**

```json
{
  "user_id": 2,
  "quantity": 3,
  "branch_code": 1,
  "days": 30
}
```

> `days` é opcional e tem o mesmo comportamento da seção 3.1 (padrão `30`).

**Resposta `200 OK`:** idêntica ao `POST /task/`, mas com `task.user_id` e `task.user_name` do usuário-alvo.

**Erros:**
* `403 Forbidden` — `"Only administrators can generate tasks for other users"` (admin = 0).
* `404 Not Found` — `"User not found"` (`user_id` inexistente).
* `400 Bad Request` / `404` — mesmas regras de disponibilidade de produtos acima.

---

### 3.3 `POST /task/admin/custom/` — Admin atribui task com códigos de produtos específicos

Permite ao admin criar uma task **escolhendo exatamente quais produtos** o operador deve conferir (sem sorteio). Não aplica o filtro de 30 dias nem de estoque — é uma atribuição explícita do admin.

**Restrição:** apenas usuários com `admin = 1`.

**Request Body (JSON):**

```json
{
  "user_id": 2,
  "branch_code": 1,
  "product_codes": ["C-003", "C-001"]
}
```

**Resposta `200 OK`:** idêntica ao `POST /task/`, com `task.user_id`/`task.user_name` do usuário-alvo e `items` na mesma ordem dos códigos informados.

**Regras:**
* Códigos duplicados são ignorados (mantém a ordem e o primeiro).
* `task.quantity` = quantidade de códigos válidos.
* Todos os códigos devem existir em `productv2` (campo `code`).

**Erros:**
* `400 Bad Request` — `"At least one product code is required"` (lista vazia).
* `404 Not Found` — `"User not found"` ou `"Products not found for codes: C-999"` (código(s) inexistente(s)).
* `403 Forbidden` — não-admin.

---

### 3.4 `GET /task/admin/tasks/` — Admin acompanha tasks dos usuários

Lista as tasks de **todos os usuários** (ou filtradas), com indicador de itens confirmados. Útil para painel de acompanhamento de pendências.

**Restrição:** apenas usuários com `admin = 1`.

**Query Params (todos opcionais):**
* `user_id` (int) — filtra tasks de um usuário específico.
* `completed` (bool: `true`/`false`) — filtra apenas concluídas ou apenas pendentes.

**Resposta `200 OK`:** lista da mais recente para a mais antiga:

```json
[
  {
    "id": 1,
    "user_id": 2,
    "user_name": "Carlos",
    "quantity": 2,
    "completed": true,
    "branch_code": 1,
    "created_date": "2026-09-24",
    "items_confirmed": 2
  }
]
```

Campo | Tipo | Descrição
:--- | :--- | :---
`quantity` | int | Total de itens da task
`items_confirmed` | int | Quantos itens já foram respondidos (`quantity_real` preenchido) — 0 = nada confirmado
`completed` | bool | `true` quando todos os itens foram respondidos

**Erros:**
* `403 Forbidden` — não-admin.

---

### 3.5 `DELETE /task/admin/tasks/{task_id}/` — Admin exclui uma task

Exclui uma task, seus **itens** e os **registros de verificação** (`productverification`) vinculados a ela. Ao excluir, os produtos daquela task voltam a ser candidatos para novas conferências na filial. **Também estorna os pontos** ("Concluir Task"/"Conferir produto na task") atribuídos pela conclusão.

**Restrição:** apenas usuários com `admin = 1`.

**Resposta `200 OK`:**

```json
{
  "message": "Task deleted successfully"
}
```

**Erros:**
* `404 Not Found` — `"Task not found"`.
* `403 Forbidden` — não-admin.

---

## 4. Listar Tasks

### `GET /task/`

Retorna **apenas as tasks do usuário autenticado** (`user_id` = do token), da mais recente para a mais antiga.

**Resposta `200 OK`:**

```json
[
  {
    "id": 1,
    "user_id": 2,
    "user_name": "Carlos",
    "quantity": 3,
    "completed": false,
    "branch_code": 1,
    "created_date": "2026-09-24"
  }
]
```

Dica de UI: exiba os blocos de task com `completed` (pendente/concluída) e `created_date`.

---

## 5. Buscar Itens de uma Task

### `GET /task/items/{task_id}`

Retorna os **itens da task** (os produtos que devem ser conferidos). É a fonte dos `id` usados no `PUT /task/items/`.

**Restrição de acesso:** apenas o dono da task (ou admin).

**Resposta `200 OK`:**

```json
[
  {
    "id": 1,
    "task_id": 1,
    "product_external_id": 12275,
    "product_inactive": false,
    "code": "12414",
    "product_name": "Produto 5",
    "quantity_system": null,
    "quantity_real": null,
    "difference": null,
    "cost_total": null,
    "stock_quantity": "15.0000000000",
    "created_date": "2026-09-24"
  }
]
```

Campo | Tipo | Descrição
:--- | :--- | :---
`id` | int | **ID do item da task** — use no PUT de resposta
`product_external_id` | int | Vínculo interno do produto (FK). **Não é o código exibido ao usuário.**
`code` | str\|null | **Código do produto** — é este que deve ser exibido. Vem do mesmo registro de produto do `product_name`, então nunca divergem.
`product_name` | str | Nome exibido ao operador
`quantity_system` | decimal\|null | Qtd. do sistema (preenchida após responder)
`quantity_real` | decimal\|null | Qtd. real conferida
`difference` | decimal\|null | `quantity_real - quantity_system`
`stock_quantity` | decimal | Quantidade em estoque da filial da task (útil p/ exibir a referência do sistema antes de conferir)

> **`code` ≠ `product_external_id`.** Em ~19% do catálogo os dois valores são diferentes (ex.: `code = "12414"`, `external_id = 12275`). Exibir o `product_external_id` como código mostra o produto errado. O `code` é `null` só se o produto tiver sido removido de `productv2` (órfão).

**Erros:**
* `403 Forbidden` — a task não pertence ao usuário logado (e não é admin).
* `404 Not Found` — `"Task not found"`.

---

## 6. Responder Task (Enviar Conferência)

### `PUT /task/items/`

Recebe a lista de itens conferidos. Para cada item, calcula a diferença e **registra a verificação do produto na filial (tabela `productverification`)** — é esse registro que faz o produto deixar de aparecer em novas tasks daquela filial dentro da janela configurada (padrão de 30 dias).

O endpoint é **idempotente**: reenviar a mesma requisição não duplica nada. A verificação é gravada **uma única vez por item** (identificada por `task_item_id`), portanto reenvios — ou o mesmo `id` repetido dentro do próprio payload — não criam registros novos em `productverification`. Corrigir as quantidades de um item já verificado apenas recalcula `difference`/`cost_total`, sem gerar uma segunda verificação.

**Request Body (JSON):**

```json
[
  {
    "id": 1,
    "quantity_system": 10,
    "quantity_real": 9
  },
  {
    "id": 2,
    "quantity_system": 10,
    "quantity_real": 10
  }
]
```

**Campos por item:**
* `id` (**obrigatório**): ID do item obtido em `GET /task/items/{task_id}`.
* `quantity_system` / `quantity_real` (decimal): quantidades conferidas. Para produto **sem estoque físico**, basta enviar `quantity_real: 0` (a diferença fica negativa e o produto é marcado como verificado mesmo assim).

**Resposta `200 OK`:**

```json
{
  "message": "Task items updated successfully",
  "items": [
    {
      "id": 1,
      "task_id": 1,
    "product_external_id": 12275,
    "product_inactive": false,
    "code": "12414",
    "product_name": "Produto 5",
    "quantity_system": "10.0000000000",
      "quantity_real": "9.0000000000",
      "difference": "-1.0000000000",
      "cost_total": null,
      "created_date": "2026-09-24"
    }
  ]
}
```

**Regras:**
* Ao responder itens de uma task, a task é marcada como `completed = true` e a quantidade (`task.quantity`) é recalculada.
* Só o **dono da task** (ou admin) pode responder — itens de outra pessoa retornam `403`.
* **Pontuação (1ª conclusão)**: o usuário que conclui a task recebe **+5 pontos** ("Concluir Task") **+3 pontos por produto** da task ("Conferir produto na task"). Na mesma filial, um mesmo produto já premiado nos últimos 5 dias não pontua de novo. Reenvios não pontuam novamente. Se a task for excluída pelo admin, os pontos são estornados.
* **Idempotência**: reenviar o mesmo payload devolve `200 OK` com exatamente o mesmo corpo e não altera nenhum dado — nem `productverification`, nem pontuação.

**Erros:**
* `400 Bad Request` — corpo vazio ou item sem `id`.
* `403 Forbidden` — `"You do not have permission to edit this item"`.
* `404 Not Found` — item ou task inexistente.

---

## 7. Resumo de Códigos de Resposta

| Código | Significado |
| :---: | :--- |
| `200` | Sucesso |
| `400` | Requisição inválida (quantity inválida, sem itens, item sem id) |
| `401` | Token ausente/expirado |
| `403` | Sem permissão (não-admin, task de outro usuário) |
| `404` | Não encontrado (produtos pendentes, usuário, task ou item) |

---

## 8. Boas Práticas do App

1. **Gerar**: ao tocar em "Nova tarefa", chame `POST /task/` com a filial do operador. Se a resposta for `404`, mostre a mensagem e não bloqueie o app.
2. **Pós-geração**: não dependa do `items` da resposta para conferir — faça `GET /task/items/{task_id}` para ter os ids estáveis dos itens (ordem de sorteio é aleatória e os ids de item são os usados no PUT).
3. **Responder**: envie cada item assim que conferido, ou monte a lista completa e envie em lote. Produto sem estoque físico: envie `quantity_real: 0`.
4. **Atualização da tela**: após o PUT, o `GET /task/` refletirá `completed = true` na task.
5. **Valores decimais**: os campos de quantidade são decimal e podem vir como string no JSON da resposta (ex.: `"10.0000000000"`). Trate como número no app.