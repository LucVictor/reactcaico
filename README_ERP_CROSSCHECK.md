# ERP Crosscheck — verificação cruzada com JSON do ERP

## O que foi implementado

Feature de verificação cruzada entre os registros do sistema (conferências, tasks e avarias) e os JSON exportados do ERP principal. Ao aprovar um registro, o sistema detecta se o produto foi ajustado no estoque (JSON de ajuste) ou movimentado como avaria (JSON de avaria) dentro de ±1 dia da data do registro.

A lógica de carregamento dos arquivos, aplicação do resultado e gravação dos matches foi centralizada em um único serviço (`service.py`), usado tanto pelas aprovações (conferência, avaria e task) quanto pela rota `POST /external/erp/json/apply`. Antes existiam três cópias divergentes da mesma lógica.

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `app/models/erp_json_file.py` | Modelo `ERPJsonFile` — controle dos arquivos JSON ingeridos (id, filename, content_hash, erp_type, filedata, imported_at) |
| `app/models/erpcrosscheckmatch.py` | Modelo `ERPCrosscheckMatch` — registro de cada cruzamento encontrado (record_id, record_type, match_type, product_code, product_name, num_mov, dt_mov, quantity, cost_unit, cod_filial, erp_local, match_date) |
| `app/routers/external/erp_crosscheck/parsers.py` | Parsers para JSON de ajuste e avaria: parse de data (`dd/MM/yyyy` e ISO `yyyy-MM-dd`), números JSON nativos e strings pt-BR, estruturas `ERPAdjustmentLine` e `ERPAvariaItem` |
| `app/routers/external/erp_crosscheck/crosscheck.py` | Lógica pura e reutilizável de cruzamento: `find_erp_adjustment_matches`, `find_erp_avaria_matches`, `CrosscheckMatch`, `date_matches`, `product_code_key`, `local_key`, ordenação determinística dos matches |
| `app/routers/external/erp_crosscheck/service.py` | **Serviço compartilhado**: loaders (`load_adjustments`, `load_avarias`), `apply_match`, `clear_match`, `save_match` (idempotente), `task_item_context`, `task_item_verification_date`, `reset_pending_crosscheck` |
| `app/routers/external/erp_crosscheck/router.py` | Router com rotas de upload/GET/DELETE do JSON, aplicação do cruzamento, consulta de matches |
| `app/database/migrations.py` | Funções `ensure_approval_columns` e `ensure_erp_crosscheck_columns` — adicionam colunas de aprovação/ERP e criam as tabelas `ERPJsonFile` e `ERPCrosscheckMatch` |

## Rotas adicionadas

Todas as rotas têm o prefixo `/external/erp/json` e exigem autenticação via Bearer token (`Authorization: Bearer <access_token>`). Além disso, **todas exigem usuário administrador** (`admin = 1`); usuários comuns recebem **403**.

| Método | Rota | Descrição | Admin |
|---|---|---|---|
| `POST` | `/external/erp/json/upload` | Ingere um JSON de ajuste ou avaria | Sim |
| `GET` | `/external/erp/json/files` | Lista os arquivos ingeridos | Sim |
| `DELETE` | `/external/erp/json/files/{file_id}` | Remove um arquivo ingerido | Sim |
| `POST` | `/external/erp/json/apply` | Limpa e reaplica o cruzamento nos pendentes | Sim |
| `GET` | `/external/erp/json/matches` | Consulta os matches de um registro | Sim |

### Códigos de erro comuns

| Código | Quando ocorre |
|---|---|
| `401` | Token ausente, inválido ou expirado |
| `403` | Usuário autenticado, mas não é administrador |
| `400` | Parâmetro/arquivo inválido (JSON inválido, data inválida, `erp_type` inválido, arquivo vazio) |
| `404` | Arquivo ERP não encontrado no `DELETE` |
| `422` | Parâmetro obrigatório ausente ou com tipo incorreto (validação automática do FastAPI) |

---

### POST `/external/erp/json/upload`

Ingere um JSON exportado do ERP e grava o conteúdo bruto no banco.

**Content-Type:** `multipart/form-data`

**Campos do formulário:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `file` | arquivo | Sim | Conteúdo do JSON exportado do ERP. |
| `erp_type` | string | Não | `ajuste` ou `avaria`. Quando omitido, o tipo é inferido pelo nome do arquivo (`avaria`/`transf` → avaria; `ajust`/`mov`/`estoque` → ajuste). |

