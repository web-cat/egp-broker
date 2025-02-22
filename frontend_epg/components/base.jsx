import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentTable } from "./assignmnetTable";
import { Dashboard } from "./dashboard";
import { StudentTable } from "./studentTable";
import { PassTable } from "./passTable";

const instructor_tabs = [
  // {
  //   name: "Students",
  //   value: "students",
  //   component: <StudentTable />,
  // },
  {
    name: "Assignments",
    value: "assignments",
    component: <AssignmentTable />,
  },
  {
    name: "Passes",
    value: "passes",
    component: <PassTable />,
  }
];

const student_tabs = [
  {
    name: "Dashboard",
    value: "dashboard",
    component: <Dashboard />,
  },
];

export function Base({ role }) {
  const settings = role == "Instructor" ? instructor_tabs : student_tabs;
  // const settings =instructor_tabs;

  return (
    <Tabs defaultValue={settings[0].value} className="space-y-4">
      <TabsList>
        {settings.map((tab) => (
          <TabsTrigger key={tab.name} value={tab.value}>{tab.name}</TabsTrigger>
        ))}
      </TabsList>

      {settings.map((tab) => (
        <TabsContent value={tab.value}>{tab.component}</TabsContent>
      ))}
    </Tabs>
  );
}
