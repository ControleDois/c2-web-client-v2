import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LoanCustomerPage } from './pages/loan/LoanCustomerPage.tsx'

// Rota pública sem autenticação — o painel autenticado (App.tsx) não usa
// roteador nenhum, então essa única rota pública é resolvida direto aqui,
// antes de montar o app normal, lendo o token da empresa na própria URL.
const loanMatch = window.location.pathname.match(/^\/emprestimo\/([^/]+)\/?$/)

const rootContent = loanMatch ? (
  <LoanCustomerPage companyToken={decodeURIComponent(loanMatch[1])} />
) : (
  <App />
)

createRoot(document.getElementById('root')!).render(<StrictMode>{rootContent}</StrictMode>)
