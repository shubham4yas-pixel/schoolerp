import { supabase } from "@/lib/supabase"

async function testStudents() {
    const { data, error } = await supabase
        .from("students")
        .select("*")

    console.log("DATA:", data)
    console.log("ERROR:", error)
}

testStudents()