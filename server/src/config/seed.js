require('dotenv').config();

const mongoose = require('mongoose');
const { Instructor, Student, Course, Enrollment, Assignment, Pass } = require('../models/models');
const connectWithRetry = require('./db');

const seedDatabase = async () => {
  try {
    await connectWithRetry();
    await mongoose.connection.dropDatabase();

    // Create Passes
    const extensionPass = await Pass.create({
      name: '24-Hour Extension',
      description: 'Extends assignment deadline by 24 hours.',
      passType: 'DURATION',
      details: { durationHours: 24 }
    });

    const quizRetakePass = await Pass.create({
      name: 'Quiz Retake',
      description: 'Allows a retake of one quiz.',
      passType: 'EVENT',
      details: {}
    });

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

    // Create Courses with allowedPassTypes (referencing Pass documents)
    const course1 = await Course.create({
      canvasId: 'course001',
      title: 'Introduction to Programming',
      description: 'Learn the basics of programming.',
      instructorId: instructor1._id,
      allowedPassTypes: [
        { passId: extensionPass._id, initialCount: 3 },
        { passId: quizRetakePass._id, initialCount: 2 }
      ]
    });

    const course2 = await Course.create({
      canvasId: 'course002',
      title: 'Data Structures and Algorithms',
      description: 'Learn about data structures and algorithms.',
      instructorId: instructor1._id,
      allowedPassTypes: [
        { passId: extensionPass._id, initialCount: 2 },
      ]
    });

    // Create Assignments
    const assignment1 = await Assignment.create({
      title: 'Assignment 1',
      description: 'First assignment.',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      courseId: course1._id
    });

    const assignment2 = await Assignment.create({
      title: 'Assignment 2',
      description: 'Second assignment.',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Due in 14 days
      courseId: course1._id
    });

    const assignment3 = await Assignment.create({
      title: 'Assignment 3',
      description: 'Third assignment.',
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // Due in 21 days
      courseId: course2._id
    });

    // Create Enrollments with used free passes (referencing Pass documents)
    await Enrollment.create({
      studentId: student1._id,
      courseId: course1._id,
      passesLeft: [
        {
          passId: extensionPass._id,
          count: 3
        },
        {
          passId: quizRetakePass._id,
          count: 2
        }
      ],
      freePasses: [
        {
          passId: extensionPass._id,
          usedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Used 2 days ago
          assignmentId: assignment1._id
        }
      ]
    });

    await Enrollment.create({
      studentId: student2._id,
      courseId: course1._id,
      passesLeft: [
        {
          passId: extensionPass._id,
          count: 3
        },
        {
          passId: quizRetakePass._id,
          count: 2
        }
      ],
      freePasses: [
        {
          passId: quizRetakePass._id,
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