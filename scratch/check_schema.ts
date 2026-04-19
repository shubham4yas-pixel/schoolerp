import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://igvbzmokviuctnzfjdbq.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlndmJ6bW9rdml1Y3RuemZqZGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzgxODksImV4cCI6MjA5MDg1NDE4OX0.U4IW--2xlZSc5lBuqA48JiFgHhniA81RKXDvDXs5vY0"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSchema() {
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("Error fetching students:", error);
    } else {
        console.log("Single student record columns:", Object.keys(data[0] || {}));
        console.log("Full record:", data[0]);
    }
}

checkSchema();
