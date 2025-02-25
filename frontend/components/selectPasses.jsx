"use client"

import { useState, useEffect } from "react"
import { Clock, MinusIcon, PlusIcon, Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { getLtik } from "@/lib/ltik"
import ky from "ky"

export default function MultiSelectPassCards({ passes_base, course }) {
    const [passes, setPasses] = useState([])
    const [selected, setSelected] = useState([])

    useEffect(() => {
        console.log("passes_base:", passes_base);
        if (passes_base) {
            const initializedPasses = passes_base.map((pass) => ({
                ...pass,
                quantity: 1,
            }))
            setPasses(initializedPasses)
        }
    }, [passes_base])

    const toggleSelect = (id) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((passId) => passId !== id) : [...prev, id]))
    }

    const updateQuantity = (id, increment) => {
        setPasses((prev) =>
            prev.map((pass) => {
                if (pass._id === id) {
                    const newQuantity = increment ? pass.quantity + 1 : Math.max(1, pass.quantity - 1)
                    return { ...pass, quantity: newQuantity }
                }
                return pass
            }),
        )
    }

    const onSubmission = async () => {
        course.allowedPassTypes = []
            passes.forEach((pass) => {
                if (selected.includes(pass._id)) {
                    course.allowedPassTypes.push({
                        passId: pass._id,
                        initialCount: pass.quantity,
                    })
                }
            }
        )
        console.log("course:", course)
        await ky.post("/api/course/add", {
            json: course,
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
        }).json()

        window.location.href = `/?ltik=${getLtik()}`
    }

    return (
        <div className="w-full">
                {passes.map((pass) => (
                    <Card
                        key={pass._id}
                        className={`relative transition-all mb-3 ${
                            selected.includes(pass._id) ? "border-primary shadow-lg scale-[1.02]" : "hover:border-primary/50"
                        }`}
                    >
                        <CardContent className="pt-6">
                            <div className="absolute top-4 right-4">
                                <Checkbox checked={selected.includes(pass._id)} onCheckedChange={() => toggleSelect(pass._id)} />
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">{pass.name}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{pass.description}</p>
                            {pass.details?.durationHours && (
                                <div className="flex items-center text-sm text-muted-foreground mb-4">
                                    <Clock className="w-4 h-4 mr-1" />
                                    Duration: {pass.details.durationHours} hours
                                </div>
                            )}
                            {selected.includes(pass._id) && (
                                <div className="flex items-center justify-between mt-4 border-t pt-4">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => updateQuantity(pass._id, false)}
                                    >
                                        <MinusIcon className="h-4 w-4" />
                                    </Button>
                                    <span className="font-medium text-lg">{pass.quantity}</span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => updateQuantity(pass._id, true)}
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            <div className="flex justify-center mt-6">
                <Button onClick={onSubmission}>
                    <Repeat className="w-4 h-4 mr-2" />
                    Submit
                </Button>
            </div>
            
        </div>
    )
}
