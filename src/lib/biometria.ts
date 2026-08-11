/**
 * Biometria — WebAuthn (Face ID / Touch ID / leitor de digital).
 *
 * A chave privada fica no cofre do dispositivo (Secure Enclave / TPM) e nunca
 * sai dele. O que fica salvo aqui neste navegador é:
 *
 * - a chave PÚBLICA da credencial (COSE/EC2 P-256, extraída do registro);
 * - o id da credencial (usado nas próximas leituras);
 * - o "refresh token" emitido pelo servidor no momento da ativação — o token
 *   do usuário fica vinculado à chave pública deste dispositivo, e só é usado
 *   depois que o dispositivo prova que possui a chave privada correspondente
 *   (a leitura biométrica). O servidor guarda apenas o HMAC desse token.
 *
 * O armazenamento local é por dispositivo (cada navegador tem o seu), então a
 * tela de login reconhece exatamente o aparelho que ativou a biometria.
 *
 * WebAuthn exige contexto seguro (HTTPS ou localhost) e um autenticador de
 * plataforma (biometria nativa). Em navegadores/dispositivos sem suporte as
 * funções retornam false e o login continua sendo por usuário e senha.
 */

export interface CredencialBiometrica {
  usuarioId: string;
  usuario: string;
  nome: string;
  /** rawId da credencial em base64url (identifica a chave no dispositivo). */
  credentialId: string;
  /** Chave pública COSE (EC2/P-256) em base64url — o "par" da chave privada. */
  chavePublica: string;
  /** Contador de autenticações informado pelo autenticador no registro. */
  contador: number;
  /** Domínio onde a credencial foi registrada (location.hostname). */
  rpId: string;
  /** Origem completa registrada (location.origin). */
  origem: string;
  /** Token de longa duração emitido pelo servidor e vinculado à chave. */
  refreshToken: string;
  criadoEm: string;
}

export interface RegistroBiometrico {
  credentialId: string;
  chavePublica: string;
  contador: number;
  /** attestationObject bruto (base64url) — enviado ao servidor para validar. */
  attestationObject: string;
  /** clientDataJSON bruto (base64url) — enviado ao servidor para validar. */
  clientDataJSON: string;
}

export interface ProvaAutenticacao {
  credentialId: string;
  /** clientDataJSON bruto (base64url). */
  clientDataJSON: string;
  /** authenticatorData bruto (base64url). */
  authenticatorData: string;
  /** Assinatura ECDSA (DER ou r||s, em base64url). */
  signature: string;
}

const ARMAZENAMENTO_KEY = "vempraporto.biometria.v1";

/* ---------------- Detecção de suporte ---------------- */

