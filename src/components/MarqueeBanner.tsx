const MarqueeBanner = () => {
  const text = "KEMIKA – Attendance & HR Management System";

  return (
    <div className="w-full bg-primary overflow-hidden flex-shrink-0">
      <div className="flex animate-marquee whitespace-nowrap py-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="text-xs font-semibold text-primary-foreground mx-8 tracking-wide">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MarqueeBanner;
