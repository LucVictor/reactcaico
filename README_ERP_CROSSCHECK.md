# ERP Crosscheck — verificação cruzada com JSON do ERP

## O que foi implementado

Feature de verificação cruzada entre os registros do sistema (conferências, tasks e avarias) e os JSON exportados do ERP principal. Ao aprovar um registro, o sistema detecta se o produto foi ajustado no estoque (JSON de ajuste) ou movimentado como avaria (JSON de avaria) dentro de ±1 dia da data do cadastro.

## Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `app/models/erp_json_file.py` | Modelo `ERPJsonFile` — controle dos arquivos JSON ingeridos (id, filename, content_hash, erp_type, filedata, imported_at) |
| `app/models/erpcrosscheckmatch.py` | Modelo `ERPCrosscheckMatch` — registro de cada cruzamento encontrado (record_id, record_type, match_type, product_code, product_name, num_mov, dt_mov, quantity, cost_unit, cod_filial, erp_local, match_date) |
| `app/routers/external/erp_crosscheck/parsers.py` | Parsers para JSON de ajuste e avaria: parse de data `dd/MM/yyyy`, número com vírgula decimal, estruturas `ERPAdjustmentLine` e `ERPAvariaItem` |
| `app/routers/external/erp_crosscheck/crosscheck.py` | Lógica pura e reutilizável de cruzamento: `find_erp_adjustment_matches`, `find_erp_avaria_matches`, `CrosscheckMatch`, `date_matches`, `product_code_key`, `local_key` |
| `app/routers/external/erp_crosscheck/router.py` | Router com rotas de upload/GET/DELETE do JSON, aplicação do cruzamento, consulta de matches |
| `app/database/migrations.py` | Nova função `ensure_erp_crosscheck_columns` — adiciona colunas ERP nas tabelas Conference, DamagedProduct, TaskItem e as tabelas ERPJsonFile e ERPCrosscheckMatch |

## Rotas adicionadas

### POST `/external/erp/json/upload`
Ingere um JSON exportado do ERP. O tipo (`ajuste` ou `avaria`) é inferido pelo nome do arquivo. Conteúdo idêntico (mesmo hash SHA-256) não é ingerido duas vezes. Retorna `file_id`, `erp_type`, `imported_at` e flag `duplicate`.

### GET `/external/erp/json/files`
Lista os arquivos JSON do ERP já ingeridos (admin). Retorna `file_id`, `filename`, `erp_type`, `content_hash`, `imported_at`.

### DELETE `/external/erp/json/files/{file_id}`
Remove um arquivo ingerido do banco (não apaga o conteúdo, apenas a referência). Admin apenas.

### POST `/external/erp/json/apply`
Aplica o cruzamento ERP em todos os registros `pending` existentes. Para cada registro pendente, calcula os cruzamentos com os JSONs já ingeridos e salva o resultado nos campos `erp_*` do registro + cria registros de `ERPCrosscheckMatch`. Admin apenas.

### GET `/external/erp/json/matches`
Lista os cruzamentos ERP já calculados para um registro específico. Parâmetros: `record_id` (ID do registro no sistema), `record_type` (`conference`, `damaged` ou `task_item`). Admin apenas.

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
Ao aprovar uma avaria pending, se ainda não houver `erp_avaria_match`, aplica o cruzamento ERP de avaria (pelo `LocalDestino` do JSON, filiação pelo `CodFilial`). Todos os matches encontrados são salvos em `ERPCrosscheckMatch`. O primeiro match também preenche os campos `erp_*` da avaria.

### admin_approve_conference
Ao aprovar uma conferência pending, se ainda não houver `erp_adjustment_match`, aplica o cruzamento ERP de ajuste (pelo `CodLocal` do JSON). Todos os matches encontrados são salvos. O primeiro match preenche os campos `erp_*` da conferência.

### admin_approve_task
Ao aprovar uma task pendente (que ainda não era approved), aplica o cruzamento ERP de ajuste em cada item pending que ainda não tenha `erp_adjustment_match`. Cada item que encontrar match: salva em `ERPCrosscheckMatch` + preenche campos `erp_*` do item.

### apply_erp_crosscheck (rota dedicada)
reaplica o cruzamento ERP em todos os pendentes existentes, útil após upload de novo JSON.

## Critério de igualdade

