# 👁️ Agent God View — O Escritório Vivo dos Seus Agentes de IA 🏢✨

Roteiro de execução, Windows-first, do repositório vazio até o PiP funcionando. Cada etapa tem objetivo, passos e um critério de pronto.

## 1. Contexto do projeto

**O que é.** Um pacote npm que, instalado em um projeto, mostra em um escritório animado o que os agentes de IA daquele projeto estão fazendo. O primeiro alvo é o opencode. Depois entram Claude Code, Codex e outros, cada um com seu adapter, sem a UI saber de qual ferramenta veio o dado.

**Origem.** Hoje existe o visualizer do AI-Crew: HTML + canvas (`index.html`, `app.js`, `office.js`, `constants.js`, `audio.js`, `persistence.js`) e um `server.js` que serve a página e o `context/crew_state.json`, relido a cada 1 s. Ele não executa agentes, só lê estado e desenha. Essa UI será reaproveitada quase inteira.

**Decisões já tomadas**

- Nome: `agent-god-view` (conferir se está livre no npm e reservar logo).
- Canal de eventos: spool NDJSON em `%APPDATA%/agent-god-view/spool/<projectId>.ndjson`, onde `projectId` é o hash do caminho absoluto do projeto. Uma linha JSON por evento.
- Shell: Tauri v2, com janela principal e uma segunda janela para o PiP (sem borda, always-on-top).
- Monorepo com pnpm workspaces. TypeScript em tudo; Rust só no shell Tauri.
- Distribuição: pacote principal + pacote por plataforma em `optionalDependencies`, começando só por `win32-x64`. Fallback: baixar o `.exe` na primeira execução, verificando SHA-256. Sem `postinstall` como caminho principal.
- Ordem de trabalho: primeiro ler a pasta `.opencode/` (sem plugin), depois um plugin apenas gravador, depois o ao vivo.
- Plugins do opencode ficam em `.opencode/plugins/` (plural, conforme a documentação atual).

**Arquitetura**

```
opencode --> plugin --> spool .ndjson --> leitor --> core (reducer) --> UI
.opencode/agent/*.md --> leitor estático ----------^
```

**Vocabulário**

- **Agent**: uma persona (id, nome, descrição, modelo, status, tarefa atual).
- **AgentEvent**: evento normalizado, independente de ferramenta.
- **CrewState**: estado completo calculado pelo reducer a partir dos eventos.
- **Adapter**: converte eventos de uma ferramenta específica em AgentEvent.
- **Spool**: arquivo NDJSON onde o plugin acrescenta eventos.
- **Fixture**: um spool real gravado, usado em testes e no modo replay.

**Fora do escopo agora:** fixar tela, tela cheia, edição do escritório, modos de visualização, interação com agentes, outras ferramentas além do opencode.

**Premissas a confirmar na sua versão do opencode:** nomes das pastas (`agent` ou `agents`), campos do frontmatter, nomes e propriedades dos eventos. Quando algo divergir, vale o que você observar na prática.

## 2. Estrutura alvo

```
agent-god-view/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  packages/
    core/              schema, reducer, testes
    adapter-opencode/  leitor de .opencode, mapeador de eventos, plugin
    ui/                escritório (Vite)
    cli/               pacote publicado: agent-god-view
    shell/             app Tauri (etapa 6)
  fixtures/            sessões gravadas .ndjson
  docs/decisions.md
```

## Etapa 0: Ambiente

1. Instale Node 20+, pnpm, Git.
2. Para o Tauri (só necessário na etapa 6): Rust via `rustup` e Visual Studio Build Tools com a carga de trabalho Desktop development with C++. WebView2 já vem no Windows 11.
3. Crie a pasta, rode `git init` e `pnpm init`.
4. Crie `pnpm-workspace.yaml` com `packages: ['packages/*']`.
5. Crie `tsconfig.base.json` com `strict: true`, `target: ES2022`, `module: NodeNext`.
6. Crie `docs/decisions.md` copiando a lista de decisões da seção 1.

**Pronto quando:** `pnpm install` roda na raiz sem erro e o nome do pacote está reservado.

## Etapa 1: `core` (schema e reducer)

**Objetivo:** ter o coração do projeto testado, sem UI e sem opencode.

1. Em `packages/core`, crie o pacote (`@agent-god-view/core`, `type: module`) e instale `typescript`, `vitest` e `zod`.
2. Crie `src/types.ts`:

