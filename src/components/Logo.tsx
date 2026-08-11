import { cn } from "@/utils/cn";
import { logoDataUrl } from "@/assets/logoData";

/**
 * Logo Marca RS TURISMO — Logo oficial (RS estilizado + carro + palmeira + arco)
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
        className="shrink-0 h-auto w-auto object-contain rounded-lg bg-black"
        style={{ height: size }}
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

/** Apenas o ícone da logo oficial. */
export function LogoIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoDataUrl}
      alt="RS TURISMO"
      className={cn("shrink-0 h-auto w-auto object-contain rounded-xl bg-black", className)}
      style={{ height: size }}
    />
  );
}
