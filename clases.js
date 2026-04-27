import neo4j from "neo4j-driver";

/**
 * Connect to Neo4j and return the driver
 * @param {string} uri - Neo4j URI
 * @param {string} user - Username
 * @param {string} password - Password
 * @returns {neo4j.Driver} The Neo4j driver
 */
export function connectToNeo4j(uri, user, password) {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  return driver;
}

/**
 * Create a new class
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {Object} data - Class data object
 * @param {string} creatorId - Creator's ID
 * @returns {Promise<void>}
 */
export async function createClass(driver, data, creatorId) {
  const session = driver.session();
  let classCode, name, description, startDate, endDate, fotoPath, isPublished, creatorUsername;
  classCode = data.classCode;
  name = data.name;
  description = data.description;
  startDate = data.startDate;
  endDate = data.endDate || "00/00/0000";
  fotoPath = data.fotoPath || null;
  isPublished = data.isPublished || false;
  creatorUsername = data.creatorUsername || '';

  try {
    await session.run(
      "CREATE (c:Class {classCode: $classCode, name: $name, description: $description, creatorId: $creatorId, creatorUsername: $creatorUsername, startDate: $startDate, endDate: $endDate, fotoPath: $fotoPath, isPublished: $isPublished})",
      { classCode, name, description, creatorId, creatorUsername, startDate, endDate, fotoPath, isPublished },
    );

    const result = await session.run(
      'MATCH (c:Class {classCode: $classCode}) RETURN c LIMIT 1',
      { classCode },
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return record.get("c").properties;
  } finally {
    await session.close();
  }
};

/**
 * Check if a class code already exists in the database
 * Conexión CreateCourse: Verifica códigos duplicados
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code to check
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export async function classCodeExists(driver, classCode) {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (c:Class {classCode: $classCode}) RETURN count(c) as count',
      { classCode }
    );
    const count = result.records[0]?.get('count');
    return count > 0;
  } finally {
    await session.close();
  }
}

/**
 * Add an evaluation to a class
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @param {string} evalId - Evaluation ID
 * @param {string} name - Evaluation name
 * @param {string} type - Evaluation type
 * @param {string} content - Content as JSON string
 * @returns {Promise<void>}
 */
export async function addEvaluation(
  driver,
  classCode,
  evalId,
  name,
  type,
  content,
) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (c:Class {classCode: $classCode})
       CREATE (e:Evaluation {evalId: $evalId, name: $name, type: $type, content: $content}),
              (c)-[:HAS_EVALUATION]->(e)`,
      { classCode, evalId, name, type, content },
    )
    ;
  } finally {
    await session.close();
  }
}

/**
 * Update an existing evaluation in a class.
 * Conexión AssessmentEditor: Permite editar evaluaciones (título, fechas, preguntas).
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} evalId - Evaluation ID to update
 * @param {string} name - New evaluation name
 * @param {string} type - Evaluation type (exam, quiz, etc)
 * @param {string} content - Stringified JSON with updated questions/dates
 * @returns {Promise<void>}
 */
export async function updateEvaluation(driver, evalId, name, type, content) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (e:Evaluation {evalId: $evalId})
       SET e.name = $name, e.type = $type, e.content = $content`,
      { evalId, name, type, content },
    );
  } finally {
    await session.close();
  }
}

/**
 * Delete an evaluation from a class.
 * Conexión AssessmentEditor: Permite eliminar evaluaciones.
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} evalId - Evaluation ID to delete
 * @returns {Promise<void>}
 */
