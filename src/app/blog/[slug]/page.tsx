import 'server-only'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  // Legacy route no longer supported
  return {
    title: 'Blog Not Found',
    description: 'This blog route is no longer supported. Please use tenant-based URLs.'
  }
}

export default async function BlogPage() {
  // Legacy route - redirect to tenant-based routing
  // Since slug is no longer globally unique, we can't resolve blogs this way
  notFound()
}