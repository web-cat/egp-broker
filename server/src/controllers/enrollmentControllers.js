const getOrAddEnrollment = async (req, res) => {
  const { studentCanvasId, courseCanvasId } = req.body;

  try {
    const course = await Course.findOne({ canvasId: courseCanvasId });
    const student = await Student.findOne({ canvasId: studentCanvasId });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    let enrollment = await Enrollment.findOne({
      courseId: course._id,
      studentId: student._id,
    });

    if (enrollment) {
      return res.status(200).json(enrollment);
    }

    enrollment = await Enrollment.create({
      courseId: course._id,
      studentId: student._id,
    });

    return res.status(201).json(enrollment);
  } catch (err) {
    console.error("Error adding or finding enrollment:", err);
    return res.status(500).json({ message: err });
  }
};

module.exports = {
  getOrAddEnrollment,
};
