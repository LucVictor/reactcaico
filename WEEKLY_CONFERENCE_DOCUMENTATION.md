# Conferência Semanal de Produtos — `GET /target/conference/weekly/{month}`

Documentação da rota que processa um mês e devolve o resumo semanal usado pela
página **/metas** (Conferência Semanal de Produtos).

A rota substitui o cálculo que antes era feito no frontend: ela soma as
**conferências** (`/conference`) e os **itens conferidos nas tasks** (`/task`) e
devolve as semanas já prontas, incluindo as semanas que começam em um mês e
terminam no mês seguinte.

---

## 1. Visão geral

| Item | Valor |
| :--- | :--- |
| Método | `GET` |
| Rota | `/target/conference/weekly/{month}` |
| Autenticação | Bearer Token (JWT) |
| Módulo | Metas (`/target`) |
| Meta semanal padrão | `150` conferências |

### Fontes contabilizadas

| Origem | Tabela | Data usada na contagem | Regra |
| :--- | :--- | :--- | :--- |
| Conferência avulsa | `conference` | `date_` | Conta 1 por registro |
| Item de task | `taskitem` + `productverification` | `productverification.created_date` (ou `taskitem.created_date` quando não houver verificação) | Conta 1 por item com `quantity_real` preenchido |

> **Estoque negativo:** registros com `quantity_system < 0` **não entram** na
> quantidade que vale para a meta. Eles são somados separadamente em
> `quantidade_negativos` apenas para fins informativos — mesma regra do
> frontend.

---

## 2. Parâmetros

### Path params

| Parâmetro | Tipo | Obrigatório | Descrição |
| :--- | :--- | :---: | :--- |
| `month` | string | Sim | Mês no formato `YYYY-MM` (ex.: `2025-10`). |

### Query params

| Parâmetro | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `user_id` | int | usuário logado | ID do usuário consultado. Sem o parâmetro, usa o usuário autenticado. Apenas admin pode consultar outro usuário. |
| `all_users` | bool | `false` | Quando `true`, agrega as conferências e tasks de **todos** os usuários. Apenas admin. |
| `meta_semanal` | int (>= 1) | `150` | Meta semanal usada no cálculo de `faltam`/`atingiu_meta`. |

---

## 3. Regras de negócio

1. **Semanas de sexta a quinta**
   A semana começa na sexta-feira e termina na quinta-feira, exatamente como no
   frontend.
2. **Semanas não são recortadas pelo mês**
   A primeira semana exibida é a sexta-feira anterior (ou igual) ao dia 1. A
   última é a sexta-feira anterior (ou igual) ao último dia do mês, somada de
   mais 6 dias. Por isso `periodo_inicio`/`periodo_fim` podem pertencer a meses
   vizinhos.
   Exemplo para `2025-10`:
   * `periodo_inicio`: `2025-09-26`
   * `periodo_fim`: `2025-11-06`
   * 6 semanas: `26/09-02/10`, `03/10-09/10`, `10/10-16/10`,
     `17/10-23/10`, `24/10-30/10`, `31/10-06/11`.
3. **Total do mês**
   `total_mes` soma **apenas os dias que pertencem ao mês selecionado**. É
   diferente da soma das semanas, pois as semanas podem incluir dias do mês
   anterior/seguinte.
4. **Itens de task**
   Só entram itens efetivamente conferidos (`quantity_real` preenchido). A data
   considerada é a da verificação (`productverification.created_date`). Se o item
   não tiver verificação registrada (dados legados), usa-se
   `taskitem.created_date`.
5. **Escopo por usuário**
   Por padrão, o resumo considera apenas o usuário autenticado:
   * conferências: `conference.created_by == nome do usuário`;
   * tasks: `task.user_id == id do usuário`.
6. **Duplicidade**
   Cada item de task é contado no máximo uma vez, mesmo que exista mais de um
   registro de verificação para o mesmo item.

---

## 4. Exemplo de requisição

```http
GET /target/conference/weekly/2025-10?meta_semanal=150
Authorization: Bearer <token_jwt>
```

Admin agregando todos os usuários:

```http
GET /target/conference/weekly/2025-10?all_users=true
Authorization: Bearer <token_jwt>
```

---

## 5. Resposta `200 OK`

