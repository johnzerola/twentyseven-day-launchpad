
CREATE TABLE public.oauth_state_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nonce text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_state_tokens ENABLE ROW LEVEL SECURITY;

-- No client-side policies needed — only service role accesses this table
