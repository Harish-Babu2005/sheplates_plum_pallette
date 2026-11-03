# Temporary direct customer/vendor signup patch

This patch removes the email OTP/verification step from the ShePlates customer and vendor self-signup UI.

## Behaviour
- New customer/vendor enters name, email and password.
- Server creates the Supabase Auth user with `email_confirm: true`.
- A matching `profiles` row is created.
- The browser signs in immediately with the submitted email/password.
- Existing users continue to use normal password sign-in.
- Operations/Super Admin accounts cannot be created through this public endpoint.
- Supabase `SUPABASE_SERVICE_ROLE_KEY` remains server-side only.

## Important
This intentionally skips proof of email ownership for new customer/vendor registrations. It is suitable for temporary UAT/client testing, not recommended for public production long-term. Re-enable verification before broad public launch.
