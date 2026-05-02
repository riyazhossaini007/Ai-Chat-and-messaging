type DateSeparatorProps = {
  text: string;
};

export default function DateSeparator({ text }: DateSeparatorProps) {
  return (
    <div className="flex justify-center my-4">
      <div className="bg-slate-700/40 text-slate-300 text-xs px-3 py-1 rounded-full backdrop-blur">
        {text}
      </div>
    </div>
  );
}