**Comportamento:**

- O JSON é decodificado (UTF-8 ou Latin-1) e validado antes de ser gravado.
- JSON inválido, estrutura inesperada ou data inválida retornam **400** com a mensagem do erro.
- Conteúdo idêntico (mesmo hash SHA-256) não é ingerido duas vezes; nesse caso retorna o arquivo existente com `duplicate: true`.
- Um registro de log (`Log`) é criado para cada upload bem-sucedido.

**Exemplo de requisição:**

```bash
curl -X POST "http://localhost:8000/external/erp/json/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Ajustes.json" \
  -F "erp_type=ajuste"
```

**Resposta de sucesso (200):**

```json
{
  "message": "JSON ingerido com sucesso",
  "file_id": 12,
  "erp_type": "ajuste",
  "imported_at": "2026-11-25T15:33:46.889123+00:00",
  "duplicate": false
}
```

**Resposta para conteúdo duplicado (200):**

```json
{
  "message": "Arquivo já ingerido (conteúdo idêntico)",
  "file_id": 12,
  "erp_type": "ajuste",
  "imported_at": "2026-11-25T15:33:46.889123+00:00",
  "duplicate": true
}
```

**Erros:**

```json
{ "detail": "Arquivo vazio" }
{ "detail": "JSON inválido: Expecting value: line 1 column 1 (char 0)" }
{ "detail": "erp_type deve ser 'ajuste' ou 'avaria'" }
{ "detail": "JSON de ajuste inválido: Invalid isoformat string: 'data-invalida'" }
```

---

### GET `/external/erp/json/files`

Lista os arquivos JSON do ERP já ingeridos, do mais recente para o mais antigo.

**Parâmetros:** nenhum.

**Exemplo de requisição:**

```bash
curl "http://localhost:8000/external/erp/json/files" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta de sucesso (200):**

```json
[
  {
    "file_id": 12,
    "filename": "Ajustes.json",
    "erp_type": "ajuste",
    "content_hash": "9f2c1a...e7",
    "imported_at": "2026-11-25T15:33:46.889123+00:00"
  },
  {
    "file_id": 11,
    "filename": "REVENDA - AVARIA.json",
    "erp_type": "avaria",
    "content_hash": "4a7b0d...c1",
    "imported_at": "2026-11-24T09:10:02.123456+00:00"
  }
]
```

Retorna lista vazia (`[]`) quando nenhum arquivo foi ingerido. Não há paginação.

---

### DELETE `/external/erp/json/files/{file_id}`

Remove um arquivo ingerido do banco (remove apenas o registro/referência, não um arquivo em disco).

**Parâmetro de rota:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `file_id` | inteiro | ID retornado no upload ou pelo `GET /files`. |

**Comportamento:**

- Após remover o arquivo, o cruzamento dos registros pendentes é **recalculado do zero** (`reset_pending_crosscheck` + nova aplicação), para que nenhum match fique órfão do arquivo removido.
- Se o arquivo removido era o único de um tipo, os matches daquele tipo deixam de existir e os campos `erp_*` correspondentes são zerados.
- Um registro de log (`Log`) é criado para a remoção.

**Exemplo de requisição:**

```bash
curl -X DELETE "http://localhost:8000/external/erp/json/files/12" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta de sucesso (200):**

```json
{
  "message": "Arquivo removido",
  "file_id": 12
}
```

**Erro (404):**

```json
{ "detail": "Arquivo ERP não encontrado" }
```

---

### POST `/external/erp/json/apply`

Limpa e reaplica o cruzamento ERP em todos os registros `pending` existentes (conferências, avarias e itens de task com `approval_status = pending`).

**Parâmetros:** nenhum (corpo vazio).

**Comportamento:**

1. `reset_pending_crosscheck`: zera os campos `erp_*` e remove os registros de `ERPCrosscheckMatch` dos pendentes.
2. Se não há nenhum arquivo ERP ingerido, retorna sem aplicar nada (todos os pendentes ficam limpos).
3. Carrega e parseia todos os arquivos (`load_adjustments` / `load_avarias`).
4. Para cada pendente, calcula o melhor match e grava os campos `erp_*` + o registro em `ERPCrosscheckMatch`.