```ts
export type AgentStatus = 'idle' | 'working' | 'waiting_permission' | 'error';

export interface AgentDef {
  id: string;
  name: string;
  description?: string;
  model?: string;
}

export interface Agent extends AgentDef {
  status: AgentStatus;
  task?: string;
  lastActivity: number;
}

export type AgentEvent =
  | { type: 'agents_defined'; ts: number; agents: AgentDef[] }
  | { type: 'agent_active'; ts: number; agentId: string; task?: string }
  | { type: 'permission_request'; ts: number; agentId: string; id: string; what: string }
  | { type: 'permission_resolved'; ts: number; id: string; granted: boolean }
  | { type: 'handoff'; ts: number; from: string; to: string }
  | { type: 'idle'; ts: number; agentId: string }
  | { type: 'error'; ts: number; agentId?: string; message: string };

export interface CrewState {
  agents: Record<string, Agent>;
  pendingPermissions: { id: string; agentId: string; what: string }[];
  lastHandoff?: { from: string; to: string; ts: number };
  updatedAt: number;
}
```

3. Crie `src/reducer.ts` com uma função pura:

```ts
import type { AgentEvent, CrewState } from './types';

export const emptyState = (): CrewState => ({
  agents: {},
  pendingPermissions: [],
  updatedAt: 0,
});

export function reduce(s: CrewState, e: AgentEvent): CrewState {
  const next: CrewState = { ...s, agents: { ...s.agents }, updatedAt: e.ts };
  const touch = (id: string, patch: object) => {
    const a = next.agents[id];
    if (a) next.agents[id] = { ...a, ...patch, lastActivity: e.ts };
  };
  switch (e.type) {
    case 'agents_defined':
      for (const d of e.agents) {
        next.agents[d.id] = next.agents[d.id]
          ? { ...next.agents[d.id], ...d }
          : { ...d, status: 'idle', lastActivity: e.ts };
      }
      break;
    case 'agent_active':
      touch(e.agentId, { status: 'working', task: e.task });
      break;
    case 'permission_request':
      touch(e.agentId, { status: 'waiting_permission', task: e.what });
      next.pendingPermissions = [...s.pendingPermissions, { id: e.id, agentId: e.agentId, what: e.what }];
      break;
    case 'permission_resolved': {
      const p = s.pendingPermissions.find((x) => x.id === e.id);
      next.pendingPermissions = s.pendingPermissions.filter((x) => x.id !== e.id);
      if (p) touch(p.agentId, { status: 'working' });
      break;
    }
    case 'handoff':
      next.lastHandoff = { from: e.from, to: e.to, ts: e.ts };
      touch(e.from, { status: 'idle' });
      touch(e.to, { status: 'working' });
      break;
    case 'idle':
      touch(e.agentId, { status: 'idle', task: undefined });
      break;
    case 'error':
      if (e.agentId) touch(e.agentId, { status: 'error', task: e.message });
      break;
  }
  return next;
}
```

4. Adicione `applyTimeouts(state, now, maxMs)`: agentes `working` sem evento há mais de `maxMs` voltam para `idle`. Isso evita agente preso como trabalhando se um evento de fim se perder.
5. Valide eventos vindos de fora com `zod` (função `parseEvent(line)` que devolve o evento ou `null`). Eventos desconhecidos são ignorados, nunca lançam erro.
6. Escreva testes no Vitest: definir agentes, ativar, pedir e resolver permissão, handoff, timeout, evento inválido.
7. Crie `toLegacyCrewState(state)` que exporta no formato do seu `crew_state.json` antigo. Serve para migrar a UI aos poucos.

**Pronto quando:** `pnpm -F core test` passa e você consegue alimentar uma lista de eventos à mão e ver o estado final correto.

## Etapa 2: Leitor estático do `.opencode/`

**Objetivo:** descobrir quem são os agentes do projeto sem precisar de plugin.

1. Em `packages/adapter-opencode`, instale `gray-matter` (frontmatter), `jsonc-parser` (o `opencode.json` pode ter comentários) e `chokidar` (watcher).
2. Crie `readProject(dir)` que:
   - procura arquivos `.md` em `.opencode/agent/` e `.opencode/agents/` (confirme qual existe na sua versão);
   - para cada um, usa o nome do arquivo como `id` e lê `description` e `model` do frontmatter;
   - lê `opencode.json` (na raiz e em `.opencode/`) e procura agentes definidos na chave `agent`, caso existam por lá também;
   - devolve `{ projectId, name, path, agents: AgentDef[] }`, com `projectId` sendo o hash SHA-1 do caminho absoluto, truncado.
