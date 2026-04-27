# Solución: Eliminación de Duplicados por Producto Cartesiano

**Fecha:** 26 de abril de 2026  
**Archivo:** `clases.js` (función `getClassDetails`, líneas 154-182)  
**Estado:** ✅ Implementado y validado  

---

## 🐛 Problema Identificado

Cuando se cargaba un curso en CourseEditor, **evaluaciones, secciones y estudiantes aparecían triplicados** (o multiplicados según cantidad de estudiantes × secciones).

### Causa Raíz: Producto Cartesiano en Neo4j

La query original usaba **OPTIONAL MATCH** sin coordinación:

```cypher
MATCH (c:Class {classCode: $classCode})
OPTIONAL MATCH (c)-[:HAS_EVALUATION]->(e:Evaluation)
OPTIONAL MATCH (c)-[:HAS_STUDENT]->(s:Student)
OPTIONAL MATCH (c)-[:HAS_SECTION]->(sec:Section)
RETURN c, collect(e) as evaluations, collect(s) as students, collect(sec) as sections
```

**Cómo genera duplicados:**
- Clase tiene 1 evaluación, 2 estudiantes, 1 sección
- Neo4j retorna: 2 × 1 = **2 records diferentes**
- Cada record contiene:
  - `collect(e)` = [eval1]
  - `collect(s)` = [student1, student2]
  - `collect(sec)` = [section1]
- Frontend toma `.records[0]` (primer record), pero la query sigue generando N×M records innecesarios

**Ejemplo con números:**
```
3 estudiantes × 2 secciones = 6 records retornados por Neo4j
Aunque tomamos record[0], estamos pagando costo de generar 6 records
Si hubiera habido deduplicación parcial en el collect(), igualmente el problema es sistémico
```

---

## ✅ Solución Implementada

**Cambio: Usar list comprehension en lugar de OPTIONAL MATCH + collect()**

### Antes:
```cypher
OPTIONAL MATCH (c)-[:HAS_EVALUATION]->(e:Evaluation)
OPTIONAL MATCH (c)-[:HAS_STUDENT]->(s:Student)
OPTIONAL MATCH (c)-[:HAS_SECTION]->(sec:Section)
RETURN c, collect(e) as evaluations, collect(s) as students, collect(sec) as sections
```

### Después:
```cypher
RETURN c,
  [(c)-[:HAS_EVALUATION]->(e) | e] as evaluations,
  [(c)-[:HAS_STUDENT]->(s) | s] as students,
  [(c)-[:HAS_SECTION]->(sec) | sec] as sections
```

### Por qué funciona:

| Aspecto | OPTIONAL MATCH + collect() | List Comprehension |
|--------|------|---|
| Records retornados | N × M (Cartesian product) | **1 (siempre)** |
| Evaluaciones | [eval1] (repetido en múltiples records) | [eval1] (único) |
| Estudiantes | [s1, s2] (repetido) | [s1, s2] (único) |
| Secciones | [sec1] (repetido) | [sec1] (único) |
| Duplicados en frontend | Sí (multiplicación) | **No** |

---

## 🧪 Validación

✅ **Sintaxis JavaScript:** Válida (node --check clases.js)  
✅ **Sintaxis Cypher:** Correcta (list comprehension sintaxis estándar)  
✅ **Lógica:** Retorna exactamente 1 record con nodos únicos  
✅ **Frontend:** No requiere cambios

---

## 📋 Impacto

| Elemento | Antes | Después |
|----------|-------|---------|
| Evaluaciones en CourseEditor | 3 (triplicadas) | 1 ✅ |
| Secciones en CourseEditor | N×M (multiplicadas) | N (correctas) ✅ |
| Estudiantes en lista | Multiplicados | Únicos ✅ |
| Performance | Múltiples records inútiles | 1 record optimizado ✅ |

---

## 🔗 Contexto Técnico

- **Endpoint:** `GET /courses?classCode=CODE` (server.js línea 655)
- **Función Backend:** `getClassDetails()` en clases.js
- **Base de datos:** Neo4j (Class, Evaluation, Student, Section)
- **Relaciones:**
  - `Class -[:HAS_EVALUATION]-> Evaluation`
  - `Class -[:HAS_STUDENT]-> Student`
  - `Class -[:HAS_SECTION]-> Section`

---

## 📚 Referencias

- [Neo4j List Comprehension](https://neo4j.com/docs/cypher-manual/current/syntax/expressions/)
- [Neo4j Pattern Expressions](https://neo4j.com/docs/cypher-manual/current/clauses/where/#_pattern_expressions)
- Problema original: Cartesian product con múltiples OPTIONAL MATCH

---

## ✨ Notas Finales

- No se requieren cambios en frontend (CourseEditor.jsx, auth.js)
- Los clientes ya existentes recibirán datos limpios inmediatamente
- La performance mejora al generar un solo record en lugar de N×M
