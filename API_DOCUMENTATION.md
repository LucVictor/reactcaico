# Documentação Completa da API (Endpoints e Regras de Negócio)

API backend desenvolvida em **FastAPI** e **SQLModel** para gestão operacional de estoque, conferência de produtos, controle de vencimentos, registro de avarias com fotos, recebimento de mercadorias, gamificação/ranking de operadores, auditoria e comunicação interna.

---

## 1. Visão Geral da Arquitetura

### 1.1 Stack Tecnológica
* **Framework Web**: FastAPI (Python 3.11+)
* **ORM & Modelagem**: SQLModel + SQLAlchemy (compatível com PostgreSQL e SQLite)
* **Autenticação**: JWT (`HS256`, expiração padrão de 120 minutos)
* **Criptografia de Senhas**: Argon2 via `passlib.context.CryptContext`
* **Processamento de Planilhas**: Pandas / Openpyxl (`.xlsx`, `.xls`)
* **Armazenamento de Arquivos**: Diretório local `/uploads` servido estaticamente (`StaticFiles`)

### 1.2 Padrão de Autenticação
A grande maioria das rotas exige o cabeçalho HTTP:
```http
Authorization: Bearer <token_jwt>
```
O payload do token JWT transporta os seguintes atributos do usuário:
* `sub` (username)
* `id` (int)
* `name` (str)
* `email` (str)
* `local` (int - ID da filial)
* `admin` (int/bool - flag de privilégio administrativo)
* `profile_photo` (caminho da imagem)

---

## 2. Sistema de Gamificação e Ranking (`Point_Rank`)

O sistema pontua operadores pelas ações realizadas e possui uma regra anti-fraude/anti-duplicidade em janelas de tempo (`Validation_Point_Rank`):

| Ação | Pontos | Janela de Validação | Regra de Negócio |
| :--- | :---: | :---: | :--- |
| **Criar Conferência** | **+2** | $\pm 5\text{ dias}$ | Não pontua se o mesmo produto já foi conferido na mesma filial nos últimos 5 dias. |
| **Criar Vencimento** | **+5** | $\pm 5\text{ dias}$ | Não pontua se o mesmo produto já foi cadastrado na mesma filial nos últimos 5 dias. |
| **Editar Vencimento** | **+1** | $\pm 2\text{ dias}$ | Pontua pela atualização de validade/quantidade respeitando a janela de 2 dias. |
| **Criar Avaria** | **+5** | $\pm 5\text{ dias}$ | Não pontua se o produto já teve avaria lançada na mesma filial nos últimos 5 dias. |
| **Concluir Task** | **+5** | Única vez por task | Pontua na 1ª conclusão da task (`completed = True`). Não pontua novamente em reenvios; registro usa `action_id = task.id`. |
| **Conferir produto na task** | **+3** (por produto) | $\pm 5\text{ dias}$ | Concedido por produto presente na task concluída. Não pontua se o mesmo produto já foi conferido por task na mesma filial nos últimos 5 dias; registro usa `action_id = item.id`. |
| **Finalizar Recebimento** | **+10** | Mesmo dia (`days=0`) | Pontua na conclusão do lote de recebimento (código reservado `555555`). |

> **Estorno Automático**: Ao deletar qualquer registro de conferência, vencimento, avaria, recebimento **ou task**, os pontos atribuídos são **automaticamente cancelados e removidos do banco**, garantindo a integridade do ranking.

---

## 3. Catálogo Completo de Endpoints

---

### 3.1 Módulo: Autenticação (`/auth`)

#### `POST /auth/login`
Autentica o usuário e gera o token de acesso.
* **Autenticação**: Pública
* **Request Body (JSON)**:
  ```json
  {
    "username": "operador1",
    "password": "senhaSegura123"
  }
  ```
