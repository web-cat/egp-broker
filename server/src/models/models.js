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
  canvasId: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  canvasApiKey: { type: String } // Optional field to store Canvas API key
}, { timestamps: true }); // Adds createdAt and updatedAt fields
instructorSchema.index({ canvasId: 1 }, { unique: true });

// Student Schema
const studentSchema = new Schema({
  canvasId: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String
});
studentSchema.index({ canvasId: 1 }, { unique: true });

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
  canvasId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  dueDate: { type: Date },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  assignment_group_name: { type: String },
  external_tool_tag_attributes: { type: Schema.Types.Mixed },
  published: { type: Boolean },
  points_possible: { type: Number },
  // Store any other Canvas fields for future flexibility
  canvasData: { type: Schema.Types.Mixed }
}, { timestamps: true });
assignmentSchema.index({ canvasId: 1, courseId: 1 }, { unique: true });

//tool mapping schema
const ProxySchema = new mongoose.Schema({
  deploymentId: {
    type: String,
    required: true,
    index: true
  },
  resourceLinkId: {
    type: String,
    required: true,
    index: true
  },
  toolType: {
    type: String,
    required: true,
    enum: ['opendsa11', 'opendsa13']
  },
  ltiVersion: {
    type: String,
    required: true,
    enum: ['lti11', 'lti13']
  },
  ltiConfig: {
    consumerKey: String,
    sharedSecret: String,
    launchUrl: String,
  },
  lastConfiguredAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });
ProxySchema.index({ deploymentId: 1, resourceLinkId: 1 }, { unique: true });

// Create models
const Pass = mongoose.model('Pass', passSchema);
const Instructor = mongoose.model('Instructor', instructorSchema);
const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const Proxy = mongoose.model('Proxy', ProxySchema);

// Export models
module.exports = {
  Pass,
  Instructor,
  Student,
  Course,
  Enrollment,
  Assignment,
  Proxy
};
