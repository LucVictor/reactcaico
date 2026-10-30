# Exportação de planilha de Task Items e Conference

## Rota
`GET /task/export`

## Objetivo
Gerar uma planilha Excel contendo os registros de:
- `Task Item` de tarefas finalizadas (`Task.completed = true`)
- `Conference` registradas pelo usuário no período informado

A exportação considera somente itens de task que já foram finalizados e filtrados pela data do período escolhido.

## Autenticação
A rota exige o token JWT do usuário autenticado no cabeçalho:

```http
Authorization: Bearer <token>
```

## Parâmetros
| Nome | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `date_from` | `date` | Sim | Data inicial do intervalo (`YYYY-MM-DD`). |
| `date_to` | `date` | Sim | Data final do intervalo (`YYYY-MM-DD`). |
| `user_id` | `int` | Não | ID do usuário a ser exportado. Se ausente, usa o usuário autenticado. |

Exemplo:

```http
GET /task/export?date_from=2026-10-01&date_to=2026-10-31
```

Ou para consultar outro usuário (somente admin):

```http
GET /task/export?date_from=2026-10-01&date_to=2026-10-31&user_id=15
```

## Retorno
A resposta retorna um arquivo Excel em formato `.xlsx` com cabeçalho de download.

### Planilha gerada
A aba `Relatorio` contém colunas como:
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

## Regras aplicadas
- `Task Item`: inclui somente itens de tarefas com `Task.completed = true`.
- `Task Item`: considera apenas itens com `quantity_real` preenchido.
- `Task Item`: usa a data da verificação do item, ou a data de criação do item quando não houver verificação registrada.
- `Conference`: considera apenas conferências do usuário autenticado (ou do `user_id` informado) dentro do período.
- Se `date_from > date_to`, a rota retorna `400 Bad Request`.
- Usuários não administradores só podem exportar seus próprios dados.

## Exemplo de resposta
```http
200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="relatorio_joao_2026-10-01_2026-10-31.xlsx"
```
