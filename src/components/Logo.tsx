import { cn } from "@/utils/cn";
import { logoDataUrl } from "@/assets/logoData";

/**
 * Logo "Vem Pra Porto" — onda do mar + sol do pôr do sol.
 * Pode ser usada como ícone (showText=false) ou com o nome da empresa.
 */
export function LogoMarca({
  size = 40,
  showText = true,
  className,
  textClassName,
  subClassName,
  subtitulo = "Controle de vouchers",
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
        alt="Vem Pra Porto — Porto Seguro, BA"
        width={size}
        height={size}
        className="shrink-0 rounded-xl object-contain"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-extrabold tracking-tight text-white", textClassName)}>
            Vem Pra Porto
          </p>
          <p className={cn("truncate text-[11px] text-sky-300", subClassName)}>
            {subtitulo}
          </p>
        </div>
      )}
    </div>
  );
}

/** Apenas o ícone da logo (onda + sol). */
export function LogoIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoDataUrl}
      alt="Vem Pra Porto — Porto Seguro, BA"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-xl object-contain", className)}
    />
  );
}

/*
  A marca oficial fica embutida no bundle para também estar disponível quando
  o voucher é gerado offline e dentro do PDF.
*/
/*
  SVG antigo removido: a imagem oficial é usada acima.
*/
