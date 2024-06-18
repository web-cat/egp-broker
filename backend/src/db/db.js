const { Sequelize, DataTypes } = require('sequelize');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'freepassdb',
};

// Initialize Sequelize
const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    dialect: 'mariadb',
});

// Define Models
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const Instructor = sequelize.define('Instructor', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const Course = sequelize.define('Course', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    instructorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Instructor,
            key: 'id',
        },
    },
    ltiId: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

const Subject = sequelize.define('Subject', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const Student = sequelize.define('Student', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const FreePassPool = sequelize.define('FreePassPool', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    studentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Student,
            key: 'id',
        },
    },
    passType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    initialCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    usedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
}, {
    timestamps: false,
});

const FreePassRequest = sequelize.define('FreePassRequest', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Student,
            key: 'id',
        },
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Course,
            key: 'id',
        },
    },
    reason: {
        type: DataTypes.STRING,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'requested',
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    timestamps: false,
});

const Assignment = sequelize.define('Assignment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Course,
            key: 'id',
        },
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    ltiId: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

const PassUsage = sequelize.define('PassUsage', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    freePassPoolId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: FreePassPool,
            key: 'id',
        },
    },
    assignmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Assignment,
            key: 'id',
        },
    },
    usageDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    timestamps: false,
});

const CourseEnrollment = sequelize.define('CourseEnrollment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Student,
            key: 'id',
        },
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Course,
            key: 'id',
        },
    },
    enrollmentDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

// Define Many-to-Many Relationships for Pass Types
const PassType = sequelize.define('PassType', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

// Junction table for Course and PassType
const CoursePassType = sequelize.define('CoursePassType', {
    courseId: {
        type: DataTypes.INTEGER,
        references: {
            model: Course,
            key: 'id',
        },
    },
    passTypeId: {
        type: DataTypes.INTEGER,
        references: {
            model: PassType,
            key: 'id',
        },
    },
}, {
    timestamps: false,
});

// Junction table for Assignment and PassType
const AssignmentPassType = sequelize.define('AssignmentPassType', {
    assignmentId: {
        type: DataTypes.INTEGER,
        references: {
            model: Assignment,
            key: 'id',
        },
    },
    passTypeId: {
        type: DataTypes.INTEGER,
        references: {
            model: PassType,
            key: 'id',
        },
    },
}, {
    timestamps: false,
});

// LTI ID Table to handle multiple LTI IDs for Users
const LTIId = sequelize.define('LTIId', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    ltiId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id',
        },
    },
    client: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

// Define Associations
User.hasMany(FreePassRequest, { foreignKey: 'studentId' });
Student.hasMany(FreePassRequest, { foreignKey: 'studentId' });
FreePassRequest.belongsTo(Student, { foreignKey: 'studentId' });

FreePassPool.belongsTo(Student, { foreignKey: 'studentId' });

FreePassRequest.belongsTo(Course, { foreignKey: 'courseId' });

Course.belongsTo(Instructor, { foreignKey: 'instructorId' });
Instructor.hasMany(Course, { foreignKey: 'instructorId' });

CourseEnrollment.belongsTo(Student, { foreignKey: 'studentId' });
CourseEnrollment.belongsTo(Course, { foreignKey: 'courseId' });
Student.hasMany(CourseEnrollment, { foreignKey: 'studentId' });
Course.hasMany(CourseEnrollment, { foreignKey: 'courseId' });

PassUsage.belongsTo(FreePassPool, { foreignKey: 'freePassPoolId' });
PassUsage.belongsTo(Assignment, { foreignKey: 'assignmentId' });
FreePassPool.hasMany(PassUsage, { foreignKey: 'freePassPoolId' });

Assignment.belongsTo(Course, { foreignKey: 'courseId' });
Course.hasMany(Assignment, { foreignKey: 'courseId' });

LTIId.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(LTIId, { foreignKey: 'userId' });

// Many-to-Many Associations
Course.belongsToMany(PassType, { through: CoursePassType, foreignKey: 'courseId' });
PassType.belongsToMany(Course, { through: CoursePassType, foreignKey: 'passTypeId' });

Assignment.belongsToMany(PassType, { through: AssignmentPassType, foreignKey: 'assignmentId' });
PassType.belongsToMany(Assignment, { through: AssignmentPassType, foreignKey: 'passTypeId' });

Assignment.belongsToMany(LTIId, { through: 'AssignmentLTIId', foreignKey: 'assignmentId' });
LTIId.belongsToMany(Assignment, { through: 'AssignmentLTIId', foreignKey: 'ltiId' });

Course.belongsToMany(LTIId, { through: 'CourseLTIId', foreignKey: 'courseId' });
LTIId.belongsToMany(Course, { through: 'CourseLTIId', foreignKey: 'ltiId' });

// Sync Database
sequelize.sync({ force: true }).then(() => {
    console.log('Database & tables created!');
});

module.exports = {
    sequelize,
    User,
    Instructor,
    Subject,
    Student,
    FreePassPool,
    FreePassRequest,
    PassUsage,
    Course,
    CourseEnrollment,
    Assignment,
    PassType,
    CoursePassType,
    AssignmentPassType,
    LTIId,
};
