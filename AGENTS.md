# AGENTS.md — F1 Race Strategist

Instrucciones compartidas del proyecto. Detalles de uso y del modelo: `README.md`.

## Propósito y límites

Challenge técnico (esfuerzo estimado 2–3 h): elegir una carrera de F1, armar una estrategia de neumáticos, simularla
y entender el resultado. Priorizar el recorrido completo sobre ampliar alcance.

- La simulación y toda llamada a la API externa viven en el backend. El frontend solo consume nuestro backend y no
  duplica el motor de simulación.
- Fuera de alcance: autenticación, roles, pagos, microservicios, colas, Redis, Kubernetes, optimización automática de
  estrategias y física avanzada.
- Los valores numéricos del proveedor son ficticios: no afirmar precisión real de F1.

## Stack (comprobado en los lockfiles)

- `frontend/`: Next.js 16.4, React 19.3, TypeScript 5.9, ESLint 9 (`eslint-config-next`), Vitest 4 + Testing
  Library + jsdom (Vite 6 fijado para seguir en Node 20). Sin Tailwind.
- `backend/`: NestJS 11.2, TypeORM 0.3.31, `pg`, `class-validator`, Jest 30, TypeScript 5.9, ESLint + Prettier.
- PostgreSQL 17 en Docker (`docker-compose.yml`, puerto de host 5434).
- npm, con un `package-lock.json` por app y sin workspaces. Node ≥ 20.12.
- Versiones elegidas a propósito: NestJS 11 y TypeORM 0.3, no los majors 12 y 1.x. No actualizar majors sin pedido explícito.
- `frontend/AGENTS.md` lo genera `next dev`: remite a la documentación de Next que coincide con la versión instalada,
  en `frontend/node_modules/next/dist/docs/`. Consultarla antes de usar APIs de Next.

## Estructura

- `backend/src/f1-api/`: cliente HTTP (presupuesto total por consulta `F1_API_TIMEOUT_MS`, menor que el timeout de
  `frontend/src/lib/api.ts`; 1 reintento en 502/503/504/red si queda presupuesto; caché en memoria de 5 min),
  parsers de runtime de cada respuesta, `F1ApiError` y el filtro que lo traduce a 502/504/404.
- `backend/src/races/`: lista de carreras y contexto de carrera (`GET /races`, `GET /races/:raceId/context`).
  Valida la coherencia de los datos externos (por ejemplo, que el clima cubra todas las vueltas).
- `backend/src/simulation/`: `simulation.engine.ts` (funciones puras), `strategy-validation.ts`, DTO de entrada y
  `POST /simulations`.
- `backend/src/saved-simulations/`: entidad `SavedSimulation` (JSONB) y `/saved-simulations`. Siempre recalcula
  con `SimulationService` antes de guardar.
- `backend/src/database/`: opciones de TypeORM, `data-source.ts` (CLI) y `migrations/`.
- `backend/src/config/app-config.ts`: lee y valida variables de entorno (`process.loadEnvFile`, sin `@nestjs/config`).
- `backend/src/testing/f1-fixtures.ts`: fixtures **solo para pruebas**. Excluido del build.
- `frontend/src/components/Strategist.tsx`: orquesta el flujo. La pantalla de inicio es el historial de simulaciones
  guardadas; "Crear simulación" abre el asistente de 4 pasos (carrera → circuito y clima → estrategia → resultado).
  Los pasos ocultos siguen montados (`hidden`) para conservar el estado. `frontend/src/lib/api.ts`: cliente del backend.
- `frontend/src/i18n/`: diccionarios ES/EN, idioma actual (`useI18n`, guardado en `localStorage`) y traducción de
  errores por código (`describe-error.ts`).

## Comandos

Desde la raíz: `docker compose up -d --wait` (DB; espera el healthcheck). El backend no arranca sin la DB.
No borrar el volumen `postgres-data`.

Desde `backend/` (requiere `.env`, copiado de `.env.example`):

- `npm run start:dev` · `npm run build`
- `npm run migration:run` · `migration:revert` · `migration:show` · `schema:check` (diferencia entre entidades y DB)
- `npm run typecheck` · `npm test` · `npm run test:e2e`
- `npm run lint` (aplica `--fix`). Para solo verificar: `npx eslint "{src,test}/**/*.ts"`.

Desde `frontend/` (requiere `.env.local`, copiado de `.env.example`):

- `npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit` · `npm test` (Vitest, `src/**/*.test.{ts,tsx}`)

No borrar `backend/dist` mientras `start:dev` está corriendo: el watcher cae con `Cannot find module dist/main`.

## Reglas de implementación

- Idioma: código e identificadores en inglés. La UI es bilingüe (ES/EN): todo texto visible va en
  `frontend/src/i18n/messages.ts`, en ambos idiomas; nada de literales en los componentes. El backend responde
  `message` en español junto con un `code` estable (`backend/src/common/api-error.ts`). Cada código nuevo de error o
  de problema se agrega también a `errors`/`problems` de los dos diccionarios.
- Formato del backend: Prettier (comillas simples). Frontend: estilo generado por create-next-app (comillas dobles).
- Sin `any` (regla de ESLint en `error` en el backend), sin aserciones ni supresiones para tapar incompatibilidades.
  Única excepción documentada: el cast en la frontera `request<T>` de `frontend/src/lib/api.ts`.
- Validar en runtime todo dato externo (`f1-api.parsers.ts`). No inventar endpoints ni campos: consultar
  `https://tech-challenge101.onrender.com/docs.json`.
- Logging con `Logger` de NestJS. Cada fallo se registra una sola vez: el cliente externo registra sus fallos y el
  filtro no repite. Nada de `console.log` en el backend.
- Errores: validación → 400, inexistente → 404, proveedor → 502/504, DB → 503. Se crean con `apiException(status,
  code, message, { cause })`; los errores del DTO los arma `common/validation-problems.ts`. Un fallo nunca se
  convierte en lista vacía ni en éxito.
- Esquema solo mediante migraciones (`synchronize: false`). Si cambia la entidad, agregar una migración nueva y
  correr `schema:check`.
- Si cambia el modelo de simulación, actualizar `SIMULATION_MODEL_VERSION`, `SIMULATION_ASSUMPTIONS`, los supuestos
  de `assumptions` en ambos diccionarios del frontend, el README y los tests.
- Gráficos: un solo eje vertical por gráfico (medidas distintas → paneles separados), y series identificadas
  también con texto, no solo por color.
- Barras por vuelta (clima, estrategia, historial): posicionar con `lapSpanStyle`/`lapBoundary` de
  `frontend/src/lib/chart.ts` (cada vuelta es un intervalo), nunca con `flex-grow`, que deja que el texto deforme las
  proporciones. El gráfico de vueltas usa la escala de puntos.
- Constantes de negocio con nombre (por ejemplo `RAIN_PENALTY_SECONDS_PER_INTENSITY`). Redondear solo al presentar.
- Frontend: no identificar compuestos solo por color (letra + nombre), estados de carga, error, vacío y éxito,
  y deshabilitar envíos duplicados.

## Verificación

- Pruebas con fixtures controladas; nunca depender de la API externa ni de la DB en `npm test` o `test:e2e`.
- No usar datos de producción ni borrar volúmenes o datos existentes.
- No presentar verificaciones no ejecutadas como exitosas.
