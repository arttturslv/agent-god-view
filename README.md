# Agent God View

<p align="center">
  <b>Visualizador em tempo real estilo "God View" para agentes de IA em um escritório 2D animado, com integração nativa ao OpenCode.</b>
</p>

---

## 📌 Introdução

O **agent-god-view** é um pacote e monorepo que permite acompanhar visualmente a atividade de agentes de IA operando em um projeto de desenvolvimento. Inspirado em visões panorâmicas de simulação (estilo *God View*), ele renderiza um escritório 2D animado em canvas onde cada agente possui seu avatar, mesa, animações de trabalho, estados de espera por permissão e handoffs em tempo real.

Projetado inicialmente com suporte nativo ao **OpenCode**, a arquitetura separa claramente a captura de eventos, o mapeamento agnóstico, o estado determinístico e a interface de visualização.

---

## 🚀 Principais Funcionalidades

- **`@agent-god-view/core`**: Coração lógico do projeto. Fornece um schema normalizado (`AgentEvent`, `CrewState`) e uma função redutora pura (`reduce`) validada com rigor e testada com Vitest.
- **`@agent-god-view/adapter-opencode`**: Leitor estático do `.opencode/` (lendo definições de agentes em `.md` e `opencode.json`) e leitor de spool NDJSON em tempo real (`tail`) com rotação e suporte a reconexão.
- **`@agent-god-view/ui`**: Escritório 2D animado desenvolvido em Vite + TypeScript. Renderiza personagens, mesas, animações, áudio contextual e suporta modo compacto para Picture-in-Picture (PiP).
- **`agent-god-view`**: CLI com servidor HTTP/SSE (`/events`), abertura do app nativo Tauri quando disponível, fallback para navegador (`--web`), modo headless (`--headless`), watcher automático de alterações e comando de `replay` de sessões gravadas.
- **Plugin OpenCode (`.opencode/plugins/agent-god-view.ts`)**: Plugin leve e assíncrono que captura eventos do OpenCode (execução de ferramentas, mensagens, pedidos de permissão) e grava no spool local sem bloquear a execução principal.

---

## 🛠️ Como Usar

### 1. Instalação das dependências
Certifique-se de ter o Node.js (>= 20.0.0) e o pnpm instalados. Na raiz do repositório, execute:
```bash
pnpm install
```

### 2. Compilação do monorepo
Compile todos os pacotes do monorepo (`ui`, `adapter-opencode`, `cli`):
```bash
pnpm build
```

### 3. Executando o viewer no projeto atual
O CLI aponta para o diretório atual e tenta abrir o aplicativo nativo Tauri quando o binário está disponível. Se ele não for encontrado, o visualizador abre no navegador:
```bash
pnpm --filter agent-god-view start
```
Para forçar o navegador local (`--web`) ou servir apenas o HTTP/SSE sem abrir janela (`--headless`):
```bash
pnpm --filter agent-god-view start -- --web
pnpm --filter agent-god-view start -- --headless
```

### 4. Replay de sessões de exemplo
Você pode reproduzir sessões gravadas (fixtures) para testar e inspecionar o comportamento dos agentes sem precisar de uma execução ativa do OpenCode:
```bash
pnpm --filter agent-god-view start -- replay ../../fixtures/opencode-session-01.ndjson
```
*(Ou alternativamente: `node packages/cli/bin.js replay fixtures/opencode-session-01.ndjson`)*

---

## 📦 Estrutura do Monorepo

O projeto está organizado em pacotes modulares sob a pasta `packages/`:

- `packages/core`: Schema TypeScript, tipos de eventos normalizados e função redutora pura (`reduce`).
- `packages/adapter-opencode`: Leitor estático de `.opencode/`, leitor de spool NDJSON, parser de frontmatter e plugin do OpenCode.
- `packages/ui`: Aplicação Vite + TypeScript para renderização do escritório 2D em canvas.
- `packages/cli`: Utilitário de linha de comando (`agent-god-view`) e servidor HTTP/SSE.
- `packages/shell`: Casca nativa em Rust / Tauri v2 (em desenvolvimento).

---

## 🔮 Próximos Passos

- **Shell Tauri v2**: Empacotamento como aplicativo desktop leve e nativo.
- **PiP Flutuante**: Janela dedicada *Always-on-Top* e sem bordas para monitoramento contínuo em segundo plano.
- **Avisos Nativos de Permissão**: Integração com notificações do sistema operacional e foco em solicitações de permissão dos agentes.
- **Distribuição npm**: Publicação oficial do pacote `agent-god-view` e binários nativos via `optionalDependencies`.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte o arquivo [`LICENSE`](./LICENSE) para mais detalhes.
