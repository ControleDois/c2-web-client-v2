import { apiGet, apiPost, apiPostForm, apiPut, apiDelete } from './api'

export const BLOG_URL = (import.meta.env.VITE_BLOG_URL ?? 'https://blog.controledois.com.br').replace(/\/+$/, '')

export const BLOG_STATUS_LABELS: Record<number, string> = {
  0: 'Rascunho',
  1: 'Publicado',
}

export interface BlogPostRecord {
  id: string
  code?: number
  title: string
  slug: string
  excerpt?: string | null
  content?: string
  cover_url?: string | null
  cover_alt?: string | null
  category?: string | null
  tags?: string[]
  author_name?: string | null
  status: number
  published_at?: string | null
  reading_minutes?: number
  seo_title?: string | null
  seo_description?: string | null
  created_at?: string
  updated_at?: string
}

export interface BlogPostPayload {
  title: string
  slug?: string | null
  excerpt: string | null
  content: string
  cover_url: string | null
  cover_alt: string | null
  category: string | null
  tags: string[]
  author_name: string | null
  status: number
  published_at?: string
  seo_title: string | null
  seo_description: string | null
}

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export const fetchBlogPosts = (
  token: string,
  options: { search?: string; status?: string; page?: number; limit?: number } = {}
) =>
  apiGet<Paginated<BlogPostRecord>>(
    '/blog-post',
    {
      search: options.search,
      status: options.status,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )

export const fetchBlogPost = (token: string, id: string) => apiGet<BlogPostRecord>(`/blog-post/${id}`, {}, token)
export const createBlogPost = (token: string, payload: BlogPostPayload) => apiPost<BlogPostRecord>('/blog-post', payload, token)
export const updateBlogPost = (token: string, id: string, payload: BlogPostPayload) =>
  apiPut<BlogPostRecord>(`/blog-post/${id}`, payload, token)
export const deleteBlogPost = (token: string, id: string) => apiDelete<void>(`/blog-post/${id}`, token)

export function uploadBlogImage(token: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiPostForm<{ url: string }>('/blog-post/image', form, token)
}
