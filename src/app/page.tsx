"use client";

import { useRouter } from "next/navigation";
import { WaveformIcon, UsersIcon, LockIcon, SparklesIcon } from "@/components/icons";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-surface-dim">
      <div className="w-full max-w-md">
        <div className="surface-card-elevated p-8 text-center">
          {/* App Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/15 flex items-center justify-center">
            <WaveformIcon size={40} className="text-primary" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-on-surface mb-2">
            Echo Legacy
          </h1>
          <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
            Preserve your family&apos;s stories, one voice at a time.
            Record, transcribe, and share memories across generations.
          </p>

          {/* Benefits */}
          <div className="space-y-4 mb-8">
            <BenefitRow
              icon={<WaveformIcon size={20} className="text-primary" />}
              title="Record voice stories"
              description="Simple one-tap recording, up to 10 minutes daily"
            />
            <BenefitRow
              icon={<SparklesIcon size={20} className="text-primary" />}
              title="Auto-transcribe & tag"
              description="AI-powered transcription, summaries, and smart tags"
            />
            <BenefitRow
              icon={<UsersIcon size={20} className="text-primary" />}
              title="Share with family"
              description="Invite family members to listen and explore together"
            />
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push("/login")}
            className="btn-primary w-full text-base font-medium"
          >
            Get Started
          </button>

          <p className="mt-4 text-xs text-on-surface-variant/60">
            Free to start &middot; 3 recordings included
          </p>
        </div>

        {/* Privacy note */}
        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-on-surface-variant/50">
          <LockIcon size={12} />
          <span>Your stories are private and secure</span>
        </div>
      </div>
    </div>
  );
}

function BenefitRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 text-left">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant/70 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
