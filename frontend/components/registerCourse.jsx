"use client"

import * as React from "react"
import MultiSelectPassCards from "./selectPasses"

export default function RegisterCourseForm({ courseCanvasId, title, description, instructorCanvasId, passes }) {
  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <h2 className="text-lg font-medium">Configure Free Passes for {title}</h2>
        <p className="text-sm text-muted-foreground">Choose One or More Free passes</p>
      </div>

      <div>
        <p><strong>Course Canvas ID:</strong> {courseCanvasId}</p>
        <p><strong>Title:</strong> {title}</p>
        <p><strong>Description:</strong> {description}</p>
        <p><strong>Instructor Canvas ID:</strong> {instructorCanvasId}</p>
      </div>

      <MultiSelectPassCards passes_base={passes} course={{
        courseCanvasId,
        title,
        description,
        instructorCanvasId,
      }} />
    </div>
  )
}