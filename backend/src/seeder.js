// seeder.js

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const {
    User,
    Course,
    CourseEnrollment,
    PassType,
    Assignment,
    Term,
    CourseOffering,
    LTIId,
    Tool,
    Admin
} = require("./models/models");

const seedDatabase = async () => {
    try {
        const hashedPassword = await bcrypt.hash('12345678', 10);
         await Admin.create({
            name: 'Admin',
            email: 'admin@test.test',
            password: hashedPassword
        });

        await Tool.create({
            toolId: 'demo',
            clientId: 'demo',
            clientId: 'demo',
            clientSecret: '12345678',
            publicKey: 'demo',
            privateKey: '12345678',
            grants: ['password']
          });
          await Admin.create([

          ])
        // Create terms
        const terms = await Term.create([
            { name: 'Fall 2024' },
            { name: 'Spring 2025' },
        ]);
        const jharana = { id: new mongoose.Types.ObjectId() };
        const admin = { id: new mongoose.Types.ObjectId() };  
        const user = { id: new mongoose.Types.ObjectId() };
        const anisha = { id: new mongoose.Types.ObjectId() };

        // Create users for instructors
        await User.create([
            { _id: jharana.id, name: 'Jharana', email: 'jharana@test.test', password: hashedPassword, role: 'user' },
            { _id: admin.id, name: 'admin', email: 'admin@test.test', password: hashedPassword, role: 'admin' },
            { _id: user.id, name: 'user', email: 'user@test.test', password: hashedPassword, role: 'user' },
            { _id: anisha.id, name: 'Anisha', email: 'anisha@test.test', password: hashedPassword, role: 'admin' },
        ]);

        await LTIId.create([
            { ltiId: 'jharana_canvas', userId: jharana.id, client: 'canvas' },
            { ltiId: 'anisha_canvas', userId: anisha.id, client: 'canvas' },
        ]);

        // Create courses
        const courses = await Course.create([
            { name: 'Math' },
            { name: 'Science' },
            { name: 'English' },
            { name: 'Computer Science' },
        ]);

        // Create course offerings with multiple sections
        const courseOfferings = await CourseOffering.create([
            { courseId: courses[0]._id, termId: terms[0]._id, sectionNumber: 'A' },
            { courseId: courses[1]._id, termId: terms[0]._id, sectionNumber: 'A' },
            { courseId: courses[2]._id, termId: terms[0]._id, sectionNumber: 'A' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '1' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '2' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '3' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '5' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '6' },
        ]);

        // Assign instructors to course offerings
        await CourseEnrollment.create([
            { userId: jharana.id, courseOfferingId: courseOfferings[0]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[1]._id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: courseOfferings[2]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[3]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[4]._id, role: 'ta' },
            { userId: anisha.id, courseOfferingId: courseOfferings[4]._id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: courseOfferings[5]._id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: courseOfferings[6]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[7]._id, role: 'ta' },
        ]);

        // Create students
        const students = [
            { name: 's1', id: new mongoose.Types.ObjectId() },
            { name: 's2', id: new mongoose.Types.ObjectId() },
            { name: 's3', id: new mongoose.Types.ObjectId() },
            { name: 's4', id: new mongoose.Types.ObjectId() },
            { name: 's5', id: new mongoose.Types.ObjectId() },
            { name: 's6', id: new mongoose.Types.ObjectId() },
        ];

        // Create users for students and assign LTI IDs
        for (const student of students) {
            await User.create({ _id: student.id, name: student.name, email: `${student.name.toLowerCase()}@test.test`, password: hashedPassword });
            await LTIId.create({ ltiId: `${student.name.toLowerCase()}_canvas`, userId: student.id, client: 'canvas' });
        }

        // Enroll students in course offerings
        const enrollments = [
            { userId: students[0].id, courseOfferingId: courseOfferings[0]._id, role: 'student' },
            { userId: students[0].id, courseOfferingId: courseOfferings[1]._id, role: 'student' },
            { userId: students[1].id, courseOfferingId: courseOfferings[2]._id, role: 'student' },
            { userId: students[2].id, courseOfferingId: courseOfferings[0]._id, role: 'student' },
            { userId: students[3].id, courseOfferingId: courseOfferings[1]._id, role: 'student' },
            { userId: students[3].id, courseOfferingId: courseOfferings[2]._id, role: 'student' },
            { userId: students[4].id, courseOfferingId: courseOfferings[0]._id, role: 'student' },
            { userId: students[5].id, courseOfferingId: courseOfferings[2]._id, role: 'student' },
            { userId: students[0].id, courseOfferingId: courseOfferings[3]._id, role: 'student' },
            { userId: students[1].id, courseOfferingId: courseOfferings[4]._id, role: 'student' },
            { userId: students[2].id, courseOfferingId: courseOfferings[5]._id, role: 'student' },
            { userId: students[3].id, courseOfferingId: courseOfferings[6]._id, role: 'student' },
            { userId: students[4].id, courseOfferingId: courseOfferings[7]._id, role: 'student' },
        ];

        await CourseEnrollment.create(enrollments);

        // Seed Assignments
        const assignments = [
            {
                courseOfferingId: courseOfferings[0]._id,
                title: 'Math Assignment 1',
                description: 'Solve problems from Chapter 1',
                value: 10,
                status: 'assigned',
                dueAt: new Date('2024-09-30'),
                tags: 'Class'
            },
            {
                courseOfferingId: courseOfferings[0]._id,
                title: 'Exam Assignment Test',
                description: 'Solve Exam problems from Chapter 1',
                value: 12,
                status: 'assigned',
                dueAt: new Date('2024-09-30'),
                tags: 'Exam'
            },
            {
                courseOfferingId: courseOfferings[0]._id,
                title: 'Exam/Class Assignment Test',
                description: 'Solve Exam/Class problems from Chapter 1',
                value: 22,
                status: 'assigned',
                dueAt: new Date('2024-09-30'),
                tags: 'Exam,Class'
            },
            {
                courseOfferingId: courseOfferings[1]._id,
                title: 'Science Assignment 1',
                description: 'Write a report on Photosynthesis',
                value: 15,
                status: 'assigned',
                dueAt: new Date('2024-10-05'),
                tags: 'Class'
            },
            {
                courseOfferingId: courseOfferings[2]._id,
                title: 'English Midterm Exam',
                description: 'Complete the midterm exam',
                value: 50,
                status: 'assigned',
                dueAt: new Date('2024-10-15'),
                tags: 'Exam, Term End'
            },
            {
                courseOfferingId: courseOfferings[3]._id,
                title: 'CS Project 1',
                description: 'Build a basic website',
                value: 20,
                status: 'assigned',
                dueAt: new Date('2024-11-01'),
                tags: 'Class'
            }
        ];

        await Assignment.create(assignments);

        //  Seed PassTypes
        const passTypes = [
            {
                name: 'General Free Pass',
                tags: 'Class',
                initialCount: 10,
                validityPeriod: 30 // 30 days
            },
            {
                name: 'Exam Pass',
                tags: 'Exam',
                initialCount: 5,
                validityPeriod: 15 // 15 days
            },
            {
                name: 'Term End Pass',
                tags: 'Term End',
                initialCount: 2,
                validityPeriod: 10 // 10 days
            }
        ];

        await PassType.create(passTypes);

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

module.exports = {seedDatabase};