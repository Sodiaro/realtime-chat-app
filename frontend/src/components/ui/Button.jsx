import { forwardRef } from "react";

// Consistent button built on daisyUI tokens. Variants map to theme colors so
// every button in the app stays on-system.
const VARIANTS = {
  primary: "btn-primary",
  neutral: "btn-neutral",
  ghost: "btn-ghost",
  outline: "btn-outline",
  error: "btn-error btn-outline",
  success: "btn-success",
};
const SIZES = { xs: "btn-xs", sm: "btn-sm", md: "", lg: "btn-lg" };

const Button = forwardRef(function Button(
  { variant = "primary", size = "md", className = "", loading = false, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`btn ${VARIANTS[variant] ?? ""} ${SIZES[size] ?? ""} gap-2 normal-case font-medium ${className}`}
      {...props}
    >
      {loading && <span className="loading loading-spinner loading-sm" />}
      {children}
    </button>
  );
});

export default Button;
