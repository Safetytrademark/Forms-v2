// ── Supabase Client ───────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://aacrsnljubmmqqxfknzp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY3JzbmxqdWJtbXFxeGZrbnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjA1MDQsImV4cCI6MjA5NDA5NjUwNH0.tIotETY8vPRju5gS4iYcqwpBoBz3XH1NhyCjN_tvXTY';

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Company invite code (used on login.html for self-registration) ─────────────
// Change this value to rotate the invite code. Anyone with this code can register.
const INVITE_CODE = 'TM-CREW-9X4W';

// ── EmailJS — delivery request email notifications ────────────────────────────
// 1. Create a free account at https://emailjs.com
// 2. Add your Gmail (or other) as a Service → copy the Service ID
// 3. Create a template with variables: {{project}} {{foreman}} {{type}} {{needed_by}} {{items}} {{notes}}
// 4. Copy your Public Key from Account > API Keys
// Then fill in the three values below:
window.EMAILJS_PUBLIC_KEY  = 'd2h5KAQWKq-NCZHC4';
window.EMAILJS_SERVICE_ID  = 'service_z19qi6i';
window.EMAILJS_TEMPLATE_ID = 'template_aarp977';
