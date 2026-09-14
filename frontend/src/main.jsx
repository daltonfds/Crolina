import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  LoaderCircle,
  Sparkles,
  AlertCircle,
  RefreshCw,
  LogIn,
  UserPlus,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import "./style.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Variáveis VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY não configuradas.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = "crolina-files";
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "docx",
  "txt",
  "md",
  "csv",
  "xlsx",
  "xls",
  "json",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "webp",
];

function Block({ title, items = [] }) {
  if (!items || !items.length) return null;

  return (
    <div className="block">
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [file, setFile] = useState(null);
  const [creator, setCreator] = useState("");
  const [title, setTitle] = useState("");

  const [doc, setDoc] = useState(null);
  const [docs, setDocs] = useState([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [exporting, setExporting] = useState("");

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (newSession) {
        loadDocuments(newSession.user.id);
      } else {
        setDocs([]);
        setDoc(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkSession() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    setSession(currentSession);

    if (currentSession) {
      await loadDocuments(currentSession.user.id);
    }
  }

  async function authenticate(event) {
    event.preventDefault();

    setAuthError("");
    setAuthBusy(true);

    try {
      if (!email || !password) {
        throw new Error("Preencha email e senha.");
      }

      if (authMode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setAuthError(
            "Conta criada. Verifique o seu email para confirmar a conta."
          );
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) throw signInError;
      }
    } catch (err) {
      setAuthError(err.message || "Não foi possível autenticar.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setDocs([]);
    setDoc(null);
  }

  async function loadDocuments(userId) {
    const { data, error: queryError } = await supabase
      .from("documents")
      .select(
        `
        id,
        creator_name,
        title,
        source_filename,
        source_mime,
        source_size,
        status,
        summary,
        key_points,
        topics,
        interesting_points,
        presentation,
        development,
        resolution,
        error_message,
        created_at,
        updated_at
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (queryError) {
      console.error(queryError);
      return;
    }

    setDocs(data || []);
  }

  function validateFile(selectedFile) {
    if (!selectedFile) {
      throw new Error("Selecione um arquivo.");
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      throw new Error("O arquivo ultrapassa o limite de 500 MB.");
    }

    const extension =
      selectedFile.name.split(".").pop()?.toLowerCase() || "";

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error(
        "Formato não suportado. Envie PDF, DOCX, TXT, MD, CSV, XLSX, XLS, JSON, PPTX ou imagem."
      );
    }
  }

  async function uploadFile(selectedFile, userId) {
    const extension =
      selectedFile.name.split(".").pop()?.toLowerCase() || "bin";

    const safeName = selectedFile.name
      .replace(/[^\w.\- ]/g, "_")
      .replace(/\s+/g, "_");

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const storagePath = `${userId}/${uniqueName}`;

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.access_token) {
      throw new Error("Sessão expirada. Entre novamente na Crolina.");
    }

    await new Promise((resolve, reject) => {
      const upload = new tus.Upload(selectedFile, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,

        retryDelays: [0, 3000, 5000, 10000, 20000],

        chunkSize: 6 * 1024 * 1024,

        headers: {
          authorization: `Bearer ${currentSession.access_token}`,
          apikey: SUPABASE_KEY,
          "x-upsert": "false",
        },

        metadata: {
          bucketName: BUCKET,
          objectName: storagePath,
          contentType:
            selectedFile.type || "application/octet-stream",
          cacheControl: "3600",
        },

        onError(error) {
          console.error("Erro no upload TUS:", error);
          reject(
            new Error(
              error?.message || "Não foi possível enviar o arquivo."
            )
          );
        },

        onProgress(bytesUploaded, bytesTotal) {
          const percentage = Math.round(
            (bytesUploaded / bytesTotal) * 100
          );

          console.log(`Upload: ${percentage}%`);
        },

        onSuccess() {
          resolve();
        },
      });

      upload.start();
    });

    return {
      storagePath,
      originalName: safeName,
    };
  }

  async function submit(event) {
    event.preventDefault();

    setError("");
    setDoc(null);

    if (!session) {
      setError("Entre na sua conta antes de enviar um documento.");
      return;
    }

    try {
      validateFile(file);
    } catch (err) {
      setError(err.message);
      return;
    }

    setBusy(true);

    try {
      const userId = session.user.id;

      const uploaded = await uploadFile(file, userId);

      const finalTitle =
        title.trim() ||
        file.name.replace(/\.[^/.]+$/, "");

      const { data: createdDocument, error: insertError } =
        await supabase
          .from("documents")
          .insert({
            user_id: userId,
            creator_name: creator.trim() || null,
            title: finalTitle,
            source_filename: file.name,
            source_mime: file.type || null,
            source_size: file.size,
            storage_path: uploaded.storagePath,
            source_storage_bucket: BUCKET,
            status: "uploaded",
          })
          .select("*")
          .single();

      if (insertError) {
        await supabase.storage
          .from(BUCKET)
          .remove([uploaded.storagePath]);

        throw insertError;
      }

      setDoc(createdDocument);

      const { error: functionError } =
        await supabase.functions.invoke("crolina-process", {
          body: {
            document_id: createdDocument.id,
          },
        });

      if (functionError) {
        console.error(functionError);
        throw new Error(
          functionError.message ||
            "Não foi possível iniciar o processamento."
        );
      }

      await pollDocument(createdDocument.id);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erro ao processar documento.");
    } finally {
      setBusy(false);
      await loadDocuments(session.user.id);
    }
  }

  async function pollDocument(documentId) {
    let attempts = 0;
    const maxAttempts = 240;

    while (attempts < maxAttempts) {
      attempts++;

      const { data, error: queryError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (queryError) {
        throw queryError;
      }

      setDoc(data);

      if (data.status === "completed") {
        return data;
      }

      if (data.status === "failed") {
        throw new Error(
          data.error_message || "A análise do documento falhou."
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(
      "O processamento está demorando mais do que o esperado. Atualize a página para verificar o estado."
    );
  }

  async function selectDocument(documentId) {
    setError("");

    const { data, error: queryError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setDoc(data);
  }

  async function processAgain() {
    if (!doc || !session) return;

    setError("");
    setBusy(true);

    try {
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          status: "uploaded",
          error_message: null,
        })
        .eq("id", doc.id)
        .eq("user_id", session.user.id);

      if (updateError) throw updateError;

      const { error: functionError } =
        await supabase.functions.invoke("crolina-process", {
          body: {
            document_id: doc.id,
          },
        });

      if (functionError) throw functionError;

      await pollDocument(doc.id);
      await loadDocuments(session.user.id);
    } catch (err) {
      setError(err.message || "Não foi possível processar novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function exportDocument(format) {
    if (!doc || doc.status !== "completed") return;

    setError("");
    setExporting(format);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("crolina-export", {
          body: {
            document_id: doc.id,
            format,
          },
        });

      if (functionError) throw functionError;

      if (!data?.download_url) {
        throw new Error("O servidor não devolveu o link de download.");
      }

      const response = await fetch(data.download_url);

      if (!response.ok) {
        throw new Error("Não foi possível baixar o arquivo.");
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        data.filename ||
        `${doc.title || "crolina-documento"}.${format}`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError(
        err.message || `Erro ao exportar ${format.toUpperCase()}.`
      );
    } finally {
      setExporting("");
    }
  }

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand">
            <div className="logo">C</div>

            <div>
              <b>Crolina</b>
              <small>Document Intelligence</small>
            </div>
          </div>

          <h1>
            Transforme documentos em
            <em> conhecimento organizado.</em>
          </h1>

          <p>
            Envie documentos, fotos ou arquivos e deixe a Crolina
            extrair, analisar e organizar o conteúdo.
          </p>

          <form onSubmit={authenticate}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Sua senha"
                autoComplete={
                  authMode === "login"
                    ? "current-password"
                    : "new-password"
                }
              />
            </label>

            {authError && (
              <div className="error">
                <AlertCircle />
                {authError}
              </div>
            )}

            <button disabled={authBusy}>
              {authBusy ? (
                <>
                  <LoaderCircle className="spin" />
                  Aguarde...
                </>
              ) : authMode === "login" ? (
                <>
                  <LogIn />
                  Entrar
                </>
              ) : (
                <>
                  <UserPlus />
                  Criar conta
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setAuthMode(
                authMode === "login" ? "register" : "login"
              );
              setAuthError("");
            }}
          >
            {authMode === "login"
              ? "Ainda não tenho conta"
              : "Já tenho uma conta"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header>
        <div className="brand">
          <div className="logo">C</div>

          <div>
            <b>Crolina</b>
            <small>Document Intelligence</small>
          </div>
        </div>

        <div className="header-actions">
          <span>Até 500 MB por arquivo</span>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">
            <Sparkles />
            IA PARA DOCUMENTOS
          </div>

          <h1>
            Transforme documentos em
            <em> conhecimento organizado.</em>
          </h1>

          <p>
            Envie fotos ou arquivos. A Crolina extrai o conteúdo,
            identifica pontos importantes e cria um documento final
            pronto para usar.
          </p>
        </section>

        <div className="grid">
          <section className="card">
            <h2>1. Enviar material</h2>

            <form onSubmit={submit}>
              <label className="drop">
                <Upload />

                <b>
                  {file
                    ? file.name
                    : "Clique para escolher um arquivo"}
                </b>

                <small>
                  PDF, DOCX, TXT, MD, CSV, XLSX, XLS, JSON,
                  PPTX e imagens
                </small>

                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.json,.pptx,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];

                    if (!selected) return;

                    try {
                      validateFile(selected);
                      setFile(selected);
                      setError("");
                    } catch (err) {
                      setFile(null);
                      setError(err.message);
                    }
                  }}
                />
              </label>

              <label>
                Nome do criador

                <input
                  value={creator}
                  onChange={(event) =>
                    setCreator(event.target.value)
                  }
                  placeholder="Seu nome"
                />
              </label>

              <label>
                Título

                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="Título do documento"
                />
              </label>

              {error && (
                <div className="error">
                  <AlertCircle />
                  {error}
                </div>
              )}

              <button disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle className="spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles />
                    Extrair e analisar
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="card">
            <h2>2. Resultado</h2>

            {!doc ? (
              <div className="empty">
                <FileText />
                <p>O resultado aparecerá aqui.</p>
              </div>
            ) : (
              <div>
                <div className="status">
                  {doc.status === "completed" ? (
                    <>
                      <CheckCircle />
                      Análise concluída
                    </>
                  ) : doc.status === "failed" ? (
                    <>
                      <AlertCircle />
                      Falhou
                    </>
                  ) : (
                    <>
                      <LoaderCircle className="spin" />
                      A processar...
                    </>
                  )}
                </div>

                <h3>{doc.title}</h3>

                {doc.creator_name && (
                  <p>
                    <strong>Criador:</strong>{" "}
                    {doc.creator_name}
                  </p>
                )}

                <p className="summary">
                  {doc.summary || "Aguarde a análise da Crolina..."}
                </p>

                {doc.status === "failed" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={processAgain}
                    disabled={busy}
                  >
                    <RefreshCw />
                    Tentar novamente
                  </button>
                )}

                {doc.status === "completed" && (
                  <>
                    <Block
                      title="Pontos importantes"
                      items={doc.key_points}
                    />

                    <Block
                      title="Tópicos"
                      items={doc.topics}
                    />

                    <Block
                      title="Pontos interessantes"
                      items={doc.interesting_points}
                    />

                    {doc.presentation && (
                      <>
                        <h4>Apresentação</h4>
                        <p>{doc.presentation}</p>
                      </>
                    )}

                    {doc.development && (
                      <>
                        <h4>Desenvolvimento</h4>
                        <p className="pre">
                          {doc.development}
                        </p>
                      </>
                    )}

                    {doc.resolution && (
                      <>
                        <h4>Resolução</h4>
                        <p>{doc.resolution}</p>
                      </>
                    )}

                    <div className="exports">
                      <b>Exportar documento:</b>

                      {["pdf", "docx", "txt"].map((format) => (
                        <button
                          type="button"
                          key={format}
                          disabled={Boolean(exporting)}
                          onClick={() =>
                            exportDocument(format)
                          }
                        >
                          {exporting === format ? (
                            <LoaderCircle className="spin" />
                          ) : (
                            <Download />
                          )}

                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="card history">
          <div className="history-header">
            <h2>Documentos recentes</h2>

            <button
              type="button"
              className="refresh-button"
              onClick={() =>
                session && loadDocuments(session.user.id)
              }
            >
              <RefreshCw />
              Atualizar
            </button>
          </div>

          {!docs.length ? (
            <div className="empty">
              <FileText />
              <p>Nenhum documento criado ainda.</p>
            </div>
          ) : (
            docs.map((item) => (
              <div
                className="row"
                key={item.id}
                onClick={() => selectDocument(item.id)}
              >
                <FileText />

                <div>
                  <b>{item.title}</b>
                  <small>{item.source_filename}</small>
                </div>

                <span className={`status-${item.status}`}>
                  {item.status}
                </span>
              </div>
            ))
          )}
        </section>
      
<a
  href="https://github.com/daltonfds/Crolina/releases/download/v1.0.0/Crolina.apk"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-700"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
  Baixar Crolina para Android
</a>

</main>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
