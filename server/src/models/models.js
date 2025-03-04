const mongoose = require('mongoose');
const { Schema } = mongoose;

// Pass Schema
const passSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  passType: { 
    type: String, 
    required: true, 
    enum: ['DURATION', 'EVENT'] // DURATION for time-based passes, EVENT for single-use passes
  },
  details: {
    durationHours: { type: Number }, // Only for DURATION passType
  }
});

// Instructor Schema
const instructorSchema = new Schema({
  canvasId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String
});

// Student Schema
const studentSchema = new Schema({
  canvasId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String
});

// Course Schema
const courseSchema = new Schema({
  canvasId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  instructorId: { type: Schema.Types.ObjectId, ref: 'Instructor', required: true },
  allowedPassTypes: [{
    passId: { type: Schema.Types.ObjectId, ref: 'Pass', required: true },
    initialCount: { type: Number, required: true, default: 0 }
  }]
});

// Enrollment Schema (updated passesLeft and freePasses)
const enrollmentSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  passesLeft: [{
    passId: { type: Schema.Types.ObjectId, ref: 'Pass', required: true },
    count: { type: Number, default: 0, required: true }
  }],
  freePasses: [
    {
      passId: { type: Schema.Types.ObjectId, ref: 'Pass' },
      usedAt: { type: Date },
      assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment' }
    }
  ]
});

// Assignment Schema
const assignmentSchema = new Schema({
  title: { type: String, required: true },
  canvasId: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true }
});

// Create models
const Pass = mongoose.model('Pass', passSchema);
const Instructor = mongoose.model('Instructor', instructorSchema);
const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);

// Export models
module.exports = {
  Pass,
  Instructor,
  Student,
  Course,
  Enrollment,
  Assignment
};
