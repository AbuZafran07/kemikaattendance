import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "lucide-react";
import { getOptimizedImageUrl, getInitials } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";

interface EmployeeAvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  fallbackClassName?: string;
  size?: "sm" | "md" | "lg";
  lazy?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const imageSizes = {
  sm: { width: 64, height: 64 },
  md: { width: 80, height: 80 },
  lg: { width: 96, height: 96 },
};

export const EmployeeAvatar = ({
  src,
  name = "",
  className,
  fallbackClassName = "bg-primary/10 text-primary",
  size = "md",
  lazy = true,
}: EmployeeAvatarProps) => {
  const [isLoading, setIsLoading] = useState(!!src);
  const [isVisible, setIsVisible] = useState(!lazy);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!lazy || !containerRef.current) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px",
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [lazy]);

  const optimizedSrc = src
    ? getOptimizedImageUrl(src, imageSizes[size])
    : "";

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div ref={containerRef} className={cn(sizeClasses[size], className)}>
      {isLoading && isVisible && (
        <Skeleton className={cn("rounded-full", sizeClasses[size])} />
      )}
      <Avatar
        className={cn(
          sizeClasses[size],
          isLoading && isVisible ? "hidden" : "animate-fade-in"
        )}
      >
        {isVisible && !hasError && optimizedSrc && (
          <AvatarImage
            src={optimizedSrc}
            alt={name || "Employee"}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
        <AvatarFallback className={fallbackClassName}>
          {name ? (
            getInitials(name)
          ) : (
            <User className="h-1/2 w-1/2" />
          )}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

export default EmployeeAvatar;