```json
{
  "mes": "2025-10",
  "meta_semanal": 150,
  "periodo_inicio": "2025-09-26",
  "periodo_fim": "2025-11-06",
  "total_mes": 523,
  "total_semanas": 6,
  "semanas_com_meta_batida": 2,
  "progresso_percentual": 33,
  "semanas": [
    {
      "numero": 1,
      "inicio": "26/09",
      "fim": "02/10",
      "periodo": "26/09 - 02/10",
      "quantidade": 172,
      "conferencias": 150,
      "tasks": 22,
      "quantidade_negativos": 4,
      "meta_semana": 150,
      "faltam": 0,
      "atingiu_meta": true
    },
    {
      "numero": 2,
      "inicio": "03/10",
      "fim": "09/10",
      "periodo": "03/10 - 09/10",
      "quantidade": 148,
      "conferencias": 120,
      "tasks": 28,
      "quantidade_negativos": 2,
      "meta_semana": 150,
      "faltam": 2,
      "atingiu_meta": false
    }
  ]
}
```

### Campos da resposta

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `mes` | string | Mês consultado (`YYYY-MM`). |
| `meta_semanal` | int | Meta semanal usada no cálculo. |
| `periodo_inicio` | date | Início da primeira semana exibida (`YYYY-MM-DD`). Pode ser do mês anterior. |
| `periodo_fim` | date | Fim da última semana exibida (`YYYY-MM-DD`). Pode ser do mês seguinte. |
| `total_mes` | int | Total conferido dentro do mês selecionado (sem negativos). |
| `total_semanas` | int | Quantidade de semanas exibidas para o mês. |
| `semanas_com_meta_batida` | int | Quantas semanas atingiram `meta_semanal`. |
| `progresso_percentual` | int | `semanas_com_meta_batida / total_semanas * 100`, limitado a 100. |
| `semanas` | array | Lista de semanas (sexta a quinta). |

### Campos de cada semana

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `numero` | int | Número sequencial da semana no mês (1, 2, 3...). |
| `inicio` | string | Dia inicial no formato `DD/MM`. |
| `fim` | string | Dia final no formato `DD/MM`. |
| `periodo` | string | Período formatado: `DD/MM - DD/MM`. |
| `quantidade` | int | Total válido para a meta (`conferencias + tasks`). |
| `conferencias` | int | Quantas vieram de `/conference`. |
| `tasks` | int | Quantas vieram de itens de `/task`. |
| `quantidade_negativos` | int | Estoque negativo (informativo, fora da meta). |
| `meta_semana` | int | Meta daquela semana. |
| `faltam` | int | Quanto falta para a meta (`max(meta_semana - quantidade, 0)`). |
| `atingiu_meta` | bool | `true` quando `quantidade >= meta_semana`. |

---

## 6. Erros

| Código | Situação | `detail` |
| :---: | :--- | :--- |
| `400` | `month` fora do formato `YYYY-MM` | `Formato inválido. Use YYYY-MM (ex: 2025-10).` |
| `401` | Token ausente/expirado | `Token inválido` |
| `403` | Não-admin consultando outro `user_id` | `You do not have permission to view another user's summary` |
| `403` | Não-admin usando `all_users=true` | `Only administrators can aggregate all users` |
| `404` | `user_id` inexistente | `User not found` |

---

## 7. Integração no frontend (substituindo o cálculo local)

Antes o componente chamava `/conference/between` + `/work_conference/items/` e
calculava as semanas no navegador. Agora basta uma chamada:

```ts
export interface WeeklyConferenceStat {
  numero: number;
  inicio: string;
  fim: string;
  periodo: string;
  quantidade: number;
  conferencias: number;
  tasks: number;
  quantidade_negativos: number;
  meta_semana: number;
  faltam: number;
  atingiu_meta: boolean;
}

export interface WeeklyConferenceSummary {
  mes: string;
  meta_semanal: number;
  periodo_inicio: string;
  periodo_fim: string;
  total_mes: number;
  total_semanas: number;
  semanas_com_meta_batida: number;
  progresso_percentual: number;
  semanas: WeeklyConferenceStat[];
}

const { data } = await api.get<WeeklyConferenceSummary>(
  `/target/conference/weekly/${mesSelecionado}`,
);

setResumo(data);
```

O componente passa a usar diretamente:

