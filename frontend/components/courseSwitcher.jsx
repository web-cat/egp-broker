"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import ky from "ky";

export function CourseSwitcher({ currentCourseId }) {
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        async function fetchCourses() {
            const response = await ky.get("/api/course/available-courses", { credentials: "include" }).json();
            setCourses(response.courses || []);
        }
        fetchCourses();
    }, []);

    const switchCourse = async (courseCanvasId) => {
        await ky.post("/auth/set-course", { json: { courseCanvasId }, credentials: "include" });
        window.location.reload();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    Switch Course <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {courses.map((course) => (
                    <DropdownMenuItem
                        key={course.canvasId}
                        onClick={() => switchCourse(course.canvasId)}
                        disabled={course.canvasId === currentCourseId}
                    >
                        {course.title}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}