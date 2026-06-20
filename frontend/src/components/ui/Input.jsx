import { forwardRef } from "react";

// Text input with an optional leading icon. Always full-width and on-token.
const SIZES = { sm: "input-sm", md: "", lg: "input-lg" };

const Input = forwardRef(function Input(
  { icon: Icon, size = "md", className = "", ...props },
  ref
) {
  const base = `input input-bordered w-full ${SIZES[size] ?? ""} ${Icon ? "pl-9" : ""} ${className}`;
  if (!Icon) return <input ref={ref} className={base} {...props} />;
  return (
    <div className="relative">
      <Icon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
      <input ref={ref} className={base} {...props} />
    </div>
  );
});

export default Input;