3. Crie `watchProject(dir, onChange)` com `chokidar` observando `.opencode/**` e `opencode.json`, com debounce de \~200 ms, chamando `readProject` de novo.
4. Se `.opencode/` não existir, devolva lista vazia e uma mensagem amigável, sem erro.
5. Teste com uma pasta de exemplo em `fixtures/project-basic/.opencode/agent/` com 3 agentes.
6. Script de verificação: `node scripts/print-agents.js <pasta>` imprime os agentes encontrados.

**Pronto quando:** apontando para o seu projeto real, o script lista os seus agentes, e editar um `.md` de agente atualiza a saída sozinho.

## Etapa 3: UI e CLI no modo navegador

**Objetivo:** ver o escritório com os agentes reais do projeto, parados, antes de qualquer Tauri.

### 3.1 UI

1. Em `packages/ui`, crie um projeto Vite (vanilla TS) e copie o visualizer atual. Primeiro faça funcionar exatamente como está, lendo o JSON antigo.
2. Introduza a abstração de fonte de dados:

```ts
export interface StateSource {
  subscribe(cb: (s: CrewState) => void): () => void;
}
```

3. Implemente `SseSource` (usa `EventSource('/events')`) e `ReplaySource` (toca um `.ndjson` com os tempos originais, ótimo para desenvolver sem opencode). Mantenha `PollingSource` como fallback.
4. Faça a UI criar os agentes a partir do `CrewState`, não de paletas fixas. Para quem não tem paleta definida, gere cor e posição de mesa a partir do hash do id. Os personagens atuais viram o tema padrão.
5. Troque a persistência para chaves por projeto: `agent-god-view:<projectId>:...`.
6. Crie o modo `compact` (poucos agentes, sem painel JSON, sem controles de simulação), que será usado no PiP.

### 3.2 CLI mínimo

1. Em `packages/cli`, crie o `bin` `agent-god-view`.
2. O comando padrão faz: `readProject(process.cwd())`, sobe um servidor HTTP em `127.0.0.1` numa porta livre, serve o build da `ui` e expõe `/events` (Server-Sent Events).
3. Ao conectar, o servidor envia o estado atual (reducer aplicado a um `agents_defined`) e reenvia sempre que o watcher detectar mudança.
4. Abra o navegador com o pacote `open`.

```ts
res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
const send = (s: CrewState) => res.write('data: ' + JSON.stringify(s) + '\n\n');
```

**Pronto quando:** rodar `node packages/cli/bin.js` dentro do seu projeto abre o navegador com o escritório mostrando os seus agentes, e editar um agente no `.opencode/` atualiza a tela.

## Etapa 4: Plugin gravador e fixtures

**Objetivo:** capturar o que o opencode realmente emite, sem interpretar nada ainda.

1. Leia a página de plugins da documentação do opencode. Pontos principais: plugins de projeto ficam em `.opencode/plugins/`, são carregados automaticamente, e a função recebe `project`, `client`, `$`, `directory` e `worktree` e devolve hooks.
2. Crie `.opencode/plugins/agent-god-view.ts` no seu projeto de teste:

```ts
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const AgentGodView = async ({ directory }: { directory: string }) => {
  const id = createHash('sha1').update(directory).digest('hex').slice(0, 12);
  const dir = join(process.env.APPDATA ?? '', 'agent-god-view', 'spool');
  const file = join(dir, id + '.ndjson');

  const write = (type: string, data: unknown) => {
    // sem await: nunca bloqueia nem derruba o opencode
    mkdir(dir, { recursive: true })
      .then(() => appendFile(file, JSON.stringify({ ts: Date.now(), type, data }) + '\n'))
      .catch(() => {});
  };

  return {
    event: async ({ event }: any) => write(event.type, event.properties),
    'tool.execute.before': async (input: any) => write('tool.execute.before', { tool: input.tool }),
    'tool.execute.after': async (input: any) => write('tool.execute.after', { tool: input.tool }),
  };
};
```

