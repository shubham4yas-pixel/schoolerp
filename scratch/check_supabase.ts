import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://igvbzmokviuctnzfjdbq.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlndmJ6bW9rdml1Y3RuemZqZGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzgxODksImV4cCI6MjA5MDg1NDE4OX0.U4IW--2xlZSc5lBuqA48JiFgHhniA81RKXDvDXs5vY0"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkData() {
    console.log("Checking Supabase data...");
    
    const { data: schools, error: schoolError } = await supabase
        .from('students')
        .select('school_id')
        .limit(10);
    
    if (schoolError) {
        console.error("Error fetching students:", schoolError);
    } else {
        console.log("Sample school_ids in students table:", schools.map(s => s.school_id));
    }

    const { count, error: countError } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error("Error counting students:", countError);
    } else {
        console.log("Total students in DB:", count);
    }
}

checkData();
