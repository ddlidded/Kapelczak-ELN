import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarWithFallbackProps {
  name?: string;
  src?: string;
  className?: string;
}

export function AvatarWithFallback({ name, src, className }: AvatarWithFallbackProps) {
  // Generate initials from name
  const initials = name
    ? name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : '?';

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {src && <AvatarImage src={src} alt={name || "User avatar"} />}
      <AvatarFallback>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