Por ser um recálculo do zero, chamar `/apply` várias vezes **não duplica** matches, e remover todos os arquivos limpa todos os resultados. Um registro de log (`Log`) é criado a cada chamada.

**Exemplo de requisição:**

```bash
curl -X POST "http://localhost:8000/external/erp/json/apply" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta de sucesso (200):**

```json
{ "message": "Cruzamento ERP aplicado com sucesso" }
```

---

### GET `/external/erp/json/matches`

Lista os cruzamentos ERP já calculados para um registro específico.

**Parâmetros de query:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `record_id` | inteiro | Sim | ID do registro no sistema (conferência, avaria ou item de task). |
| `record_type` | string | Sim | Tipo do registro: `conference`, `damaged` ou `task_item`. |

**Exemplo de requisição:**

```bash
curl "http://localhost:8000/external/erp/json/matches?record_id=42&record_type=conference" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta de sucesso (200):**

```json
[
  {
    "match_id": 7,
    "record_id": 42,
    "record_type": "conference",
    "match_type": "ajuste",
    "product_code": "12414",
    "product_name": "ARROZ",
    "num_mov": "A100",
    "dt_mov": "2026-01-01",
    "quantity": "17.4",
    "cost_unit": "1234.56",
    "cod_filial": "1",
    "erp_local": "1",
    "match_date": "2026-11-25"
  }
]
```

Observações:

- Retorna lista vazia (`[]`) quando o registro não tem match.
- `quantity` e `cost_unit` são retornados como **string** (para preservar precisão decimal); converta no cliente se necessário.
- `dt_mov` e `match_date` são retornados no formato ISO (`yyyy-MM-dd`).
- Não há paginação; o volume é limitado aos matches do registro informado.

---

### Fluxo completo de uso

```text
1. POST /auth/login                          -> obtém o access_token
2. POST /external/erp/json/upload            -> ingere Ajustes.json (erp_type=ajuste)
3. POST /external/erp/json/upload            -> ingere REVENDA - AVARIA.json (erp_type=avaria)
4. POST /external/erp/json/apply             -> calcula o cruzamento dos pendentes
5. GET  /external/erp/json/files             -> confere os arquivos ingeridos
6. GET  /external/erp/json/matches?...       -> consulta os matches de um registro
7. DELETE /external/erp/json/files/{id}      -> remove um arquivo (recalcula os pendentes)
```

Exemplo em `bash` (assumindo `TOKEN` já obtido):

```bash
BASE="http://localhost:8000/external/erp/json"

curl -X POST "$BASE/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Ajustes.json" -F "erp_type=ajuste"

curl -X POST "$BASE/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@REVENDA - AVARIA.json" -F "erp_type=avaria"

curl -X POST "$BASE/apply" -H "Authorization: Bearer $TOKEN"

curl "$BASE/files" -H "Authorization: Bearer $TOKEN"

curl "$BASE/matches?record_id=42&record_type=conference" \
  -H "Authorization: Bearer $TOKEN"
```

## Modelos atualizados

### Conference (tabela + Read)
- `erp_adjustment_match` (bool, default False)
- `erp_num_mov` (str, nullable)
- `erp_dt_mov` (date, nullable)
- `erp_quantity` (float, nullable)
- `erp_cost_unit` (float, nullable)
- `erp_cod_filial` (str, nullable)
- `erp_local` (str, nullable)

### DamagedProduct (tabela + Read)
- `erp_avaria_match` (bool, default False)
- `erp_num_mov` (str, nullable)
- `erp_dt_mov` (date, nullable)
- `erp_quantity` (float, nullable)
- `erp_cost_unit` (float, nullable)
- `erp_cod_filial` (str, nullable)
- `erp_local` (str, nullable)

### TaskItem (tabela + Read)
- `erp_adjustment_match` (bool, default False)
- `erp_num_mov` (str, nullable)
- `erp_dt_mov` (date, nullable)
- `erp_quantity` (float, nullable)
- `erp_cost_unit` (float, nullable)
- `erp_cod_filial` (str, nullable)
- `erp_local` (str, nullable)

## Integração com aprovação

