const mongoose = require('mongoose');
const { Schema } = mongoose;

// Enum for FreePassType
const FreePassType = {
  EXTENSION_24H: 'EXTENSION_24H',
  QUIZ_RETAKE: 'QUIZ_RETAKE'
};

// Instructor Schema
const instructorSchema = new Schema({
  canvasId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String
});

// Student Schema
const studentSchema = new Schema({
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String
});

// Course Schema
const courseSchema = new Schema({
  canvasId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  instructorId: { type: Schema.Types.ObjectId, ref: 'Instructor', required: true }
});

// FreePass Schema
const freePassSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { 
    type: String,
    enum: Object.values(FreePassType),
    required: true
  },
  description: String,
  usedAt: Date,
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment' }
});

// Enrollment Schema
const enrollmentSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
});

// Assignment Schema
const assignmentSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true }
});

// Create models
const Instructor = mongoose.model('Instructor', instructorSchema);
const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const FreePass = mongoose.model('FreePass', freePassSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);

// Export models
module.exports = {
  Instructor,
  Student,
  Course,
  FreePass,
  Enrollment,
  Assignment,
  FreePassType // Export the enum as well
};