3. Regras do plugin: nunca lançar exceção, nunca bloquear, não gravar conteúdo de arquivos nem comandos completos, e limitar o tamanho do spool (rotacionar acima de alguns MB).
4. Reinicie o opencode no projeto e rode uma sessão de verdade que inclua: uma tarefa simples, o uso de pelo menos um subagente, uma edição de arquivo e uma ação que peça permissão. Se possível, grave também uma sessão com permissão negada.
5. Copie os spools gerados para `fixtures/opencode-session-01.ndjson`, `-02` etc.
6. Liste os tipos de evento que apareceram e quantos de cada, com um script Node que lê o arquivo e conta por `type`.
7. Para cada tipo relevante, anote quais propriedades trazem: id da sessão, nome do agente, nome da tool, id e descrição da permissão. Faça uma tabela em `docs/opencode-events.md`. Essa tabela é a base da etapa 5.

**Pronto quando:** você tem pelo menos duas fixtures reais e a tabela de eventos documentada, incluindo o ponto exato onde aparecem `permission.asked` e `permission.replied`.

## Etapa 5: Mapeamento e ao vivo via spool

**Objetivo:** transformar os eventos crus em AgentEvent e ver os agentes reagindo em tempo real.

1. Em `adapter-opencode`, crie `mapEvent(raw): AgentEvent[]` (uma linha crua pode gerar zero, um ou mais eventos). Ponto de partida, a ajustar pela sua tabela:

| Evento do opencode | AgentEvent |
| --- | --- |
| `message.updated` / `message.part.updated` com agente identificado | `agent_active` |
| `tool.execute.before` | `agent_active` com a tool como tarefa |
| `permission.asked` | `permission_request` |
| `permission.replied` | `permission_resolved` |
| `session.idle` | `idle` |
| `session.error` | `error` |
| sessão filha / uso de subagente | `handoff` |

2. Descubra como identificar o agente de cada evento (normalmente vem na mensagem ou na sessão). Se um evento não trouxer o agente, associe pela sessão ativa. Anote as regras no `docs/opencode-events.md`.
3. Escreva testes que pegam cada fixture, passam por `mapEvent` e depois pelo `reduce`, e conferem o estado final (por exemplo, nenhuma permissão pendente ao final de uma sessão aprovada).
4. Implemente o `tail` do spool em Node, guardando o offset e tratando linha parcial:

```ts
import { watch } from 'node:fs';
import { open, stat } from 'node:fs/promises';

export function tail(file: string, onLine: (l: string) => void) {
  let offset = 0;
  let buf = '';
  const read = async () => {
    const { size } = await stat(file);
    if (size < offset) offset = 0; // arquivo rotacionado
    if (size === offset) return;
    const fh = await open(file, 'r');
    const chunk = Buffer.alloc(size - offset);
    await fh.read(chunk, 0, chunk.length, offset);
    await fh.close();
    offset = size;
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    lines.filter(Boolean).forEach(onLine);
  };
  read().catch(() => {});
  return watch(file, () => read().catch(() => {}));
}
```

5. No CLI, ligue o `tail` ao reducer e envie cada novo estado pelo SSE. Ao conectar, o servidor relê o spool inteiro para reconstruir o estado.
6. Adicione o comando `agent-god-view replay <fixture>` que alimenta a UI com uma fixture, respeitando os tempos.
7. Ajuste o `applyTimeouts` com valores reais (por exemplo, 30 s sem evento volta para `idle`).

**Pronto quando:** com o opencode rodando no projeto e o CLI aberto, os agentes mudam de estado ao vivo, o pedido de permissão aparece e some quando você responde.

## Etapa 6: Shell Tauri, PiP e aviso de permissão

**Objetivo:** trocar o navegador por uma janela nativa leve e criar a janela flutuante.

1. Em `packages/shell`, inicialize o Tauri v2 apontando o `frontendDist` para o build da `ui`.
2. Mova o `tail` do spool para o Rust com a crate `notify`: guarda offset por arquivo, trata linha parcial e envia cada linha ao frontend com `app.emit('spool-line', ...)`. Crie o comando `get_snapshot(projectId)` que devolve o arquivo inteiro para quando a janela abre depois do início da sessão.
3. No frontend, crie `TauriEventSource` (usa `listen`) e passe cada linha por `mapEvent` e `reduce`. O reducer continua em TypeScript, só há uma implementação da lógica.
4. Capabilities do Tauri v2: conceda só o necessário (janelas, eventos, notificação). O acesso a arquivos passa pelo Rust.
5. Plugin `single-instance`: um segundo `agent-god-view` só traz a janela existente para frente. Aceite o argumento `--project <caminho>`.
6. **PiP:** crie uma segunda janela com label `pip`, sem decorações, `always_on_top`, redimensionável, `skip_taskbar`, tamanho inicial pequeno (por exemplo 320x200). A UI detecta o label e entra no modo `compact`. Use `data-tauri-drag-region` para arrastar e um botão minúsculo para fechar. Use o plugin `window-state` para lembrar posição e tamanho.
7. Reduza o custo do PiP: 15 fps e pausar o desenho quando minimizado.
8. **Aviso de permissão:** ao chegar `permission_request`, dispare uma notificação nativa e peça atenção na barra de tarefas (`request_user_attention`). Evite roubar o foco enquanto o usuário digita. Reaproveite o banner e o som do `audio.js`. Ao chegar `permission_resolved`, limpe o aviso.
9. Teste: dois monitores com DPI diferentes, PiP sobre editor e sobre app em tela cheia, fechar o terminal com o viewer aberto.

