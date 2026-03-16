import Anthropic from '@anthropic-ai/sdk'

// Singleton — solo para Server Components y API routes
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
