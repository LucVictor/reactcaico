# README Exclusivo — Exportação Administrativa de Task Items e Conference (`/task/admin/export`)

## Visão geral
Esta rota é exclusiva para administradores e gera um arquivo Excel com os registros de:

- `Task Item` de tarefas finalizadas (`Task.completed = true`)
- `Conference` registradas no período informado

A exportação administrativa pode ser feita para:

- um usuário específico, via `user_id`
- todos os usuários, quando `user_id` não é informado

## Autenticação
A rota exige token JWT válido e perfil de administrador:

```http
Authorization: Bearer <token>
```

Se o usuário autenticado não for administrador, a rota responde com:

```json
{
  "detail": "Acesso negado: apenas administradores podem exportar os dados completos."
}
```

## Endpoint
```http
GET /task/admin/export
```

## Query params
| Nome | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `date_from` | `date` | Sim | Data inicial do período (`YYYY-MM-DD`). |
| `date_to` | `date` | Sim | Data final do período (`YYYY-MM-DD`). |
| `user_id` | `int` | Não | ID do usuário para exportar apenas um operador. Se omitido, exporta todos os usuários. |

## Exemplos
### Exportar todos os usuários
```http
GET /task/admin/export?date_from=2026-10-01&date_to=2026-10-31
```

### Exportar um usuário específico
```http
GET /task/admin/export?date_from=2026-10-01&date_to=2026-10-31&user_id=15
```

## Comportamento
- Inclui somente `Task Item` de tarefas finalizadas.
- Inclui somente itens de task com `quantity_real` preenchido.
- Usa a data da verificação do item, ou a data de criação do item quando a verificação ainda não foi registrada.
- Inclui todas as `Conference` do usuário ou usuários filtrados dentro do período.
- Caso `date_from > date_to`, retorna `400 Bad Request`.
- Caso `user_id` informado não exista, retorna `404 Not Found`.

## Retorno
A resposta retorna um arquivo Excel (.xlsx) com download do navegador.

### Nome do arquivo
- Usuário específico:
  `relatorio_admin_<usuario>_<date_from>_<date_to>.xlsx`
- Todos os usuários:
  `relatorio_admin_todos_usuarios_<date_from>_<date_to>.xlsx`

### Planilha
A aba `Relatorio` contém as colunas:
- `categoria`
- `data`
- `user_id`
- `user_name`
- `task_id`
- `product_code`
- `product_name`
- `quantity_system`
- `quantity_real`
- `difference`
- `cost_total`
- `branch_code`
- `local`
- `created_by`

## Observação
A rota administrativa complementa a rota do operador `GET /task/export`, que exporta somente os próprios dados do usuário autenticado.