* **Respostas**:
  * `200 OK`:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1Ni...",
      "token_type": "bearer"
    }
    ```
  * `401 Unauthorized`: `{"detail": "Credenciais inválidas"}`
* **Regras de Negócio**:
  * Validação de hash com Argon2.
  * Registra tentativa em `loginhistory` (com IP e hostname).
  * Cria sessão ativa em `activesession` com expiração de 120 minutos.

---

#### `POST /auth/register`
Cadastra um novo usuário no sistema.
* **Autenticação**: Bearer Token (**Apenas Admin**)
* **Query Params**: `username`, `password`, `local` (int), `name`, `email`, `admin` (int: 0 ou 1)
* **Respostas**:
  * `200 OK`: `{"id": 2, "username": "operador2"}`
  * `400 Bad Request`: `{"detail": "Usuário já existe"}`
  * `403 Forbidden`: `{"detail": "Apenas administradores podem criar usuários."}`
* **Regras de Negócio**:
  * Restrito a usuários com `admin != 0`.
  * `username` único no banco.
  * Senha criptografada com Argon2 antes de persistir.

---

### 3.2 Módulo: Administração (`/admin`)

#### `GET /admin/logged-users`
Lista todos os usuários com sessões ativas no momento (`expires_at > now`).
* **Autenticação**: Bearer Token (**Apenas Admin**)
* **Respostas**:
  * `200 OK`: Lista com ID, nome, username, IP, hostname, login_time e expires_at.
  * `403 Forbidden`: Acesso não autorizado.

---

#### `GET /admin/login-history`
Consulta o histórico completo de tentativas de login.
* **Autenticação**: Bearer Token (**Apenas Admin**)
* **Respostas**:
  * `200 OK`: Lista de registros de `LoginHistory` ordenados por `created_at DESC`.

---

#### `GET /admin/users`
Lista todos os usuários cadastrados sem expor o hash da senha.
* **Autenticação**: Bearer Token (**Apenas Admin**)
* **Respostas**:
  * `200 OK`: Lista de objetos `User` com exclusão do campo `password`.

---

#### `POST /admin/upload-products/`
Importa ou atualiza o catálogo de produtos em massa via planilha Excel.
* **Autenticação**: Bearer Token (**Apenas Admin**)
* **Content-Type**: `multipart/form-data` (`file`: `.xlsx` ou `.xls`)
* **Colunas Obrigatórias na Planilha**:
  1. `Código`
  2. `Nome do Produto`
  3. `Matriz Minimo` (Preço)
  4. `COD.BARRAS`
* **Respostas**:
  * `200 OK`: `{"message": "Processamento concluído: X produtos atualizados/cadastrados, Y produtos ignorados por não ter código."}`
* **Regras de Negócio**:
  * Linhas sem `Código` são ignoradas.
  * Se `COD.BARRAS` estiver vazio, assume o valor do `Código`.
  * Realiza **upsert**: atualiza produtos existentes ou insere novos.

---

### 3.3 Módulo: Perfil do Usuário (`/profile`)

#### `GET /profile/`
Retorna os dados cadastrais do usuário autenticado.
* **Autenticação**: Bearer Token
* **Respostas**:
  * `200 OK`: `{"username": "...", "email": "...", "name": "...", "profile_photo": "..."}`

---

#### `PUT /profile/change-password`
Altera a senha da conta autenticada.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "password": "senhaAtual123",
    "new_password": "novaSenha456"
  }
  ```
* **Respostas**:
  * `200 OK`: `{"Menssage": "Password updated!"}`
  * `404 Not Found`: `{"detail": "Password wrong!"}` (quando a senha atual não confere).

---

#### `POST /profile/upload-photo`
Envia e atualiza a foto de perfil do usuário.
* **Autenticação**: Bearer Token
* **Content-Type**: `multipart/form-data` (`file`)
* **Regras de Negócio**:
  * Valida se `content_type` inicia com `image/`.
  * Salva o arquivo em `uploads/user_{id}.{ext}` e atualiza o campo `profile_photo`.

---

#### `GET /profile/photo`
Retorna o binário da foto de perfil do usuário autenticado (`FileResponse`).
* **Autenticação**: Bearer Token
* **Respostas**: Arquivo de imagem ou `404 Not Found`.

---

### 3.4 Módulo: Produtos (`/product`)

#### `GET /product/{code}`
Busca um produto específico pelo código único interno.
* **Autenticação**: Bearer Token
* **Respostas**:
  * `200 OK`: `{"id": 1, "code": 1001, "name": "Café 500g", "barCode": "7891234567890", "price": 12.50}`
  * `404 Not Found`: `{"detail": "Product not found"}`

---

### 3.5 Módulo: Conferência de Estoque (`/conference`)

