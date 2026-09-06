You are adding Google Sign-In to a React 19 frontend (no backend API yet — mock everything).

## Requirements
1. Google Sign-In is the ONLY login method — no email/password form
2. Only @kmitl.ac.th emails are allowed (show restriction notice on UI)
3. Mock the entire backend call — do NOT call any real API
4. Store mock token + user in localStorage as `lab_token` and `lab_currentUser`
5. After login, redirect to dashboard ("/")

## Existing files (read before writing)

**src/pages/Login.jsx** — current email/password login form with:
- useState for email, password, loading, errors
- Calls useAuth().login(email, password)
- Framer motion animations
- toast.success/toast.error for feedback

**src/hooks/useAuth.jsx** — AuthContext with:
- `login(email, password)` — calls authService.login(), stores lab_token + lab_currentUser
- `logout()` — clears localStorage
- `currentUser`, `token`, `isAuthenticated`, `isLoading`
- Restores auth from localStorage on mount

**src/services/authService.js** — currently has:
- `authService.login(email, password)` — calls apiClient.post('/auth/login', { email, password })

**src/lib/apiClient.js** — fetch wrapper (NOT used in mock, but exists)
- Base URL `/api`, auto-attaches Bearer token from lab_token

**package.json** — react 19, @tanstack/react-query v5, framer-motion, sonner, lucide-react, etc.
**Does NOT have @react-oauth/google** — must be added

**src/main.jsx** — ReactDOM root with QueryClientProvider, BrowserRouter, AuthProvider, Toaster

## Implementation Steps

### 1. Install package

### 2. src/main.jsx
Wrap the app tree with GoogleOAuthProvider:
```jsx
import { GoogleOAuthProvider } from "@react-oauth/google";

// Must use VITE_GOOGLE_CLIENT_ID — set a dummy value for now:
// In .env: VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
// Or use a hardcoded placeholder

<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock-client-id"}>
  ...existing tree...
</GoogleOAuthProvider>