export async function deleteEvaluation(driver, evalId) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (e:Evaluation {evalId: $evalId})
       DETACH DELETE e`,
      { evalId },
    );
  } finally {
    await session.close();
  }
}

/**
 * Delete a section (and its subsections recursively if needed).
 * Conexión SectionEditor: Permite eliminar secciones.
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} sectionId - Section ID to delete
 * @returns {Promise<void>}
 */
export async function deleteSection(driver, sectionId) {
  const session = driver.session();
  try {
    // Use DETACH DELETE to remove all relationships and the node itself
    await session.run(
      `MATCH (s:Section {sectionId: $sectionId})
       DETACH DELETE s`,
      { sectionId },
    );
  } finally {
    await session.close();
  }
}

/**
 * Delete a class and all its relationships (sections, evaluations, students)
 * Conexión DeleteCourse: Elimina un curso completamente de Neo4j.
 * DETACH DELETE elimina el nodo Class y todas sus relaciones en una operación.
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code to delete
 * @returns {Promise<void>}
 */
export async function deleteClass(driver, classCode) {
  const session = driver.session();
  try {
    // Cascade delete: elimina el curso, sus evaluaciones (y los SUBMITTED de estudiantes),
    // sus secciones, y todas las relaciones (incluyendo HAS_STUDENT).
    await session.run(
      `MATCH (c:Class {classCode: $classCode})
       OPTIONAL MATCH (c)-[:HAS_EVALUATION]->(e:Evaluation)
       OPTIONAL MATCH (c)-[:HAS_SECTION]->(s:Section)
       DETACH DELETE c, e, s`,
      { classCode },
    );
  } finally {
    await session.close();
  }
}

/**
 * Update class metadata (name, description, dates, image)
 * Conexión CourseEditor: Persiste cambios de metadatos en Neo4j
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @param {Object} data - Updated data (name, description, startDate, endDate, fotoPath)
 * @returns {Promise<Object>} Updated class properties
 */
export async function updateClass(driver, classCode, data) {
  const session = driver.session();
  try {
    // Construir dinámicamente qué campos actualizar
    const setClause = [];
    const params = { classCode };
    
    if (data.name !== undefined) {
      setClause.push('c.name = $name');
      params.name = data.name;
    }
    if (data.description !== undefined) {
      setClause.push('c.description = $description');
      params.description = data.description;
    }
    if (data.startDate !== undefined) {
      setClause.push('c.startDate = $startDate');
      params.startDate = data.startDate;
    }
    if (data.endDate !== undefined) {
      setClause.push('c.endDate = $endDate');
      params.endDate = data.endDate;
    }
    if (data.fotoPath !== undefined) {
      setClause.push('c.fotoPath = $fotoPath');
      params.fotoPath = data.fotoPath;
    }

    if (setClause.length === 0) {
      return null;
    }

    await session.run(
      `MATCH (c:Class {classCode: $classCode})
       SET ${setClause.join(', ')}`,
      params
    );

    // Retornar propiedades actualizadas
    const result = await session.run(
      'MATCH (c:Class {classCode: $classCode}) RETURN c LIMIT 1',
      { classCode }
    );

    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get("c").properties;
  } finally {
    await session.close();
  }
}

/**
 * Update class publication status
 * Conexión CourseEditor: Persiste estado público/oculto en Neo4j
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @param {boolean} isPublished - Publication status
 * @returns {Promise<Object>} Updated class properties
 */
export async function updateClassVisibility(driver, classCode, isPublished) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (c:Class {classCode: $classCode})
       SET c.isPublished = $isPublished`,
      { classCode, isPublished }
    );

    const result = await session.run(
      'MATCH (c:Class {classCode: $classCode}) RETURN c LIMIT 1',
      { classCode }
    );

    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get("c").properties;
  } finally {
    await session.close();
  }
}

/**
 * Add a student to a class
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @param {string} studentId - Student ID
 * @returns {Promise<void>}
 */
export async function addStudent(driver, classCode, studentId) {
  const session = driver.session();
  try {
    await session.run(
      `MERGE (s:Student {studentId: $studentId})
       WITH s
       MATCH (c:Class {classCode: $classCode})
       CREATE (c)-[:HAS_STUDENT]->(s)`,
      { classCode, studentId },
    );
  } finally {
    await session.close();
  }
}

/**
 * Add a section to a class or another section
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} parentId - Parent class code or section ID
 * @param {string} sectionId - Section ID
 * @param {string} description - Description as JSON string
 * @param {boolean} isClassParent - True if parent is class, false if section
 * @returns {Promise<void>}
 */
