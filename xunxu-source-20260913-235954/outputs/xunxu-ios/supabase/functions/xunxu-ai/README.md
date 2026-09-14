# xunxu-ai

Authenticated Supabase Edge Function for the mobile app's Doubao requests.

Required function secrets:

- `ARK_API_KEY`
- `ARK_MODEL`

The function must be deployed with JWT verification enabled. The client sends
the current Supabase user session and never receives either Ark secret.