### admin_approve_damaged
Ao aprovar uma avaria pending, se ainda não houver `erp_avaria_match`, aplica o cruzamento ERP de avaria (pelo `LocalDestino` do JSON, filial pelo `CodFilial`). O match encontrado preenche os campos `erp_*` da avaria e é persistido em `ERPCrosscheckMatch`.

### admin_approve_conference
Ao aprovar uma conferência pending, se ainda não houver `erp_adjustment_match`, aplica o cruzamento ERP de ajuste (pelo `CodLocal` do JSON). O match encontrado preenche os campos `erp_*` da conferência e é persistido em `ERPCrosscheckMatch`.

### admin_approve_task
Ao aprovar uma task pending, aplica o cruzamento ERP de ajuste em cada item que ainda não tenha `erp_adjustment_match`. Cada item que encontrar match: preenche os campos `erp_*` + grava em `ERPCrosscheckMatch`.

### apply_erp_crosscheck (rota dedicada)
Limpa e reaplica o cruzamento ERP em todos os pendentes existentes, útil após upload ou remoção de JSON.

## Critério de igualdade

- **Mesmo `product_code`**: `CODPRODUTO` trim + uppercase
- **Mesma `local`**: `CodLocal` para ajuste/conferência e task item; `LocalDestino` para avaria
- **Data dentro de ±1 dia**: da data do registro no sistema (`date_` da conferência, `damaged_date` da avaria, data de verificação/`created_date` do item de task)

### Item de task: código, filial e data

O `TaskItem` guarda apenas o `product_external_id`, não o código do produto nem a filial. Por isso o cruzamento resolve:

- **Código do produto**: `Productv2.code` onde `Productv2.external_id == TaskItem.product_external_id`
- **Filial**: `Task.branch_code` da task do item
- **Data**: `ProductVerification.created_date` mais recente do item, quando já existe verificação registrada; caso contrário, `TaskItem.created_date`

Se o produto não for encontrado em `Productv2`, o item é ignorado (sem cruzamento) para não gerar falso positivo.

## Ordem de escolha do match

Quando mais de uma linha do ERP bate no produto + local + janela de data, os matches são ordenados por:

1. proximidade da data do movimento em relação à data do registro (menor diferença primeiro);
2. `num_mov` como critério de desempate.

Assim, o primeiro da lista (o mais próximo) é o aplicado nos campos `erp_*` e persistido em `ERPCrosscheckMatch`, sem escolha arbitrária. A gravação é idempotente: o mesmo `num_mov` + `cod_filial` não é gravado duas vezes para o mesmo registro.

## Avaria: origem vs destino

Avaria é transferência para local de avaria. O cruzamento é feito pelo `LocalDestino` do JSON. A filial é definida pelo `CodFilial` do JSON (não por `LocalOrigem`). Isso está implementado em `find_erp_avaria_matches` e na função `_apply_damaged_erp_crosscheck` do admin de damaged.

## Parse dos JSON

### Ajuste (`Ajustes.json`)
1 linha por movimento. Campos: `CodFilial, NomeFilial, NumMov, DtMov, CodLocal, NomeLocal, CODPRODUTO, NOMEPRODUTO, UnidItemMov, QtdAjuste, CustoUnitario, Observacoes`.

### Avaria (`REVENDA - AVARIA.json`)
1 objeto por item de transferência. Campos: `CodFilial, NumMov, DtMov, TipoMov, LocalOrigem, CodFilialDest, LocalDestino, CODPRODUTO, NOMEPRODUTO, UnidItemMov, QtdTransferida, CustoUnitario`.

### Formatação lida
- `DtMov`: `"dd/MM/yyyy"` (ex: `"24/11/2026"`). Também aceita ISO `yyyy-MM-dd` por tolerância.
- Campos numéricos podem vir como **número JSON** (`17.4`) ou como **string pt-BR** (ex: `"8,1665"`, `"1.234,56"`, `"-7"`).
  - Se não houver vírgula na string, o ponto é tratado como separador decimal (`"17.4"` → `17.4`).
  - Se houver vírgula, o formato é pt-BR: ponto é milhar e vírgula é decimal (`"1.234,56"` → `1234.56`).
  - Valores JSON numéricos são preservados como vieram (sem remover o ponto).

## Banco

### Tabela `ERPJsonFile`
Controle dos arquivos ingeridos. `content_hash` (SHA-256 do conteúdo bruto) para detectar duplicata.