#### `GET /conference/`
Retorna as conferências cadastradas desde o primeiro dia do mês corrente.
* **Autenticação**: Bearer Token
* **Respostas**: Lista de conferências do mês.

---

#### `GET /conference/between`
Filtra conferências por intervalo de datas e opcionalmente por usuário criador.
* **Autenticação**: Bearer Token
* **Query Params**:
  * `date1` (date: `YYYY-MM-DD`, obrigatório)
  * `date2` (date: `YYYY-MM-DD`, obrigatório)
  * `user` (int, opcional): ID do usuário criador.
* **Respostas**: Lista de conferências filtradas.

---

#### `POST /conference/`
Cadastra uma nova conferência pontual de produto.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "product_code": 1001,
    "quantity_system": 50.0,
    "quantity_real": 48.0,
    "local": 1,
    "date_": "2026-08-21"
  }
  ```
* **Respostas**: Objeto `Conference` criado.
* **Regras de Negócio**:
  1. $\text{Diferença} = \text{quantity\_real} - \text{quantity\_system}$ (arredondado para 3 casas decimais).
  2. $\text{Custo Total} = \text{Diferença} \times \text{Preço Unitário}$ (arredondado para 2 casas decimais).
  3. Preenche `product_name` do produto e `created_by` com o nome do usuário logado.
  4. Valida concessão de **+2 pontos** no Ranking ($\pm 5\text{ dias}$).
  5. Cria registro em `Log` com a ação `Cadastrar`.

---

#### `DELETE /conference/{conference_id}`
Exclui uma conferência.
* **Autenticação**: Bearer Token
* **Respostas**:
  * `200 OK`: `{"message": "Conferência deletada com sucesso"}`
  * `403 Forbidden`: `{"detail": "Sem permissão para deletar"}` (se o usuário logado não foi quem criou).
  * `404 Not Found`: `{"detail": "Conferência não encontrada"}`
* **Regras de Negócio**:
  * Apenas o criador original pode deletar.
  * Estorna os pontos associados do ranking (janela de 3 dias).
  * Cria log de auditoria com a ação `Excluir`.

---

### 3.6 Módulo: Auditoria de Estoque (`/audit`)

#### `GET /audit/?code_product={code_product}`
Lista todo o histórico de conferências de determinado produto por ordem decrescente de data.
* **Autenticação**: Bearer Token
* **Respostas**: Lista de conferências do produto.

---

### 3.7 Módulo: Lotes de Trabalho para Conferência (`/work_conference`)

#### `POST /work_conference/`
Gera uma nova ordem de conferência com produtos sorteados aleatoriamente.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "quantity": 10,
    "local": 1
  }
  ```
* **Respostas**:
  * `200 OK`: Objeto `work_conference` e lista de `work_items`.
  * `400 Bad Request`: Sem produtos disponíveis ou todos já foram conferidos nos últimos 30 dias.
* **Regras de Negócio**:
  * **Sorteio Inteligente**: Exclui qualquer produto conferido nos últimos 30 dias (`Work_Conference_Item.created_date >= now - 30 dias`).
  * Sorteia `quantity` produtos válidos aleatoriamente e inicializa os itens com valores nulos/pendentes.

---

#### `PATCH /work_conference/items/batch`
Atualiza itens de conferência em lote ou inativa produtos.
* **Autenticação**: Bearer Token
* **Request Body (JSON - Lista de Objetos)**:
  ```json
  [
    {
      "id": 101,
      "quantity_system": 10.0,
      "quantity_real": 10.0
    },
    {
      "id": 102,
      "active": false
    }
  ]
  ```
* **Respostas**: Resumo de itens atualizados, excluídos e conferências concluídas.
* **Regras de Negócio**:
  * Se `active: false`, o item é **excluído** do banco de dados.
  * Atualiza `quantity_system` e `quantity_real` dos demais itens.
  * Recalcula a quantidade real restante da conferência (`Work_Conference.quantity`) e marca como `completed = True`.

---

#### `GET /work_conference/`
Lista todas as Work Conferences pertencentes ao usuário autenticado.
* **Autenticação**: Bearer Token

---

#### `GET /work_conference/items/`
Retorna todos os itens de conferências **finalizadas** (`completed == True`) do usuário autenticado, com filtro opcional por período (`date1` e `date2`).
* **Autenticação**: Bearer Token