export async function addSection(
  driver,
  parentId,
  sectionId,
  description,
  isClassParent = true,
) {
  const session = driver.session();
  try {
    if (isClassParent) {
      await session.run(
        `MATCH (c:Class {classCode: $parentId})
         CREATE (s:Section {sectionId: $sectionId, description: $description}),
                (c)-[:HAS_SECTION]->(s)`,
        { parentId, sectionId, description },
      );
    } else if (sectionId!=parentId){
      await session.run(
        `MATCH (p:Section {sectionId: $parentId})
         CREATE (s:Section {sectionId: $sectionId, description: $description}),
                (p)-[:HAS_SUBSECTION]->(s)`,
        { parentId, sectionId, description },
      );
    }
    else{
      return {message:"cant have a sub section and a sectrion with same id"}
    }
  } finally {
    await session.close();
  }
}

/**
 * Retrieve class details including evaluations, students, and sections
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @returns {Promise<Object>} Class data
 */
export async function getClassDetails(driver, classCode) {
  const session = driver.session();
  try {
    // IMPORTANTE: Usar list comprehension [(c)-[:REL]->(n) | n] en lugar de OPTIONAL MATCH + collect()
    // Problema original: Con N estudiantes y M secciones, OPTIONAL MATCH retornaba N×M records,
    // causando que evaluaciones y secciones se triplicaran (multiplicaban) en la UI.
    // Referencia: https://neo4j.com/docs/cypher-manual/current/syntax/expressions/
    const result = await session.run(
      `MATCH (c:Class {classCode: $classCode})
       RETURN c,
         [(c)-[:HAS_EVALUATION]->(e) | e] as evaluations,
         [(c)-[:HAS_STUDENT]->(s) | s] as students,
         [(c)-[:HAS_SECTION]->(sec) | 
           {
             section: sec,
             resources: [(sec)-[:HAS_RESOURCE]->(r) | r]
           }
         ] as sectionsWithResources`,
      { classCode },
    );
    if (result.records.length === 0) return null;
    const record = result.records[0];
    
    // Mapear secciones con sus recursos
    const sectionsWithResources = record.get("sectionsWithResources");
    const sections = sectionsWithResources.map(item => ({
      ...item.section.properties,
      resources: item.resources.filter(r => r !== null).map(r => r.properties)
    }));
    
    return {
      class: record.get("c").properties,
      evaluations: record.get("evaluations").filter((e) => e !== null).map((e) => e.properties),
      students: record.get("students").filter((s) => s !== null).map((s) => s.properties),
      sections: sections,
    };
  } finally {
    await session.close();
  }
}

/**
 * Retrieve all evaluations for a class
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @returns {Promise<Array>} List of evaluations
 */
export async function getEvaluations(driver, classCode) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (c:Class {classCode: $classCode})-[:HAS_EVALUATION]->(e:Evaluation)
       RETURN e`,
      { classCode },
    );
    return result.records.map((record) => record.get("e").properties);
  } finally {
    await session.close();
  }
}

/**
 * Retrieve all students for a class
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} classCode - Class code
 * @returns {Promise<Array>} List of students
 */
export async function getStudents(driver, classCode) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (c:Class {classCode: $classCode})-[:HAS_STUDENT]->(s:Student)
       RETURN s`,
      { classCode },
    );
    return result.records.map((record) => record.get("s").properties);
  } finally {
    await session.close();
  }
}

/**
 * Retrieve sections for a class or section (recursive)
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} parentId - Class code or Section ID
 * @param {boolean} isClass - True if parent is class
 * @returns {Promise<Array>} List of sections with nested subsections
 */
export async function getSections(driver, parentId, isClass = true) {
  const session = driver.session();
  try {
    let query;
    if (isClass) {
      query = `MATCH (c:Class {classCode: $parentId})-[:HAS_SECTION]->(s:Section)
               RETURN s`;
    } else {
      query = `MATCH (p:Section {sectionId: $parentId})-[:HAS_SUBSECTION]->(s:Section)
               RETURN s`;
    }
    const result = await session.run(query, { parentId });
    const sections = result.records.map((record) => record.get("s").properties);
    // For nested, we might need to recurse, but for simplicity, return flat
    return sections;
  } finally {
    await session.close();
  }
}

/**
 * Update the description of a section
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} sectionId - Section ID
 * @param {string} description - New description string
 * @returns {Promise<void>}
 */
