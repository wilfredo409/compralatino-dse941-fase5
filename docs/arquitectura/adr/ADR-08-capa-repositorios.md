# ADR-08: Adopción del patrón Repository con SQL explícito parametrizado

* **Estado:** Aprobado
* **Fecha:** 2026-10-24
* **Autor:** Edwin Cerón (@wilfredo409)
* **Revisores:** Laura, David Cardona
* **Contexto de Fase:** Fase 4 · Tareas E-4 y L-1 (Guía Word: Sección 6.2)

---

## 1. Contexto y Problemática

En la versión actual del backend (Node.js 22 LTS / Express), existen **46 consultas SQL embebidas directamente en las funciones controladoras** de las rutas HTTP:
* `pedidos`: 16 consultas
* `admin`: 11 consultas
* `auth`: 6 consultas
* `usuarios`: 5 consultas
* `webhooks`: 4 consultas
* `productos`: 3 consultas
* `categorías`: 1 consulta

Esta concentración de responsabilidades acopla la gestión del protocolo HTTP (parámetros de ruta, headers, códigos de respuesta) con la lógica de acceso a datos y las peculiaridades del motor PostgreSQL, dificultando la mantenibilidad y el aislamiento de pruebas.

### Aclaración sobre ADR-04
El `ADR-04` original planteaba de manera preliminar el uso de un «mapeador objeto-relacional (ORM)». Se formaliza mediante este documento que **no se adoptará un ORM**. Lo efectivamente construido y estandarizado para CompraLatino es **SQL nativo parametrizado explícito encapsulado en clases Repository**, prescindiendo de capas de abstracción ORM.

---

## 2. Decisión

Implementar el **patrón Repository** para centralizar y encapsular la persistencia de datos:

1. **Estructura física:** Crear el directorio `src/repositories/` en el backend.
2. **Consultas parametrizadas:** Todo acceso a la base de datos se ejecutará mediante consultas nativas parametrizadas (`$1, $2, ...`) utilizando el pool de conexiones de `pg`. Queda estrictamente prohibida la concatenación directa de cadenas para prevenir inyecciones SQL.
3. **Contrato de métodos:** Los repositorios expondrán funciones asíncronas puras que reciben parámetros de dominio y retornan objetos planos JavaScript o arreglos resultantes (`rows`).
4. **Desacoplamiento de controladores:** Los controladores de Express consumirán exclusivamente métodos del repositorio correspondiente, delegando el manejo de transacciones complejas o sentencias SQL.

### Alcance inicial para el refactor (Laura · Tarea L-1)
Para mitigar riesgos de regresión sobre las 66 pruebas automatizadas existentes, el refactor inmediato se limita a los módulos de menor acoplamiento transaccional (**9 consultas en total**):
* **`CategoriaRepository`**: 1 consulta (`categorías`).
* **`ProductoRepository`**: 3 consultas (`productos`).
* **`UsuarioRepository`**: 5 consultas (`usuarios`).

Los módulos con flujos transaccionales críticos (`pedidos`, `admin`, `webhooks`, `auth`) mantendrán temporalmente su estructura actual y se migrarán de forma progresiva.

---

## 3. Alternativas Descartadas

* **ORM completo (Prisma / TypeORM / Sequelize):** Descartado por overhead de dependencias, penalización innecesaria en tiempos de arranque/memoria en contenedor Docker y riesgo de romper compatibilidad con las 66 pruebas unitarias y de integración existentes.
* **Query Builder (Knex.js / Kysely):** Descartado para no añadir abstracciones intermedias ni rehacer las consultas SQL y esquemas DDL ya validados y optimizados para PostgreSQL 16.
* **Mantener SQL en controladores:** Descartado por constituir deuda técnica y contravenir las indicaciones de modularidad y arquitectura en capas solicitadas en la Sección 6.2.

---

## 4. Consecuencias

### Positivas
* **Separación de responsabilidades:** Las rutas HTTP sólo manejan validación de entrada, orquestación y serialización de respuestas HTTP.
* **Testabilidad:** Facilita la creación de stubs y mocks de repositorios en pruebas unitarias sin requerir conexión constante a la base de datos real.
* **Contrato OpenAPI intacto:** Se garantiza que el contrato `openapi.yaml` servido en `/api/docs` no sufre ninguna modificación sintáctica ni semántica.
* **Compatibilidad de la suite:** Las 66 pruebas del backend (`npm test`) continuarán pasando al 100% con $\ge$ 90% de cobertura.

### Negativas / Riesgos
* Incremento inicial en la cantidad de archivos del proyecto (`src/repositories/*.js`).
* Requiere disciplina de equipo para evitar la introducción de nuevas llamadas directas a `pool.query()` fuera de `src/repositories/`.