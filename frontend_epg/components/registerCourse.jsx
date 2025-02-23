"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

const frameworks = [
  { value: "next.js", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt", label: "Nuxt.js" },
  { value: "remix", label: "Remix" },
  { value: "astro", label: "Astro" },
  { value: "gatsby", label: "Gatsby" },
]

export default function RegisterCourseForm({ courseCanvasId, title, description, instructorCanvasId }) {
  const [open, setOpen] = React.useState(false)
  const [selectedValues, setSelectedValues] = React.useState([])

  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <h2 className="text-lg font-medium">Configure Free Passes for {title}</h2>
        <p className="text-sm text-muted-foreground">Choose Free Passes</p>
      </div>

            <div>
              <p><strong>Course Canvas ID:</strong> {courseCanvasId}</p>
              <p><strong>Title:</strong> {title}</p>
              <p><strong>Description:</strong> {description}</p>
              <p><strong>Instructor Canvas ID:</strong> {instructorCanvasId}</p>
            </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedValues.length === 0 ? "Select frameworks..." : `${selectedValues.length} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search frameworks..." />
            <CommandList>
              <CommandEmpty>No framework found.</CommandEmpty>
              <CommandGroup>
                {frameworks.map((framework) => (
                  <CommandItem
                    key={framework.value}
                    onSelect={() => {
                      setSelectedValues((prev) => {
                        const newValues = prev.includes(framework.value)
                          ? prev.filter((value) => value !== framework.value)
                          : [...prev, framework.value]
                        return newValues
                      })
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValues.includes(framework.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {framework.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => {
                setSelectedValues((prev) => prev.filter((v) => v !== value))
              }}
            >
              {frameworks.find((f) => f.value === value)?.label}
              <span className="ml-1">×</span>
            </Badge>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => {
          console.log("Selected values:", selectedValues)
        }}
      >
        Submit
      </Button>
    </div>
  )
}