export async function updateSection(driver, sectionId, description) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (s:Section {sectionId: $sectionId})
       SET s.description = $description`,
      { sectionId, description },
    );
  } finally {
    await session.close();
  }
}

/**
 * Clone a class with the same properties and optional new creator
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} sourceClassCode - Existing class code to clone
 * @param {string} newClassCode - New class code for the clone
 * @param {string|null} creatorId - Optional creator ID for the cloned class
 * @returns {Promise<Object|null>} The cloned class properties or null
 */
export async function cloneClass(driver, sourceClassCode, newClassCode, newData, creatorId = null) {
  const session = driver.session();
  try {
    // Conexión CloneCourse: Crea un nuevo curso clonando la estructura completa
    // 1. Copia todas las secciones y sus materiales (recursos)
    // 2. Crea nuevo nodo Class con metadatos proporcionados
    // 3. NO copia evaluaciones (deben recalibrarse en nuevo contexto)
    
    
    // Paso 1: Obtener todas las secciones y recursos del original
    const sourceData = await session.run(
      `MATCH (c:Class {classCode: $sourceClassCode})
       OPTIONAL MATCH (c)-[:HAS_SECTION]->(s:Section)
       OPTIONAL MATCH (s)-[:HAS_RESOURCE]->(r:Resource)
       RETURN s, collect(r) as resources`,
      { sourceClassCode }
    );

    // Paso 2: Crear el nuevo Class
    const createResult = await session.run(
      `CREATE (clone:Class {classCode: $newClassCode, name: $name, description: $description, creatorId: $creatorId, creatorUsername: $creatorUsername, startDate: $startDate, endDate: $endDate, fotoPath: $fotoPath, isPublished: false})
       RETURN clone`,
      {
        newClassCode,
        creatorId: creatorId || '', // Asegurar que siempre haya un valor
        name: newData.name || '',
        description: newData.description || '',
        startDate: newData.startDate || '',
        endDate: newData.endDate || null,
        fotoPath: newData.fotoPath || '',
        creatorUsername: newData.creatorUsername || ''
      }
    );

    if (createResult.records.length === 0) {
      return null;
    }

    const cloned = createResult.records[0].get("clone").properties;
    console.log('[cloneClass] New course created - classCode:', cloned.classCode, 'creatorId:', cloned.creatorId);
    
    // Paso 3: Copiar secciones y sus recursos
    for (const record of sourceData.records) {
      const section = record.get('s');
      const resources = record.get('resources');

      if (section) {
        const newSectionId = section.properties.sectionId + '_' + newClassCode;

        // Crear nueva sección
        await session.run(
          `MATCH (clone:Class {classCode: $newClassCode})
           CREATE (clone)-[:HAS_SECTION]->(newSec:Section {sectionId: $sectionId, description: $description})
           WITH newSec
           UNWIND $resources as resData
             CREATE (newSec)-[:HAS_RESOURCE]->(newRes:Resource {resourceId: resData.resourceId + '_' + $newClassCode, name: resData.name, type: resData.type, content: resData.content, url: resData.url})
           RETURN newSec`,
          {
            newClassCode,
            sectionId: newSectionId,
            description: section.properties.description || '',
            resources: resources.map(r => r.properties)
          }
        );
      }
    }

    return cloned;
  } finally {
    await session.close();
  }
}

/**
 * Retrieve all classes from Neo4j
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @returns {Promise<Array>} List of all classes
 */
export async function getAllClasses(driver) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (c:Class)
       RETURN c`,
    );
    return result.records.map((record) => record.get("c").properties);
  } finally {
    await session.close();
  }
}

/**
 * Retrieve classes created by a specific user
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} creatorId - Creator user ID
 * @returns {Promise<Array>} List of classes created by the user
 */
