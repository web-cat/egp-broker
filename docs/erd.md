erDiagram
USER ||--o{ LTI_IDENTITY : has
USER ||--o{ ENROLLMENT : has
USER ||--o{ PASS_POOL : has
USER ||--o{ LTI_RESULT : has

    LTI_PLATFORM ||--o{ LTI_DEPLOYMENT : has
    LTI_PLATFORM ||--o{ LTI_IDENTITY : identifies
    LTI_PLATFORM ||--o{ LTI_TOOL : registers

    LTI_DEPLOYMENT ||--o{ COURSE : contains
    LTI_DEPLOYMENT ||--o{ LTI_IDENTITY : scopes

    COURSE ||--o{ ENROLLMENT : has
    COURSE ||--o{ ASSIGNMENT : contains
    COURSE ||--o{ PASS_TYPE : defines

    ASSIGNMENT ||--o{ PASS_ELIGIBILITY : has
    ASSIGNMENT ||--o{ PASS_REDEMPTION : records
    ASSIGNMENT ||--o{ LTI_RESULT : reports

    PASS_TYPE ||--o{ PASS_ELIGIBILITY : applies_to
    PASS_TYPE ||--o{ PASS_PROMPT : requires
    PASS_TYPE ||--o{ PASS_POOL : manages

    PASS_POOL ||--o{ PASS_REDEMPTION : funds

    LTI_TOOL ||--o{ ASSIGNMENT : handles

    class USER {
        string id
        string email
        string globalRole
    }
    class COURSE {
        string id
        string ltiContextId
        string canvasCourseId
    }
    class ASSIGNMENT {
        string id
        string canvasAssignmentId
        datetime dueDate
    }
    class PASS_TYPE {
        string name
        float hoursPerPass
        int initialBalance
    }
