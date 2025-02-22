require('dotenv').config();

const mongoose = require('mongoose');
const { Instructor, Student, Course, Enrollment, Assignment, FreePassType } = require('../models/models');
const connectWithRetry = require('./db');

const seedDatabase = async () => {
  try {
    await connectWithRetry();
    await mongoose.connection.dropDatabase();

    // Create Instructors
    const instructor1 = await Instructor.create({
      canvasId: 'inst001',
      email: 'instructor1@example.com',
      firstName: 'John',
      lastName: 'Doe'
    });

    // Create Students
    const student1 = await Student.create({
      canvasId: 'stud001',
      email: 'student1@example.com',
      firstName: 'Jane',
      lastName: 'Smith'
    });

    const student2 = await Student.create({
      canvasId: 'stud002',
      email: 'student2@example.com',
      firstName: 'Alice',
      lastName: 'Johnson'
    });

    // Create Courses with allowedPassTypes
    const course1 = await Course.create({
      canvasId: 'course001',
      title: 'Introduction to Programming',
      description: 'Learn the basics of programming.',
      instructorId: instructor1._id,
      allowedPassTypes: [FreePassType.EXTENSION_24H, FreePassType.QUIZ_RETAKE]
    });

    // Create Assignments
    const assignment1 = await Assignment.create({
      title: 'Assignment 1',
      description: 'First assignment.',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      courseId: course1._id
    });

    // Create Enrollments with used free passes
    await Enrollment.create({
      studentId: student1._id,
      courseId: course1._id,
      passesLeft: {
        EXTENSION_24H: 2,
        QUIZ_RETAKE: 1
      },
      freePasses: [
        {
          type: FreePassType.EXTENSION_24H,
          usedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Used 2 days ago
          assignmentId: assignment1._id
        }
      ]
    });

    await Enrollment.create({
      studentId: student2._id,
      courseId: course1._id,
      passesLeft: {
        EXTENSION_24H: 1,
        QUIZ_RETAKE: 2
      },
      freePasses: [
        {
          type: FreePassType.QUIZ_RETAKE,
          usedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Used 1 day ago
          assignmentId: assignment1._id
        }
      ]
    });

    console.log('Database seeded successfully!');
    mongoose.connection.close();
  } catch (err) {
    console.error('Error seeding database:', err);
    mongoose.connection.close();
  }
};

seedDatabase();