* `data.meta_semanal` no lugar de `META_SEMANAL`;
* `data.total_mes` no lugar de `totalMensal`;
* `data.semanas_com_meta_batida` e `data.total_semanas` no lugar do cálculo local;
* `data.progresso_percentual` na barra de progresso;
* `data.semanas` na tabela (campos `quantidade`, `quantidade_negativos`,
  `meta_semana`, `faltam`, `atingiu_meta`).

> Se precisar exibir a origem das conferências, use `conferencias` e `tasks` de
> cada semana.

---

## 8. Rota administrativa

### `GET /target/admin/conference/weekly/{month}`

Versão administrativa da mesma conferência semanal. Exige `admin` e permite
consultar **todos os usuários** ou um usuário específico.

| Item | Valor |
| :--- | :--- |
| Método | `GET` |
| Rota | `/target/admin/conference/weekly/{month}` |
| Autenticação | Bearer Token (**apenas admin**) |

#### Parâmetros

| Parâmetro | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `month` (path) | string | — | Mês no formato `YYYY-MM`. |
| `user_id` | int | — | Quando informado, o consolidado e o detalhamento ficam restritos a esse usuário. Quando omitido, o consolidado inclui todos os usuários e o detalhamento lista cada um. |
| `include_empty` | bool | `false` | Inclui no detalhamento usuários sem nenhum movimento no período. Ignorado quando `user_id` é informado. |
| `meta_semanal` | int (>= 1) | `150` | Meta semanal usada no cálculo. |

#### Comportamento

* **Sem `user_id`**: `consolidado` = soma de todos os usuários; `usuarios` =
  resumo individual de cada usuário com movimento no período.
* **Com `user_id`**: `consolidado` e `usuarios` referem-se apenas àquele
  usuário.
* Um usuário com apenas estoque negativo também é considerado “com movimento”
  e aparece no detalhamento (com `total_mes = 0` e
  `quantidade_negativos > 0`).
* As regras de contagem, semanas de sexta a quinta e cruzamento de meses são
  idênticas às da rota não administrativa.

#### Exemplo

```http
GET /target/admin/conference/weekly/2025-10
Authorization: Bearer <token_jwt>
```

```json
{
  "mes": "2025-10",
  "meta_semanal": 150,
  "total_usuarios": 2,
  "consolidado": {
    "mes": "2025-10",
    "meta_semanal": 150,
    "periodo_inicio": "2025-09-26",
    "periodo_fim": "2025-11-06",
    "total_mes": 523,
    "total_semanas": 6,
    "semanas_com_meta_batida": 2,
    "progresso_percentual": 33,
    "semanas": [
      {
        "numero": 1,
        "inicio": "26/09",
        "fim": "02/10",
        "periodo": "26/09 - 02/10",
        "quantidade": 172,
        "conferencias": 150,
        "tasks": 22,
        "quantidade_negativos": 4,
        "meta_semana": 150,
        "faltam": 0,
        "atingiu_meta": true
      }
    ]
  },
  "usuarios": [
    {
      "user_id": 1,
      "user_name": "Ana",
      "local": 1,
      "resumo": {
        "mes": "2025-10",
        "meta_semanal": 150,
        "periodo_inicio": "2025-09-26",
        "periodo_fim": "2025-11-06",
        "total_mes": 300,
        "total_semanas": 6,
        "semanas_com_meta_batida": 1,
        "progresso_percentual": 17,
        "semanas": []
      }
    }
  ]
}
```

> No exemplo, `semanas` foi omitido dentro de `resumo` apenas para encurtar.
> A resposta real sempre traz a lista completa, com a mesma estrutura da rota
> principal.

#### Erros

| Código | Situação | `detail` |
| :---: | :--- | :--- |
| `400` | `month` fora do formato `YYYY-MM` | `Formato inválido. Use YYYY-MM (ex: 2025-10).` |
| `401` | Token ausente/expirado | `Token inválido` |
| `403` | Usuário não é admin | `Only administrators can access the weekly conference summary` |
| `404` | `user_id` inexistente | `User not found` |

---

## 9. Observações

* A rota é **somente leitura**: não grava nada no banco.
* A meta padrão é `150`, mas pode ser alterada por requisição via `meta_semanal`
  sem impactar as demais rotas.
* O cálculo de datas usa o calendário do servidor, sem conversão de fuso, pois
  `conference.date_`, `taskitem.created_date` e
  `productverification.created_date` são datas (`date`), não timestamps.
