"use client"

import * as React from "react"
import MultiSelectPassCards from "./selectPasses"

export default function RegisterCourseForm({ courseCanvasId, title, description, instructorCanvasId, passes }) {
  const [canvasApiKey, setCanvasApiKey] = React.useState("")

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

      <div className="space-y-2">
        <label htmlFor="canvas-api-key" className="text-sm font-medium">
          Canvas API Key
        </label>
        <input
          id="canvas-api-key"
          type="password"
          value={canvasApiKey}
          onChange={(e) => setCanvasApiKey(e.target.value)}
          placeholder="Enter your Canvas API key"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500">
          Your Canvas API key will be used to authenticate with Canvas services
        </p>
      </div>

      <MultiSelectPassCards passes_base={passes} course={{
        courseCanvasId,
        title,
        description,
        instructorCanvasId,
        canvasApiKey,
      }} />

      
    </div>
  )
}