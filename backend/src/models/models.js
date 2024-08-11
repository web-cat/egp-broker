const mongoose = require('mongoose');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'freepassdb',
};

// Connect to MongoDB
const mongoURI = `mongodb://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}/${dbConfig.database}`;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Define Schemas and Models
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    }
});

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    }
});

const toolSchema = new mongoose.Schema({
    toolId: String,
    clientId: String,
    clientSecret: String,
    publicKey: String,
    privateKey: String,
    grants: [String]
});

const tokenSchema = new mongoose.Schema({
    accessToken: String,
    accessTokenExpiresAt: Date,
    refreshToken: String,
    refreshTokenExpiresAt: Date,
    scope: String,
    toolId: String,
    userId: String
});


const courseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
});

const termSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
});

const courseOfferingSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    termId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Term',
        required: true,
    },
    sectionNumber: {
        type: String,
        required: true,
    },
});

const courseEnrollmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    courseOfferingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseOffering',
        required: true,
    },
    role: {
        type: String,
        required: true,
    },
    enrolledAt: {
        type: Date,
        default: Date.now,
    },
});

const passTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: String,
    tags: String,
    initialCount: Number,
    validityPeriod: Number,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
});

const freePassPoolSchema = new mongoose.Schema({
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    courseOfferingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseOffering',
    },
    passTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PassType',
        default: null
    },
    value: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        default: "active",
    },
}, {
    timestamps: false,
});

const freePassRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    courseOfferingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseOffering',
        required: true,
    },
    passTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PassType',
        required: true,
    },
    reason: String,
    status: {
        type: String,
        default: 'requested', // could be 'requested', 'granted', or 'failed'
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    grantedAt: Date,
    rejectedAt: Date,
    freePassPoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FreePassPool',
    },
}, {
    timestamps: false,
});

const assignmentSchema = new mongoose.Schema({
    courseOfferingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseOffering',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: String,
    value: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        default: 'assigned',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    dueAt: {
        type: Date,
        required: true,
    },
    tags: String,
});

const passUsageSchema = new mongoose.Schema({
    freePassId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FreePassPool',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        required: true,
    },
    status: {
        type: String,
        default: 'success', //success, failed
    },
    usedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: false,
});

const ltiIdSchema = new mongoose.Schema({
    ltiId: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    client: {
        type: String,
        required: true,
    },
});

const assignmentPassTypeSchema = new mongoose.Schema({
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
    },
    passTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PassType',
    },
}, {
    timestamps: false,
});

// Create Models
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);

const Course = mongoose.model('Course', courseSchema);
const Term = mongoose.model('Term', termSchema);
const CourseOffering = mongoose.model('CourseOffering', courseOfferingSchema);
const CourseEnrollment = mongoose.model('CourseEnrollment', courseEnrollmentSchema);
const PassType = mongoose.model('PassType', passTypeSchema);
const FreePassPool = mongoose.model('FreePassPool', freePassPoolSchema);
const FreePassRequest = mongoose.model('FreePassRequest', freePassRequestSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);
const PassUsage = mongoose.model('PassUsage', passUsageSchema);
const LTIId = mongoose.model('LTIId', ltiIdSchema);
const AssignmentPassType = mongoose.model('AssignmentPassType', assignmentPassTypeSchema);

const Tool = mongoose.model('Tool', toolSchema);
const Token = mongoose.model('Token', tokenSchema);

module.exports = {
    mongoose,
    User,
    Admin,
    Course,
    Term,
    CourseOffering,
    CourseEnrollment,
    PassType,
    FreePassPool,
    FreePassRequest,
    Assignment,
    PassUsage,
    LTIId,
    Tool,
    Token,
};
