'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

// Envuelve cada página con un fade-in suave al navegar.
// No usa AnimatePresence+exit porque el App Router no desmonta
// la página anterior antes de montar la nueva.
export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