---

#### `GET /work_conference/items/{work_id}`
Retorna os itens de uma conferência específica.
* **Autenticação**: Bearer Token
* **Regra de Negócio**: Valida se o lote pertence ao usuário autenticado (retorna `404` caso não pertença).

---

### 3.8 Módulo: Vencimentos / Validades (`/shelflife` e `/external`)

#### `GET /shelflife/`
Lista todos os vencimentos cadastrados.
* **Autenticação**: Bearer Token
* **Respostas**: Lista de registros `Shelflife` ou `404 Not Found`.

---

#### `POST /shelflife/`
Cadastra um novo produto no controle de validade.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "product_code": 1001,
    "quantity": 20.0,
    "shelflife_date": "2026-12-31",
    "local": 1
  }
  ```
* **Respostas**: `200 OK`
* **Regras de Negócio**:
  1. Busca o nome do produto no catálogo.
  2. Registra log de auditoria (`Cadastrar`).
  3. Atribui **+5 pontos** no ranking ($\pm 5\text{ dias}$).
  4. **Notificação Global Automática**: Dispara mensagem de sistema para todos os usuários (`system_send_mail_all_users`) informando o produto, quantidade, validade (`dd/mm/aaaa`) e filial.

---

#### `PUT /shelflife/`
Atualiza a quantidade de um vencimento já existente.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "id": 10,
    "quantity": 15.0
  }
  ```
* **Regras de Negócio**:
  * Atualiza a quantidade e o campo `last_mod` (UTC).
  * Concede **+1 ponto** no ranking ($\pm 2\text{ dias}$).
  * Registra log com a alteração realizada.

---

#### `DELETE /shelflife/{id}`
Exclui um registro de vencimento.
* **Autenticação**: Bearer Token
* **Regras de Negócio**:
  * Deleta o registro do banco.
  * Cria log de auditoria (`Excluir`).
  * Estorna os pontos concedidos (janela de 5 dias).

---

#### `GET /external/shelflife/visualization`
Endpoint público para consulta e visualização externa de vencimentos.
* **Autenticação**: Nenhuma

---

### 3.9 Módulo: Avarias (`/damaged`)

