

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

const FreePass = sequelize.define('FreePass', {
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
    instructorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Instructor,
            key: 'id',
        },
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Course,
            key: 'id',
        },
    },
    value: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'active', // inactive, used
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
});


const PassUsage = sequelize.define('PassUsage', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    freePassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: FreePass,
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


// Define Associations
User.hasMany(FreePassRequest, { foreignKey: 'studentId' });
Student.hasMany(FreePassRequest, { foreignKey: 'studentId' });
FreePassRequest.belongsTo(Student, { foreignKey: 'studentId' });

FreePass.belongsTo(Student, { foreignKey: 'studentId' });
FreePass.belongsTo(Instructor, { foreignKey: 'instructorId' });
FreePass.belongsTo(Course, { foreignKey: 'courseId' });

FreePassRequest.belongsTo(Course, { foreignKey: 'courseId' });

Course.belongsTo(Instructor, { foreignKey: 'instructorId' });
Instructor.hasMany(Course, { foreignKey: 'instructorId' });

CourseEnrollment.belongsTo(Student, { foreignKey: 'studentId' });
CourseEnrollment.belongsTo(Course, { foreignKey: 'courseId' });
Student.hasMany(CourseEnrollment, { foreignKey: 'studentId' });
Course.hasMany(CourseEnrollment, { foreignKey: 'courseId' });

PassUsage.belongsTo(FreePass, { foreignKey: 'freePassId' });
PassUsage.belongsTo(Assignment, { foreignKey: 'assignmentId' });
FreePass.hasMany(PassUsage, { foreignKey: 'freePassId' });

Assignment.belongsTo(Course, { foreignKey: 'courseId' });
Course.hasMany(Assignment, { foreignKey: 'courseId' });

module.exports = {
    sequelize,
    User,
    Instructor,
    Subject,
    Student,
    FreePass,
    FreePassRequest,
    PassUsage,
    Course,
    CourseEnrollment,
    Assignment,
};
