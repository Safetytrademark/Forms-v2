// ── Login Page Logic ──────────────────────────────────────────────────────────
// Handles Sign In and Create Account on login.html.
// INVITE_CODE is defined in supabase-client.js

(async () => {
  // If already authenticated, forward to the app immediately
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    window.location.href = 'index.html';
    return;
  }

  // Focus email field on load
  document.getElementById('siEmail')?.focus();
})();

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(tab) {
  const isSignIn = tab === 'signin';

  document.getElementById('tabSignIn').classList.toggle('active',   isSignIn);
  document.getElementById('tabRegister').classList.toggle('active', !isSignIn);
  document.getElementById('formSignIn').classList.toggle('hidden',   !isSignIn);
  document.getElementById('formRegister').classList.toggle('hidden', isSignIn);

  document.getElementById('cardTitle').textContent = isSignIn
    ? 'Welcome back'
    : 'Create your account';
  document.getElementById('cardSub').textContent = isSignIn
    ? 'Sign in to your account to continue.'
    : 'Get access with your company invite code.';

  clearErrors();

  if (isSignIn) document.getElementById('siEmail')?.focus();
  else          document.getElementById('regName')?.focus();
}

// ── Sign In ───────────────────────────────────────────────────────────────────
async function handleSignIn() {
  const email    = document.getElementById('siEmail')?.value.trim()    ?? '';
  const password = document.getElementById('siPassword')?.value         ?? '';
  const btn      = document.getElementById('siBtn');
  const errEl    = document.getElementById('siError');

  if (!email || !password) {
    showError(errEl, 'Please fill in all fields.');
    return;
  }

  setLoading(btn, true, 'Signing in…');
  clearEl(errEl);

  const { error } = await sbClient.auth.signInWithPassword({ email, password });

  if (error) {
    showError(errEl, friendlyError(error.message));
    setLoading(btn, false, 'Sign In →');
    return;
  }

  // Success — hand off to app
  window.location.href = 'index.html';
}

// ── Register ──────────────────────────────────────────────────────────────────
async function handleRegister() {
  const name     = document.getElementById('regName')?.value.trim()     ?? '';
  const email    = document.getElementById('regEmail')?.value.trim()    ?? '';
  const password = document.getElementById('regPassword')?.value        ?? '';
  const code     = document.getElementById('regCode')?.value.trim()     ?? '';
  const btn      = document.getElementById('regBtn');
  const errEl    = document.getElementById('regError');
  const succEl   = document.getElementById('regSuccess');

  clearEl(errEl);
  clearEl(succEl);

  // Validate fields
  if (!name)     { showError(errEl, 'Please enter your full name.');    return; }
  if (!email)    { showError(errEl, 'Please enter your email.');        return; }
  if (password.length < 6) { showError(errEl, 'Password must be at least 6 characters.'); return; }
  if (!code)     { showError(errEl, 'Please enter the company invite code.'); return; }

  // Validate invite code
  if (code !== INVITE_CODE) {
    showError(errEl, 'Invalid company code. Ask your manager for the correct code.');
    return;
  }

  setLoading(btn, true, 'Creating account…');

  // Create auth account (trigger handle_new_user creates profile row automatically)
  const { error: signUpError } = await sbClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: 'foreman'
      }
    }
  });

  if (signUpError) {
    showError(errEl, friendlyError(signUpError.message));
    setLoading(btn, false, 'Create Account →');
    return;
  }

  // Show success briefly, then auto sign-in
  showEl(succEl, 'Account created! Signing you in…');
  setLoading(btn, true, 'Signing in…');

  // Auto sign-in (email confirmation is disabled in Supabase settings)
  const { error: signInError } = await sbClient.auth.signInWithPassword({ email, password });

  if (signInError) {
    // Edge case: account created but sign-in failed — ask user to sign in manually
    showError(errEl, 'Account created! Please sign in with your new credentials.');
    showTab('signin');
    document.getElementById('siEmail').value = email;
    setLoading(btn, false, 'Create Account →');
    return;
  }

  window.location.href = 'index.html';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = text;
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function showEl(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearEl(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.remove('show');
}

function clearErrors() {
  clearEl(document.getElementById('siError'));
  clearEl(document.getElementById('regError'));
  clearEl(document.getElementById('regSuccess'));
}

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (m.includes('user already registered')) return 'An account with this email already exists. Try signing in.';
  if (m.includes('password'))  return 'Password must be at least 6 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return msg;
}
