import { useEffect, useRef, useState, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BLOG_URL,
  createBlogPost,
  fetchBlogPost,
  updateBlogPost,
  uploadBlogImage,
  type BlogPostPayload,
} from '../lib/blogPosts'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { ChevronLeftIcon, TagIcon, PaperclipIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface BlogPostFormPageProps {
  session: AuthSession
  postId?: string
  onBack: () => void
  onSaved: () => void
}

const textareaClass =
  'w-full rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]'

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

// ISO (do servidor) <-> valor do <input type="datetime-local"> no horário do navegador.
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const empty = (value: string) => (value.trim() ? value.trim() : null)

export function BlogPostFormPage({ session, postId, onBack, onSaved }: BlogPostFormPageProps) {
  const token = session.token.token
  const [loading, setLoading] = useState(Boolean(postId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [author, setAuthor] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [coverAlt, setCoverAlt] = useState('')
  const [status, setStatus] = useState(0)
  const [publishedAt, setPublishedAt] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [uploading, setUploading] = useState<'cover' | 'inline' | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const inlineInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!postId) return
    let cancelled = false
    fetchBlogPost(token, postId)
      .then((post) => {
        if (cancelled) return
        setTitle(post.title ?? '')
        setSlug(post.slug ?? '')
        setExcerpt(post.excerpt ?? '')
        setContent(post.content ?? '')
        setCategory(post.category ?? '')
        setTags((post.tags ?? []).join(', '))
        setAuthor(post.author_name ?? '')
        setCoverUrl(post.cover_url ?? '')
        setCoverAlt(post.cover_alt ?? '')
        setStatus(post.status ?? 0)
        setPublishedAt(isoToLocalInput(post.published_at))
        setSeoTitle(post.seo_title ?? '')
        setSeoDescription(post.seo_description ?? '')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o artigo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [postId, token])

  // Edita o texto na posição do cursor: envolve a seleção (negrito, link...) ou põe um prefixo na linha (título, lista...).
  function wrapSelection(before: string, after = '', placeholder = '') {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = content.slice(start, end) || placeholder
    setContent(content.slice(0, start) + before + selected + after + content.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function prefixLine(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    setContent(content.slice(0, lineStart) + prefix + content.slice(lineStart))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  async function handleImage(file: File | undefined, target: 'cover' | 'inline') {
    if (!file) return
    setUploading(target)
    setError(null)
    try {
      const { url } = await uploadBlogImage(token, file)
      if (target === 'cover') {
        setCoverUrl(url)
      } else {
        setTab('write')
        const el = textareaRef.current
        const position = el ? el.selectionStart : content.length
        const markdown = `\n\n![${file.name.replace(/\.[^.]+$/, '')}](${url})\n\n`
        setContent(content.slice(0, position) + markdown + content.slice(position))
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(null)
      if (coverInput.current) coverInput.current.value = ''
      if (inlineInput.current) inlineInput.current.value = ''
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (title.trim().length < 3) {
      setError('Informe o título do artigo.')
      return
    }
    if (status === 1 && !content.trim()) {
      setError('Escreva o texto do artigo antes de publicar.')
      return
    }

    const payload: BlogPostPayload = {
      title: title.trim(),
      slug: slug.trim() ? slugify(slug) : null,
      excerpt: empty(excerpt),
      content,
      cover_url: empty(coverUrl),
      cover_alt: empty(coverAlt),
      category: empty(category),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      author_name: empty(author),
      status,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      seo_title: empty(seoTitle),
      seo_description: empty(seoDescription),
    }

    setSubmitting(true)
    try {
      if (postId) await updateBlogPost(token, postId, payload)
      else await createBlogPost(token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o artigo.')
    } finally {
      setSubmitting(false)
    }
  }

  const toolbar: { label: string; title: string; action: () => void }[] = [
    { label: 'T1', title: 'Título', action: () => prefixLine('## ') },
    { label: 'T2', title: 'Subtítulo', action: () => prefixLine('### ') },
    { label: 'N', title: 'Negrito', action: () => wrapSelection('**', '**', 'texto') },
    { label: 'I', title: 'Itálico', action: () => wrapSelection('*', '*', 'texto') },
    { label: '• Lista', title: 'Lista', action: () => prefixLine('- ') },
    { label: '1. Lista', title: 'Lista numerada', action: () => prefixLine('1. ') },
    { label: '❝', title: 'Citação', action: () => prefixLine('> ') },
    { label: 'Link', title: 'Link', action: () => wrapSelection('[', '](https://)', 'texto do link') },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para o blog
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Blog</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {postId ? 'Editar artigo' : 'Novo artigo'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Artigo</h2>
            <div className="flex flex-col gap-4">
              <TextField
                label="Título"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: Como emitir NFC-e com CPF na nota"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Resumo (aparece na lista e no Google)</span>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                  placeholder="Duas ou três frases que resumem o artigo"
                  className={textareaClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Categoria"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Fiscal, PDV, Financeiro"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                />
                <TextField
                  label="Etiquetas (separadas por vírgula)"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="nfc-e, pdv"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
                <TextField
                  label="Autor"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Equipe Controle Dois"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Imagem de capa</h2>
            <div className="flex flex-wrap items-start gap-4">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="h-28 w-48 flex-none rounded-xl object-cover" />
              ) : (
                <div className="flex h-28 w-48 flex-none items-center justify-center rounded-xl bg-[var(--page)] text-[12px] text-[var(--muted)]">
                  Sem capa
                </div>
              )}
              <div className="flex min-w-[240px] flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => void handleImage(event.target.files?.[0], 'cover')}
                  />
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    disabled={uploading !== null}
                    className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
                  >
                    <PaperclipIcon className="h-4 w-4" />
                    {uploading === 'cover' ? 'Enviando…' : 'Enviar imagem'}
                  </button>
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverUrl('')}
                      className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <TextField
                  label="Descrição da imagem (acessibilidade)"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Tela do PDV com o CPF na nota"
                  value={coverAlt}
                  onChange={(event) => setCoverAlt(event.target.value)}
                />
                <p className="text-[12px] text-[var(--muted)]">JPG, PNG, WebP ou GIF de até 5 MB. Tamanho ideal: 1200 x 675.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Texto</h2>
              <div className="flex rounded-xl bg-[var(--page)] p-1">
                {(
                  [
                    { value: 'write', label: 'Escrever' },
                    { value: 'preview', label: 'Pré-visualizar' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTab(option.value)}
                    className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                      tab === option.value ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'write' ? (
              <>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {toolbar.map((button) => (
                    <button
                      key={button.label}
                      type="button"
                      title={button.title}
                      onClick={button.action}
                      className="rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-soft)] hover:bg-[var(--blue-100)] hover:text-[var(--blue-700)]"
                    >
                      {button.label}
                    </button>
                  ))}
                  <input
                    ref={inlineInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => void handleImage(event.target.files?.[0], 'inline')}
                  />
                  <button
                    type="button"
                    onClick={() => inlineInput.current?.click()}
                    disabled={uploading !== null}
                    className="rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-soft)] hover:bg-[var(--blue-100)] hover:text-[var(--blue-700)] disabled:opacity-60"
                  >
                    {uploading === 'inline' ? 'Enviando…' : 'Imagem'}
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  rows={22}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={'Escreva o artigo aqui. Use os botões acima ou o formato Markdown:\n\n## Título de seção\n\nParágrafo com **negrito** e [link](https://controledois.com.br).'}
                  className={`${textareaClass} font-mono leading-relaxed`}
                />
              </>
            ) : (
              <div className="blog-preview min-h-[320px] rounded-xl bg-[var(--page)] p-5">
                {content.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">Nada para mostrar ainda.</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Publicação e Google</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Situação" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                <option value={0}>Rascunho (não aparece no blog)</option>
                <option value={1}>Publicado</option>
              </SelectField>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de publicação</span>
                <input
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(event) => setPublishedAt(event.target.value)}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
                />
                <span className="text-[11.5px] text-[var(--muted)]">Vazio = publica agora. Data futura agenda o artigo.</span>
              </label>
              <TextField
                label="Endereço (slug)"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder={title ? slugify(title) : 'gerado a partir do título'}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              Endereço final: {BLOG_URL}/{slug.trim() ? slugify(slug) : title ? slugify(title) : '…'}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TextField
                label="Título para o Google (opcional)"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Se vazio, usa o título do artigo"
                maxLength={200}
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição para o Google (opcional)</span>
                <textarea
                  rows={2}
                  maxLength={320}
                  value={seoDescription}
                  onChange={(event) => setSeoDescription(event.target.value)}
                  placeholder="Se vazia, usa o resumo"
                  className={textareaClass}
                />
              </label>
            </div>
          </div>

          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}
          {notice && <p className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--blue-700)]">{notice}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || uploading !== null}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : status === 1 ? 'Salvar e publicar' : 'Salvar rascunho'}
            </button>
            <button type="button" onClick={onBack} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
