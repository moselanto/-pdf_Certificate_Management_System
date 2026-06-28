// PUBLIC certificate verification page — the QR code target.
// Server component: fetches from the public verify API and renders a clear
// "valid / not found / revoked" result. No login required.

import { headers } from "next/headers";

interface VerifyResult {
  valid: boolean;
  revoked?: boolean;
  certificateNumber?: string;
  recipientName?: string;
  issueDate?: string;
  organization?: string | null;
  course?: string | null;
  integrityHash?: string | null;
  integrityAlg?: string | null;
}

async function fetchVerification(
  number: string,
  token?: string,
): Promise<VerifyResult | null> {
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
  const url = `${base}/api/verify/${encodeURIComponent(number)}${
    token ? `?t=${encodeURIComponent(token)}` : ""
  }`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404 || res.status === 403) return { valid: false };
  if (!res.ok) return null;
  return res.json();
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: { number: string };
  searchParams: { t?: string };
}) {
  const result = await fetchVerification(params.number, searchParams.t);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-600" />
          <span className="text-lg font-bold text-gray-900">CertForge Verify</span>
        </div>

        {!result || !result.valid ? (
          <div>
            <div className="mb-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
              {result?.revoked ? "Certificate revoked" : "Not verified"}
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              We could not verify this certificate
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Certificate number <span className="font-mono">{params.number}</span>{" "}
              {result?.revoked
                ? "has been revoked by the issuing organization."
                : "was not found in our records. Please check the number and try again."}
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-2 inline-flex rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
              Verified authentic
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {result.recipientName}
            </h1>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Certificate No." value={result.certificateNumber} mono />
              {result.course && <Row label="Course" value={result.course} />}
              <Row
                label="Issued by"
                value={result.organization ?? "Pimofy Training Institute"}
              />
              {result.issueDate && (
                <Row
                  label="Issue date"
                  value={new Date(result.issueDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                />
              )}
            </dl>

            {result.integrityHash && (
              <div className="mt-5 rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                    {result.integrityAlg ?? "SHA-256"}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    Content integrity signature
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-gray-600">
                  {result.integrityHash}
                </p>
                <p className="mt-2 text-[11px] text-gray-500">
                  This fingerprint was computed from the certificate PDF at the
                  time it was issued. If you have the PDF, you can re-hash it and
                  confirm it matches to prove the document has not been altered.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Powered by CertForge · This page confirms the certificate exists in the
        issuer&apos;s records.
      </p>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right font-medium text-gray-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
