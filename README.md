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

## 🛠️ Como Usar e Testar Localmente

### 1. Instalação das dependências
Certifique-se de ter o Node.js (>= 20.0.0) e o pnpm instalados. Na raiz do repositório, execute:
```bash
pnpm install
```

### 2. Compilação do monorepo
Compile todos os pacotes do monorepo (`core`, `adapter-opencode`, `ui`, `cli`, `shell`):
```bash
pnpm build
```

### 3. Executando o visualizador e CLI localmente
Para iniciar o servidor HTTP/SSE e o CLI apontando para o projeto atual:
```bash
pnpm --filter agent-god-view start
```
*(Ou utilize o comando de desenvolvimento correspondente conforme o pacote).*
Para forçar o uso do navegador (`--web`) ou iniciar no modo headless (`--headless`):
```bash
pnpm --filter agent-god-view start -- --web
pnpm --filter agent-god-view start -- --headless
```

### 4. Executando o Tauri Shell em modo de desenvolvimento
Para testar a aplicação desktop nativa (Tauri v2) e recursos como janelas flutuantes PiP e notificações do sistema:
```bash
pnpm tauri dev
```
*(Equivalente a `pnpm --filter @agent-god-view/shell dev`)*.

### 5. Replay de sessões de exemplo
Você pode reproduzir sessões gravadas (fixtures) para testar e inspecionar o comportamento dos agentes sem precisar de uma execução ativa do OpenCode:
```bash
pnpm --filter agent-god-view start -- replay ../../fixtures/opencode-session-01.ndjson
```

---

## ⚙️ Geração Automatizada do Binário Tauri via GitHub Actions (`v*`)

O projeto conta com automação via **GitHub Actions** para compilar e empacotar o aplicativo nativo para distribuição:
1. **Disparador por Tag**: Ao criar e enviar uma tag de versão semântica iniciada em `v` (ex: `git tag v0.1.0 && git push origin v0.1.0`), o pipeline do GitHub Actions é acionado.
2. **Build em Runner Windows**: O workflow executa em um runner `windows-latest` preparado com Node.js, pnpm e a toolchain do Rust.
3. **Compilação do Binário Executável**: Executa o comando de build do Tauri (`pnpm tauri build --no-bundle`) para gerar o binário `.exe` otimizado.
4. **Release Automatizado e Checksum**: O GitHub Actions calcula a soma de verificação SHA-256 do executável gerado, cria um **GitHub Release** formal e anexa os artefatos binários para download seguro e verificação de integridade pelos clientes/CLI.

---

## 📦 Construção e Publicação no npm (`agent-god-view`)

Para preparar e publicar o pacote oficial `agent-god-view` no registro npm:

1. **Build Completo do Monorepo**:
   Garanta que todos os pacotes estejam compilados e que os scripts de `prepack` (responsáveis por consolidar os artefatos de distribuição da CLI e binários) rodem corretamente:
   ```bash
   pnpm build
   ```
2. **Inspeção com o Doctor**:
   Valide se o ambiente, dependências e binários locais estão íntegros executando:
   ```bash
   agent-god-view doctor
   ```
3. **Publicação no Registro npm**:
   Utilize o pnpm para publicar o pacote principal com suporte a proveniência (`--provenance`) e acesso público:
   ```bash
   pnpm --filter agent-god-view publish --access public --provenance
   ```
   *(Nota: O ecossistema publica os pacotes de plataforma/binários opcionais antes do pacote principal da CLI quando aplicável).*

---

## 📦 Estrutura do Monorepo

O projeto está organizado em pacotes modulares sob a pasta `packages/`:

- `packages/core`: Schema TypeScript, tipos de eventos normalizados e função redutora pura (`reduce`).
- `packages/adapter-opencode`: Leitor estático de `.opencode/`, leitor de spool NDJSON, parser de frontmatter e plugin do OpenCode.
- `packages/ui`: Aplicação Vite + TypeScript para renderização do escritório 2D em canvas.
- `packages/cli`: Utilitário de linha de comando (`agent-god-view`) e servidor HTTP/SSE.
- `packages/shell`: Casca nativa em Rust / Tauri v2 para desktop e PiP.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte o arquivo [`LICENSE`](./LICENSE) para mais detalhes.
