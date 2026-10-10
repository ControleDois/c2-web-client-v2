import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LoanCustomerPage } from './pages/loan/LoanCustomerPage.tsx'
import { SignaturePage } from './pages/signature/SignaturePage.tsx'
import { CoraCallbackPage } from './pages/cora/CoraCallbackPage.tsx'

// Rotas públicas sem autenticação — o painel autenticado (App.tsx) não usa
// roteador nenhum, então essas rotas públicas são resolvidas direto aqui,
// antes de montar o app normal, lendo o token/parâmetro na própria URL.
const loanMatch = window.location.pathname.match(/^\/emprestimo\/([^/]+)\/?$/)
const signatureMatch = window.location.pathname.match(/^\/assinar\/([^/]+)\/?$/)
const coraCallback = /^\/cora\/callback\/?$/.test(window.location.pathname)

const rootContent = loanMatch ? (
  <LoanCustomerPage companyToken={decodeURIComponent(loanMatch[1])} />
) : signatureMatch ? (
  <SignaturePage token={decodeURIComponent(signatureMatch[1])} />
) : coraCallback ? (
  <CoraCallbackPage />
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(<StrictMode>{rootContent}</StrictMode>)