- **Mesmo `product_code`**: `CODPRODUTO` trim + uppercase
- **Mesma `local`**: `CodLocal` para ajuste/conferência e task item; `LocalDestino` para avaria
- **Data dentro de ±1 dia**: da data do registro no sistema (`date_` da conferência, `damaged_date` da avaria, `created_date` do item de task)

## Avaria: origem vs destino

Avaria é transferência para local de avaria. O cruzamento é feito pelo `LocalDestino` do JSON. A filial é definida pelo `CodFilial` do JSON (não por `LocalOrigem`). Isso está implementado em `find_erp_avaria_matches` e na função `_apply_damaged_erp_crosscheck` do admin de damaged.

## Parse dos JSON

### Ajuste (`Ajustes.json`)
1 linha por movimento. Campos: `CodFilial, NomeFilial, NumMov, DtMov, CodLocal, NomeLocal, CODPRODUTO, NOMEPRODUTO, UnidItemMov, QtdAjuste, CustoUnitario, Observacoes`.

### Avaria (`REVENDA - AVARIA.json`)
1 objeto por item de transferência. Campos: `CodFilial, NumMov, DtMov, TipoMov, LocalOrigem, CodFilialDest, LocalDestino, CODPRODUTO, NOMEPRODUTO, UnidItemMov, QtdTransferida, CustoUnitario`.

### Formatação lida
- `DtMov`: `"dd/MM/yyyy"` (ex: `"24/11/2026"`)
- Campos numéricos podem vir como string; `CustoUnitario` com vírgula decimal (ex: `"8,1665"`)

## Banco

### Tabela `ERPJsonFile`
Controle dos arquivos ingeridos. `content_hash` (SHA-256 do conteúdo bruto) para detectar duplicata.

### Tabela `ERPCrosscheckMatch`
Registro de cada cruzamento encontrado. Persiste todos os matches, não apenas o primeiro usado para preencher os campos do registro.

### Migração automática
`ensure_erp_crosscheck_columns(engine)` é chamada em `main.py` após `ensure_approval_columns`. Adiciona colunas faltantes em Conference, DamagedProduct, TaskItem e cria as tabelas ERPJsonFile e ERPCrosscheckMatch se não existirem. compatível com PostgreSQL (SERIAL, BYTEA) e SQLite (sem SERIAL, BYTEA mapeado).

## Decisões de implementação

- **Janela de tempo**: ±1 dia da data do registro no sistema, conforme solicitado
- **Critério de igualdade**: mesmo `product_code` (trim+uppercase) + mesma `local` + data dentro da janela
- **Resultado do cruzamento**: gravado nos schemas Read (ConferenceRead, DamagedProductRead, TaskItemRead) e aparece nas listagens admin via os campos `erp_*`. Também persistido em `ERPCrosscheckMatch` para consulta dedicada
- **Múltiplos matches**: todos os matches encontrados dentro da janela são persistidos em `ERPCrosscheckMatch`; apenas o primeiro preenche os campos `erp_*` do registro para manter o Read enxuto
- **Todas as linhas que batam**: sim, todas as linhas de ajuste/avaria que batem no dia são registradas em `ERPCrosscheckMatch`, não apenas a primeira
- **JSON de ajuste sempre tem `CodLocal`**: confirmado nos arquivos anexos; `CodLocal` é usado no cruzamento com conferência
- **Avaria cruza pelo `LocalDestino`**: confirmado; mesmo quando o cadastro tem outro local, o cruzamento usa `LocalDestino` do JSON
- **CODFILIAL define a filial**: confirmado; `LocalOrigem`/`LocalDestino` são locais operacionais da transferência, não definem filial
- **Upload via API + registro no banco com hash**: implementado; hash SHA-256 do conteúdo bruto detecta duplicata
- **Documentação**: este documento

## Estado dos checks

- Compilação: `python -m compileall -q app main.py` — passou (exit 0)

## Pendente / não implementado

- Testes e2e com SQLite não foram executados neste término
- Front/Android: não solicitado; o plano original mencionava "confirmar se quer também documento para front/Android" — foi decidido não criar, pois o resultado já está disponível nos schemas Read e nas listagens admin
- Validação mais rigorosa de tipos no parse (ex: campos obrigatórios ausentes) — o parser ignora linhas inválidas e retorna lista parcial; para uso interno com JSON do ERP isso é aceitável