#### `POST /damaged/`
Registra uma nova avaria de produto.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "product_code": 1001,
    "quantity": 2.0,
    "damaged_date": "2026-08-21",
    "shelflife_date": "2026-12-31",
    "type": 1,
    "origin": 1,
    "local": 1
  }
  ```
* **Regras de Negócio**:
  * Calcula custo unitário (`cost = product.price`) e custo total (`cost_total = quantity * product.price`).
  * Registra log de auditoria (`Cadastrar`).
  * Concede **+5 pontos** no ranking ($\pm 5\text{ dias}$).

---

#### `POST /damaged/{damaged_id}/photos`
Upload de uma ou mais fotos da avaria.
* **Autenticação**: Bearer Token
* **Content-Type**: `multipart/form-data` (`files`: lista de imagens)
* **Regras de Negócio**:
  * Valida extensões: `jpg`, `jpeg`, `png`, `webp`.
  * Cria diretório dedicado: `uploads/damaged_photos/{damaged_id}/`.
  * Salva os arquivos com nomes UUID únicos e cria registros em `DamagedProductPhoto`.
  * Rollback e limpeza automática em caso de erro.

---

#### `GET /damaged/`
Lista as avarias registradas a partir do primeiro dia do mês atual.
* **Autenticação**: Bearer Token

---

#### `GET /damaged/photo/{damaged_id}`
Retorna metadados e URLs de todas as fotos vinculadas a uma avaria.
* **Autenticação**: Bearer Token

---

#### `GET /damaged/between`
Filtra avarias por intervalo de datas (`date1` e `date2`).
* **Autenticação**: Bearer Token

---

#### `DELETE /damaged/{id}`
Exclui a avaria, suas fotos no banco e arquivos no disco.
* **Autenticação**: Bearer Token
* **Regras de Negócio**:
  * Remove todos os arquivos do disco na pasta `uploads/damaged_photos/{id}/` e deleta o diretório.
  * Deleta registros de fotos e da avaria.
  * Registra log de auditoria (`Excluir`).
  * Estorna os 5 pontos do ranking (janela de 5 dias).

---

#### `POST /damaged/type` & `GET /damaged/type/` & `GET /damaged/type/{id}`
Cadastro e consulta de tipos de avarias (ex: Quebra, Vencimento, Rasgado).

---

#### `POST /damaged/origin` & `GET /damaged/origin/` & `GET /damaged/origin/{id}`
Cadastro e consulta de origens de avarias (ex: Transporte, Loja, Depósito).

---

### 3.10 Módulo: Recebimento de Mercadorias (`/receipt`)

> **Documentação Exclusiva Detalhada:** Consulte [README_RECEIPT.md](file:///c:/Users/lucas/Desktop/apicaico/README_RECEIPT.md) para o guia completo de integração do Frontend, contratos de dados, exemplos em TypeScript/Kotlin e script SQL.

O recebimento de mercadorias é estruturado como um **conjunto de múltiplos produtos recebidos ao longo do dia** em cada filial, suportando produtos cadastrados e produtos novos, contagem física vs. sistema, e múltiplas fotos na **baia de recebimento** e na **prateleira**.

#### `GET /receipt/product-info/{code}`
Consulta rápida para auto-completar o formulário de recebimento no frontend.
* **Autenticação**: Bearer Token
* **Query Params**: `local` (opcional, filial de estoque)
* **Retorno**: `{ found: bool, code: str, name: str, quantity_system: float, is_new_product: bool, barcodes: list }`

---

#### `POST /receipt/items` (ou `POST /receipt/{receipt_id}/items`)
Submete o formulário de recebimento de um produto com fotos. Se `receipt_id` não for informado, anexa automaticamente ao recebimento aberto do dia na filial.
* **Autenticação**: Bearer Token
* **Content-Type**: `multipart/form-data`
* **Form Fields**:
  * `product_code` (str): Código ou código de barras.
  * `is_new_product` (bool): `true` para produtos novos sem cadastro.
  * `product_name` (str): Nome do produto (obrigatório se `is_new_product=true`).
  * `quantity_physical` (float): Quantidade física recebida.
  * `quantity_system` (float, opcional): Quantidade no sistema (auto-preenchida se omitida).
  * `received_quantity` (float, opcional): Quantidade efetivamente recebida (se omitida, usa `quantity_physical`).
  * `invoice_photo` (file, opcional): Foto da nota fiscal do produto.
  * `observations` (str, opcional): Observações do produto.
  * `dock_photos` / `baia_photos`: Fotos na baia de recebimento (1 ou mais).
  * `shelf_photos` / `prateleira_photos`: Fotos na prateleira (1 ou mais).
* **Campos Automáticos**: `user_id`, `user_name`, `received_at` (timestamp UTC).

---

#### `GET /receipt/today`
Retorna o recebimento aberto do dia na filial do usuário com todos os itens e fotos recebidos hoje.

---

#### `GET /receipt/` & `GET /receipt/{receipt_id}`
Lista recebimentos ou obtém os detalhes completos de um lote específico com todos os produtos e fotos.

---

#### `PATCH /receipt/{receipt_id}/complete` (ou `PATCH /receipt/{receipt_id}`)
Finaliza o recebimento do dia.
* **Regras de Negócio**:
  * Marca `completed = True` e grava `completed_at`.
  * Atribui **+10 pontos** no ranking (código reservado `555555`, validação `days=0`).
  * Registra log de auditoria (`Finalizar`).

---

#### `PATCH /receipt/items/{item_id}`
Atualiza dados de um item recebido (contagem física, observações, etc.).

---

#### `POST /receipt/items/{item_id}/photos`
Upload de fotos adicionais para um item (`photo_type`: `'dock'` ou `'shelf'`).

---

#### `POST /receipt/items/{item_id}/invoice-photo`
Envia ou substitui a foto da nota fiscal de um produto já recebido.
* **Content-Type**: `multipart/form-data`
* **Form Fields**: `invoice_photo` (file) — imagem da nota fiscal.

---

#### `DELETE /receipt/items/{item_id}`
Remove um item do recebimento e apaga suas fotos em disco.

---

#### `DELETE /receipt/{receipt_id}`
Remove o recebimento completo, itens, fotos em disco e estorna pontos do ranking.

---

### 3.11 Módulo: Metas Operacionais (`/target`)

#### `POST /target/conference/`
Cadastra meta mensal de conferência para um usuário.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**:
  ```json
  {
    "moth": "2026-08",
    "quantity": 150,
    "completed": false,
    "user_id": 1
  }
  ```

---

#### `GET /target/conference/{moth}`
Consulta metas de conferência para um mês específico (ex: `2026-08`), com filtro opcional por `user_id`.
* **Autenticação**: Bearer Token
* **Regra de Negócio**: Filtra entre o 1º dia e o último dia do mês especificado.

---

#### `GET /target/conference/weekly/{month}`
Processa o mês informado e devolve o resumo semanal da página **/metas** (Conferência Semanal de Produtos), somando as conferências de `/conference` e os **itens conferidos nas tasks** (`/task`).
* **Autenticação**: Bearer Token
* **Path Param**: `month` (`YYYY-MM`, ex.: `2025-10`)
* **Query Params**:
  * `user_id` (int, opcional): usa o usuário autenticado quando omitido. Apenas admin pode consultar outro usuário.
  * `all_users` (bool, padrão `false`): agrega todos os usuários (apenas admin).
  * `meta_semanal` (int >= 1, padrão `150`): meta semanal usada no cálculo.
* **Regras de Negócio**:
  * Semanas de **sexta a quinta**, sem recorte pelo mês: a primeira pode começar no mês anterior e a última pode terminar no mês seguinte.
  * `total_mes` soma apenas os dias dentro do mês selecionado.
  * `quantity_system < 0` não entra na meta; é contabilizado em `quantidade_negativos` (informativo).
  * Itens de task usam a data da verificação (`productverification.created_date`) e apenas itens com `quantity_real` preenchido; dados legados sem verificação usam `taskitem.created_date`.
* **Resposta `200 OK`**:
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
      }
    ]
  }
  ```
