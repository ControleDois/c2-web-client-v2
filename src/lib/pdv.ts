// Endereço do PDV (Venda Rápida): app separado, abre em outra aba.
export const PDV_URL = (import.meta.env.VITE_PDV_URL ?? 'https://pdv.controledois.com.br').replace(/\/+$/, '')
