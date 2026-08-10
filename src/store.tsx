import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Config, GastoOperacional, ID, Sessao, StatusVoucher, Usuario, Voucher } from "@/types";
import { api, modoLocal, versaoDesatualizada } from "@/api";
import { CONFIG_PADRAO } from "@/data/seed";
import { normalizarStatus, uid } from "@/lib/utils";

const SESSAO_KEY = "vempraporto.sessao";
const TEMPO_OCIOSO_MS = 30 * 60 * 1000;

/**
 * A sessão fica somente na aba atual. Não usamos localStorage para que um token
 * de acesso não continue gravado no computador depois que o navegador fechar.
 */
function lerSessao(): Sessao | null {
  try {
    // Descarta sessões persistentes criadas por versões antigas.
    localStorage.removeItem(SESSAO_KEY);
    const raw = sessionStorage.getItem(SESSAO_KEY);
    if (!raw) return null;
    const sessao = JSON.parse(raw) as Sessao;
    if (!sessao.token || !sessao.usuario || !sessao.usuario.papel || new Date(sessao.expiraEm).getTime() <= Date.now()) {
      sessionStorage.removeItem(SESSAO_KEY);
      return null;
    }
    return sessao;
  } catch {
    sessionStorage.removeItem(SESSAO_KEY);
    return null;
  }
}

function gravarSessao(s: Sessao | null) {
  localStorage.removeItem(SESSAO_KEY);
  if (s) sessionStorage.setItem(SESSAO_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSAO_KEY);
}

export interface Toast {
  id: string;
  msg: string;
  tone: "ok" | "erro" | "info";
}

interface Ctx {
  sessao: Sessao | null;
  usuario: Usuario | null;
  ehAdmin: boolean;
  verificando: boolean;
  carregando: boolean;
  local: boolean;
  erroCarga: string;
  /** true quando o Apps Script publicado é anterior ao Code.gs deste site. */
  apiDesatualizada: boolean;
  entrar: (s: Sessao) => void;
  sair: () => Promise<void>;
  recarregar: () => void;

  vouchers: Voucher[];
  gastos: GastoOperacional[];
  config: Config;

  salvarVoucher: (v: Voucher) => Promise<void>;
  removerVoucher: (id: ID) => Promise<void>;
  salvarGasto: (g: GastoOperacional) => Promise<void>;
  removerGasto: (id: ID) => Promise<void>;
  mudarStatus: (id: ID, status: StatusVoucher) => Promise<void>;
  salvarConfig: (c: Config) => Promise<void>;

  toasts: Toast[];
  notificar: (msg: string, tone?: Toast["tone"]) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(lerSessao);
  const [verificando, setVerificando] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState("");
  const [apiDesatualizada, setApiDesatualizada] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [gastos, setGastos] = useState<GastoOperacional[]>([]);
  const [config, setConfig] = useState<Config>(CONFIG_PADRAO);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notificar = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  useEffect(() => {
    const guardada = lerSessao();
    if (!guardada) {
      setVerificando(false);
      return;
    }
    api
      .eu(guardada.token)
      .then((usuario) => {
        const nova = { ...guardada, usuario };
        setSessao(nova);
        gravarSessao(nova);
      })
      .catch(() => {
        gravarSessao(null);
        setSessao(null);
      })
      .finally(() => setVerificando(false));
  }, []);

  useEffect(() => {
    if (!sessao) return;

    let ultimaAtividade = Date.now();
    const registrarAtividade = () => {
      ultimaAtividade = Date.now();
    };
    const eventos: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll"];
    eventos.forEach((evento) => window.addEventListener(evento, registrarAtividade, { passive: true }));

    const relogio = window.setInterval(() => {
      const expirou = new Date(sessao.expiraEm).getTime() <= Date.now();
      const ociosa = Date.now() - ultimaAtividade >= TEMPO_OCIOSO_MS;
      if (!expirou && !ociosa) return;

      void api.sair(sessao.token).catch(() => {});
      gravarSessao(null);
      setSessao(null);
      setVouchers([]);
      setConfig(CONFIG_PADRAO);
      notificar(
        expirou ? "Sua sessão expirou. Entre novamente." : "Sessão encerrada por inatividade.",
        "info",
      );
    }, 30_000);

    return () => {
      window.clearInterval(relogio);
      eventos.forEach((evento) => window.removeEventListener(evento, registrarAtividade));
    };
  }, [sessao, notificar]);