export async function getCreatedClasses(driver, creatorId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (c:Class {creatorId: $creatorId})
       RETURN c`,
      { creatorId },
    );
    return result.records.map((record) => record.get("c").properties);
  } finally {
    await session.close();
  }
}

// ============================================================================
// SUBMISSIONS / GRADES
// ============================================================================

/**
 * Submit or update a student's evaluation result in Neo4j.
 * Creates/updates a SUBMITTED relationship between Student and Evaluation.
 * @param {neo4j.Driver} driver
 * @param {Object} submission - { userId, username, courseId, evalId, assessmentTitle, score, correctAnswers, totalQuestions, questionResults, submittedAt }
 */
export async function submitEvaluation(driver, submission) {
  const session = driver.session();
  try {
    const questionResultsStr = typeof submission.questionResults === 'string'
      ? submission.questionResults
      : JSON.stringify(submission.questionResults || []);

    await session.run(
      `MERGE (s:Student {studentId: $userId})
       WITH s
       MATCH (e:Evaluation {evalId: $evalId})
       MERGE (s)-[sub:SUBMITTED {evalId: $evalId, courseId: $courseId}]->(e)
       SET sub.userId = $userId,
           sub.username = $username,
           sub.courseId = $courseId,
           sub.evalId = $evalId,
           sub.assessmentTitle = $assessmentTitle,
           sub.score = $score,
           sub.correctAnswers = $correctAnswers,
           sub.totalQuestions = $totalQuestions,
           sub.questionResults = $questionResults,
           sub.submittedAt = $submittedAt`,
      {
        userId: String(submission.userId),
        username: String(submission.username || submission.userId),
        courseId: String(submission.courseId),
        evalId: String(submission.evalId),
        assessmentTitle: submission.assessmentTitle || '',
        score: submission.score ?? 0,
        correctAnswers: submission.correctAnswers ?? 0,
        totalQuestions: submission.totalQuestions ?? 0,
        questionResults: questionResultsStr,
        submittedAt: submission.submittedAt || new Date().toISOString()
      }
    );
  } finally {
    await session.close();
  }
}

/**
 * Get a student's submission for a specific evaluation.
 * @param {neo4j.Driver} driver
 * @param {string} evalId - Evaluation ID
 * @param {string} userId - Student ID
 * @returns {Promise<Object|null>}
 */
export async function getEvaluationResult(driver, evalId, userId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (s:Student {studentId: $userId})-[sub:SUBMITTED]->(e:Evaluation {evalId: $evalId})
       RETURN sub`,
      { userId, evalId }
    );
    if (result.records.length === 0) return null;
    const sub = result.records[0].get('sub').properties;
    return {
      ...sub,
      questionResults: sub.questionResults ? JSON.parse(sub.questionResults) : []
    };
  } finally {
    await session.close();
  }
}

/**
 * Get all submissions for a specific evaluation (for professors).
 * @param {neo4j.Driver} driver
 * @param {string} evalId - Evaluation ID
 * @returns {Promise<Array>}
 */
export async function getEvaluationSubmissions(driver, evalId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (s:Student)-[sub:SUBMITTED]->(e:Evaluation {evalId: $evalId})
       RETURN sub`,
      { evalId }
    );
    return result.records.map(record => {
      const sub = record.get('sub').properties;
      return {
        ...sub,
        questionResults: sub.questionResults ? JSON.parse(sub.questionResults) : []
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * Get all submissions by a student across all evaluations in a course.
 * @param {neo4j.Driver} driver
 * @param {string} courseId - Course class code
 * @param {string} userId - Student ID
 * @returns {Promise<Array>}
 */
export async function getCourseSubmissionsForUser(driver, courseId, userId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (s:Student {studentId: $userId})-[sub:SUBMITTED]->(e:Evaluation)
       WHERE sub.courseId = $courseId
       RETURN sub`,
      { userId, courseId }
    );
    return result.records.map(record => {
      const sub = record.get('sub').properties;
      return {
        ...sub,
        questionResults: sub.questionResults ? JSON.parse(sub.questionResults) : []
      };
    });
  } finally {
    await session.close();
  }
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