/** WebAuthn exige HTTPS (ou localhost) e um navegador com PublicKeyCredential. */
export function suportada(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

/** true quando o aparelho tem autenticador de plataforma (Face ID/Touch ID/digital). */
export async function plataformaDisponivel(): Promise<boolean> {
  if (!suportada()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/* ---------------- Base64url ---------------- */

export function toBase64Url(dados: ArrayBuffer | Uint8Array | number[]): string {
  const bytes =
    dados instanceof Uint8Array
      ? dados
      : dados instanceof ArrayBuffer
        ? new Uint8Array(dados)
        : new Uint8Array(dados);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deBase64Url(valor: string): Uint8Array<ArrayBuffer> {
  const normalizado = valor.replace(/-/g, "+").replace(/_/g, "/");
  const completo = normalizado + "=".repeat((4 - (normalizado.length % 4)) % 4);
  const bin = atob(completo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ---------------- CBOR mínimo (só o que o WebAuthn precisa) ---------------- */

/** Byte string do CBOR (marcada para não confundir com texto). */
interface BytesCbor {
  b: number[];
}

function ehBytes(v: ValorCbor): v is BytesCbor {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "b" in v &&
    Array.isArray((v as BytesCbor).b)
  );
}

type ValorCbor =
  | number
  | string
  | boolean
  | null
  | BytesCbor
  | ValorCbor[]
  | { [chave: string]: ValorCbor };

function lerInteiroCbor(bytes: Uint8Array, pos: { i: number }, tamanho: number): number {
  let valor = 0;
  for (let k = 0; k < tamanho; k++) valor = valor * 256 + bytes[pos.i++];
  return valor;
}

export function lerCbor(bytes: Uint8Array, pos: { i: number } = { i: 0 }): ValorCbor {
  const b = bytes[pos.i++];
  const major = b >> 5;
  const info = b & 0x1f;
  let valor: number;
  if (info < 24) valor = info;
  else if (info === 24) valor = bytes[pos.i++];
  else if (info === 25) valor = lerInteiroCbor(bytes, pos, 2);
  else if (info === 26) valor = lerInteiroCbor(bytes, pos, 4);
  else if (info === 27) valor = lerInteiroCbor(bytes, pos, 8);
  else throw new Error("CBOR inválido.");

  switch (major) {
    case 0:
      return valor;
    case 1:
      return -1 - valor;
    case 2: {
      const arr: number[] = [];
      for (let k = 0; k < valor; k++) arr.push(bytes[pos.i++]);
      return { b: arr };
    }
    case 3: {
      let s = "";
      for (let k = 0; k < valor; k++) s += String.fromCharCode(bytes[pos.i++]);
      return s;
    }
    case 4: {
      const lista: ValorCbor[] = [];
      for (let k = 0; k < valor; k++) lista.push(lerCbor(bytes, pos));
      return lista;
    }
    case 5: {
      const mapa: Record<string, ValorCbor> = {};
      for (let k = 0; k < valor; k++) {
        const chave = String(lerCbor(bytes, pos));
        mapa[chave] = lerCbor(bytes, pos);
      }
      return mapa;
    }
    case 7:
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22) return null;
      throw new Error("CBOR não suportado.");
    default:
      throw new Error("CBOR não suportado.");
  }
}

/* ---------------- authData / registro ---------------- */

export interface AuthDataInfo {
  rpIdHash: number[];
  flags: number;
  contador: number;
}

/** Parse do authenticatorData: rpIdHash(32) | flags(1) | contador(4) [| credencial]. */
export function parseAuthData(authData: Uint8Array): AuthDataInfo {
  if (authData.length < 37) throw new Error("authenticatorData inválido.");
  return {
    rpIdHash: Array.from(authData.slice(0, 32)),
    flags: authData[32],
    contador: ((authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36]) >>> 0,
  };
}

/**
 * WebAuthn devolve a assinatura ES256 em ASN.1/DER. A API WebCrypto usa o
 * formato compacto r||s (64 bytes), enquanto alguns autenticadores/navegadores
 * já devolvem esse formato compacto. Aceitamos os dois para o modo local e
 * para manter o payload igual ao que o Apps Script valida.
 */
export function assinaturaEcdsaParaRaw(assinatura: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (assinatura.length === 64) {
    const bruto = new Uint8Array(64);
    bruto.set(assinatura);
    return bruto;
  }
  if (assinatura.length < 8 || assinatura[0] !== 0x30) return null;

  let pos = 1;
  let tamanho = assinatura[pos++];
  if (tamanho & 0x80) {
    const bytesTamanho = tamanho & 0x7f;
    if (!bytesTamanho || bytesTamanho > 2 || pos + bytesTamanho > assinatura.length) return null;
    tamanho = 0;
    for (let i = 0; i < bytesTamanho; i++) tamanho = tamanho * 256 + assinatura[pos++];
  }
  if (pos + tamanho !== assinatura.length) return null;

  const lerInteiro = (): Uint8Array | null => {
    if (pos >= assinatura.length || assinatura[pos++] !== 0x02 || pos >= assinatura.length) return null;
    let tamanhoInteiro = assinatura[pos++];
    if (tamanhoInteiro & 0x80) {
      const bytesTamanho = tamanhoInteiro & 0x7f;
      if (!bytesTamanho || bytesTamanho > 2 || pos + bytesTamanho > assinatura.length) return null;
      tamanhoInteiro = 0;
      for (let i = 0; i < bytesTamanho; i++) tamanhoInteiro = tamanhoInteiro * 256 + assinatura[pos++];
    }
    if (!tamanhoInteiro || pos + tamanhoInteiro > assinatura.length) return null;
    let inteiro = assinatura.slice(pos, pos + tamanhoInteiro);
    pos += tamanhoInteiro;
    // DER permite um zero apenas para manter o inteiro positivo.
    while (inteiro.length > 32 && inteiro[0] === 0) inteiro = inteiro.slice(1);
    if (inteiro.length > 32) return null;
    const resultado = new Uint8Array(32);
    resultado.set(inteiro, 32 - inteiro.length);
    return resultado;
  };

  const r = lerInteiro();
  const s = lerInteiro();
  if (!r || !s || pos !== assinatura.length) return null;
  const bruto = new Uint8Array(64);
  bruto.set(r, 0);
  bruto.set(s, 32);
  return bruto;
}

/**
 * Extrai do attestationObject (CBOR) a credencial criada: id, chave pública
 * COSE e os dados do authenticatorData (rpIdHash, flags, contador).
 */
export function extrairCredencialDoRegistro(
  attestationObject: ArrayBuffer | Uint8Array,
): { credentialId: number[]; chavePublicaCose: number[]; contador: number; rpIdHash: number[]; flags: number } {
  const bytes = attestationObject instanceof Uint8Array ? attestationObject : new Uint8Array(attestationObject);
  const mapa = lerCbor(bytes);
  const authDataItem = (mapa as Record<string, ValorCbor>)["3"];
  if (!ehBytes(authDataItem)) throw new Error("authenticatorData ausente.");
  const authData = new Uint8Array(authDataItem.b);
  const info = parseAuthData(authData);
  if ((info.flags & 0x40) === 0) throw new Error("Registro sem credencial.");

  const pos = { i: 37 };
  pos.i += 16; // aaguid
  const idLen = (authData[pos.i] << 8) | authData[pos.i + 1];
  pos.i += 2;
  const credentialId = Array.from(authData.slice(pos.i, pos.i + idLen));
  pos.i += idLen;
  const chavePublicaCose = Array.from(authData.slice(pos.i));
  return { credentialId, chavePublicaCose, contador: info.contador, rpIdHash: info.rpIdHash, flags: info.flags };
}

/* ---------------- Registro (ativação) ---------------- */

/**
 * Abre a janela nativa do aparelho (Face ID / Touch ID / leitor de digital)
 * e cria a credencial vinculada a este dispositivo. O desafio vem do servidor
 * (gerado em biometriaIniciarRegistro) — assim o registro é comprovável.
 */
export async function registrar(opts: {
  desafio: string;
  rpId: string;
  usuario: { id: string; usuario: string; nome: string };
  credenciaisExistentes?: string[];
}): Promise<RegistroBiometrico> {
  if (!suportada()) throw new Error("Este navegador não suporta biometria (WebAuthn).");

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: deBase64Url(opts.desafio),
      rp: { id: opts.rpId, name: "RS TURISMO" },
      user: {
        id: new TextEncoder().encode(opts.usuario.id),
        name: opts.usuario.usuario,
        displayName: opts.usuario.nome,
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 (P-256)
      timeout: 60_000,
      attestation: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      excludeCredentials: (opts.credenciaisExistentes ?? []).map((id) => ({
        id: deBase64Url(id),
        type: "public-key" as const,
      })),
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Registro de biometria cancelado.");
  const resposta = cred.response as AuthenticatorAttestationResponse;
  if (!resposta.attestationObject) throw new Error("Resposta de registro inválida.");

  const extraido = extrairCredencialDoRegistro(resposta.attestationObject);
  return {
    credentialId: toBase64Url(cred.rawId),
    chavePublica: toBase64Url(extraido.chavePublicaCose),
    contador: extraido.contador,
    attestationObject: toBase64Url(resposta.attestationObject),
    clientDataJSON: toBase64Url(resposta.clientDataJSON),
  };
}

/* ---------------- Autenticação (próximos logins) ---------------- */

/**
 * Faz a leitura biométrica rápida: o aparelho pede Face ID / Touch ID /
 * digital e devolve uma assinatura da credencial registrada (prova de posse
 * da chave privada). O desafio vem do servidor (biometriaDesafioLogin).
 */
export async function autenticar(opts: {
  desafio: string;
  rpId: string;
  credencialIds: string[];
}): Promise<ProvaAutenticacao> {
  if (!suportada()) throw new Error("Este navegador não suporta biometria (WebAuthn).");

  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: deBase64Url(opts.desafio),
      rpId: opts.rpId,
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: opts.credencialIds.map((id) => ({
        id: deBase64Url(id),
        type: "public-key" as const,
      })),
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Leitura biométrica cancelada.");
  const resposta = cred.response as AuthenticatorAssertionResponse;
  return {
    credentialId: toBase64Url(cred.rawId),
    clientDataJSON: toBase64Url(resposta.clientDataJSON),
    authenticatorData: toBase64Url(resposta.authenticatorData),
    signature: toBase64Url(resposta.signature),
  };
}

/**
 * Verifica a assinatura da leitura biométrica usando WebCrypto — usado pelo
 * banco local (modo demonstração), onde não existe servidor para validar.
 * Confere: tipo, desafio, origem, rpIdHash, flags (UP + UV) e a assinatura
 * ECDSA com a chave pública guardada no registro.
 */
export async function verificarAutenticacao(
  credencial: Pick<CredencialBiometrica, "origem" | "rpId" | "chavePublica">,
  prova: ProvaAutenticacao,
  desafio: string,
): Promise<boolean> {
  try {
    if (!globalThis.crypto?.subtle) return false;

    const cdjBytes = deBase64Url(prova.clientDataJSON);
    const cdj = JSON.parse(new TextDecoder().decode(cdjBytes)) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };
    if (cdj.type !== "webauthn.get") return false;
    if (cdj.challenge !== desafio) return false;
    if (cdj.origin !== credencial.origem) return false;

    const authData = deBase64Url(prova.authenticatorData);
    const info = parseAuthData(authData);
    const rpIdHash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credencial.rpId)),
    );
    if (!iguaisBytes(info.rpIdHash, rpIdHash)) return false;
    // UP (presença) e UV (verificação do usuário) precisam estar marcados.
    if ((info.flags & 0x01) === 0 || (info.flags & 0x04) === 0) return false;

    const chave = await importarChaveEcdsa(credencial.chavePublica);
    if (!chave) return false;

    const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", cdjBytes));
    const assinado = new Uint8Array(authData.length + clientDataHash.length);
    assinado.set(authData, 0);
    assinado.set(clientDataHash, authData.length);
    const assinatura = assinaturaEcdsaParaRaw(deBase64Url(prova.signature));
    if (!assinatura) return false;

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      chave,
      assinatura,
      assinado,
    );
  } catch {
    return false;
  }
}