  useEffect(() => {
    if (!sessao) return;
    let cancelado = false;
    setCarregando(true);
    setErroCarga("");

    api
      .dados(sessao.token)
      .then((d) => {
        if (cancelado) return;
        // Status fora da lista (ex.: "confirmado" de versões antigas) é
        // normalizado para "pendente" para a tela nunca quebrar.
        setVouchers((d.vouchers ?? []).map((v) => ({ ...v, status: normalizarStatus(v.status) })));
        setGastos(d.gastos ?? []);
        setConfig({ ...CONFIG_PADRAO, ...(d.config ?? {}) });
        // Uma implantação antiga responde normalmente, mas descarta os campos
        // novos ao gravar. Avisamos para o texto não sumir sem explicação.
        setApiDesatualizada(!modoLocal() && versaoDesatualizada(d.versao));
      })
      .catch((e: unknown) => {
        if (!cancelado)
          setErroCarga(e instanceof Error ? e.message : "Não foi possível carregar os dados.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [sessao, recarga]);

  const token = sessao?.token ?? "";

  const executar = useCallback(
    async (fn: () => Promise<unknown>, ok: string, reverter: () => void) => {
      try {
        await fn();
        if (ok) notificar(ok);
      } catch (e) {
        reverter();
        notificar(e instanceof Error ? e.message : "Falha ao salvar.", "erro");
      }
    },
    [notificar],
  );

  const valor = useMemo<Ctx>(
    () => ({
      sessao,
      usuario: sessao?.usuario ?? null,
      ehAdmin: sessao?.usuario?.papel === "admin",
      verificando,
      carregando,
      local: modoLocal(),
      erroCarga,
      apiDesatualizada,

      entrar: (s) => {
        gravarSessao(s);
        setSessao(s);
      },
      sair: async () => {
        if (sessao) await api.sair(sessao.token).catch(() => {});
        gravarSessao(null);
        setSessao(null);
        setVouchers([]);
        setConfig(CONFIG_PADRAO);
      },
      recarregar: () => setRecarga((n) => n + 1),

      vouchers,
      gastos,
      config,

      salvarVoucher: async (v) => {
        const antes = vouchers;
        setVouchers((l) =>
          l.some((x) => x.id === v.id) ? l.map((x) => (x.id === v.id ? v : x)) : [v, ...l],
        );
        await executar(
          () => api.salvarVoucher(token, v),
          `Voucher ${v.codigo} salvo.`,
          () => setVouchers(antes),
        );
      },
      removerVoucher: async (id) => {
        const antes = vouchers;
        setVouchers((l) => l.filter((v) => v.id !== id));
        await executar(() => api.removerVoucher(token, id), "Voucher excluído.", () => setVouchers(antes));
      },
      salvarGasto: async (g) => {
        const antes = gastos;
        setGastos((l) => [g, ...l]);
        await executar(() => api.salvarGasto(token, g), "Gasto registrado.", () => setGastos(antes));
      },
      removerGasto: async (id) => {
        const antes = gastos;
        setGastos((l) => l.filter((g) => g.id !== id));
        await executar(() => api.removerGasto(token, id), "Gasto excluído.", () => setGastos(antes));
      },
      mudarStatus: async (id, status) => {
        const antes = vouchers;
        const alvo = vouchers.find((v) => v.id === id);
        if (!alvo) return;
        const novo = { ...alvo, status };
        setVouchers((l) => l.map((v) => (v.id === id ? novo : v)));
        await executar(() => api.salvarVoucher(token, novo), "", () => setVouchers(antes));
      },
      salvarConfig: async (c) => {
        const antes = config;
        setConfig(c);
        await executar(() => api.salvarConfig(token, c), "Configurações salvas.", () =>
          setConfig(antes),
        );
      },

      toasts,
      notificar,
    }),
    [
      sessao,
      verificando,
      carregando,
      erroCarga,
      apiDesatualizada,
      vouchers,
      gastos,
      config,
      toasts,
      token,
      executar,
      notificar,
    ],
  );

  return <StoreCtx.Provider value={valor}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore precisa estar dentro de StoreProvider");
  return ctx;
}
