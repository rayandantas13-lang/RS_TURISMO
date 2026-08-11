import { cn } from "@/utils/cn";
import { logoDataUrl } from "@/assets/logoData";

/**
 * Logo RS TURISMO — Sol laranja/amarelo com palmeira azul azul-piscina (conforme LOGO_VEM_PRA_PORTO.PNG)
 */
export function LogoMarca({
  size = 40,
  showText = true,
  className,
  textClassName,
  subClassName,
  subtitulo = "Turismo & Passeios",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  subClassName?: string;
  subtitulo?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoDataUrl}
        alt="RS TURISMO"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-contain bg-black"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className="min-w-0">
          <p className={cn("truncate text-[15px] font-extrabold tracking-tight text-white", textClassName)}>
            RS TURISMO
          </p>
          <p className={cn("truncate text-[11px] font-semibold tracking-wide text-orange-400", subClassName)}>
            {subtitulo}
          </p>
        </div>
      )}
    </div>
  );
}

/** Apenas o ícone da logo (sol + palmeira). */
export function LogoIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoDataUrl}
      alt="RS TURISMO"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-contain bg-black", className)}
    />
  );
}