* **Documentação detalhada**: consulte [WEEKLY_CONFERENCE_DOCUMENTATION.md](WEEKLY_CONFERENCE_DOCUMENTATION.md).

---

### 3.12 Módulo: Comunicação e Alertas (`/message` e `/warning`)

#### `POST /message/`
Envia mensagem direta para um usuário.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**: `destination_user`, `sending_user`, `title`, `message`

---

#### `POST /message/mailsystem`
Envia um comunicado para **todos os usuários cadastrados**.
* **Autenticação**: Bearer Token
* **Request Body (JSON)**: `title`, `message`, `sending_user`

---

#### `GET /message/mailbox` & `GET /message/{message_id}`
Lista mensagens recebidas na caixa de entrada do usuário ou consulta mensagem por ID.
* **Autenticação**: Bearer Token

---

#### `PUT /message/{message_id}`
Atualiza leitura (`read`) e aceite/confirmação (`ok_`) de uma mensagem.
* **Autenticação**: Bearer Token

---

#### `POST /warning/` & `GET /warning/` & `PUT /warning/read/{warning_id}`
Criação, listagem e confirmação de leitura de alertas formais e advertências.
* **Autenticação**: Bearer Token

---

### 3.13 Módulo: Ranking e Pontuação (`/rank`)

#### `GET /rank/`
Consulta o extrato geral de pontuações de operadores com filtros dinâmicos.
* **Autenticação**: Bearer Token
* **Query Params**: `user` (int, opcional), `date1` (str, opcional), `date2` (str, opcional)

---

#### `GET /rank/points/{date_str}`
Obtém todas as pontuações consolidadas de determinado mês (`YYYY-MM`).
* **Autenticação**: Bearer Token

---

### 3.14 Módulo: Auditoria e Logs (`/logs`)

#### `GET /logs/`
Consulta a trilha de auditoria do sistema.
* **Autenticação**: Bearer Token
* **Query Params**: `user` (int, opcional), `date1` (str, opcional), `date2` (str, opcional)
* **Respostas**: Lista de logs (`Cadastrar`, `Editar`, `Excluir`, `Finalizar`).

---

### 3.15 Módulo: Unidades e Filiais (`/local`)

#### `GET /local/` & `POST /local/`
Listagem e cadastro de unidades/lojas físicas.
* **Autenticação**: Bearer Token