### Tabela `ERPCrosscheckMatch`
Registro de cada cruzamento encontrado. Persiste o match aplicado ao registro, com gravação idempotente (`num_mov` + `cod_filial` por registro).

### Migração automática
`ensure_erp_crosscheck_columns(engine)` é chamada em `main.py` após `ensure_approval_columns`. Adiciona colunas faltantes em Conference, DamagedProduct, TaskItem e cria as tabelas ERPJsonFile e ERPCrosscheckMatch se não existirem. Compatível com PostgreSQL (SERIAL, BYTEA) e SQLite (sem SERIAL, BYTEA mapeado).

`ensure_approval_columns(engine)` garante as colunas de aprovação (`approval_status`, `rejection_reason`, `approved_by`, `approved_at`) nas tabelas que já existiam antes da feature, evitando erro de boot em bancos antigos.

## Decisões de implementação

- **Janela de tempo**: ±1 dia da data do registro no sistema, conforme solicitado
- **Critério de igualdade**: mesmo `product_code` (trim+uppercase) + mesma `local` + data dentro da janela
- **Resultado do cruzamento**: gravado nos schemas Read (ConferenceRead, DamagedProductRead, TaskItemRead) e aparece nas listagens admin via os campos `erp_*`. Também persistido em `ERPCrosscheckMatch` para consulta dedicada
- **Múltiplos matches**: todas as linhas compatíveis são avaliadas; a mais próxima da data (desempate por `num_mov`) preenche os campos `erp_*` e é persistida em `ERPCrosscheckMatch`
- **Idempotência**: chamadas repetidas de `/apply` não duplicam matches
- **Recálculo do zero**: `/apply` e remoção de arquivo limpam os resultados anteriores dos pendentes antes de recalcular
- **JSON de ajuste sempre tem `CodLocal`**: confirmado nos arquivos anexos; `CodLocal` é usado no cruzamento com conferência
- **Avaria cruza pelo `LocalDestino`**: confirmado; mesmo quando o cadastro tem outro local, o cruzamento usa `LocalDestino` do JSON
- **CODFILIAL define a filial**: confirmado; `LocalOrigem`/`LocalDestino` são locais operacionais da transferência, não definem filial
- **Task item usa código oficial do produto**: `TaskItem` só tem `product_external_id`; o `CODPRODUTO` é resolvido em `Productv2.code` e a filial em `Task.branch_code`
- **Upload via API + registro no banco com hash**: implementado; hash SHA-256 do conteúdo bruto detecta duplicata
- **Documentação**: este documento

## Estado dos checks

- Compilação: `python -m compileall -q app main.py` — passou (exit 0)
- Boot local contra PostgreSQL real: `Application startup complete` (migrações executadas)
- Login: `POST /auth/login` 200 com credenciais válidas, 401 com senha incorreta; token aceito em `/profile/`, `/task/` e `/external/erp/json/files`
- Fluxo HTTP (SQLite isolado): upload 200 → apply 200 → matches 200 com `num_mov=A100`, `quantity=17.4`, `cost_unit=1234.56`
- `/apply` chamado duas vezes: continua com 1 match (sem duplicata)
- Upload com data inválida: **400**
- Remoção de arquivo: limpa apenas os matches relacionados; remover todos os arquivos zera todos os matches e flags
- Testes de unidade da lógica: `_parse_br_number` (`17.4`, `"17.4"`, `"1.234,56"`, `"8,1665"`) OK; conferência/avaria/task item preenchidos corretamente

## Pendente / não implementado

- Testes automatizados (pytest) no repositório: os fluxos acima foram validados manualmente/por script, mas não há suíte versionada
- Front/Android: não solicitado; o resultado já está disponível nos schemas Read e nas listagens admin
- Validação mais rigorosa de tipos no parse (ex: campos obrigatórios ausentes) — o parser ignora linhas inválidas quando aplicável; a rota de upload valida o JSON e retorna 400 em data/estrutura inválida

## Observação de deploy

As correções de código só entram em vigor após reconstruir a imagem Docker. Se o container continuar exibindo código antigo (por exemplo, traceback apontando para linhas que já foram corrigidas), execute:

```bash
docker build -t apicaico .
docker compose up -d --build
```
