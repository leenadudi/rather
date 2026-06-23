"use client";

interface Props {
  date: string;
}

export function QuestionCard({ date }: Props) {
  return (
    <div className="text-center mb-8">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-widest mb-4">
        {date}
      </p>
      <h1 className="text-2xl font-bold text-text-primary leading-snug text-balance">
        would you rather
      </h1>
    </div>
  );
}
