import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://igvbzmokviuctnzfjdbq.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlndmJ6bW9rdml1Y3RuemZqZGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzgxODksImV4cCI6MjA5MDg1NDE4OX0.U4IW--2xlZSc5lBuqA48JiFgHhniA81RKXDvDXs5vY0"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)