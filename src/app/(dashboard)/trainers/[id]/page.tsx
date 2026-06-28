import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEMPLATE_BUCKET } from "@/lib/supabase/storage";
import { SignatureUpload } from "./SignatureUpload";
import { TrainerDetailsForm } from "./TrainerDetailsForm";

export default async function TrainerPage({ params }: { params: { id: string } }) {
  const db = createSupabaseServerClient();
  const { data: trainer } = await db
    .from("trainers")
    .select("id, name, title, institution, signature_path")
    .eq("id", params.id)
    .single();
  if (!trainer) notFound();

  // Signed URL to preview the current signature, if any.
  let signatureUrl: string | null = null;
  if (trainer.signature_path) {
    const { data: signed } = await db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(trainer.signature_path, 60 * 30);
    signatureUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{trainer.name}</h2>
        {trainer.title && <p className="text-sm text-gray-500">{trainer.title}</p>}
        {trainer.institution && (
          <p className="text-sm text-gray-500">{trainer.institution}</p>
        )}
      </div>
      <TrainerDetailsForm
        trainerId={trainer.id}
        initialName={trainer.name}
        initialTitle={(trainer.title as string | null) ?? ""}
        initialInstitution={(trainer.institution as string | null) ?? ""}
      />
      <SignatureUpload trainerId={trainer.id} currentSignatureUrl={signatureUrl} />
    </div>
  );
}
