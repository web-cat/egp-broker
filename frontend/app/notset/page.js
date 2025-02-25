import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import React from 'react'

function CourseNotSetPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="max-w-md w-full mx-auto">
        <CardHeader>
          <CardTitle>Notice</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-700">
            Free passes for this course have not been set up yet. Please contact your instructor.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default CourseNotSetPage