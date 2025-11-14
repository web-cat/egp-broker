import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Dashboard} from "./dashboard";
import {StudentTable} from "./studentTable";
import InstructorDashboard from "./instructorDashboard";
import InstructorSettings from "./instructorSettings";
import {getLtik} from "@/lib/ltik";
import {CourseSwitcher} from "@/components/courseSwitcher";

export function Base({launchInfo}) {
    const {role, canvas_user_id, canvas_course_id} = launchInfo;
    // Check if user is LTI or direct login
    const isLtiUser = !!getLtik();

    const instructor_tabs = [
        {
            name: "Dashboard",
            value: "dashboard",
            component: (
                <InstructorDashboard
                    courseCanvasId={canvas_course_id}
                />
            )
        },
        {
            name: "Students",
            value: "students",
            component: <StudentTable courseCanvasId={canvas_course_id}/>,
        },
        {
            name: "Settings",
            value: "settings",
            component: <InstructorSettings
                instructorCanvasId={canvas_user_id}
            />,
        },
    ];
    const student_tabs = [
        {
            name: "Dashboard",
            value: "dashboard",
            component: (
                <Dashboard
                    studentCanvasId={canvas_user_id}
                    courseCanvasId={canvas_course_id}
                />
            ),
        },
    ];

    const settings = role == "Instructor" ? instructor_tabs : student_tabs;

    return (
        <Tabs defaultValue={settings[0].value} className="space-y-4">
            <TabsList>
                {/* Course switcher button - only for direct login instructors */}
                {role === "Instructor" && !getLtik() && (
                    <div className="mb-4">
                        <CourseSwitcher
                            currentCourseId={canvas_course_id}
                            isLtiUser={false}
                        />
                    </div>
                )}
                {settings.map((tab) => (
                    <TabsTrigger key={tab.name} value={tab.value}>
                        {tab.name}
                    </TabsTrigger>
                ))}
            </TabsList>

            {settings.map((tab) => (
                <TabsContent value={tab.value}>{tab.component}</TabsContent>
            ))}
        </Tabs>
    );
}
