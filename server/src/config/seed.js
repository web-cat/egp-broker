require('dotenv').config();
const mongoose = require('mongoose');
const { 
  Instructor, 
  Student, 
  Course, 
  CoursePassType, 
  FreePass, 
  Enrollment, 
  Assignment,
  FreePassType 
} = require('../models/models'); // Adjust path as needed
const connectWithRetry = require('./db');

async function clearDatabase() {
  await Promise.all([
    Instructor.deleteMany({}),
    Student.deleteMany({}),
    Course.deleteMany({}),
    CoursePassType.deleteMany({}),
    FreePass.deleteMany({}),
    Enrollment.deleteMany({}),
    Assignment.deleteMany({})
  ]);
  console.log('Database cleared');
}

async function seedDatabase() {
  try {
    await connectWithRetry();
    await clearDatabase();

    // Create Instructors
    const instructors = await Instructor.create([
      {
        ltiId: 'lti_inst_1',
        canvasId: 'canvas_inst_1',
        email: 'professor1@university.edu',
        firstName: 'John',
        lastName: 'Smith'
      },
      {
        ltiId: 'lti_inst_2',
        canvasId: 'canvas_inst_2',
        email: 'professor2@university.edu',
        firstName: 'Jane',
        lastName: 'Doe'
      }
    ]);

    // Create Students
    const students = await Student.create([
      {
        email: 'student1@university.edu',
        firstName: 'Alice',
        lastName: 'Johnson'
      },
      {
        email: 'student2@university.edu',
        firstName: 'Bob',
        lastName: 'Wilson'
      }
    ]);

    // Create Courses
    const courses = await Course.create([
      {
        ltiId: 'lti_course_1',
        canvasId: 'canvas_course_1',
        title: 'Introduction to Computer Science',
        description: 'Fundamentals of programming and computer science',
        instructorId: instructors[0]._id
      },
      {
        ltiId: 'lti_course_2',
        canvasId: 'canvas_course_2',
        title: 'Advanced Mathematics',
        description: 'Complex mathematical concepts and applications',
        instructorId: instructors[1]._id
      }
    ]);

    // Create Assignments
    const assignments = await Assignment.create([
      {
        title: 'Programming Project 1',
        description: 'Build a simple calculator application',
        dueDate: new Date('2025-03-15'),
        courseId: courses[0]._id
      },
      {
        title: 'Math Final Exam',
        description: 'Comprehensive exam covering all topics',
        dueDate: new Date('2025-04-01'),
        courseId: courses[1]._id
      }
    ]);

    // Create CoursePassTypes
    const coursePassTypes = await CoursePassType.create([
      {
        courseId: courses[0]._id,
        passType: FreePassType.EXTENSION_24H
      },
      {
        courseId: courses[1]._id,
        passType: FreePassType.QUIZ_RETAKE
      }
    ]);

    // Create Enrollments
    const enrollments = await Enrollment.create([
      {
        studentId: students[0]._id,
        courseId: courses[0]._id,
        enrolledAt: new Date()
      },
      {
        studentId: students[1]._id,
        courseId: courses[1]._id,
        enrolledAt: new Date()
      }
    ]);

    // Create FreePasses
    const freePasses = await FreePass.create([
      {
        studentId: students[0]._id,
        type: FreePassType.EXTENSION_24H,
        description: '24-hour extension for Project 1',
        reason: 'Medical emergency',
        courseId: courses[0]._id,
        assignmentId: assignments[0]._id,
        remaining: 1
      },
      {
        studentId: students[1]._id,
        type: FreePassType.QUIZ_RETAKE,
        description: 'Quiz retake pass',
        reason: 'Technical issues during first attempt',
        courseId: courses[1]._id,
        assignmentId: assignments[1]._id,
        remaining: 1
      }
    ]);

    console.log('Database seeded successfully!');
    console.log(`Created:
      - ${instructors.length} instructors
      - ${students.length} students
      - ${courses.length} courses
      - ${assignments.length} assignments
      - ${coursePassTypes.length} course pass types
      - ${enrollments.length} enrollments
      - ${freePasses.length} free passes`);

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seeder
seedDatabase();