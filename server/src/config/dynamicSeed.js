require('dotenv').config();

const mongoose = require('mongoose');
const { Instructor, Student, Course, Enrollment, Assignment, Pass } = require('../models/models');
const connectWithRetry = require('./db');

// --- Argument Parsing ---
const argv = require('minimist')(process.argv.slice(2));
const canvasId = argv.canvasId || argv['canvasId'];
const numStudents = parseInt(argv.students || argv['students'] || 5, 10);

if (!canvasId) {
  console.error('Usage: node dynamicSeed.js --canvasId=<courseCanvasId> [--students=<number>]');
  process.exit(1);
}

function randomName() {
  const first = ['Alex', 'Sam', 'Jamie', 'Taylor', 'Jordan', 'Morgan', 'Casey', 'Riley', 'Drew', 'Avery'];
  const last = ['Smith', 'Johnson', 'Lee', 'Brown', 'Garcia', 'Martinez', 'Davis', 'Clark', 'Lewis', 'Walker'];
  return {
    firstName: first[Math.floor(Math.random() * first.length)],
    lastName: last[Math.floor(Math.random() * last.length)]
  };
}

function randomEmail(firstName, lastName) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random()*10000)}@example.com`;
}

function randomCanvasId() {
  return 'stud' + Math.floor(Math.random() * 1000000);
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

async function main() {
  await connectWithRetry();

  // 1. Find the course
  const course = await Course.findOne({ canvasId }).populate('allowedPassTypes.passId');
  if (!course) {
    console.error(`Course with canvasId ${canvasId} not found.`);
    process.exit(1);
  }

  // 2. Find assignments for this course
  const assignments = await Assignment.find({ courseId: course._id });
  if (assignments.length === 0) {
    console.warn('No assignments found for this course. Passes will be marked as used but not linked to assignments.');
  }

  // 3. Get allowed passes for this course
  const allowedPassTypes = course.allowedPassTypes;
  if (!allowedPassTypes || allowedPassTypes.length === 0) {
    console.warn('No allowed passes for this course. Students will be enrolled without passes.');
  }

  const createdStudents = [];
  const createdEnrollments = [];

  for (let i = 0; i < numStudents; i++) {
    // 4. Create student
    const { firstName, lastName } = randomName();
    const email = randomEmail(firstName, lastName);
    const canvasId = randomCanvasId();
    const student = await Student.create({ canvasId, email, firstName, lastName });
    createdStudents.push(student);

    // 5. Prepare passesLeft
    const passesLeft = allowedPassTypes.map(pt => ({ passId: pt.passId._id, count: pt.initialCount }));

    // 6. Randomly use some passes and decrement passesLeft
    const freePasses = [];
    for (const pt of allowedPassTypes) {
      // 50% chance to use at least one pass of this type
      if (Math.random() < 0.5 && assignments.length > 0 && pt.initialCount > 0) {
        const numUsed = getRandomInt(pt.initialCount + 1); // up to initialCount
        for (let j = 0; j < numUsed; j++) {
          const assignment = assignments[getRandomInt(assignments.length)];
          freePasses.push({
            passId: pt.passId._id,
            usedAt: new Date(Date.now() - getRandomInt(7) * 24 * 60 * 60 * 1000), // used up to 7 days ago
            assignmentId: assignment._id
          });
          // Decrement passesLeft for this pass type
          const pl = passesLeft.find(p => p.passId.equals(pt.passId._id));
          if (pl && pl.count > 0) {
            pl.count -= 1;
          }
        }
      }
    }

    // 7. Create enrollment
    const enrollment = await Enrollment.create({
      studentId: student._id,
      courseId: course._id,
      passesLeft,
      freePasses
    });
    createdEnrollments.push(enrollment);
  }

  // --- Summary ---
  console.log(`\nSeeded ${createdStudents.length} students and enrollments for course '${course.title}' (${course.canvasId})`);
  for (let i = 0; i < createdStudents.length; i++) {
    const s = createdStudents[i];
    const e = createdEnrollments[i];
    console.log(`\nStudent: ${s.firstName} ${s.lastName}`);
    console.log(`  Email: ${s.email}`);
    console.log(`  Canvas ID: ${s.canvasId}`);
    // Passes left
    if (e.passesLeft && e.passesLeft.length > 0) {
      console.log('  Passes Left:');
      for (const pl of e.passesLeft) {
        // Find pass type name
        const passType = course.allowedPassTypes.find(pt => pt.passId._id.equals(pl.passId));
        const passName = passType ? passType.passId.name : pl.passId.toString();
        console.log(`    - ${passName}: ${pl.count}`);
      }
    } else {
      console.log('  Passes Left: None');
    }
    // Passes used
    if (e.freePasses && e.freePasses.length > 0) {
      console.log(`  Passes Used (${e.freePasses.length}):`);
      for (const fp of e.freePasses) {
        // Find pass type name
        const passType = course.allowedPassTypes.find(pt => pt.passId._id.equals(fp.passId));
        const passName = passType ? passType.passId.name : fp.passId.toString();
        // Find assignment title
        let assignmentTitle = '';
        if (fp.assignmentId && Array.isArray(assignments)) {
          const assignment = assignments.find(a => a._id.equals(fp.assignmentId));
          assignmentTitle = assignment ? assignment.title : fp.assignmentId.toString();
        }
        const usedAtStr = fp.usedAt ? new Date(fp.usedAt).toLocaleString() : 'N/A';
        console.log(`    - ${passName} on assignment: ${assignmentTitle} at ${usedAtStr}`);
      }
    } else {
      console.log('  Passes Used: None');
    }
  }

  mongoose.connection.close();
}

main().catch(err => {
  console.error('Error during dynamic seeding:', err);
  mongoose.connection.close();
}); 