**Pronto quando:** `pnpm tauri dev` mostra a janela com o estado ao vivo, o PiP flutua e lembra a posição, e um pedido de permissão do opencode gera notificação mesmo com o terminal em segundo plano.

## Etapa 7: Instalação e distribuição

**Objetivo:** `npm i -D agent-god-view` e funcionar.

1. Comando `agent-god-view init`: copia o plugin para `.opencode/plugins/` com um cabeçalho de versão, sem sobrescrever sem confirmar.
2. Comando `agent-god-view doctor`: confere Node, WebView2, presença do binário, plugin instalado e permissão de escrita no spool.
3. Build do binário: `pnpm tauri build --no-bundle` gera só o `.exe`.
4. Crie o pacote `@agent-god-view/win32-x64` com o `.exe`, campos `os: ['win32']` e `cpu: ['x64']`. No pacote principal, liste-o em `optionalDependencies` com a mesma versão.
5. O CLI localiza o binário com `require.resolve`, e se não achar, baixa do GitHub Releases para `%LOCALAPPDATA%/agent-god-view/bin/<versão>/` verificando o SHA-256 antes de executar.
6. Inicie o app de forma desacoplada para ele não morrer com o terminal:

```ts
const child = spawn(exePath, ['--project', process.cwd()], { detached: true, stdio: 'ignore' });
child.unref();
```

7. Mantenha o modo navegador como fallback (`--web`).
8. CI no GitHub Actions: lint, typecheck e testes em PR; em tag `v*`, build no `windows-latest`, checksums, release e publicação no npm (plataforma primeiro, pacote principal por último, com `--provenance`).
9. Escreva README com GIF do PiP, requisitos e um texto de privacidade explicando o que o plugin grava e que nada sai da máquina.

**Pronto quando:** em uma máquina limpa, `npm i -D agent-god-view`, `npx agent-god-view init` e `npx agent-god-view` abrem o viewer funcionando.

## Resumo de ordem e riscos

| Etapa | Entrega | Maior risco |
| --- | --- | --- |
| 0 | Ambiente | Instalar toolchain do Rust no Windows |
| 1 | core + reducer | Nenhum relevante |
| 2 | Leitor do .opencode | Nomes de pastas e frontmatter variam |
| 3 | UI + CLI no navegador | Migrar o visualizer sem quebrar |
| 4 | Plugin gravador + fixtures | Propriedades dos eventos diferirem do esperado |
| 5 | Mapeamento ao vivo | Identificar qual agente gerou cada evento |
| 6 | Tauri, PiP, permissão | Comportamento de always-on-top e foco |
| 7 | Distribuição | Antivírus e WebView2 |

As etapas 0 a 3 já entregam algo demonstrável (o escritório com os seus agentes reais). Quem decide a viabilidade do resto é a etapa 4, então faça ela cedo.

## Prompt de contexto para colar em um agente de código

Se for usar o opencode para ajudar a construir o projeto, comece cada sessão com algo assim:

> Estou criando o `agent-god-view`: um pacote npm que mostra em um escritório animado (canvas) o que agentes de IA estão fazendo. Alvo inicial: opencode. Monorepo pnpm, TypeScript, shell Tauri v2 na etapa 6. Eventos chegam por um spool NDJSON em `%APPDATA%/agent-god-view/spool/<projectId>.ndjson`, convertidos por adapters para um schema normalizado (`AgentEvent`) e reduzidos por uma função pura `reduce(state, event)` no pacote `core`. A UI nunca conhece a ferramenta de origem. Estamos na etapa N. Leia `docs/decisions.md` e `docs/opencode-events.md` antes de alterar qualquer coisa e não invente nomes de eventos: use só os que aparecem nas fixtures.
