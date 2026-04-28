import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://heeroai-lohios-projects.vercel.app'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/auth/login',
        disallow: ['/admin/', '/dev/', '/api/', '/empleado/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
