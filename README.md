# Tâb — Jogo de Tabuleiro

Este projeto consiste numa implementação web completa do tradicional jogo de tabuleiro do Médio Oriente **Tâb**, desenvolvido para a unidade curricular de **Tecnologias Web** do **DCC/FCUP** (Departamento de Ciência de Computadores da Faculdade de Ciências da Universidade do Porto).

O projeto suporta tanto o jogo **Local (contra o Computador com Inteligência Artificial)** como o jogo **Online (multijogador contra outros jogadores)**, utilizando um servidor próprio em Node.js com comunicação em tempo real via SSE.

---

## Funcionalidades

### Modos de Jogo
- **Contra o Computador:** Jogo local com IA ajustável.
- **Contra Outro Jogador:** Jogo online em rede com salas criadas a partir do servidor.
- **Tamanho do Tabuleiro Customizável:** Suporte para tabuleiros de 7, 9, 11, 13 ou 15 colunas (9 colunas por defeito).

### Inteligência Artificial (Minimax)
A IA implementa o algoritmo de decisão **Minimax** com cortes Alfa-Beta (otimizado no lado do cliente em [minimax.js](./minimax.js):
- **Fácil:** Profundidade reduzida com jogadas mais aleatórias (+10 XP na vitória, -5 XP na derrota).
- **Médio:** Avaliação heurística intermédia (+20 XP na vitória, -10 XP na derrota).
- **Difícil:** Análise aprofundada com antecipação de capturas e controlo das linhas (+30 XP na vitória, -15 XP na derrota).

### Sistema de Dados Tradicional
Simulação do lançamento de **4 paus de madeira** que servem de dado:
- **0 faces claras (Sitteh):** Anda **6** casas e volta a lançar.
- **1 face clara (Tâb):** Anda **1** casa, introduz peças em jogo e volta a lançar.
- **2 faces claras (Itneyn):** Anda **2** casas.
- **3 faces claras (Teláteh):** Anda **3** casas.
- **4 faces claras (Arba'ah):** Anda **4** casas e volta a lançar.

### Funcionalidades Online & Backend
- **Autenticação de Utilizadores:** Registo e início de sessão persistentes com passwords cifradas no servidor.
- **Ranking Global:** Lista os 10 jogadores com mais vitórias.
- **SSE:** Atualizações do estado do jogo enviadas instantaneamente do servidor para o cliente sem necessidade de *polling*.

### Interface e Experiência do Utilizador 
- **Tema Egípcio:** Design e ambientação visual inspirados no antigo Egito com efeitos de áudio opcionais (música de fundo no deserto).
- **Estados Visuais das Peças:** Opacidade distinta dependendo do estado da peça:
  - **Não movida:** Opaca (ainda não entrou no tabuleiro).
  - **Em jogo:** Semi-transparente (já se moveu mas não entrou na linha adversária).
  - **Veterana:** Mais transparente (já visitou a linha inicial do oponente).
- **Painel de Regras Interativo:** Painel expansível integrado para consulta rápida das regras dentro do jogo.

---

## Estrutura do Projeto

```text
├── server_modules/
│   ├── game_rules.js       # Regras lógicas e movimentação no lado do servidor
│   ├── requestFunctions.js  # Controladores dos endpoints HTTP e SSE
│   ├── storage.js          # Persistência de dados em ficheiros JSON (users/games)
│   └── utils.js            # Funções utilitárias (cifragem de passwords, parsing, etc.)
├── adapter.js              # Adaptador para compatibilidade de regras cliente-servidor
├── egypt-egyptian-desert-music-263086.mp3 # Música de fundo
├── favicon.ico             # Ícone da página
├── gamelogic.js            # Regras de movimentação e estados no lado do cliente
├── games.json              # Ficheiro de persistência de jogos ativos/terminados
├── index.html              # Interface do utilizador (HTML5)
├── index.js                # Ponto de entrada do servidor Node.js (Porta 8139)
├── login.js                # Lógica de interface para registo e login
├── LogoPaint_1.png         # Logótipo do jogo
├── main.js                 # Controlador principal do jogo, UI e fluxo de jogadas
├── minimax.js              # Implementação do algoritmo Minimax para a IA
├── network.js              # Comunicação HTTP e EventSource (SSE) com o servidor
├── package.json            # Metadados do projeto Node.js
├── styles.css              # Estilos e animações da interface (Vanilla CSS)
└── users.json              # Ficheiro de persistência de utilizadores e estatísticas
```

---

## Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (ES6+ moderno, sem frameworks adicionais).
- **Backend:** Node.js (servidor HTTP puro e nativo, sem dependências externas como Express).
- **Persistência de Dados:** Ficheiros JSON locais (`users.json` e `games.json`).

---

## Instalação e Execução

### Pré-requisitos
Certifique-se de que tem o [Node.js](https://nodejs.org/) instalado no seu computador.

### Passos para Correr o Servidor Localmente

1. Navegue até à pasta do projeto:
   ```bash
   cd caminho/para/o/projeto
   ```
2. Instale as dependências (se existirem, neste caso apenas scripts nativos):
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
   O servidor começará a correr na porta `8139` (ou na porta definida na variável de ambiente `PORT`). Verá a seguinte mensagem no terminal:
   ```text
   Server running at http://localhost:8139/
   ```

### Executar o Cliente

1. Para jogar, basta abrir o ficheiro [index.html](./index.html) diretamente no seu navegador de internet de preferência ou usar um servidor local simples (ex: Live Server do VS Code).
2. Se quiser que o cliente se ligue ao servidor local em vez do servidor de produção do DCC-FCUP, modifique a constante `SERVER_BASE` no ficheiro [network.js](./network.js):
   ```javascript
   const SERVER_BASE = "http://localhost:8139";
   ```

---

## Resumo das Regras de Movimento do Jogo

1. **Movimento Serpentina:** As peças movem-se da esquerda para a direita na linha 1, da direita para a esquerda na linha 2, da esquerda para a direita na linha 3, e da direita para a esquerda na linha 4.
2. **Entrada:** Só se podem introduzir peças no tabuleiro com um lançamento de valor **1 (Tâb)**.
3. **Captura:** Mover para uma casa ocupada por uma peça adversária resulta na eliminação dessa peça. Não é permitido capturar peças da própria equipa (*friendly fire*).
4. **Restrição das Veteranas:** Peças na linha inicial adversária só se podem mover se não houver mais peças do próprio jogador na sua respetiva linha de partida.
5. **Vitória:** O jogo termina quando um jogador captura todas as peças do adversário.
