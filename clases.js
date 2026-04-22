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
  let classCode, name, description, startDate, endDate, fotoPath = null;
  classCode = data.classCode;
  name = data.name;
  description = data.description;
  startDate = data.startDate;
  endDate = data.endDate || "00/00/0000";
  fotoPath = data.fotoPath || null;

  try {
    await session.run(
      "CREATE (c:Class {classCode: $classCode, name: $name, description: $description, creatorId: $creatorId, startDate: $startDate, endDate: $endDate, fotoPath: $fotoPath})",
      { classCode, name, description, creatorId, startDate, endDate, fotoPath },
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
    } else {
      await session.run(
        `MATCH (p:Section {sectionId: $parentId})
         CREATE (s:Section {sectionId: $sectionId, description: $description}),
                (p)-[:HAS_SUBSECTION]->(s)`,
        { parentId, sectionId, description },
      );
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
    const result = await session.run(
      `MATCH (c:Class {classCode: $classCode})
       OPTIONAL MATCH (c)-[:HAS_EVALUATION]->(e:Evaluation)
       OPTIONAL MATCH (c)-[:HAS_STUDENT]->(s:Student)
       OPTIONAL MATCH (c)-[:HAS_SECTION]->(sec:Section)
       RETURN c, collect(e) as evaluations, collect(s) as students, collect(sec) as sections`,
      { classCode },
    );
    if (result.records.length === 0) return null;
    const record = result.records[0];
    return {
      class: record.get("c").properties,
      evaluations: record.get("evaluations").map((e) => e.properties),
      students: record.get("students").map((s) => s.properties),
      sections: record.get("sections").map((sec) => sec.properties),
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
export async function cloneClass(driver, sourceClassCode, newClassCode, creatorId = null) {
  const session = driver.session();
  try {
    const result = await session.run(     //https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZndxcXUxZmNnaGs3N2o1dnZyYmU0bWcyemwyaHNrMDM5Mm5sMmZlZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LrQdI5XBVw8mdMDfFN/giphy.gif 
      `MATCH (c:Class {classCode: $sourceClassCode})
       OPTIONAL MATCH (c)-[:HAS_EVALUATION]->(e:Evaluation)
       OPTIONAL MATCH (c)-[:HAS_SECTION]->(s:Section)
       OPTIONAL MATCH (c)-[:HAS_STUDENT]->(st:Student)
       WITH c, collect(DISTINCT e) as evaluations, collect(DISTINCT s) as sections, collect(DISTINCT st) as students
       CREATE (clone:Class {classCode: $newClassCode, name: c.name, description: c.description, creatorId: coalesce($creatorId, c.creatorId), startDate: c.startDate, endDate: c.endDate, fotoPath: c.fotoPath})
       WITH clone, evaluations, sections, students
       UNWIND evaluations as ev
         CREATE (ce:Evaluation {evalId: ev.evalId, name: ev.name, type: ev.type, content: ev.content})
         CREATE (clone)-[:HAS_EVALUATION]->(ce)
       WITH clone, sections, students
       UNWIND sections as sec
         CREATE (cs:Section {sectionId: sec.sectionId + '_copy', description: sec.description})
         CREATE (clone)-[:HAS_SECTION]->(cs)
       WITH clone, students
       UNWIND students as st
         MERGE (s:Student {studentId: st.studentId})
         CREATE (clone)-[:HAS_STUDENT]->(s)
       RETURN clone`,
      { sourceClassCode, newClassCode, creatorId },
    );

    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get("clone").properties;
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

export async function getCreatedClasses(driver, studentId) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n:Class{creatorId:$studentId}) RETURN n`,
      { studentId },
    );
    return result.records.map((record) => record.get("c").properties);
  } finally {
    await session.close();
  }
}