async function importarChaveEcdsa(chavePublicaB64: string): Promise<CryptoKey | null> {
  try {
    const mapa = lerCbor(deBase64Url(chavePublicaB64)) as Record<string, ValorCbor>;
    const x = mapa["-2"];
    const y = mapa["-3"];
    if (!ehBytes(x) || !ehBytes(y)) return null;
    return await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: toBase64Url(x.b),
        y: toBase64Url(y.b),
        ext: false,
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }
}

function iguaisBytes(a: number[] | Uint8Array, b: number[] | Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ---------------- Armazenamento local (por dispositivo) ---------------- */

function lerRegistro(): CredencialBiometrica[] {
  try {
    const bruto = localStorage.getItem(ARMAZENAMENTO_KEY);
    if (!bruto) return [];
    const lista = JSON.parse(bruto) as unknown;
    if (!Array.isArray(lista)) return [];
    return lista.filter(
      (c): c is CredencialBiometrica =>
        !!c && typeof c === "object" && typeof (c as CredencialBiometrica).credentialId === "string",
    );
  } catch {
    return [];
  }
}

function gravarRegistro(lista: CredencialBiometrica[]) {
  try {
    localStorage.setItem(ARMAZENAMENTO_KEY, JSON.stringify(lista));
  } catch {
    /* sem armazenamento (modo privado, quota) — a biometria fica indisponível */
  }
}

/** Credenciais deste dispositivo (neste domínio) — reconhece o aparelho. */
export function credenciaisSalvas(): CredencialBiometrica[] {
  if (!suportada()) return [];
  const rpAtual = location.hostname;
  return lerRegistro().filter((c) => c.rpId === rpAtual);
}

export function jaAtivada(usuarioId: string): boolean {
  return credenciaisSalvas().some((c) => c.usuarioId === usuarioId);
}

/** Guarda a credencial + o token do usuário vinculado à chave pública. */
export function salvarCredencial(credencial: CredencialBiometrica) {
  const atual = lerRegistro();
  const demais = atual.filter(
    (x) => x.rpId !== credencial.rpId || x.credentialId !== credencial.credentialId,
  );
  demais.push(credencial);
  gravarRegistro(demais);
}

export function removerCredencialLocal(credentialId: string) {
  gravarRegistro(lerRegistro().filter((x) => x.credentialId !== credentialId));
}

export function removerTodasLocais() {
  const rpAtual = location.hostname;
  gravarRegistro(lerRegistro().filter((x) => x.rpId !== rpAtual));
}
