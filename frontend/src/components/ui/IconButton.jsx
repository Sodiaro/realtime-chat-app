import { forwardRef } from "react";

// Circular ghost icon button with a required accessible label.
const SIZES = { xs: "btn-xs", sm: "btn-sm", md: "", lg: "btn-lg" };

const IconButton = forwardRef(function IconButton(
  { label, size = "sm", active = false, className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`btn btn-ghost btn-circle ${SIZES[size] ?? ""} ${
        active ? "text-primary" : "text-base-content/60 hover:text-base-content"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default IconButton;
