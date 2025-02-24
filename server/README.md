# EGP-Broker LTI 1.3 Server

> If you make a change to the LTI Developer key, delete and reinstall the tool for each course

## File Structure

```bash
server/
├── README.md
├── app.js
├── package-lock.json
├── package.json
└── src
    ├── config
    │   ├── db.js
    │   └── seed.js
    ├── controllers
    │   ├── courseControllers.js
    │   ├── enrollmentControllers.js
    │   ├── instructorController.js
    │   ├── ltiController.js
    │   ├── passControllers.js
    │   └── studnetControllers.js
    ├── middleware
    ├── models
    │   └── models.js
    └── routes
        ├── apiRoutes.js
        ├── assignmentRoutes.js
        ├── courseRoutes.js
        ├── enrollmentRoutes.js
        ├── index.js
        ├── ltiRoutes.js
        ├── passRoutes.js
        └── studentRoutes.js
```

## API Reference

### LTI Routes

#### `POST /lti/grade`

- **Description**: Submits a grade for a user.
- **Request Body**:

  ```json
  {
    "grade": number
  }
  ```

- **Response**:
  - `200 OK`: Grade submitted successfully.
  - `500 Internal Server Error`: Error message.

#### `GET /lti/members`

- **Description**: Retrieves the members of the course.
- **Response**:
  - `200 OK`: List of members.
  - `500 Internal Server Error`: Error message.

#### `POST /lti/deeplink`

- **Description**: Creates a deep linking form.
- **Request Body**:

  ```json
  {
    "name": string,
    "value": string
  }
  ```

- **Response**:
  - `200 OK`: Deep linking form.
  - `500 Internal Server Error`: Error message.

#### `GET /lti/resources`

- **Description**: Retrieves available deep linking resources.
- **Response**:
  - `200 OK`: List of resources.

#### `GET /lti/info`

- **Description**: Retrieves user and context information.
- **Response**:
  - `200 OK`: User and context information.

#### `GET /lti/course_info`

- **Description**: Retrieves course information for instructors.
- **Response**:
  - `200 OK`: Course information.
  - `403 Forbidden`: Unauthorized access.

### API Routes

#### `GET /api`

- **Description**: Dummy route for GET request.
- **Response**:
  - `200 OK`: Success message.

#### `GET /api/enrollment/:courseCanvasId`

- **Description**: Retrieves enrollments for a course.
- **Query Parameters**:
  - `studentCanvasId` (optional): Canvas ID of the student.
- **Response**:
  - `200 OK`: List of enrollments.
  - `404 Not Found`: Course or student not found.
  - `500 Internal Server Error`: Error message.

#### `GET /api/assignment/:courseCanvasId`

- **Description**: Retrieves assignments for a course.
- **Response**:
  - `200 OK`: List of assignments.
  - `404 Not Found`: Course not found.
  - `500 Internal Server Error`: Error message.

#### `GET /api/pass`

- **Description**: Retrieves all passes.
- **Response**:
  - `200 OK`: List of passes.
  - `500 Internal Server Error`: Error message.

#### `POST /api/course/add`

- **Description**: Adds a new course.
- **Request Body**:

  ```json
  {
    "courseCanvasId": string,
    "title": string,
    "description": string,
    "instructorCanvasId": string,
    "allowedPassTypes": [
      {
        "passId": string,
        "initialCount": number
      }
    ]
  }
  ```

- **Response**:
  - `201 Created`: Course added successfully.
  - `500 Internal Server Error`: Error message.

### Student Routes

#### `GET /api/student`

- **Description**: Retrieves all students or filters by course.
- **Query Parameters**:
  - `course` (optional): Course ID to filter students.
- **Response**:
  - `200 OK`: List of students.
  - `500 Internal Server Error`: Error message.

#### `GET /api/student/:id`

- **Description**: Retrieves a student by ID.
- **Response**:
  - `200 OK`: Student information.
  - `404 Not Found`: Student not found.
  - `500 Internal Server Error`: Error message.

#### `POST /api/student`

- **Description**: Creates a new student.
- **Request Body**:

  ```json
  {
    "name": string,
    "age": number,
    "major": string,
    "course": string
  }
  ```

- **Response**:
  - `201 Created`: Student created successfully.
  - `400 Bad Request`: Validation error.
  - `500 Internal Server Error`: Error message.

#### `PATCH /api/student/:id`

- **Description**: Updates a student by ID.
- **Request Body**:

  ```json
  {
    "name": string,
    "age": number,
    "major": string,
    "course": string
  }
  ```

- **Response**:
  - `200 OK`: Student updated successfully.
  - `400 Bad Request`: Validation error.
  - `404 Not Found`: Student not found.
  - `500 Internal Server Error`: Error message.

#### `DELETE /api/student/:id`

- **Description**: Deletes a student by ID.
- **Response**:
  - `200 OK`: Student deleted successfully.
  - `404 Not Found`: Student not found.
  - `500 Internal Server Error`: Error message.

## Roadmap

- com.instructure.User.student_view

## FAQ

- What data can I get from Canvas?
  - <https://canvas.instructure.com/doc/api/file.tools_variable_substitutions.html>
