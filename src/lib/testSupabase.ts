import { supabase } from './supabase'
async function testConnection() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .limit(1)

  if (error) {
    console.error("Connection error:", error)
  } else {
    console.log("Supabase connected:", data)
  }
}

testConnection()