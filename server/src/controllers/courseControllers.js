const { Course } = require("../models/models");

const getCourse = async (canvasId) => {
    try {
        let course = await Course.findOne({ canvasId });
        return course;
    }
    catch (err) {
        console.error("Error finding course:", err);
        return err
    }
}

const addCourse = async (courseData) => {
    try {
        let course = await Course.create(courseData);
        return course;
    }
    catch (err) {
        console.error("Error adding course:", err);
        return err;
    }
}

module.exports = {
    addCourse,
    getCourse,
};

