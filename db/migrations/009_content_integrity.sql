-- 009_content_integrity.sql
-- Content-integrity signature (#3, Phase 5).
--
-- At generation time we compute a SHA-256 over a canonical payload that binds
-- the rendered PDF bytes to the certificate's identifying fields (number,
-- recipient, issue date, org). We store that digest here and surface it on the
-- public verification page, so anyone holding the PDF can re-hash it and confirm
-- the document was not altered after issue (tamper-evidence).
--
-- NOTE: this is a content-integrity hash, NOT a PAdES/PKCS#7 PDF signature.
-- It proves the bytes match what we issued; it is not an X.509-backed digital
-- signature that PDF readers render a trust badge for. A full PAdES signer is
-- tracked separately in the ROADMAP.
--
-- integrity_alg records the algorithm so the scheme can evolve. Run in Supabase.

alter table public.certificates
  add column if not exists integrity_hash text,
  add column if not exists integrity_alg  text;
