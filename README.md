# F1 Race Strategist

Aplicación web para elegir una carrera de F1, armar una estrategia de neumáticos, simularla y entender el resultado.

- `frontend/`: Next.js 16 (App Router) + TypeScript. Solo consume nuestro backend.
- `backend/`: NestJS 11 + TypeORM 0.3 + PostgreSQL. Consume la [API del challenge](https://tech-challenge101.onrender.com/docs), valida y simula.
- `docker-compose.yml`: solo PostgreSQL. Las apps corren en el host.

> Los valores numéricos del proveedor son ficticios: los tiempos no representan F1 real.

## Requisitos

- Node.js ≥ 20.12 (probado con 20.20.1) y npm (probado con 10.8).
- Docker con Compose v2 que soporte `up --wait` (probado con 2.38.2).

## Puesta en marcha

```bash
# 1. PostgreSQL, desde la raíz del repositorio (puerto de host 5434, para no chocar con un PostgreSQL local).
#    --wait espera a que el healthcheck (pg_isready) dé "healthy" antes de devolver el control.
docker compose up -d --wait

# 2. Backend, en la misma terminal (pasa de la raíz a backend/)
cd backend
cp .env.example .env
npm ci
npm run migration:run
npm run start:dev          # http://localhost:4000

# 3. Frontend, en otra terminal que empieza en la raíz del repositorio
cd frontend
cp .env.example .env.local
npm ci
npm run dev                # http://localhost:3000
```

El backend necesita PostgreSQL disponible para arrancar: TypeORM se conecta antes de aceptar solicitudes y, si no
puede, reintenta durante unos 30 s y el proceso termina con error. Si la base cae con el backend ya en marcha,
`POST /simulations` sigue respondiendo, el guardado y el historial responden 503, y al volver la base se reconecta
sin reiniciar el backend (verificado a mano con `docker compose stop postgres` / `up -d --wait`).

La primera carga puede tardar hasta un minuto: la API externa duerme cuando está inactiva. La interfaz lo avisa a los
3 s. Cada consulta al proveedor tiene un presupuesto total de `F1_API_TIMEOUT_MS` (60 s por defecto), que incluye el
único reintento y su espera de 1 s. Solo se reintenta ante error de red o 502/503/504, y solo si después de la espera
quedan al menos 5 s; agotar el presupuesto no se reintenta y responde 504. El frontend espera 90 s por solicitud, así
que recibe ese 504 en lugar de un corte propio. Por eso el backend rechaza valores de `F1_API_TIMEOUT_MS` fuera de
1000–80000 ms.

### Variables de entorno

| Archivo | Variable | Uso |
|---|---|---|
| `backend/.env` | `PORT` | Puerto del backend (4000). |
| | `CORS_ORIGINS` | Orígenes permitidos, separados por coma. |
| | `F1_API_BASE_URL`, `F1_API_TIMEOUT_MS` | API externa y presupuesto total por consulta, reintento incluido (1000–80000 ms). |
| | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL (deben coincidir con `docker-compose.yml`). |
| `frontend/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | URL de nuestro backend. Es pública: se incrusta en el bundle al compilar. |

Los valores de ejemplo son credenciales locales de desarrollo, no secretos.

## Verificación

| Dónde | Comando | Qué comprueba |
|---|---|---|
| `backend/` | `npm run typecheck` | Tipos (incluye specs). |
| `backend/` | `npx eslint "{src,test}/**/*.ts"` | Lint sin modificar archivos (`npm run lint` aplica `--fix`). |
| `backend/` | `npm test` | Unitarias: motor, validación, cliente de la API, servicios. Con fixtures; sin red ni DB. |
| `backend/` | `npm run test:e2e` | Contrato HTTP (400/404/502/503/504) con la API y la DB simuladas. |
| `backend/` | `npm run build` | Compilación de producción. |
| `backend/` | `npm run schema:check` | La entidad coincide con las migraciones (necesita la DB levantada). |
| `frontend/` | `npx tsc --noEmit`, `npm run lint`, `npm run build` | Tipos, lint y build. |
| `frontend/` | `npm test` | Vitest + jsdom: regresión del guardado con el backend simulado (respuestas viejas y fallos inciertos) y escala de las barras por vuelta. |

## API del backend

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/races` | Carreras con circuito. |
| GET | `/races/:raceId/context` | Carrera + circuito, clima, parámetros, neumáticos y parrilla. |
| POST | `/simulations` | `{ raceId, stints: [{ compound, laps }] }` → resultado. No guarda. |
| POST | `/saved-simulations` | Mismo cuerpo. **Recalcula** en el servidor y guarda. |
| GET | `/saved-simulations`, `/saved-simulations/:id` | Historial (últimas 50) y detalle. |

Errores: 400 estrategia inválida · 404 carrera o simulación inexistente · 502 API externa caída o con datos inválidos ·
504 API externa sin respuesta a tiempo · 503 base de datos no disponible. El cálculo (`POST /simulations`) no consulta
PostgreSQL; el guardado y el historial sí.

Cada error trae un `code` estable, un `message` en español y, si corresponde, `params` y `problems`, uno por cada
problema de la estrategia:

```json
{ "statusCode": 400, "code": "INVALID_STRATEGY", "message": "La estrategia no es válida.",
  "problems": [{ "code": "LAPS_MISMATCH", "message": "La estrategia cubre 61 vueltas, pero la carrera tiene 62.",
                 "params": { "assigned": 61, "total": 62 } }] }
```

Los códigos están en `backend/src/common/api-error.ts`. El frontend traduce por código.

## Interfaz

La pantalla de inicio lista las **simulaciones guardadas** (ver detalle de cada una). El botón **Crear simulación**
abre un asistente de 4 pasos, con "Anterior" y "Siguiente":

1. **Carrera**: selector propio (patrón ARIA listbox) que muestra ronda, circuito, fecha, vueltas y probabilidad de lluvia de cada carrera; se usa con mouse o teclado.
2. **Circuito y clima**: datos clave e intensidad de lluvia. Los parámetros detallados y los pilotos y equipos
   están plegados.
3. **Estrategia**: tramos, compuestos y vueltas, con los neumáticos al costado.
4. **Resultado**: tiempo total, paradas, la estrategia y "De dónde sale el tiempo total" leído como un ticket (tiempo
   base ± cada efecto = total), más el gráfico por vuelta. Tablas de tramos, paradas y supuestos en "Ver detalle".

## Idiomas

La interfaz está en español e inglés: el botón ES | EN del encabezado cambia el idioma y lo recuerda en el
navegador. Los textos viven en `frontend/src/i18n/messages.ts`. TypeScript exige que el inglés tenga las mismas
claves que el español. Los errores se traducen por su `code`, así que un error ya visible también cambia de idioma.

Lo que no se traduce: los nombres propios del proveedor (carreras, circuitos, pilotos) y el resumen del clima, que la
API solo da en inglés. En español se muestra como "Resumen del proveedor (original en inglés)" en lugar de inventar
una traducción.

## Modelo de simulación (`backend/src/simulation/simulation.engine.ts`)

Se recorre la carrera vuelta por vuelta. Todo está en segundos.

```
vuelta(n) = baseLapTime                              (circuito)
          + tyre.pace                                (delta del compuesto)
          + tyre.degradation × circuit.tyreWear × edad
          − fuelEffectPerLap × (n − 1)
          + 30 × max(0, lluvia(n) − tyre.optimalRainIntensity.max) × (1 − tyre.wetPerformance)

total = Σ vuelta(n) + paradas × (pitStopLoss + tyreChangeTime)
```

- **Desgaste**: la edad es 0 en la primera vuelta de cada juego nuevo y suma 1 por vuelta. Cada tramo empieza con
  neumáticos nuevos, también el primero.
- **Paradas**: una entre cada par de tramos consecutivos. Se cuenta al final de la última vuelta del tramo saliente.
  No hay parada antes de la salida ni después de la última vuelta. `pitStopLoss` y `tyreChangeTime` vienen de
  `simulation-parameters` (la API aclara que la pérdida excluye el cambio, así que se suman).
- **Clima**: la lluvia de cada vuelta sale del tramo del pronóstico que la contiene. La constante de 30 s por unidad de
  exceso es **nuestra**, no de la API: la elegimos para que, con los datos del proveedor, el compuesto pensado para
  cada nivel de lluvia sea aproximadamente el más rápido. El backend rechaza un pronóstico que no cubra todas las vueltas.
  Simplificación: solo se penaliza superar el máximo óptimo del compuesto; estar debajo del mínimo no suma nada, y el
  ritmo propio del compuesto (`pace`) se cuenta aparte. Por eso la fila "Penalización por lluvia y compuesto" puede
  ser 0 aunque llueva.
- **Desgaste y combustible**: al cambiar neumáticos la edad vuelve a 0, pero el efecto del combustible sigue
  acumulándose. Dentro de un tramo, la vuelta siguiente puede ser más lenta o más rápida según qué efecto predomine.
- **Tiempos en pista**: el gráfico de vueltas y los tiempos por tramo excluyen las paradas, que se suman aparte al total.
- **Mínimo de paradas** (`minimumPitStops`): se muestra como advertencia; no bloquea la simulación.
- **Fuera del modelo** (se muestran como contexto): pilotos y equipos, `lapTimeVariance`, `safetyCarProbability`,
  `overtakingDifficulty`, temperaturas, `rainProbability`. Es un modelo determinista y sin tráfico.
- Precisión completa en el cálculo; el redondeo se hace solo al presentar. El desglose detallado muestra tres
  decimales; el total usa los valores sin redondear.
- **Combustible relativo** (gráfico debajo del de tiempos): es una **representación ilustrativa**, no un dato de la
  API. Muestra el combustible al inicio de cada vuelta, `1 − (n − 1) / vueltas`, suponiendo consumo uniforme y ninguna
  recarga: 100 % al inicio de V1 y 1/vueltas al inicio de la última (0 % sería el final de la carrera). La API no da
  cantidades, así que no se muestran kilos ni litros, y los tiempos no usan este porcentaje. Va en un gráfico aparte,
  alineado por vuelta, para no mezclar dos escalas en un mismo eje.
- **Escalas**: en las barras (clima, estrategia, historial) cada vuelta es un intervalo, y el ancho de un segmento
  depende solo de sus vueltas; una parada al final de la vuelta n queda en el límite n/vueltas. En el gráfico de
  vueltas cada vuelta es un punto. Ver `frontend/src/lib/chart.ts`.

Validaciones: carrera existente, al menos un tramo (máximo 20), compuestos que existan en `/api/tyres`, vueltas
enteras entre 1 y 200 por tramo, y suma de vueltas igual a la distancia de la carrera.

## Por qué PostgreSQL

El challenge no exige una base de datos. La agregamos para guardar simulaciones y poder volver a consultarlas o
compararlas, con un historial que sobrevive a reinicios. Se guarda la estrategia, el resultado completo (JSONB) y la
versión del modelo, para interpretar resultados viejos si el modelo cambia. El backend nunca guarda números que
mande el navegador: recalcula antes de guardar. No replicamos el catálogo externo, que se consulta en vivo con un
caché en memoria de 5 minutos. La API es determinista, así que ese caché es seguro.

## Decisiones

- NestJS 11 y TypeORM 0.3 en lugar de NestJS 12 / TypeORM 1.x / TypeScript 7 (majors recientes): APIs conocidas y
  todavía mantenidas, dentro del tiempo del challenge.
- `overrides` de `multer` a 2.5.0 dentro de `@nestjs/platform-express` (`backend/package.json`). Corrige
  [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m), un DoS en `multer` < 2.5.0.
  `@nestjs/platform-express` 11.2.8, la última 11.x, fija `multer` 2.4.0, y la primera versión corregida del
  paquete es la 12.3.0, un major: forzar solo `multer` (minor dentro de 2.x, mismas dependencias) evita migrar a
  NestJS 12. Con el override pasan typecheck, lint, tests unitarios y HTTP y el build, y `npm audit --omit=dev` da
  0 vulnerabilidades. Se puede retirar cuando una versión compatible de `@nestjs/platform-express` incluya
  `multer` ≥ 2.5.0.
- `GET /api/tyres` no figura en la tabla del PDF, pero está documentado en el OpenAPI y responde. De ahí salen los compuestos.
- Validación en runtime de las respuestas externas con parsers propios, sin agregar una librería.
- Cliente externo: presupuesto total configurable por consulta, un único reintento ante 502/503/504 o error de red
  (solo lecturas `GET`), y deduplicación de solicitudes simultáneas.
- El guardado no se reintenta automáticamente. Si la conexión se corta o vence el tiempo después de enviarlo, el
  navegador no puede saber si el servidor escribió: la interfaz lo dice así, recarga el historial y pide revisarlo
  antes de volver a guardar. Una respuesta de guardado que llega cuando ya hay otro resultado en pantalla solo
  refresca el historial; no cambia el estado del resultado nuevo.

## Mejoras con más tiempo

- Migrar a NestJS 12 / TypeORM 1.x.
- Validar en el frontend las respuestas del backend (hoy se confía en el contrato tipado).
- Más tests de componentes del frontend (hoy solo cubren el guardado) y un e2e de navegador automatizado. El
  recorrido se verificó manualmente con Playwright.
- Comparar dos estrategias lado a lado y borrar simulaciones del historial.
- Modelar safety car o variación aleatoria con una semilla, y efecto de temperatura en el desgaste.
- Más pruebas de interacción del selector de carrera (hoy: teclado y Escape automatizados; clic afuera y apertura hacia arriba verificados a mano).
- Un JSON mal formado devuelve el 400 genérico de Nest, sin `code`. La interfaz no envía ese caso y, si ocurriera,
  muestra un error genérico.