export const sampleData = {
  class: {
    classCode: "IC4302-2026-S1",
    name: "Bases de Datos 2",
    description:
      "Curso avanzado de bases de datos con enfoque en NoSQL y grafos",
    startDate: "2026-01-15",
    endDate: "2026-05-15",
    fotoPath: "/images/ic4302.jpg",
  },
  creatorId: "prof_001",
  evaluations: [
    {
      evalId: "quiz_001",
      name: "Quiz 1 - Introduction",
      type: "quiz",
      content: JSON.stringify({
        questions: 5,
        totalPoints: 20,
        topics: ["Fundamentals", "Basics"],
      }),
    },
    {
      evalId: "quiz_002",
      name: "Quiz 2 - Databases",
      type: "quiz",
      content: JSON.stringify({
        questions: 8,
        totalPoints: 40,
        topics: ["SQL", "Schema Design"],
      }),
    },
    {
      evalId: "hw_001",
      name: "Homework 1 - SQL Queries",
      type: "homework",
      content: JSON.stringify({
        tasks: 5,
        totalPoints: 100,
        deadline: "2026-02-20",
      }),
    },
    {
      evalId: "exam_001",
      name: "Midterm Exam",
      type: "exam",
      content: JSON.stringify({
        duration: 120,
        totalPoints: 200,
        format: "Written",
        date: "2026-03-10",
      }),
    },
  ],
  students: [
    { studentId: "student_001" },
    { studentId: "student_002" },
    { studentId: "student_003" },
    { studentId: "student_004" },
    { studentId: "student_005" },
  ],
  sections: [
    {
      sectionId: "sec_001",
      description: JSON.stringify({
        title: "Fundamentals",
        topics: ["Introduction", "Basics", "Data Types"],
        weeks: "1-2",
      }),
      subsections: [
        {
          sectionId: "subsec_001_1",
          description: JSON.stringify({
            title: "Introduction to Databases",
            content: "Overview of database concepts",
          }),
        },
        {
          sectionId: "subsec_001_2",
          description: JSON.stringify({
            title: "Relational Model",
            content: "Understanding tables, rows, and columns",
          }),
        },
      ],
    },
    {
      sectionId: "sec_002",
      description: JSON.stringify({
        title: "SQL Basics",
        topics: ["SELECT", "WHERE", "JOIN"],
        weeks: "3-4",
      }),
      subsections: [
        {
          sectionId: "subsec_002_1",
          description: JSON.stringify({
            title: "SELECT Statements",
            content: "Basic query syntax",
          }),
        },
        {
          sectionId: "subsec_002_2",
          description: JSON.stringify({
            title: "Joins",
            content: "Inner, outer, and cross joins",
          }),
        },
      ],
    },
    {
      sectionId: "sec_003",
      description: JSON.stringify({
        title: "Advanced Topics",
        topics: ["Transactions", "Indexing", "Performance"],
        weeks: "5-8",
      }),
      subsections: [
        {
          sectionId: "subsec_003_1",
          description: JSON.stringify({
            title: "Transactions and ACID",
            content: "Database consistency",
          }),
        },
      ],
    },
  ],
};

/**
 * Send sample data to Neo4j
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @returns {Promise<void>}
 */
export async function sendSampleData(driver) {
  try {
    // Create the class
    console.log("Creating class...");
    await createClass(driver, sampleData.class, sampleData.creatorId);

    // Add evaluations
    console.log("Adding evaluations...");
    for (const evaluation of sampleData.evaluations) {
      await addEvaluation(
        driver,
        sampleData.class.classCode,
        evaluation.evalId,
        evaluation.name,
        evaluation.type,
        evaluation.content,
      );
    }

    // Add students
    console.log("Adding students...");
    for (const student of sampleData.students) {
      await addStudent(driver, sampleData.class.classCode, student.studentId);
    }

    // Add sections with subsections
    console.log("Adding sections...");
    for (const section of sampleData.sections) {
      await addSection(
        driver,
        sampleData.class.classCode,
        section.sectionId,
        section.description,
        true,
      );

      // Add subsections
      if (section.subsections) {
        for (const subsection of section.subsections) {
          await addSection(
            driver,
            section.sectionId,
            subsection.sectionId,
            subsection.description,
            false,
          );
        }
      }
    }

    console.log("Sample data sent successfully!");
  } catch (error) {
    console.error("Error sending sample data:", error);
    throw error;
  }
}

/**
 * Get all classes a student is enrolled in
 * @param {neo4j.Driver} driver - The Neo4j driver
 * @param {string} studentId - Student ID
 * @returns {Promise<Array>} List of classes the student is enrolled in
 */
export async function getEnrolledClasses(driver, studentId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (c:Class)-[:HAS_STUDENT]->(s:Student {studentId: $studentId})
       RETURN c`,
      { studentId },
    );
    return result.records.map((record) => record.get("c").properties);
  } finally {
    await session.close();
  }
}
