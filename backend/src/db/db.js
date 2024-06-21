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
    }
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
});

const Term = sequelize.define('Term', {
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

const CourseOffering = sequelize.define('CourseOffering', {
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
    termId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Term,
            key: 'id',
        },
    },
    sectionNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const CourseEnrollment = sequelize.define('CourseEnrollment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id',
        },
    },
    courseOfferingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: CourseOffering,
            key: 'id',
        },
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    enrolledAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

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
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tags: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    initialCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    validityPeriod: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id',
        },
    },
});

const FreePassPool = sequelize.define('FreePassPool', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    creatorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id',
        },
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id',
        },
    },
    courseOfferingId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: CourseOffering,
            key: 'id',
        },
    },
    passTypeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: PassType,
            key: 'id',
        },
        defaultValue: null
    },
    value: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "active",
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
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id',
        },
    },
    courseOfferingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: CourseOffering,
            key: 'id',
        },
    },
    passTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: PassType,
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
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    grantedAt: {
        type: DataTypes.DATE,
    },
    rejectedAt: {
        type: DataTypes.DATE,
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
    courseOfferingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: CourseOffering,
            key: 'id',
        },
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
    },
    value: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'assigned',
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    dueAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    tags: {
        type: DataTypes.STRING,
        allowNull: true,
    }
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
    usedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    timestamps: false,
});

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
User.hasMany(CourseEnrollment, { foreignKey: 'userId' });
CourseEnrollment.belongsTo(User, { foreignKey: 'userId' });

Course.hasMany(CourseOffering, { foreignKey: 'courseId' });
CourseOffering.belongsTo(Course, { foreignKey: 'courseId' });

Term.hasMany(CourseOffering, { foreignKey: 'termId' });
CourseOffering.belongsTo(Term, { foreignKey: 'termId' });

CourseOffering.hasMany(CourseEnrollment, { foreignKey: 'courseOfferingId' });
CourseEnrollment.belongsTo(CourseOffering, { foreignKey: 'courseOfferingId' });

PassType.hasMany(FreePassPool, { foreignKey: 'passTypeId' });
FreePassPool.belongsTo(PassType, { foreignKey: 'passTypeId' });

User.hasMany(FreePassPool, { foreignKey: 'userId' });
FreePassPool.belongsTo(User, { foreignKey: 'userId' });

// User.hasMany(FreePassPool, { foreignKey: 'creatorId' });
// FreePassPool.belongsTo(User, { foreignKey: 'creatorId' });

User.hasMany(FreePassRequest, { foreignKey: 'userId' });
FreePassRequest.belongsTo(User, { foreignKey: 'userId' });

CourseOffering.hasMany(FreePassPool, { foreignKey: 'courseOfferingId' });
FreePassPool.belongsTo(CourseOffering, { foreignKey: 'courseOfferingId' });

CourseOffering.hasMany(FreePassRequest, { foreignKey: 'courseOfferingId' });
FreePassRequest.belongsTo(CourseOffering, { foreignKey: 'courseOfferingId' });

PassType.hasMany(FreePassRequest, { foreignKey: 'passTypeId' });
FreePassRequest.belongsTo(PassType, { foreignKey: 'passTypeId' });

CourseOffering.hasMany(Assignment, { foreignKey: 'courseOfferingId' });
Assignment.belongsTo(CourseOffering, { foreignKey: 'courseOfferingId' });

FreePassPool.hasMany(PassUsage, { foreignKey: 'freePassId' });
PassUsage.belongsTo(FreePassPool, { foreignKey: 'freePassId' });

Assignment.hasMany(PassUsage, { foreignKey: 'assignmentId' });
PassUsage.belongsTo(Assignment, { foreignKey: 'assignmentId' });

LTIId.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(LTIId, { foreignKey: 'userId' });

// Many-to-Many Associations
CourseOffering.belongsToMany(PassType, { through: 'CourseOfferingPassType', foreignKey: 'courseOfferingId' });
PassType.belongsToMany(CourseOffering, { through: 'CourseOfferingPassType', foreignKey: 'passTypeId' });

Assignment.belongsToMany(PassType, { through: 'AssignmentPassType', foreignKey: 'assignmentId' });
PassType.belongsToMany(Assignment, { through: 'AssignmentPassType', foreignKey: 'passTypeId' });

module.exports = {
    sequelize,
    User,
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
};
