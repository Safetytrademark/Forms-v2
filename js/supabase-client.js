// ── Supabase Client ───────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://aacrsnljubmmqqxfknzp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3JzbmxqdWJtbXFxeGZrbnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjA1MDQsImV4cCI6MjA5NDA5NjUwNH0.tIotETY8vPRju5gS4iYcqwpBoBz3XH1NhyCjN_tvXTY';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Company invite code (used on login.html for self-registration) ─────────────
// Change this value to rotate the invite code. Anyone with this code can register.
const INVITE_CODE = 'TM-CREW-9X4W';

